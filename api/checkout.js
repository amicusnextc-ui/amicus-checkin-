const TIMEZONE = 'America/Los_Angeles';
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB || '89b6c47f85a842968493ce28ad93f8de';

function getServiceSunday() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'
  }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay();
  if (dow === 6) { const _s = new Date(laDay); _s.setUTCDate(laDay.getUTCDate() + 1); return _s.toISOString().split('T')[0]; } // Sat → next Sun (director auth required downstream)
  const sunday = new Date(laDay);
  sunday.setUTCDate(laDay.getUTCDate() - dow);
  return sunday.toISOString().split('T')[0];
}

module.exports = async (req, res) => {
  // === AUTH (Task #305): inline soft/hard-mode shared-secret check ===
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

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const studentName = body.studentName || body.name;
    const studentId = body.studentId;
    const recordId = body.recordId || body.pageId;
    if (!studentName && !recordId) return res.status(400).json({ error: 'Missing studentName/name or recordId/pageId', received: Object.keys(body) });

    const serviceSunday = getServiceSunday();
    if (!serviceSunday) {
      return res.status(403).json({ error: 'Saturday is reset day', resetDay: true });
    }

    // Non-Sunday check-outs require director password
    const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const isSundayToday = todayLA === serviceSunday;
    if (!isSundayToday) {
      if (req.body.directorPassword !== process.env.DIRECTOR_PASSWORD) {
        return res.status(403).json({ error: '일요일 외 체크아웃은 디렉터 인증이 필요합니다', requiresDirectorAuth: true });
      }
    }

    const now = new Date();
    const checkOutTime = now.toLocaleTimeString('ko-KR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });

    let targetId = recordId;

    // If no recordId, find the attendance record for this service week
    if (!targetId && studentName) {
      const queryRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          filter: {
            and: [
              { property: '\uc8fc\uc77c \ub0a0\uc9dc (Date)', date: { equals: serviceSunday } },
              { property: '\uc774\ub984 (Name)', rich_text: { equals: studentName } }
            ]
          }
        })
      });
      const data = await queryRes.json();
      const record = data.results?.[0];
      if (!record) {
        return res.status(404).json({ error: 'No check-in record found for this week', serviceSunday });
      }
      targetId = record.id;
    }

    // Update check-out time
    await fetch('https://api.notion.com/v1/pages/' + targetId, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: {
          '\uccb4\ud06c\uc544\uc6c3 \uc2dc\uac04 (Check-out)': { rich_text: [{ text: { content: checkOutTime } }] }
        }
      })
    });

    return res.json({ success: true, recordId: targetId, checkOutTime, serviceSunday });

  } catch(e) {
    console.error('checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
