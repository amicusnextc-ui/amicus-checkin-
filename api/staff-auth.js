// Unified auth endpoint for staff / leader / director
// - GET (legacy):  ?name=<staff_name>&password=<staff_pw>    → staff-role auth (backward compat)
// - POST (new):    { role, name, password }                  → any role
// Returns: { ok, role, name, dept, token } on success
// token = process.env.API_SECRET (used by protected APIs as shared secret)
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
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const STAFF = {
    '\uc774\uc9c0\ud61c': '\uc720\uc544\ubd80 (Infant)',
    '\uae40\ud5a5\uc219': '\uc720\uce58\ubd80 (Preschool)',
    '\ubc15\uc740\ud61c': '\uc720\ub144\ubd80 (Elementary Jr)',
    '\ubc31\uc9c4\uc8fc': '\ucd08\ub4f1\ubd80 (Elementary)',
    '\ubc15\uba85\ucca0': '\uc911\uace0\ub4f1\ubd80 (Youth)',
  };
  // Leader name → dept short ('' or null = all-dept visibility)
  const LEADERS = {
    '\uc774\uac15\ud76c': '\uc911\uace0\ub4f1\ubd80',
    '\ucd5c\uc7ac\uc6d0': null,
  };
  const DIRECTORS = new Set(['\ubc15\uba85\ucca0']);

  let role, name, password;
  if (req.method === 'POST') {
    const body = req.body || {};
    role = body.role || 'staff';
    name = body.name;
    password = body.password;
  } else if (req.method === 'GET') {
    role = 'staff';
    name = req.query.name;
    password = req.query.password;
  } else {
    return res.status(405).end();
  }

  if (!name || !password) return res.status(400).json({ ok: false, error: 'missing params' });

  const staffPw = process.env.STAFF_PASSWORD || process.env.ADMIN_PASSWORD;
  const leaderPw = process.env.LEADER_PASSWORD;
  const directorPw = process.env.DIRECTOR_PASSWORD;

  let ok = false;
  let dept = null;

  if (role === 'staff') {
    if (staffPw && password === staffPw && STAFF[name]) {
      ok = true;
      dept = STAFF[name];
    }
  } else if (role === 'leader') {
    if (leaderPw && password === leaderPw && LEADERS.hasOwnProperty(name)) {
      ok = true;
      dept = LEADERS[name]; // may be null → sees all depts
    }
  } else if (role === 'director') {
    if (directorPw && password === directorPw && DIRECTORS.has(name)) {
      ok = true;
      dept = null;
    }
  }

  if (!ok) {
    return res.status(401).json({ ok: false, error: '\ube44\ubc00\ubc88\ud638\uac00 \ud2c0\ub838\uc2b5\ub2c8\ub2e4' });
  }

  const token = process.env.API_SECRET || null;
  return res.status(200).json({ ok: true, role, name, dept, token });
};
