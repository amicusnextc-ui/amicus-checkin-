const TIMEZONE = 'America/Los_Angeles';
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB || '89b6c47f85a842968493ce28ad93f8de';
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const NOTION_VERSION = '2022-06-28';

function getServiceSunday() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
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
    const { studentId, name, department } = req.body || {};
    if (!name && !studentId) return res.status(400).json({ error: 'Missing name or studentId' });

    const serviceSunday = getServiceSunday();
    if (!serviceSunday) return res.status(403).json({ error: 'Saturday is reset day', resetDay: true });

    // Day-of-week gate: non-Sunday requires director password
    const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const isSundayToday = todayLA === serviceSunday;
    if (!isSundayToday) {
      if (req.body.directorPassword !== '3167') {
        return res.status(403).json({ error: '일요일 외 체크인 취소는 디렉터 인증이 필요합니다', requiresDirectorAuth: true });
      }
    }

    const notionHeaders = {
      'Authorization': 'Bearer ' + NOTION_TOKEN,
      'Notion-Version': NOTION_VERSION,
      'Content-Type': 'application/json'
    };

    // 1. Find attendance record for this student + serviceSunday
    const queryRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
      method: 'POST',
      headers: notionHeaders,
      body: JSON.stringify({
        filter: { and: [
          { property: '\uC8FC\uC77C \uB0A0\uC9DC (Date)', date: { equals: serviceSunday } },
          { property: '\uC774\uB984 (Name)', title: { equals: name } }
        ]},
        page_size: 5
      })
    });
    const queryData = await queryRes.json();
    if (!queryRes.ok) return res.status(500).json({ error: queryData.message || 'query failed' });

    const records = queryData.results || [];
    if (records.length === 0) {
      return res.json({ success: false, message: '이번 주 출석 기록이 없습니다' });
    }

    // 2. Archive the record(s) — Notion soft-delete (reversible for 30 days)
    const archived = [];
    for (const rec of records) {
      const arRes = await fetch('https://api.notion.com/v1/pages/' + rec.id, {
        method: 'PATCH',
        headers: notionHeaders,
        body: JSON.stringify({ archived: true })
      });
      if (arRes.ok) archived.push(rec.id);
    }

    // 3. Recompute student's lastAttended from remaining attendance records
    let newLastAttended = null;
    if (studentId) {
      // Query attendance for this student (by name), find max date
      const histRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
        method: 'POST',
        headers: notionHeaders,
        body: JSON.stringify({
          filter: { property: '\uC774\uB984 (Name)', title: { equals: name } },
          sorts: [{ property: '\uC8FC\uC77C \uB0A0\uC9DC (Date)', direction: 'descending' }],
          page_size: 1
        })
      });
      const histData = await histRes.json();
      const latest = (histData.results || [])[0];
      if (latest) {
        newLastAttended = latest.properties?.['\uC8FC\uC77C \uB0A0\uC9DC (Date)']?.date?.start || null;
      }

      // Update student record
      try {
        await fetch('https://api.notion.com/v1/pages/' + studentId, {
          method: 'PATCH',
          headers: notionHeaders,
          body: JSON.stringify({
            properties: newLastAttended
              ? { '\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)': { date: { start: newLastAttended } } }
              : { '\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)': { date: null } }
          })
        });
      } catch(e) { console.warn('lastAttended revert failed:', e.message); }
    }

    return res.json({ success: true, archivedCount: archived.length, archivedIds: archived, newLastAttended, serviceSunday });

  } catch(e) {
    console.error('checkin-cancel error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
