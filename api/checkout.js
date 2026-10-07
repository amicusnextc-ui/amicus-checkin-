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
      if (_provided !== _expected && !(process.env.STAFF_SECRET && _provided === process.env.STAFF_SECRET)) {
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

    /* === Task #374: 체크아웃 무결성 ===
       이전 동작: 이름으로 찾아 results[0]을 집고, 이미 체크아웃됐는지 보지 않고
       체크아웃 시각만 덮어썼다. guardianConfirmed는 받기만 하고 버렸다.
       → 동명이인이면 엉뚱한 아이가 인계 처리되고, 두 번 누르면 최초 시각이 사라지고,
         "보호자 확인함"이 어디에도 남지 않았다. */
    const guardianConfirmed = body.guardianConfirmed === true || body.guardianConfirmed === 'true';
    const releasedTo = String(body.releasedTo || body.releasedToName || '').trim().slice(0, 120);
    const _METHODS = ['보호자', '지정 픽업', '본인 귀가', '예외'];
    const checkoutMethod = _METHODS.indexOf(String(body.checkoutMethod || '')) >= 0
      ? String(body.checkoutMethod) : '보호자';

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
      const _hits = data.results || [];
      if (_hits.length === 0) {
        return res.status(404).json({ error: 'No check-in record found for this week', serviceSunday });
      }
      /* Task #374: 동명이인이면 추측하지 않는다. 예전에는 results[0]을 집어서
         같은 이름의 다른 아이가 인계 처리될 수 있었다. */
      if (_hits.length > 1) {
        return res.status(409).json({
          error: '같은 이름의 출석 기록이 ' + _hits.length + '건입니다. 명단에서 학생을 직접 선택해 주세요.',
          ambiguous: true, count: _hits.length, serviceSunday
        });
      }
      targetId = _hits[0].id;
    }

    /* Task #374: 쓰기 전에 대상 기록을 읽는다 — 이미 체크아웃됐는지 확인하고
       최초 시각을 덮어쓰지 않기 위해. */
    const _notionHeaders = {
      'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
      'Notion-Version': '2022-06-28',
      'Content-Type': 'application/json'
    };
    const _getRes = await fetch('https://api.notion.com/v1/pages/' + targetId, { headers: _notionHeaders });
    if (!_getRes.ok) {
      return res.status(404).json({ error: '출석 기록을 찾을 수 없습니다 (HTTP ' + _getRes.status + ')', recordId: targetId });
    }
    const _page = await _getRes.json();
    const _rt = function (key) {
      try {
        return ((_page.properties[key] || {}).rich_text || []).map(function (t) { return t.plain_text || ''; }).join('').trim();
      } catch (e) { return ''; }
    };
    const _existingOut = _rt('체크아웃 시간 (Check-out)');
    const _recordName = (function () {
      try { return (((_page.properties['이름 (Name)'] || {}).title) || []).map(function (t) { return t.plain_text || ''; }).join('').trim(); }
      catch (e) { return ''; }
    })();

    if (_existingOut) {
      /* 되돌리기가 필요한 경우(오체크아웃 정정)에만 디렉터 인증으로 강제 허용하고,
         최초 시각은 특이사항에 남긴다. */
      const _forcing = body.force === true && body.directorPassword === process.env.DIRECTOR_PASSWORD;
      if (!_forcing) {
        return res.status(409).json({
          error: '이미 체크아웃된 학생입니다 (' + _existingOut + ')',
          alreadyCheckedOut: true, checkOutTime: _existingOut,
          recordId: targetId, name: _recordName
        });
      }
    }

    /* Task #374: 보호자 인계 확인을 서버에서 강제한다. 클라이언트 체크박스만 믿지 않는다. */
    if (!guardianConfirmed) {
      return res.status(400).json({
        error: '보호자 인계 확인이 필요합니다. 데려가시는 분을 확인한 뒤 체크해 주세요.',
        guardianRequired: true, recordId: targetId, name: _recordName
      });
    }

    // Update check-out time — Task #312: verify Notion response, don't silently succeed
    const _coRes = await fetch('https://api.notion.com/v1/pages/' + targetId, {
      method: 'PATCH',
      headers: {
        'Authorization': 'Bearer ' + process.env.NOTION_TOKEN,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        properties: (function () {
          /* Task #374: \uc2dc\uac01\ub9cc \ub0a8\uae30\ub358 \uac83\uc744 "\ub204\uac00 \ud655\uc778\ud588\uace0 \ub204\uad6c\uc5d0\uac8c \uc778\uacc4\ud588\ub294\uc9c0"\uae4c\uc9c0 \uae30\ub85d */
          const _p = {
            '\uccb4\ud06c\uc544\uc6c3 \uc2dc\uac04 (Check-out)': { rich_text: [{ text: { content: checkOutTime } }] },
            '\ubcf4\ud638\uc790 \uc778\uacc4 \ud655\uc778 (Guardian)': { checkbox: true },
            '\uc778\uacc4 \ubc29\ubc95 (Method)': { select: { name: checkoutMethod } }
          };
          if (releasedTo) {
            _p['\uc778\uacc4\uc790 (Released To)'] = { rich_text: [{ text: { content: releasedTo } }] };
          }
          if (_existingOut) {
            /* \uac15\uc81c \uc815\uc815\uc77c \ub54c\ub9cc \ub3c4\ub2ec. \ucd5c\ucd08 \uc2dc\uac01\uc744 \uc783\uc9c0 \uc54a\ub3c4\ub85d \ud2b9\uc774\uc0ac\ud56d\uc5d0 \ub0a8\uae34\ub2e4. */
            const _prev = _rt('\ud2b9\uc774\uc0ac\ud56d (Notes)');
            const _line = '[\uccb4\ud06c\uc544\uc6c3 \uc815\uc815 ' + serviceSunday + '] \ucd5c\ucd08 ' + _existingOut + ' \u2192 ' + checkOutTime;
            _p['\ud2b9\uc774\uc0ac\ud56d (Notes)'] = { rich_text: [{ text: { content: ((_prev ? _prev + '\n' : '') + _line).slice(0, 1900) } }] };
          }
          return _p;
        })()
      })
    });
    if (!_coRes.ok) {
      let _errBody = '';
      try { _errBody = (await _coRes.text()).slice(0, 200); } catch(e){}
      throw new Error('Notion checkout PATCH failed: HTTP ' + _coRes.status + ' ' + _errBody);
    }

    /* Task #374: 클라이언트가 "누구에게 인계했는지"를 화면에 보여줄 수 있도록 함께 반환 */
    return res.json({
      success: true, recordId: targetId, checkOutTime, serviceSunday,
      name: _recordName, releasedTo: releasedTo || null,
      checkoutMethod, guardianConfirmed: true
    });

  } catch(e) {
    console.error('checkout error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
