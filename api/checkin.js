const TIMEZONE = 'America/Los_Angeles';
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB || '89b6c47f85a842968493ce28ad93f8de';
const STUDENT_DB = process.env.NOTION_STUDENT_DB || '107828732f784c39bcb0136a4397c758';

// Get the Sunday date for the current service week (LA time)
// Sun: today, Mon-Fri: last Sunday, Sat: returns null (reset day)
function getServiceSunday() {
  
    /* Task #313 M6: reject if we're still in Saturday LA time (< Sunday 00:00 LA) */
    {
      const _laNow = new Date().toLocaleString('en-US', { timeZone: TIMEZONE });
      const _laDate = new Date(_laNow);
      const _laDow = _laDate.getDay();
      const _laHour = _laDate.getHours();
      if (_laDow === 6 && _laHour >= 22) {
        if (!body.directorPassword && !body.bypassLiability) {
          return res.status(400).json({ error: '체크인은 일요일 오전 12시 이후부터 가능합니다. Check-in opens Sunday 12:00 AM.', code: 'SATURDAY_LATE_BOUNDARY' });
        }
      }
    }
    const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'
  }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay(); // 0=Sun,1=Mon,...,6=Sat
  if (dow === 6) { const _s = new Date(laDay); _s.setUTCDate(laDay.getUTCDate() + 1); return _s.toISOString().split('T')[0]; } // Sat → next Sun (director auth required downstream)
  const diff = dow; // days since Sunday
  const sunday = new Date(laDay);
  sunday.setUTCDate(laDay.getUTCDate() - diff);
  return sunday.toISOString().split('T')[0];
}

module.exports = async (req, res) => {
  /* Task #313: CORS whitelist */
  {
    const _allowed = ['https://amicus-checkin.vercel.app', 'https://amicuschurch.com', 'https://www.amicuschurch.com'];
    const _origin = (req.headers && req.headers.origin) || '';
    const _isPreview = /^https:\/\/amicus-checkin-[a-z0-9-]+\.vercel\.app$/.test(_origin);
    if (_allowed.indexOf(_origin) >= 0 || _isPreview) { res.setHeader('Access-Control-Allow-Origin', _origin); res.setHeader('Vary', 'Origin'); }
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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

  // === CANCEL branch: uncheckin (soft-delete attendance + revert student.lastAttended) ===
  if (req.body && req.body.action === 'cancel') {
    try {
      const { studentId, name, department } = req.body;
      if (!name && !studentId) return res.status(400).json({ error: 'Missing name or studentId' });
      const serviceSundayC = getServiceSunday();
      if (!serviceSundayC) return res.status(403).json({ error: 'Saturday is reset day', resetDay: true });
      const todayLAc = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
      const isSundayTodayC = todayLAc === serviceSundayC;
      if (!isSundayTodayC && req.body.directorPassword !== process.env.DIRECTOR_PASSWORD) {
        return res.status(403).json({ error: '디렉터 인증이 필요합니다', requiresDirectorAuth: true });
      }
      const hdrs = { 'Authorization': 'Bearer ' + process.env.NOTION_TOKEN, 'Notion-Version': '2022-06-28', 'Content-Type': 'application/json' };
      // Find the attendance record(s) for this student this week
      const qRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
        method: 'POST', headers: hdrs,
        body: JSON.stringify({ filter: { and: [
          { property: '\uc8fc\uc77c \ub0a0\uc9dc (Date)', date: { equals: serviceSundayC } },
          { property: '\uc774\ub984 (Name)', title: { equals: name } }
        ]}, page_size: 5 })
      });
      const qData = await qRes.json();
      const recs = qData.results || [];
      if (recs.length === 0) return res.json({ success: false, message: '이번 주 출석 기록이 없습니다' });
      const archived = [];
      for (const rec of recs) {
        const aRes = await fetch('https://api.notion.com/v1/pages/' + rec.id, { method: 'PATCH', headers: hdrs, body: JSON.stringify({ archived: true }) });
        if (aRes.ok) archived.push(rec.id);
      }
      // Recompute student's lastAttended from remaining records
      let newLast = null;
      if (studentId) {
        const hRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
          method: 'POST', headers: hdrs,
          body: JSON.stringify({ filter: { property: '\uc774\ub984 (Name)', title: { equals: name } }, sorts: [{ property: '\uc8fc\uc77c \ub0a0\uc9dc (Date)', direction: 'descending' }], page_size: 1 })
        });
        const hData = await hRes.json();
        const latest = (hData.results || [])[0];
        if (latest) newLast = latest.properties?.['\uc8fc\uc77c \ub0a0\uc9dc (Date)']?.date?.start || null;
        try {
          await fetch('https://api.notion.com/v1/pages/' + studentId, {
            method: 'PATCH', headers: hdrs,
            body: JSON.stringify({ properties: newLast ? { ['\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)']: { date: { start: newLast } } } : { ['\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)']: { date: null } } })
          });
        } catch(eu) { console.warn('lastAttended revert failed:', eu.message); }
      }
      return res.json({ success: true, archivedCount: archived.length, archivedIds: archived, newLastAttended: newLast, serviceSunday: serviceSundayC });
    } catch(ec) { console.error('cancel error:', ec.message); return res.status(500).json({ error: ec.message }); }
  }

  try {
    const { studentId, studentName, name, department, isVisitor, isNew, allergyAlert, hasAllergy, staffName, staff, guardianName, notes } = req.body || {};
    const displayName = studentName || name || '';
    const isVisitorFlag = isVisitor === true || isNew === true;
    const allergyFlag = allergyAlert === true || hasAllergy === true;
    const staffField = staffName || staff || '';
    if (!studentId && !displayName) return res.status(400).json({ error: 'Missing studentId or name' });

    // Get service Sunday
    const serviceSunday = getServiceSunday();
    if (!serviceSunday) {
      return res.status(403).json({ error: 'Saturday is reset day - no check-ins', resetDay: true });
    }

    // Non-Sunday check-ins require director password
    const todayLA = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(new Date());
    const isSundayToday = todayLA === serviceSunday;
    if (!isSundayToday) {
      if (req.body.directorPassword !== process.env.DIRECTOR_PASSWORD) {
        return res.status(403).json({ error: '일요일 외 체크인은 디렉터 인증이 필요합니다', requiresDirectorAuth: true });
      }
    }

    const now = new Date();
    const checkInTime = now.toLocaleTimeString('ko-KR', { timeZone: TIMEZONE, hour: '2-digit', minute: '2-digit' });

    // Check for existing attendance record for this service week
    const checkRes = await fetch('https://api.notion.com/v1/databases/' + ATTENDANCE_DB + '/query', {
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
            { property: '\uc774\ub984 (Name)', rich_text: { equals: displayName || studentId } }
          ].concat(department ? [{ property: '\ubd80\uc11c (Department)', select: { equals: department } }] : [])
        }
      })
    });
    const checkData = await checkRes.json();
    const existing = checkData.results?.[0];

    if (existing) {
      // Already checked in this week - update time (Task #312: verify response)
      const _upRes = await fetch('https://api.notion.com/v1/pages/' + existing.id, {
        method: 'PATCH',
        headers: {
          'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          properties: {
            '\uccb4\ud06c\uc778 \uc2dc\uac04 (Check-in)': { rich_text: [{ text: { content: checkInTime } }] }
          }
        })
      });
      if (!_upRes.ok) {
        let _eb = '';
        try { _eb = (await _upRes.text()).slice(0, 200); } catch(e){}
        throw new Error('Notion checkin update failed: HTTP ' + _upRes.status + ' ' + _eb);
      }
      return res.json({ success: true, action: 'updated', existingId: existing.id, serviceSunday, checkInTime });
    }

    // Create new attendance record for this service week
    const props = {
      '\uc774\ub984 (Name)': { title: [{ text: { content: displayName || studentId } }] },
      '\uc8fc\uc77c \ub0a0\uc9dc (Date)': { date: { start: serviceSunday } },
      '\uccb4\ud06c\uc778 \uc2dc\uac04 (Check-in)': { rich_text: [{ text: { content: checkInTime } }] },
      '\ubd80\uc11c (Department)': { select: department ? { name: department } : null },
    };
    if (isVisitorFlag) props['\ubc29\ubb38\uc790 (Visitor)'] = { checkbox: true };
    if (allergyFlag) props['\uc54c\ub7ec\uc9c0 \uc54c\ub9bc (Allergy Alert)'] = { checkbox: true };
    if (staffField) props['\uac04\uc0ac (Staff)'] = { rich_text: [{ text: { content: staffField } }] };
    var finalNotes = (req.body.bypassLiability ? '[LIABILITY BYPASS] ' : '') + (notes || ''); if (finalNotes) props['특이사항 (Notes)'] = { rich_text: [{ text: { content: finalNotes } }] };

    // Auto-set checkOut for 중고등부 — they have no formal checkout flow (self-depart)
    if (department && (department.indexOf('중고등부') === 0 || department.indexOf('Middle/High') !== -1 || department.indexOf('Youth') !== -1)) {
      props['체크아웃 시간 (Check-out)'] = { rich_text: [{ text: { content: 'AUTO' } }] };
    }

    const createRes = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties: props })
    });
    const newRecord = await createRes.json();
    // Task #312: verify creation succeeded — Notion returns object with id on success
    if (!createRes.ok || !newRecord.id) {
      throw new Error('Notion attendance record creation failed: HTTP ' + createRes.status + ' ' + JSON.stringify(newRecord).slice(0, 200));
    }

    // Update student last attended — direct Notion API call (avoid Vercel self-fetch flakiness)
    if (studentId) {
      try {
        await fetch('https://api.notion.com/v1/pages/' + studentId, {
          method: 'PATCH',
          headers: {
            'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
            'Notion-Version': '2022-06-28',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ properties: { '\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)': { date: { start: serviceSunday } } } })
        });
      } catch(e) { console.warn('lastAttended update failed:', e.message); }
    }

    return res.json({ success: true, action: 'created', recordId: newRecord.id, serviceSunday, checkInTime });

  } catch(e) {
    console.error('checkin error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
