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
  var dept = escapeHtml((opts.studentDept||'').split(' ')[0]);
  var guardian = escapeHtml(opts.guardian);
  var sig = escapeHtml(opts.signature);
  var ver = escapeHtml(opts.termsVersion || '2025-2027');
  return [
    '<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;padding:24px;color:#111827;">',
    '  <div style="text-align:center;padding:16px 0;border-bottom:1px solid #e5e7eb;">',
    '    <h1 style="margin:0;font-size:22px;color:#4f46e5;">📝 책임 동의서 제출 확인</h1>',
    '    <p style="margin:4px 0 0;font-size:13px;color:#6b7280;">Amicus Presbyterian Church · 교육부</p>',
    '  </div>',
    '  <p style="margin:20px 0 12px;font-size:14px;line-height:1.6;">Amicus Presbyterian Church 책임 동의서(Liability Waiver) 제출을 확인해 드립니다.</p>',
    '  <p style="margin:0 0 20px;font-size:13px;color:#6b7280;line-height:1.6;">This email serves as your digital receipt for the Liability Waiver submission.</p>',
    '  <div style="background:#f9fafb;border-radius:12px;padding:16px 20px;margin:16px 0;">',
    '    <table style="width:100%;font-size:14px;border-collapse:collapse;">',
    '      <tr><td style="padding:6px 0;color:#6b7280;width:120px;">학생</td><td style="padding:6px 0;font-weight:600;">'+name+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">부서</td><td style="padding:6px 0;">'+dept+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">보호자 이름</td><td style="padding:6px 0;">'+guardian+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">전자 서명</td><td style="padding:6px 0;font-family:Georgia,serif;font-style:italic;color:#4f46e5;">'+sig+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">제출 일시</td><td style="padding:6px 0;">'+escapeHtml(ts)+'</td></tr>',
    '      <tr><td style="padding:6px 0;color:#6b7280;">약관 버전</td><td style="padding:6px 0;">'+ver+'</td></tr>',
    '    </table>',
    '  </div>',
    '  <details style="margin:20px 0;padding:12px 16px;background:#f3f4f6;border-radius:12px;font-size:12px;line-height:1.6;color:#4b5563;">',
    '    <summary style="cursor:pointer;font-weight:600;color:#111827;">📄 약관 전문 보기 (Full Waiver Text)</summary>',
    '    <div style="margin-top:10px;">',
    '      <p><strong>WAIVER OF LIABILITY, ASSUMPTION OF RISK, AND INDEMNITY AGREEMENT</strong></p>',
    '      <p><strong>Effective Dates:</strong> January 1, 2025 – December 31, 2027</p>',
    '      <p><strong>Release of Liability:</strong> I expressly assume all risks of the child when participating in the activities. I further release Amicus and its ministers, leaders, employees, volunteers, and agents from any claim that my child may have as a result of injury or illness incurred during participation.</p>',
    '      <p><strong>Photography & Media:</strong> I authorize Amicus to include my child in pictures or on audio/video for promotional purposes, worship services, and church communications.</p>',
    '      <p><strong>Emergency Medical:</strong> I give permission for agents of Amicus to seek and secure any needed medical attention for the child named above, including hospitalization.</p>',
    '      <p><strong>Indemnification:</strong> I agree to indemnify and hold harmless Amicus for any and all claims arising from my child’s involvement in activities.</p>',
    '    </div>',
    '  </details>',
    '  <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;text-align:center;">This is a legally binding electronic signature under the California E-SIGN Act. Please retain this email for your records.</p>',
    '  <p style="margin:8px 0 0;font-size:12px;color:#9ca3af;text-align:center;">감사합니다. · Thank you.<br/>— Amicus Education</p>',
    '</div>'
  ].join('\n');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const {
      pageId, action,
      name, department, grade, allergy, notes, liabilityForm, baptized, photo, status, lastAttended,
      guardianName, signature, timestamp,
      email, studentName, studentDept, studentAmcId, userAgent, termsVersion
    } = body;

    if (!pageId) return res.status(400).json({ error: 'Missing pageId' });

    // ===== LIABILITY action =====
    if (action === 'liability') {
      const ts = timestamp || new Date().toISOString();
      const noteLine = 'Signed by ' + (guardianName||'') + ' on ' + ts + (signature ? ' | Sig: '+signature : '') + (email ? ' | Email: '+email : '');

      // 1. Update student record
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Liability Form': { select: { name: '제출 완료' } },
          '특이사항 (Notes)': { rich_text: [{ text: { content: '[LIABILITY] ' + noteLine } }] }
        }
      });

      // 2. Send email via Resend
      let emailSent = false;
      let emailStatus = '발송 안 함';
      if (process.env.RESEND_API_KEY && email) {
        try {
          const html = buildEmailHtml({ studentName, studentDept, guardian: guardianName, signature, timestamp: ts, termsVersion });
          const subject = '[Amicus] 책임 동의서 제출 확인 — ' + (studentName || '');
          const r = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': 'Bearer ' + process.env.RESEND_API_KEY,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: 'Amicus Education <onboarding@resend.dev>',
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
        const titleStr = (studentName || '학생') + ' · ' + ts.slice(0,10);
        await notion.pages.create({
          parent: { database_id: LIABILITY_ARCHIVE_DB },
          properties: {
            '제출 제목': { title: [{ text: { content: titleStr } }] },
            '학생 이름': { rich_text: [{ text: { content: studentName || '' } }] },
            '학생 부서': studentDept ? { select: { name: studentDept } } : { select: null },
            '보호자 이름': { rich_text: [{ text: { content: guardianName || '' } }] },
            '서명 (텍스트)': { rich_text: [{ text: { content: signature || '' } }] },
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

    // ===== General update =====
    const props = {};
    if (name !== undefined) props['이름 (Name)'] = { title: [{ text: { content: name } }] };
    if (department !== undefined) props['부서 (Department)'] = { select: department ? { name: department } : null };
    if (grade !== undefined) props['학년 (Grade)'] = { rich_text: [{ text: { content: grade||'' } }] };
    if (allergy !== undefined) props['알러지 (Allergy)'] = { rich_text: [{ text: { content: allergy||'' } }] };
    if (notes !== undefined) props['특이사항 (Notes)'] = { rich_text: [{ text: { content: notes||'' } }] };
    if (liabilityForm !== undefined) props['Liability Form'] = { select: liabilityForm ? { name: liabilityForm } : null };
    if (status !== undefined) props['상태 (Status)'] = { select: status ? { name: status } : null };
    if (lastAttended !== undefined) props['마지막 출석 (Last Attended)'] = { date: { start: lastAttended } };

    if (Object.keys(props).length > 0) {
      await notion.pages.update({ page_id: pageId, properties: props });
    }
    return res.json({ success: true, action: 'updated' });
  } catch(e) {
    console.error('update-student error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
