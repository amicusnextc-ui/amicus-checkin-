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
  res.setHeader('Access-Control-Allow-Origin', '*');
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
