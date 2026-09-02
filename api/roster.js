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
    res.json({ students: cleanStudents });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
};
