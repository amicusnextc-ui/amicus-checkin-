const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

const LIABILITY_ARCHIVE_DB = 'e26a4d73-e048-4dd4-9b99-6e0bd6c01b67';
const BCC_EMAIL = 'amicusnextc@gmail.com';

function escapeHtml(s){
  return String(s||'').replace(/[&<>"']/g, function(c){
    return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
  });
}

function buildEmailHtml(opts){
  var ts;
  try { ts = new Date(opts.timestamp).toLocaleString('ko-KR', {timeZone:'America/Los_Angeles'}); }
  catch(e){ ts = opts.timestamp; }
  var name = escapeHtml(opts.studentName);
  var dob = escapeHtml(opts.studentDOB || '');
  var dept = escapeHtml((opts.studentDept||'').split(' ')[0]);
  var guardian = escapeHtml(opts.guardian);
  var sig = escapeHtml(opts.signature);
  var guardian2 = escapeHtml(opts.guardian2 || '');
  var sig2 = escapeHtml(opts.signature2 || '');
  var ver = escapeHtml(opts.termsVersion || '2025-2027');

  var parent2Row = guardian2 ?
    '<tr><td style="padding:6px 0;color:#6b7280;">보호자 2</td><td style="padding:6px 0;font-weight:600;">'+guardian2+'</td></tr>' +
    '<tr><td style="padding:6px 0;color:#6b7280;">서명 2</td><td style="padding:6px 0;font-family:Georgia,serif;font-style:italic;color:#4f46e5;">'+sig2+'</td></tr>'
    : '';

  return [
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">',
    '  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb;">',
    '    <h1 style="margin:0;font-size:20px;color:#111827;">WAIVER OF LIABILITY, ASSUMPTION OF RISK,</h1>',
    '    <h1 style="margin:2px 0 0;font-size:20px;color:#111827;">AND INDEMNITY AGREEMENT</h1>',
    '    <p style="margin:8px 0 0;font-size:13px;color:#6b7280;">Amicus Presbyterian Church</p>',
    '    <p style="margin:2px 0 0;font-size:12px;color:#9ca3af;">10960 Via Frontera, San Diego CA 92127 · 760.300.5659</p>',
    '  </div>',
    '  <p style="margin:16px 0 6px;font-size:14px;line-height:1.6;">전자 서명된 Liability Waiver 사본입니다. This email serves as your digital receipt for the signed Liability Waiver.</p>',
    '  <p style="margin:0 0 16px;font-size:12px;color:#6b7280;line-height:1.6;">Effective Dates: January 1, 2025 – December 31, 2027 · FOR USE ONLY IF THE PARTICIPANT IS A MINOR</p>',
    '  <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin:16px 0;">',
    '    <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#4f46e5;">서명 정보 · Signature Details</p>',
    '    <table style="width:100%;font-size:14px;border-collapse:collapse;">',
    '      <tr><td style="padding:6px 0;color:#6b7280;width:120px;">학생 이름</td><td style="padding:6px 0;font-weight:600;">'+name+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">생년월일 (DOB)</td><td style="padding:6px 0;">'+dob+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">부서</td><td style="padding:6px 0;">'+dept+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">보호자 1</td><td style="padding:6px 0;font-weight:600;">'+guardian+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">서명 1</td><td style="padding:6px 0;font-family:Georgia,serif;font-style:italic;color:#4f46e5;">'+sig+'</td></tr>',
    parent2Row,
    '      <tr><td style="padding:6px 0;color:#6b7280;">제출 일시</td><td style="padding:6px 0;">'+escapeHtml(ts)+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">약관 버전</td><td style="padding:6px 0;">'+ver+'</td></tr>',
    '    </table>',
    '  </div>',
    '  <details style="margin:20px 0;padding:14px 18px;background:#f3f4f6;border-radius:12px;font-size:12px;line-height:1.65;color:#374151;">',
    '    <summary style="cursor:pointer;font-weight:700;color:#111827;font-size:13px;">📄 전체 약관 보기 (Full Waiver Text)</summary>',
    '    <div style="margin-top:12px;">',
    '      <p style="margin:0 0 10px;"><strong>Functions and Activities:</strong> Prior to my own/child\'s participation in the programs and recreational and other activities of Amicus Presbyterian Church (&ldquo;Amicus&rdquo;), I acknowledge that there are certain risks associated with the activities, including, by way of example, physical injury due to activity-related accidents, physical injury due to transportation-related accidents, illness, even death, or property loss arising from, but not limited to, participation in the activity. In addition, I acknowledge that there may be other risks inherent in these activities of which I may not be presently aware.</p>',
    '      <p style="margin:0 0 10px;"><strong>Release of Liability:</strong> By signing this Permission/Waiver Form, I expressly warrant that the child named above is capable of withstanding both the physical and mental demands of the activities discussed above. I also expressly assume all risks of the child when participating in the activities, whether such risks are known or unknown to me at this time. I further release of Amicus and its ministers, leaders, employees, volunteers, and agents from any claim that my child may have or that I may have against them as a result of injury or illness incurred during the course of participation in the activities. This release of liability shall include (without limitation) any claims of negligence or breach of warranty. This release of liability is also intended to cover all claims that members of the child\'s or my family or estate, heirs, representatives, or assigns may have against of Amicus or its ministers, leaders, employees, volunteers, or agents. I further agree to indemnify and hold harmless of Amicus and its ministers, leaders, employees, volunteers, or agents from any and all claims arising from my participation in its activities and programs, or as a result of injury or illness of my child during such activities.</p>',
    '      <p style="margin:0 0 10px;"><strong>Special Events and Field Trips:</strong> I understand that the child named above will be participating in various activities at Amicus and in the regional area. I understand that during this period my child/ward may take part in activities such as: Religious Studies, discussion groups, music, worship services, group songs, games of skill and experience, drama, walking to outside events at other locales and establishments, and other activities consistent with the purposes of the church\'s student ministry.</p>',
    '      <p style="margin:0 0 10px;"><strong>Photography, Audio, Video, and Social Media:</strong> I authorize of Amicus to include myself/child in pictures or on audio or video for promotional purposes of events he/she is participating in. I also authorize of Amicus to post pictures or recordings of my children on the conference presentations and worship services, educational presentations, or church website and related ministries. I hereby release any and all claims any person or organization utilizing this material for educational and ministry purposes.</p>',
    '      <p style="margin:0 0 10px;"><strong>First Aid and Emergency Medical Treatment:</strong> I recognize that there may be occasions where the child named above may be in need of first aid or emergency medical treatment as a result of an accident, illness, or other health condition or injury. I do hereby give permission for agents of Amicus to seek and secure any needed medical attention or treatment for the child name above including hospitalization, if in the agent\'s opinion such need arises. In doing so I agree to pay all fees and costs arising from this action to obtain medical treatment. <strong>I give permission for attending physician(s) and other medical personnel to administer any needed medical treatment, including surgery and again, I agree to pay for the medical treatment.</strong></p>',
    '      <p style="margin:0 0 10px;"><strong>Indemnification and hold harmless:</strong> I also agree to indemnify and hold harmless Amicus for any and all claims, actions, suits, procedure costs, expenses, damages, and liabilities including attorneys\' fees, brought as a result of my involvement in the Activity, and to reimburse them for any such cost incurred.</p>',
    '      <p style="margin:0 0 10px;"><strong>Severability:</strong> The undersigned further expressively agrees that this Waiver of Liability, Assumption of Risk, and Indemnity Agreement is intended to be as broad and inclusive as permitted by the law of the state of California, and if any portion is later held invalid, it is heretofore agreed that the balance shall continue to be in full force and legal effect.</p>',
    '      <p style="margin:0;"><strong>Acknowledgment of understanding:</strong> I have read this Waiver of Liability, Assumption of Risk, and Indemnity Agreement, and fully understand its terms, and understand that I am giving up substantial rights, including my right to sue. I acknowledge that I am signing the agreement freely and voluntarily and intend my signature to be complete in unconditional release of all liability to the greatest extent allowed by law.</p>',
    '    </div>',
    '  </details>',
    '  <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;text-align:center;line-height:1.6;">This is a legally binding electronic signature under the California E-SIGN Act.<br/>Please retain this email for your records. 이 이메일을 기록용으로 보관해 주세요.</p>',
    '  <p style="margin:12px 0 0;font-size:12px;color:#6b7280;text-align:center;">감사합니다. · Thank you.<br/><strong>Amicus Presbyterian Church · 교육부</strong></p>',
    '</div>'
  ].filter(Boolean).join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  // === AUTH (Task #50): inline soft/hard-mode shared-secret check ===
  {
    const _expected = process.env.API_SECRET;
    const _enforce  = process.env.API_AUTH_ENFORCE === '1';
    if (_expected) {
      let _provided = '';
      try {
        const _h = String((req.headers && req.headers.authorization) || '');
        if (_h.toLowerCase().indexOf('bearer ') === 0) _provided = _h.slice(7).trim();
        else if (req.headers && req.headers['x-api-key']) _provided = String(req.headers['x-api-key']).trim();
        else if (req.query && req.query.apiKey) _provided = String(req.query.apiKey).trim();
      } catch (e) {}
      if (_provided !== _expected) {
        if (_enforce) return res.status(401).json({ error: 'unauthorized' });
        try { console.warn('[auth] missing/invalid token (soft) url=' + (req.url||'?')); } catch(e){}
      }
    }
  }

  // === Task #305: hard-fail if REGISTER_TOKEN_SECRET is unset in production (prevents predictable tokens) ===
  if (!process.env.REGISTER_TOKEN_SECRET && process.env.VERCEL_ENV === 'production') {
    console.error('[FATAL] REGISTER_TOKEN_SECRET missing in production — all HMAC tokens would be predictable');
    return res.status(500).json({ error: 'Server misconfigured: REGISTER_TOKEN_SECRET missing' });
  }

  // === GET handler: liability submission history ===
  if (req.method === 'GET') {
    try {
      const action = (req.query && req.query.action) || '';
      if (action !== 'history') {
        return res.status(400).json({ error: 'Unknown GET action. Use ?action=history' });
      }
      const days = parseInt((req.query && req.query.days) || '30', 10);
      const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
      const cutoffISO = new Date(cutoffMs).toISOString();
      const r = await fetch('https://api.notion.com/v1/databases/' + LIABILITY_ARCHIVE_DB + '/query', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: { property: '제출 일시', date: { after: cutoffISO } },
          sorts: [ { property: '제출 일시', direction: 'descending' } ],
          page_size: 100
        })
      });
      const data = await r.json();
      if (!r.ok) return res.status(500).json({ error: data.message || 'Notion query failed' });
      const submissions = (data.results || []).map(p => {
        const props = p.properties || {};
        const rt = (f) => (props[f] && props[f].rich_text && props[f].rich_text[0] && props[f].rich_text[0].plain_text) || '';
        const title = (props['제출 제목'] && props['제출 제목'].title && props['제출 제목'].title[0] && props['제출 제목'].title[0].plain_text) || '';
        // Task #263: hide test records marked with 🗑️ or containing "test"
        if (title && (title.indexOf('🗑️') >= 0 || /\btest\b/i.test(title) || /테스트/.test(title))) return null;
        return {
          id: p.id,
          title,
          studentName: rt('학생 이름'),
          studentDept: (props['학생 부서'] && props['학생 부서'].select && props['학생 부서'].select.name) || '',
          studentAmcId: rt('학생 ID (AMC)'),
          guardianName: rt('보호자 이름'),
          email: (props['수신 이메일'] && props['수신 이메일'].email) || '',
          emailStatus: (props['이메일 발송 상태'] && props['이메일 발송 상태'].select && props['이메일 발송 상태'].select.name) || '',
          submittedAt: (props['제출 일시'] && props['제출 일시'].date && props['제출 일시'].date.start) || '',
          termsVersion: (props['약관 버전'] && props['약관 버전'].select && props['약관 버전'].select.name) || '',
          createdAt: p.created_time
        };
      });
      const filtered = submissions.filter(x => x !== null); return res.status(200).json({ submissions: filtered, count: filtered.length, days });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      pageId, action,
      name, department, grade, allergy, notes, liabilityForm, baptized, photo, status, lastAttended,
      guardianName, signature, timestamp,
      guardian2Name, signature2,
      email, studentName, studentDept, studentAmcId, studentDOB, userAgent, termsVersion,
      adminMode, adminName
    } = body;

    // === SEND LIABILITY INVITE EMAILS (single or bulk, no pageId guard) ===
    if (action === 'send-liability-invite') {
      const pageIds = body.pageIds || (pageId ? [pageId] : []);
      if (!pageIds.length) return res.status(400).json({ error: 'pageId or pageIds required' });
      if (!process.env.RESEND_API_KEY) return res.status(500).json({ error: 'Resend not configured' });
      const results = [];
      for (const pid of pageIds) {
        try {
          const sp = await notion.pages.retrieve({ page_id: pid });
          const props = sp.properties || {};
          const t = (f) => (props[f]?.title?.[0]?.plain_text) || '';
          const studentName = t('이름 (Name)');
          const motherEmail = props['어머니 이메일 (Mother Email)']?.email;
          const fatherEmail = props['아버지 이메일 (Father Email)']?.email;
          const parentEmail = motherEmail || fatherEmail;
          if (!parentEmail) { results.push({ pid, name: studentName, status: 'no-email' }); continue; }
          const link = 'https://amicus-checkin.vercel.app/liability.html?studentId=' + pid;
          const _infoTokSecret = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
          const infoToken = require('crypto').createHmac('sha256', _infoTokSecret).update('info:'+pid).digest('hex').slice(0,32); // Task #312: 32 chars (128 bits)
          const infoLink = 'https://amicus-checkin.vercel.app/parent-info.html?studentId=' + pid + '&token=' + infoToken;
          const html = '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;"><div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb;"><h1 style="margin:0;font-size:22px;color:#4f46e5;">📋 Liability Form 작성 안내 / Action Required</h1><p style="margin:6px 0 0;font-size:13px;color:#6b7280;">Amicus Presbyterian Church · 교육부</p></div><p style="margin:20px 0 12px;font-size:15px;line-height:1.7;">안녕하세요, <strong>' + studentName + '</strong> 학생의 부모님께,<br/>Hello, parent of <strong>' + studentName + '</strong>:</p><p style="margin:0 0 16px;font-size:14px;line-height:1.7;color:#374151;">아미쿠스 교회 교육부 활동 참여를 위해 책임 동의서(Liability Form) 작성이 필요합니다. 약 5분 소요됩니다.<br/><br/>For your child to participate in Amicus Education Ministry programs, please complete the Liability Form. Takes about 5 minutes.</p><div style="text-align:center;margin:28px 0;"><a href="' + link + '" style="display:inline-block;background:linear-gradient(to right,#4f46e5,#7c3aed);color:white;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(79,70,229,0.3);margin:0 4px 8px;">📝 안전 동의서 / Liability</a><a href="' + infoLink + '" style="display:inline-block;background:linear-gradient(to right,#10b981,#059669);color:white;padding:14px 32px;border-radius:14px;text-decoration:none;font-weight:700;font-size:15px;box-shadow:0 4px 12px rgba(16,185,129,0.3);margin:0 4px 8px;">📋 정보 입력 / Info Update</a></div><p style="margin:16px 0 8px;font-size:13px;color:#6b7280;line-height:1.6;border-top:1px solid #e5e7eb;padding-top:16px;">문의 / Contact: amicusnextc@gmail.com<br/>🏛️ Amicus Presbyterian Church</p></div>';
          const rr = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + process.env.RESEND_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'Amicus Church <noreply@amicuschurch.com>',
              to: [parentEmail],
              bcc: [BCC_EMAIL],
              subject: '[아미쿠스 교회] ' + studentName + ' - Liability Form 작성 안내',
              html,
              reply_to: 'amicusnextc@gmail.com'
            })
          });
          if (rr.ok) {
            await notion.pages.update({ page_id: pid, properties: { 'Liability Form': { select: { name: '확인 필요' } } } }).catch(()=>{});
            results.push({ pid, name: studentName, status: 'sent', email: parentEmail });
          } else {
            const errd = await rr.json().catch(()=>({}));
            results.push({ pid, name: studentName, status: 'failed', error: errd.message });
          }
        } catch(e) {
          results.push({ pid, status: 'error', error: e.message });
        }
      }
      const sent = results.filter(r=>r.status==='sent').length;
      const noEmail = results.filter(r=>r.status==='no-email').length;
      const failed = results.length - sent - noEmail;
      return res.json({ success: true, sent, noEmail, failed, results });
    }

    // === AUTO-CLOSE pending checkouts (cron / admin) — Gap #1 ===
    if (action === 'auto-close') {
      if (body.password !== process.env.DIRECTOR_PASSWORD) {
        return res.status(401).json({ error: 'Unauthorized' });
      }
      const TZ_AUTO = 'America/Los_Angeles';
      const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: TZ_AUTO, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      const targetDate = body.date || todayLA;
      const ATT_DB = process.env.NOTION_ATTENDANCE_DB_ID || '89b6c47f85a842968493ce28ad93f8de';
      const nh = { 'Authorization': 'Bearer ' + process.env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
      const qRes = await fetch('https://api.notion.com/v1/databases/' + ATT_DB + '/query', {
        method: 'POST', headers: nh,
        body: JSON.stringify({
          filter: {
            and: [
              { property: '\uc8fc\uc77c \ub0a0\uc9dc (Date)', date: { equals: targetDate } },
              { property: '\uccb4\ud06c\uc544\uc6c3 \uc2dc\uac04 (Check-out)', rich_text: { is_empty: true } }
            ]
          },
          page_size: 100
        })
      });
      const qd = await qRes.json();
      if (!qRes.ok) return res.status(500).json({ error: 'Query failed: ' + (qd.message || 'unknown') });
      const pending = qd.results || [];
      const results = [];
      for (const rec of pending) {
        const name = rec.properties['\uc774\ub984 (Name)']?.title?.[0]?.plain_text || '?';
        const uRes = await fetch('https://api.notion.com/v1/pages/' + rec.id, {
          method: 'PATCH', headers: nh,
          body: JSON.stringify({ properties: { '\uccb4\ud06c\uc544\uc6c3 \uc2dc\uac04 (Check-out)': { rich_text: [{ text: { content: 'AUTO' } }] } } })
        });
        const ud = await uRes.json();
        results.push({ id: rec.id, name, ok: uRes.ok, error: uRes.ok ? null : ud.message });
      }
      return res.json({ success: true, date: targetDate, total: pending.length, closed: results.filter(r=>r.ok).length, results });
    }

    // === PARENT-INFO FORM (parent fills missing info via shared link) — Gap #4 followup ===
    if (action === 'parent-info') {
      const sId = body.studentId;
      const fields = body.fields || {};
      if (!sId) return res.status(400).json({ error: 'studentId required' });
      /* Task #290: HMAC token verify (soft mode unless PARENT_INFO_TOKEN_ENFORCE=1) */
      try {
        const _piSecret = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
        /* Task #312: accept both legacy 16-char and new 32-char tokens */
        const _fullExpected = require('crypto').createHmac('sha256', _piSecret).update('info:'+sId).digest('hex');
        const _expectedTok = _fullExpected.slice(0,16);
        const _expectedTok32 = _fullExpected.slice(0,32);
        const _gotTok = body.token || '';
        if (_gotTok !== _expectedTok && _gotTok !== _expectedTok32) /* Task #312: accept both */ {
          if (process.env.PARENT_INFO_TOKEN_ENFORCE === '1') {
            return res.status(403).json({ error: 'Invalid or missing token' });
          }
          console.warn('[parent-info] token mismatch (soft) sId=' + sId + ' got=' + (_gotTok? _gotTok.slice(0,4)+'...':'(none)'));
        }
      } catch(_te) { console.warn('[parent-info] token check error (soft):', _te.message); }
      const STUDENT_DB_PI = process.env.NOTION_STUDENT_DB_ID || '107828732f784c39bcb0136a4397c758';
      const piHeaders = { 'Authorization': 'Bearer ' + process.env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
      // Resolve pageId: accept Notion UUID directly, or look up by AMC code in title
      let targetPageId = sId;
      if (sId.length < 30) {
        // Looks like AMC-XXX — query by 고유번호 (ID) field
        const qRes = await fetch('https://api.notion.com/v1/databases/' + STUDENT_DB_PI + '/query', {
          method: 'POST', headers: piHeaders,
          body: JSON.stringify({ filter: { property: '\uace0\uc720\ubc88\ud638 (ID)', unique_id: { equals: parseInt(String(sId).replace(/[^0-9]/g, '')) } }, page_size: 1 })
        });
        const qd = await qRes.json();
        if (!qd.results || !qd.results[0]) return res.status(404).json({ error: 'Student not found by AMC code: ' + sId });
        targetPageId = qd.results[0].id;
      }
      // Build properties — only include non-empty fields
      const props = {};
      if (fields.nameEN) props['\uc601\ubb38\uc774\ub984 (Name EN)'] = { rich_text: [{ text: { content: fields.nameEN } }] };
      if (fields.grade) props['\ud559\ub144 (Grade)'] = { rich_text: [{ text: { content: fields.grade } }] };
      if (fields.school) props['\ud559\uad50 (School)'] = { rich_text: [{ text: { content: fields.school } }] };
      if (fields.allergy) props['\uc54c\ub7ec\uc9c0 (Allergy)'] = { rich_text: [{ text: { content: fields.allergy } }] };
      if (fields.motherName) props['\uc5b4\uba38\ub2c8 \uc774\ub984 (Mother Name)'] = { rich_text: [{ text: { content: fields.motherName } }] };
      if (fields.motherPhone) props['\uc5b4\uba38\ub2c8 \uc5f0\ub77d\ucc98 (Mother Phone)'] = { phone_number: fields.motherPhone };
      if (fields.motherEmail) props['\uc5b4\uba38\ub2c8 \uc774\uba54\uc77c (Mother Email)'] = { email: fields.motherEmail };
      if (fields.fatherName) props['\uc544\ubc84\uc9c0 \uc774\ub984 (Father Name)'] = { rich_text: [{ text: { content: fields.fatherName } }] };
      if (fields.fatherPhone) props['\uc544\ubc84\uc9c0 \uc5f0\ub77d\ucc98 (Father Phone)'] = { phone_number: fields.fatherPhone };
      if (fields.fatherEmail) props['\uc544\ubc84\uc9c0 \uc774\uba54\uc77c (Father Email)'] = { email: fields.fatherEmail };
      if (fields.address) props['\uc9d1\uc8fc\uc18c (Address)'] = { rich_text: [{ text: { content: fields.address } }] };
      if (fields.emergency) props['\ube44\uc0c1\uc5f0\ub77d\ucc98 (Emergency)'] = { phone_number: fields.emergency };
      if (fields.dob) props['\uc0dd\ub144\uc6d4\uc77c (DOB)'] = { date: { start: fields.dob } };
      if (fields.baptized) props['\uc138\ub840 \uc5ec\ubd80 (Baptized)'] = { select: { name: fields.baptized } };
      // Build guardian string if mother/father names provided
      const guardianParts = [fields.fatherName, fields.motherName].filter(Boolean);
      if (guardianParts.length > 0) props['\ubcf4\ud638\uc790 (Guardian)'] = { rich_text: [{ text: { content: guardianParts.join('/') } }] };
      if (Object.keys(props).length === 0) return res.status(400).json({ error: 'No fields to update' });
      const uRes = await fetch('https://api.notion.com/v1/pages/' + targetPageId, {
        method: 'PATCH', headers: piHeaders,
        body: JSON.stringify({ properties: props })
      });
      const ud = await uRes.json();
      if (!uRes.ok) return res.status(500).json({ error: 'Update failed: ' + (ud.message || 'unknown') });
      return res.json({ success: true, studentId: targetPageId, updatedFields: Object.keys(props).length });
    }

    if (action === 'gen-parent-info-link') {
      const crypto = require('crypto');
      const SECRET = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
      const sid = req.query.student || req.body?.student || '';
      if (!sid) return res.status(400).json({ error: 'student (studentId/pageId) required' });
      const token = crypto.createHmac('sha256', SECRET).update('info:'+sid).digest('hex').slice(0,32); // Task #312: 32 chars
      const base = 'https://amicus-checkin.vercel.app/parent-info.html';
      return res.json({ studentId: sid, token, link: base + '?studentId=' + sid + '&token=' + token });
    }
    
    if (!pageId) return res.status(400).json({ error: 'Missing pageId' });

    if (action === 'parent-register') {
      const crypto = require('crypto');
      const SECRET = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
      function genToken(sid){ return crypto.createHmac('sha256', SECRET).update(String(sid)).digest('hex').slice(0, 16); }
      const sidRaw = req.query.student || req.body?.student || '';
      const tokenIn = req.query.token || req.body?.token || '';
      if (!sidRaw) return res.status(400).json({ error: 'student required' });
      let resolvedPageId = null, resolvedAmc = '';
      const amcMatch = String(sidRaw).match(/^AMC-(\d+)$/i);
      if (amcMatch) {
        const num = parseInt(amcMatch[1], 10);
        const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || '107828732f784c39bcb0136a4397c758';
        const q = await notion.databases.query({ database_id: STUDENT_DB, filter: { property: '고유번호 (ID)', unique_id: { equals: num } }, page_size: 1 });
        if (q.results[0]) { resolvedPageId = q.results[0].id; resolvedAmc = sidRaw.toUpperCase(); }
      } else {
        try {
          const p = await notion.pages.retrieve({ page_id: sidRaw });
          resolvedPageId = p.id;
          const idn = p.properties['고유번호 (ID)']?.unique_id?.number;
          resolvedAmc = idn ? 'AMC-' + String(idn).padStart(3, '0') : '';
        } catch(e) {}
      }
      if (!resolvedPageId) return res.status(404).json({ error: 'Student not found' });
      const expected = genToken(resolvedAmc);
      if (tokenIn !== expected) return res.status(403).json({ error: 'Invalid or expired token' });
      const page = await notion.pages.retrieve({ page_id: resolvedPageId });
      const props = page.properties;
      const rt = (k) => props[k]?.rich_text?.[0]?.plain_text || '';
      const sel = (k) => props[k]?.select?.name || '';
      if (req.method === 'GET' || req.query.mode === 'lookup') {
        return res.json({
          studentId: resolvedAmc,
          name: props['이름 (Name)']?.title?.[0]?.plain_text || '',
          nameEN: rt('영문이름 (Name EN)'),
          grade: rt('학년 (Grade)'),
          dept: sel('부서 (Department)'),
          allergy: rt('알러지 (Allergy)') || '없음',
          parentName: rt('아버지 이름 (Father Name)') || rt('어머니 이름 (Mother Name)') || rt('보호자 (Guardian)') || '',
          parentEmail: (props['아버지 이메일 (Father Email)']?.email) || (props['어머니 이메일 (Mother Email)']?.email) || '',
          parentPhone: (props['아버지 연락처 (Father Phone)']?.phone_number) || (props['어머니 연락처 (Mother Phone)']?.phone_number) || ''
        });
      }
      const { parentName, parentEmail, parentPhone, emergencyName, emergencyPhone, address, signature, submittedDate } = req.body || {};
      if (!parentName || !parentEmail || !parentPhone) return res.status(400).json({ error: 'parentName, parentEmail, parentPhone required' });
      if (!signature || signature.trim().length < 2) return res.status(400).json({ error: 'signature required' });
      const ts = new Date().toISOString();
      const curNotes = (page.properties['특이사항 (Notes)']?.rich_text || []).map(b => b.plain_text || '').join('');
      const appendPrefix = curNotes ? curNotes + '\n' : '';
      const regLine = '[REGISTER ' + ts.slice(0,10) + '] Parent: ' + parentName + ' | Email: ' + parentEmail + ' | Phone: ' + parentPhone + (emergencyName ? ' | Emergency: ' + emergencyName + ' (' + (emergencyPhone||'') + ')' : '') + ' | Sig: ' + signature;
      const newNotes = appendPrefix + regLine;
      await notion.pages.update({
        page_id: resolvedPageId,
        properties: {
          '아버지 이름 (Father Name)': { rich_text: [{ text: { content: parentName.slice(0, 200) } }] },
          '아버지 이메일 (Father Email)': { email: parentEmail },
          '아버지 연락처 (Father Phone)': { phone_number: parentPhone },
          ...(emergencyPhone ? { '비상연락처 (Emergency)': { phone_number: emergencyPhone } } : {}),
          ...(address ? { '집주소 (Address)': { rich_text: [{ text: { content: String(address).slice(0, 300) } }] } } : {}),
          '방문자 (Visitor)': { checkbox: false },
          '정회원 전환일 (Converted Date)': { date: { start: ts.slice(0, 10) } },
          'Liability Form': { select: { name: '제출 완료' } },
          '특이사항 (Notes)': { rich_text: [{ text: { content: newNotes.slice(0, 1900) } }] }
        }
      });
      return res.json({ success: true, studentId: resolvedAmc, action: 'registered' });
    }
    
    if (action === 'gen-register-link') {
      const crypto = require('crypto');
      const SECRET = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
      function genToken(sid){ return crypto.createHmac('sha256', SECRET).update(String(sid)).digest('hex').slice(0, 16); }
      const sid = req.query.student || req.body?.student || '';
      if (!/^AMC-\d+$/i.test(sid)) return res.status(400).json({ error: 'student=AMC-XXX required' });
      const token = genToken(sid.toUpperCase());
      const base = 'https://amicus-checkin.vercel.app/register.html';
      return res.json({ studentId: sid.toUpperCase(), token, link: base + '?student=' + sid.toUpperCase() + '&token=' + token });
    }
    
    if (action === 'liability') {
      const ts = timestamp || new Date().toISOString();
      var noteLine = 'Signed by ' + (guardianName||'') + ' on ' + ts + (signature ? ' | Sig: '+signature : '');
      if (guardian2Name && signature2) noteLine += ' | Parent2: ' + guardian2Name + ' Sig: ' + signature2;
      if (email) noteLine += ' | Email: ' + email;
      if (body.adminMode && body.adminName) noteLine += ' | ADMIN-SUBMITTED by ' + body.adminName;

      // 1. Update student record (append to Notes, preserve history)
      try {
        const curPage = await notion.pages.retrieve({ page_id: pageId });
        const curNotes = (curPage.properties['특이사항 (Notes)']?.rich_text || [])
          .map(b => b.plain_text || (b.text && b.text.content) || '')
          .join('');
        const appendPrefix = curNotes ? curNotes + '\n' : '';
        const newNotes = appendPrefix + '[LIABILITY ' + ts.slice(0,10) + '] ' + noteLine;
        await notion.pages.update({
          page_id: pageId,
          properties: {
            'Liability Form': { select: { name: '제출 완료' } },
            // Option B: auto-save signer info + Gap #4: 정식 등록 시 방문자 → 정회원 자동 전환
            '\ubc29\ubb38\uc790 (Visitor)': { checkbox: false },
            '\uc815\ud68c\uc6d0 \uc804\ud658\uc77c (Converted Date)': { date: { start: new Date().toISOString().slice(0,10) } },
            ...(email ? { '어머니 이메일 (Mother Email)': { email: email } } : {}),
            ...(guardianName ? { '보호자 (Guardian)': { rich_text: [{ text: { content: String(guardianName).slice(0, 200) } }] } } : {}),
            '특이사항 (Notes)': { rich_text: [{ text: { content: newNotes.slice(0, 1900) } }] }
          }
        });
      } catch(upE) {
        console.error('Student update failed (non-fatal):', upE.message);
      }

      // 2. Send email via Resend
      let emailSent = false;
      let emailStatus = '발송 안 함';
      if (process.env.RESEND_API_KEY && email) {
        try {
          const html = buildEmailHtml({
            studentName, studentDept, studentDOB,
            guardian: guardianName, signature,
            guardian2: guardian2Name, signature2,
            timestamp: ts, termsVersion
          });
          const subject = '[Amicus] Liability Waiver 제출 확인 — ' + (studentName || '');
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Amicus \uad50\uc721\ubd80 <education@amicuschurch.com>',
              to: [email],
              bcc: [BCC_EMAIL],
              subject: subject,
              html: html
            })
          });
          emailSent = r.ok;
          emailStatus = r.ok ? '발송 성공' : '발송 실패';
          if (!r.ok) {
            const errd = await r.json().catch(()=>({}));
            console.error('Resend error:', errd);
          }
        } catch(ee) {
          console.error('Email send error:', ee.message);
          emailStatus = '발송 실패';
        }
      }

      // 3. Log to Liability 제출 이력 DB
      try {
        const ipAddr = (req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || '').toString().split(',')[0].trim();
        const titleStr = (body.adminMode && body.adminName ? '🔑 ADMIN · ' : '') + (studentName || '학생') + ' · ' + ts.slice(0,10);
        const combinedSig = signature + (signature2 ? ' / ' + signature2 : '');
        const combinedGuardian = guardianName + (guardian2Name ? ' / ' + guardian2Name : '');
        await notion.pages.create({
          parent: { database_id: LIABILITY_ARCHIVE_DB },
          properties: {
            '제출 제목': { title: [{ text: { content: titleStr } }] },
            '학생 이름': { rich_text: [{ text: { content: studentName || '' } }] },
            '학생 부서': studentDept ? { select: { name: studentDept } } : { select: null },
            '보호자 이름': { rich_text: [{ text: { content: combinedGuardian } }] },
            '서명 (텍스트)': { rich_text: [{ text: { content: combinedSig } }] },
            '제출 일시': { date: { start: ts } },
            '약관 버전': { select: { name: termsVersion || '2025-2027' } },
            '수신 이메일': email ? { email: email } : { email: null },
            '이메일 발송 상태': { select: { name: emailStatus } },
            '아카이브 BCC': { email: BCC_EMAIL },
            '제출자 IP': { rich_text: [{ text: { content: ipAddr } }] },
            '디바이스 (User Agent)': { rich_text: [{ text: { content: (userAgent||'').slice(0, 200) } }] },
            '학생 ID (AMC)': { rich_text: [{ text: { content: studentAmcId || '' } }] }
          }
        });
      } catch(le) {
        console.error('Liability archive DB insert failed:', le.message);
      }

      return res.json({ success: true, action: 'liability', emailSent, emailStatus });
    }

    // General update (with full parent/contact fields support)
    const props = {};
    if (name !== undefined) props['\uc774\ub984 (Name)'] = { title: [{ text: { content: name || '' } }] };
    if (body.nameEN !== undefined) props['\uc601\ubb38\uc774\ub984 (Name EN)'] = { rich_text: [{ text: { content: body.nameEN || '' } }] };
    if (department !== undefined) props['\ubd80\uc11c (Department)'] = { select: department ? { name: department } : null };
    if (grade !== undefined) props['\ud559\ub144 (Grade)'] = { rich_text: [{ text: { content: grade||'' } }] };
    if (body.school !== undefined) props['\ud559\uad50 (School)'] = { rich_text: [{ text: { content: body.school||'' } }] };
    if (body.dob !== undefined) props['date:\uc0dd\ub144\uc6d4\uc77c (DOB):start'] = body.dob || null; // might need adjustment — but Notion API requires date object
    if (allergy !== undefined) props['\uc54c\ub7ec\uc9c0 (Allergy)'] = { rich_text: [{ text: { content: allergy||'' } }] };
    if (notes !== undefined) props['\ud2b9\uc774\uc0ac\ud56d (Notes)'] = { rich_text: [{ text: { content: notes||'' } }] };
    if (liabilityForm !== undefined) props['Liability Form'] = { select: liabilityForm ? { name: liabilityForm } : null };
    if (status !== undefined) props['\uc0c1\ud0dc (Status)'] = { select: status ? { name: status } : null };
    if (lastAttended !== undefined) props['\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)'] = { date: { start: lastAttended } };
    if (body.fatherName !== undefined) props['\uc544\ubc84\uc9c0 \uc774\ub984 (Father Name)'] = { rich_text: [{ text: { content: body.fatherName||'' } }] };
    if (body.fatherPhone !== undefined) props['\uc544\ubc84\uc9c0 \uc5f0\ub77d\ucc98 (Father Phone)'] = { phone_number: body.fatherPhone || null };
    if (body.fatherEmail !== undefined) props['\uc544\ubc84\uc9c0 \uc774\uba54\uc77c (Father Email)'] = { email: body.fatherEmail || null };
    if (body.motherName !== undefined) props['\uc5b4\uba38\ub2c8 \uc774\ub984 (Mother Name)'] = { rich_text: [{ text: { content: body.motherName||'' } }] };
    if (body.motherPhone !== undefined) props['\uc5b4\uba38\ub2c8 \uc5f0\ub77d\ucc98 (Mother Phone)'] = { phone_number: body.motherPhone || null };
    if (body.motherEmail !== undefined) props['\uc5b4\uba38\ub2c8 \uc774\uba54\uc77c (Mother Email)'] = { email: body.motherEmail || null };
    if (body.address !== undefined) props['\uc9d1\uc8fc\uc18c (Address)'] = { rich_text: [{ text: { content: body.address||'' } }] };
    if (body.photo !== undefined) props['\uc0ac\uc9c4 \ucd2c\uc601 (Photo)'] = { select: body.photo ? { name: body.photo } : null };
    if (body.baptized !== undefined) props['\uc138\ub840 \uc5ec\ubd80 (Baptized)'] = { select: body.baptized ? { name: body.baptized } : null };
    // DOB needs special handling (date object not flat string)
    if (body.dob !== undefined) {
      props['\uc0dd\ub144\uc6d4\uc77c (DOB)'] = body.dob ? { date: { start: body.dob } } : { date: null };
      delete props['date:\uc0dd\ub144\uc6d4\uc77c (DOB):start'];
    }

    if (Object.keys(props).length > 0) {
      await notion.pages.update({ page_id: pageId, properties: props });
    }
    return res.json({ success: true, action: 'updated' });
  } catch(e) {
    console.error('update-student error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
