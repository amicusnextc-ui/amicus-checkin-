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
  if (dow === 6) return null;
  const sunday = new Date(laDay);
  sunday.setUTCDate(laDay.getUTCDate() - dow);
  return sunday.toISOString().split('T')[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentName, studentId, recordId } = req.body || {};
    if (!studentName && !recordId) return res.status(400).json({ error: 'Missing studentName or recordId' });

    const serviceSunday = getServiceSunday();
    if (!serviceSunday) {
      return res.status(403).json({ error: 'Saturday is reset day', resetDay: true });
    }

    // Non-Sunday check-outs require director password
    const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const isSundayToday = todayLA === serviceSunday;
    if (!isSundayToday) {
      if (req.body.directorPassword !== '3167') {
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
