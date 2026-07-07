const TIMEZONE = 'America/Los_Angeles';
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB || '89b6c47f85a842968493ce28ad93f8de';

// Returns this week's Sunday date (or last Sunday if Mon-Fri, null if Saturday)
function getServiceSunday() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'
  }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay();
  if (dow === 6) return null; // Saturday = reset
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

  /* Task #313: CORS whitelist */
  {
    const _allowed = ['https://amicus-checkin.vercel.app', 'https://amicuschurch.com', 'https://www.amicuschurch.com'];
    const _origin = (req.headers && req.headers.origin) || '';
    const _isPreview = /^https:\/\/amicus-checkin-[a-z0-9-]+\.vercel\.app$/.test(_origin);
    if (_allowed.indexOf(_origin) >= 0 || _isPreview) { res.setHeader('Access-Control-Allow-Origin', _origin); res.setHeader('Vary', 'Origin'); }
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const name = req.query.name || req.query.studentName;
    if (!name) return res.status(400).json({ error: 'Missing name' });

    const serviceSunday = getServiceSunday();

    // Saturday = reset day, show as not checked in
    if (!serviceSunday) {
      return res.json({
        checkedInToday: false, checkedOutToday: false,
        checkInTime: null, checkOutTime: null,
        serviceSunday: null, resetDay: true
      });
    }

    // Query attendance for this service week
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
            { property: '\uc774\ub984 (Name)', rich_text: { equals: name } }
          ]
        }
      })
    });
    const data = await queryRes.json();
    const record = data.results?.[0];

    if (!record) {
      return res.json({ checkedInToday: false, checkedOutToday: false, checkInTime: null, checkOutTime: null, serviceSunday });
    }

    const checkIn = record.properties?.['\uccb4\ud06c\uc778 \uc2dc\uac04 (Check-in)']?.rich_text?.[0]?.text?.content || null;
    const checkOut = record.properties?.['\uccb4\ud06c\uc544\uc6c3 \uc2dc\uac04 (Check-out)']?.rich_text?.[0]?.text?.content || null;

    return res.json({
      checkedInToday: !!checkIn,
      checkedOutToday: !!checkOut,
      checkInTime: checkIn,
      checkOutTime: checkOut,
      recordId: record.id,
      serviceSunday
    });

  } catch(e) {
    console.error('check-status error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
