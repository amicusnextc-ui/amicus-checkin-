const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const REQUESTS_DB = 'd25f9fdaeeb748ac97ffda2f68f776bb';
const ABSENTEES_DB = 'de7bb42e89254fad949dde9123cd4cdb';
const STUDENT_DB = process.env.NOTION_STUDENT_DB || '107828732f784c39bcb0136a4397c758';
const TIMEZONE = 'America/Los_Angeles';

function getServiceSunday() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay();
  if (dow === 6) return null;
  const s = new Date(laDay);
  s.setUTCDate(laDay.getUTCDate() - dow);
  return s.toISOString().split('T')[0];
}

// Reference week for absentee contact logs — always returns a Sunday date.
// On Saturdays (when getServiceSunday returns null), use the most recent past Sunday
// so contact-log lookups and POSTs stay consistent across the week.
function getReferenceWeek() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay();
  const s = new Date(laDay);
  // dow=0(Sun)→0d back, 1(Mon)→1d, ... 6(Sat)→6d back (last Sunday)
  s.setUTCDate(laDay.getUTCDate() - dow);
  return s.toISOString().split('T')[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const type = req.query.type || (req.body && req.body.type);
  try {

    // REQUESTS
    if (type === 'requests') {
      if (req.method === 'GET') {
        const dept = req.query.department;
        const filter = (dept && dept !== 'all') ? { property: '부서 (Department)', select: { equals: dept } } : undefined;
        const r = await notion.databases.query({ database_id: REQUESTS_DB, sorts: [{ timestamp: 'created_time', direction: 'descending' }], ...(filter ? { filter } : {}) });
        const rows = r.results.map(p => { const pr = p.properties; return { id: p.id,
          title: pr['제목 (Title)']?.title?.[0]?.text?.content || '',
          content: pr['요청 내용 (Content)']?.rich_text?.[0]?.text?.content || '',
          requester: pr['요청자 (Requester)']?.rich_text?.[0]?.text?.content || '',
          department: pr['부서 (Department)']?.select?.name || '',
          status: pr['상태 (Status)']?.select?.name || '대기중',
          handler: pr['담당자 (Handler)']?.rich_text?.[0]?.text?.content || '',
          notes: pr['처리 메모 (Notes)']?.rich_text?.[0]?.text?.content || '',
          createdAt: p.created_time }; });
        return res.json({ success: true, requests: rows });
      }
      if (req.method === 'POST') {
        const { title, content, requester, department } = req.body;
        const p = await notion.pages.create({ parent: { database_id: REQUESTS_DB }, properties: {
          '제목 (Title)': { title: [{ text: { content: title || '요청' } }] },
          '요청 내용 (Content)': { rich_text: [{ text: { content: content || '' } }] },
          '요청자 (Requester)': { rich_text: [{ text: { content: requester || '' } }] },
          '부서 (Department)': { select: department ? { name: department } : null },
          '상태 (Status)': { select: { name: '대기중' } } } });
        return res.json({ success: true, id: p.id, action: 'created' });
      }
      if (req.method === 'PATCH') {
        const { id, status, handler, notes } = req.body;
        const props = {};
        if (status) props['상태 (Status)'] = { select: { name: status } };
        if (handler) props['담당자 (Handler)'] = { rich_text: [{ text: { content: handler } }] };
        if (notes !== undefined) props['처리 메모 (Notes)'] = { rich_text: [{ text: { content: notes } }] };
        if (status === '완료') props['완료일 (Completed)'] = { date: { start: new Date().toISOString().split('T')[0] } };
        await notion.pages.update({ page_id: id, properties: props });
        return res.json({ success: true, action: 'updated' });
      }
    }

    // ABSENTEES
    if (type === 'absentees') {
      if (req.method === 'GET') {
        const dept = req.query.department;
        const ss = getServiceSunday();
        const refWeek = getReferenceWeek(); // always defined (Sat→last Sunday)
        // Exclude visitors: visitors don't go in 연락 명단 (David policy)
        let andClauses = [
          { property: '상태 (Status)', select: { equals: '활성 (Active)' } },
          { property: '방문자 (Visitor)', checkbox: { equals: false } },
          { property: '부서 (Department)', select: { does_not_equal: '졸업' } }
        ];
        if (dept && dept !== 'all') andClauses.push({ property: '부서 (Department)', select: { equals: dept } });
        let filter = { and: andClauses };
        const students = await notion.databases.query({ database_id: STUDENT_DB, filter, page_size: 100 });
        const ago = new Date(refWeek);
        ago.setUTCDate(ago.getUTCDate() - 14);
        const cutoff = ago.toISOString().split('T')[0];
        const absentees = students.results.filter(p => { const last = p.properties['마지막 출석 (Last Attended)']?.date?.start; return !last || last <= cutoff; })
          .map(p => { const pr = p.properties; return { id: p.id, name: pr['이름 (Name)']?.title?.[0]?.text?.content || '', department: pr['부서 (Department)']?.select?.name || '', grade: pr['학년 (Grade)']?.rich_text?.[0]?.text?.content || '', lastAttended: pr['마지막 출석 (Last Attended)']?.date?.start || null }; });
        const cm = {};
        // Notion date filter index lags badly on recently-edited values (some records
        // don't surface even with on_or_after). Bypass entirely: pull recent records by
        // created_time and filter in app code.
        const recs = await notion.databases.query({ database_id: ABSENTEES_DB, sorts: [{ timestamp: 'created_time', direction: 'descending' }], page_size: 100 });
        recs.results.forEach(p => {
          const wk = p.properties['주간 기준일 (Week)']?.date?.start;
          if (wk !== refWeek) return;
          const name = p.properties['학생 이름 (Student)']?.title?.[0]?.text?.content;
          if (name && !cm[name]) {
            cm[name] = {
              contacted: p.properties['연락 여부 (Contacted)']?.select?.name || '미연락',
              reason: p.properties['연락 사유 / 메모 (Reason)']?.rich_text?.[0]?.text?.content || '',
              staff: p.properties['연락한 간사 (Staff)']?.rich_text?.[0]?.text?.content || '',
              recordId: p.id
            };
          }
        });
        const result = absentees.map(a => ({ ...a, ...(cm[a.name] || { contacted: '미연락' }) }));
        return res.json({ success: true, absentees: result, serviceSunday: ss, referenceWeek: refWeek, count: result.length });
      }
      if (req.method === 'POST') {
        const { studentName, department, grade, lastAttended, reason, staffName, recordId } = req.body;
        const ss = getServiceSunday();
        const refWeek = getReferenceWeek();
        const today = new Date().toISOString().split('T')[0];
        if (recordId) {
          await notion.pages.update({ page_id: recordId, properties: {
            '연락 여부 (Contacted)': { select: { name: '연락함' } },
            '연락 사유 / 메모 (Reason)': { rich_text: [{ text: { content: reason || '' } }] },
            '연락한 간사 (Staff)': { rich_text: [{ text: { content: staffName || '' } }] },
            '연락일 (Contact Date)': { date: { start: today } } } });
          return res.json({ success: true, action: 'updated' });
        }
        const props = {
          '학생 이름 (Student)': { title: [{ text: { content: studentName || '' } }] },
          '부서 (Department)': { rich_text: [{ text: { content: department || '' } }] },
          '학년 (Grade)': { rich_text: [{ text: { content: grade || '' } }] },
          '연락 여부 (Contacted)': { select: { name: '연락함' } },
          '연락 사유 / 메모 (Reason)': { rich_text: [{ text: { content: reason || '' } }] },
          '연락한 간사 (Staff)': { rich_text: [{ text: { content: staffName || '' } }] },
          '연락일 (Contact Date)': { date: { start: today } }
        };
        if (lastAttended) props['마지막 출석 (Last Attended)'] = { date: { start: lastAttended } };
        props['주간 기준일 (Week)'] = { date: { start: refWeek } };
        const p = await notion.pages.create({ parent: { database_id: ABSENTEES_DB }, properties: props });
        return res.json({ success: true, id: p.id, action: 'created' });
      }
    }
    // WRAP-UP REMINDER (manual send by director)
    if (type === 'wrapup-reminder') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      const RESEND_API_KEY = process.env.RESEND_API_KEY;
      if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not configured' });
      const DEPTS = {
        '유아부': { staff: '이지혜', email: 'wise0331@gmail.com' },
        '유치부': { staff: '김향숙', email: 'flower5425@gmail.com' },
        '유년부': { staff: '박은혜', email: '86eunhye@gmail.com' },
        '초등부': { staff: '백진주', email: 'jinjoopearl19@gmail.com' },
        '중고등부': { staff: '박명철', email: 'amicusnextc@gmail.com' }
      };
      const { dept } = req.body || {};
      if (!dept || !DEPTS[dept]) return res.status(400).json({ error: 'Invalid dept. Must be: ' + Object.keys(DEPTS).join(', ') });
      const info = DEPTS[dept];
      const now2 = new Date();
      const laDate2 = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now2);
      const [yr,mo,dy] = laDate2.split('-').map(Number);
      const laDay2 = new Date(Date.UTC(yr, mo-1, dy));
      const dow = laDay2.getUTCDay();
      const sd = new Date(laDay2);
      sd.setUTCDate(laDay2.getUTCDate() - dow);
      const sShort = (sd.getUTCMonth()+1) + '/' + sd.getUTCDate();
      const sMonth = sd.getUTCMonth()+1;
      const sDay = sd.getUTCDate();
      const subject = '[Amicus-checkin] ' + sShort + ' ' + dept + ' 주일 마무리 보고 부탁드립니다 🗓️ (수동 리마인드)';
      const html = '<div style="font-family:-apple-system,Segoe UI,Helvetica,sans-serif;color:#111827;max-width:560px;margin:0 auto;padding:20px;">' +
        '<h2 style="color:#6366f1;font-size:20px;margin:0 0 16px 0;">🗓️ ' + dept + ' 마무리 - ' + sShort + '</h2>' +
        '<p style="font-size:15px;line-height:1.6;color:#374151;"><strong>' + info.staff + ' 간사님 안녕하세요!</strong><br><br>' +
        sMonth + '월 ' + sDay + '일 주일에 대한 마무리 보고가 아직 등록되지 않았습니다.</p>' +
        '<div style="background:#f3f4f6;border-left:4px solid #6366f1;border-radius:8px;padding:14px;margin:20px 0;">' +
        '<p style="margin:0;font-size:14px;color:#374151;">📝 <strong>staff.html → 🗓️ 주일 마무리 탭</strong>에서 작성해주세요.<br>특이사항이 없으면 <strong>[⚡ 없음]</strong> 버튼 클릭 OK!</p></div>' +
        '<p style="font-size:14px;color:#6b7280;">🔗 <a href="https://amicus-checkin.vercel.app/staff.html" style="color:#6366f1;">amicus-checkin.vercel.app/staff.html</a></p>' +
        '<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">' +
        '<p style="font-size:12px;color:#9ca3af;text-align:center;">Amicus Presbyterian Church · 교육부<br>이 메일은 디렉터가 수동 발송했습니다.</p></div>';
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: 'Amicus 교육부 <noreply@amicuschurch.com>', to: [info.email], subject, html })
      });
      const body = await emailRes.json().catch(() => ({}));
      if (!emailRes.ok) return res.status(500).json({ error: 'Resend failed', detail: body });
      return res.json({ success: true, dept, sentTo: info.email, staff: info.staff, emailId: body.id });
    }
    // ATTENDANCE FIX (director-only attendance record corrections)
    if (type === 'attendance-fix') {
      if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
      const { action, recordId } = req.body || {};
      if (!action || !recordId) return res.status(400).json({ error: 'action and recordId required' });
      if (action === 'delete') {
        const rec = await notion.pages.retrieve({ page_id: recordId });
        const curName = rec.properties['이름 (Name)']?.title?.[0]?.text?.content || '';
        const newName = curName.startsWith('🗑️') ? curName : '🗑️ ' + curName;
        await notion.pages.update({ page_id: recordId, properties: {
          '이름 (Name)': { title: [{ text: { content: newName } }] }
        }});
        return res.json({ success: true, action: 'deleted', recordId, newName });
      }
      if (action === 'force-checkout') {
        const now = new Date();
        const t = new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit', hour12: true }).format(now);
        await notion.pages.update({ page_id: recordId, properties: {
          '체크아웃 시간 (Check-out)': { rich_text: [{ text: { content: t } }] }
        }});
        return res.json({ success: true, action: 'force-checkout', recordId, checkOutTime: t });
      }
      return res.status(400).json({ error: 'Unknown action: ' + action });
    }
    return res.status(400).json({ error: 'Unknown type' });
  } catch(e) {
    console.error('staff-ops error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
