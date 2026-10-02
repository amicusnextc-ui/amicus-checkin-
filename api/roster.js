const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_STUDENT_DB_ID;

function prop(page, name) {
  const p = page.properties[name];
  if (!p) return null;
  switch(p.type) {
    case 'title': return p.title.map(t=>t.plain_text).join('');
    case 'rich_text': return p.rich_text.map(t=>t.plain_text).join('');
    case 'select': return p.select?.name || null;
    case 'date': return p.date?.start || null;
    case 'phone_number': return p.phone_number || null;
    case 'email': return p.email || null;
    case 'checkbox': return p.checkbox;
    case 'unique_id': return p.unique_id?.number ? String(p.unique_id.number) : null;
    case 'auto_increment_id': return p.unique_id?.number ? String(p.unique_id.number) : null;
    default: return null;
  }
}

function cleanName(raw) {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
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
  const { dept, includeVisitors, status } = req.query;
  // Task #274: status=archived shows only archived students (non-active OR 졸업)
  // Default (no status param): only 활성 + non-졸업 students
  const isArchived = (status === 'archived');
  let filter = isArchived
    ? {
        or: [
          { property: '상태 (Status)', select: { does_not_equal: '활성 (Active)' } },
          { property: '부서 (Department)', select: { equals: '졸업' } }
        ]
      }
    : {
        and: [
          { property: '상태 (Status)', select: { equals: '활성 (Active)' } },
          { property: '부서 (Department)', select: { does_not_equal: '졸업' } },
        ]
      };
  // includeVisitors=true → include 방문자=YES (for staff name lookups). Default excludes visitors so dashboard counts stay accurate.
  if (!isArchived && (!includeVisitors || includeVisitors === 'false')) {
    filter.and.unshift({ property: '방문자 (Visitor)', checkbox: { equals: false } });
  }
  if (dept && !isArchived) filter.and.push({ property: '부서 (Department)', select: { equals: dept } });
  // Task #277: archived dept filter — done in JS after fetch since Notion select doesn't support contains/prefix match

  try {
    let allPages = [], cursor;
    do {
      const resp = await notion.databases.query({
        database_id: DB,
        filter,
        sorts: [{ property: '이름 (Name)', direction: 'ascending' }],
        start_cursor: cursor,
        page_size: 100
      });
      allPages = allPages.concat(resp.results);
      cursor = resp.has_more ? resp.next_cursor : null;
    } while (cursor);

    const now = new Date();
    const students = allPages.map(page => {
      const d = prop(page, '부서 (Department)');
      const isJrPlus = d && !['유아부 (Infant)', '유치부 (Preschool)'].includes(d);
      const dob = prop(page, '생년월일 (DOB)');
      let age = null, isBirthdayMonth = false;
      if (dob) {
        const bd = new Date(dob);
        isBirthdayMonth = bd.getMonth() === now.getMonth();
        age = now.getFullYear() - bd.getFullYear() -
          (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate()) ? 1 : 0);
      }
      const fatherPhone = prop(page, '아버지 연락처 (Father Phone)');
      const motherPhone = prop(page, '어머니 연락처 (Mother Phone)');

      // Read studentId directly from unique_id property to handle both type names
      const idProp = page.properties['고유번호 (ID)'];
      const idNum = idProp?.unique_id?.number || idProp?.number || null;
      const studentId = idNum ? 'AMC-' + String(idNum).padStart(3, '0') : null;

      return {
        id: page.id,
        name: cleanName(prop(page, '이름 (Name)')),
        nameEN: prop(page, '영문이름 (Name EN)'),
        department: d,
        grade: prop(page, '학년 (Grade)'),
        school: isJrPlus ? prop(page, '학교 (School)') : null,
        dob,
        age,
        isBirthdayMonth,
        guardian: prop(page, '보호자 (Guardian)'),
        phone: fatherPhone || motherPhone,
        fatherName: prop(page, '아버지 이름 (Father Name)'),
        fatherPhone,
        fatherEmail: prop(page, '아버지 이메일 (Father Email)'),
        motherName: prop(page, '어머니 이름 (Mother Name)'),
        motherPhone,
        motherEmail: prop(page, '어머니 이메일 (Mother Email)'),
        address: prop(page, '집주소 (Address)'),
        allergy: prop(page, '알러지 (Allergy)'),
        notes: prop(page, '특이사항 (Notes)'),
        liabilityForm: prop(page, 'Liability Form'),
        baptized: prop(page, '세례 여부 (Baptized)'),
        photo: prop(page, '사진 촬영 (Photo)'),
        status: prop(page, '상태 (Status)'),
        studentId,
        lastAttended: prop(page, '마지막 출석 (Last Attended)'),
        inviteSentAt: prop(page, '안내 발송일 (Invite Sent)'),
        isVisitor: (function(){ try { return !!(page.properties['방문자 (Visitor)'] || {}).checkbox; } catch(e) { return false; } })(), /* Task #369: 명단에서 방문자 구분 */
        photoUrl: (function(){ try { var _f = page.properties['사진 (Photo)']; var _x = _f && _f.files && _f.files[0]; return _x ? ((_x.file && _x.file.url) || (_x.external && _x.external.url) || '') : ''; } catch(e){ return ''; } })(),
      };
    });
    // Task #276: archived mode — filter out test pollution (🗑️/🧪 prefix + empty names)
    let cleanStudents = students;
    if (isArchived) {
      var _deptShort = (dept || '').split(' ')[0];
      cleanStudents = students.filter(function(s) {
        var nm = (s.name || '').trim();
        if (!nm) return false; // empty name = orphan/test
        if (nm.indexOf('\ud83d\uddd1\ufe0f') === 0) return false; // 🗑️ trash prefix
        if (nm.indexOf('\ud83e\uddea') === 0) return false; // 🧪 test prefix
        // Task #277: dept short-name prefix match (handles 'Youth'/'Middle/High' variants)
        if (_deptShort) {
          var sd = (s.department || '');
          if (sd.indexOf(_deptShort) < 0) return false;
        }
        return true;
      });
    }
    /* === Task #371: 키 종류별 필드 축소 ===
       STAFF_SECRET 이 설정돼 있고 요청 토큰이 그것과 다르면(= 키오스크 키),
       연락처·이메일·집주소를 값 대신 "있음/없음" 플래그로만 반환한다.
       STAFF_SECRET 미설정 시에는 아무것도 바뀌지 않음 (기존 동작 유지). */
    {
      const _staffSecret = process.env.STAFF_SECRET || '';
      if (_staffSecret) {
        let _tok = '';
        try {
          const _h2 = String((req.headers && req.headers.authorization) || '');
          if (_h2.toLowerCase().indexOf('bearer ') === 0) _tok = _h2.slice(7).trim();
          else if (req.headers && req.headers['x-api-key']) _tok = String(req.headers['x-api-key']).trim();
          else if (req.query && req.query.apiKey) _tok = String(req.query.apiKey).trim();
        } catch (e) {}
        /* Task #372: 학부모 HMAC 토큰 예외.
           parent-info 링크가 가진 토큰이 유효하면, 그 학생 "한 명만" 전체 필드로 반환한다.
           전체 명단 열람은 여전히 불가 — 축소보다 오히려 더 좁다. */
        let _parentOk = false;
        try {
          const _sid = String((req.query && (req.query.studentId || req.query.student)) || '').trim();
          const _ptok = String((req.query && req.query.token) || '').trim();
          if (_sid && _ptok) {
            const _sec = process.env.REGISTER_TOKEN_SECRET || 'amicus-default-secret-change-me';
            const _full = require('crypto').createHmac('sha256', _sec).update('info:' + _sid).digest('hex');
            if (_ptok === _full.slice(0, 16) || _ptok === _full.slice(0, 32)) {
              cleanStudents = cleanStudents.filter(function (s) {
                return s.id === _sid || s.studentId === _sid;
              });
              _parentOk = true;
            }
          }
        } catch (e) {}
        if (_tok !== _staffSecret && !_parentOk) {
          const _has = function (v) { return !!(v && String(v).trim()); };
          cleanStudents = cleanStudents.map(function (st) {
            const o = Object.assign({}, st);
            o.hasFatherPhone = _has(o.fatherPhone);
            o.hasMotherPhone = _has(o.motherPhone);
            o.hasPhone       = _has(o.phone) || o.hasFatherPhone || o.hasMotherPhone;
            o.hasFatherEmail = _has(o.fatherEmail);
            o.hasMotherEmail = _has(o.motherEmail);
            o.hasEmail       = o.hasFatherEmail || o.hasMotherEmail;
            o.hasAddress     = _has(o.address);
            delete o.fatherPhone; delete o.motherPhone; delete o.phone;
            delete o.fatherEmail; delete o.motherEmail; delete o.address;
            return o;
          });
        }
      }
    }
    res.json({ students: cleanStudents });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
