const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";

function isBirthdayThisMonth(dobStr) {
    if (!dobStr) return false;
    const dob = new Date(dobStr);
    return dob.getMonth() === new Date().getMonth();
}
function isBirthdayToday(dobStr) {
    if (!dobStr) return false;
    const dob = new Date(dobStr);
    const today = new Date();
    return dob.getMonth() === today.getMonth() && dob.getDate() === today.getDate();
}

function mapStudent(p, twoWeeksAgo) {
    const props = p.properties;
    const rt = (field) => props[field]?.rich_text?.[0]?.plain_text || "";
    const ph = (field) => props[field]?.phone_number || "";
    const dob = props["생년월일 (DOB)"]?.date?.start || "";
    const lastAttended = props["마지막 출석 (Last Attended)"]?.date?.start || "";
    const dept = props["부서 (Department)"]?.select?.name || "";
    const status = props["상태 (Status)"]?.select?.name || "";
    const isVisitor = props["방문자 (Visitor)"]?.checkbox || false;
    const fatherName = rt("아버지 이름 (Father Name)");
    const motherName = rt("어머니 이름 (Mother Name)");
    const fatherPhone = ph("아버지 연락처 (Father Phone)");
    const motherPhone = ph("어머니 연락처 (Mother Phone)");
    let guardian = "";
    if (fatherName && motherName) guardian = fatherName + " / " + motherName;
    else if (fatherName) guardian = fatherName;
    else if (motherName) guardian = motherName;
    if (!guardian) guardian = rt("보호자 (Guardian)");
    // phone: 아버지/어머니 연락처만 사용 (연락처 (Phone) 필드 제외)
  const phone = fatherPhone || motherPhone;
    const needsContact = lastAttended ? lastAttended < twoWeeksAgo : !isVisitor;
    const birthdayThisMonth = isBirthdayThisMonth(dob);
    const birthdayToday = isBirthdayToday(dob);
    const idNum = props["고유번호 (ID)"]?.unique_id?.number;
    return {
          id: p.id,
          studentId: idNum ? "AMC-" + String(idNum).padStart(3, "0") : "",
          studentIdNum: idNum || 0,
          name: cleanName(props["이름 (Name)"]?.title?.[0]?.plain_text || ""),
          nameEN: rt("영문이름 (Name EN)"),
          department: dept,
          grade: rt("학년 (Grade)"),
          allergy: rt("알러지 (Allergy)"),
          notes: rt("특이사항 (Notes)"),
          status,
          isVisitor,
          liabilityForm: props["Liability Form"]?.select?.name || "미제출",
          dob,
          lastAttended,
          needsContact,
          birthdayThisMonth,
          birthdayToday,
          guardian,
          phone,
          fatherName,
          motherName,
          fatherPhone,
          motherPhone,
          fatherEmail: props["아버지 이메일 (Father Email)"]?.email || null,
          motherEmail: props["어머니 이메일 (Mother Email)"]?.email || null,
          school: rt("학교 (School)"),
          address: rt("집주소 (Address)"),
          baptized: props["세례 여부 (Baptized)"]?.select?.name || "",
          photo: props["사진 촬영 (Photo)"]?.select?.name || "",
          householdMatch: true,
          checkedInToday: false,
    }

function cleanName(raw) {
  if (!raw) return "";
  return raw.replace(/\s*\([^)]*\)\s*$/, "").trim();
}
;
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
    if (req.method !== "GET") return res.status(405).end();
    const { name, phone4, id3 } = req.query;
    if (!name && !phone4 && !id3)
          return res.status(400).json({ error: "name, phone4, or id3 required" });
    try {
          const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
            .toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
          let filter;
          if (id3) {
                  const num = parseInt(id3, 10);
                  if (isNaN(num)) return res.status(400).json({ error: "invalid id3" });
                  filter = { property: "고유번호 (ID)", unique_id: { equals: num } };
          } else if (phone4) {
                  // 아버지/어머니 연락처만 검색
            filter = {
                      or: [
                        { property: "아버지 연락처 (Father Phone)", phone_number: { contains: phone4 } },
                        { property: "어머니 연락처 (Mother Phone)", phone_number: { contains: phone4 } },
                                ]
            };
          } else {
                  filter = {
                            or: [
                              { property: "이름 (Name)", title: { contains: name.trim() } },
                              { property: "영문이름 (Name EN)", rich_text: { contains: name.trim() } },
                              { property: "아버지 이름 (Father Name)", rich_text: { contains: name.trim() } },
                              { property: "어머니 이름 (Mother Name)", rich_text: { contains: name.trim() } },
                              { property: "보호자 (Guardian)", rich_text: { contains: name.trim() } },
                                    ]
                  };
          }
          const response = await fetch("https://api.notion.com/v1/databases/" + STUDENT_DB + "/query", {
                  method: "POST",
                  headers: {
                            "Authorization": "Bearer " + process.env.NOTION_TOKEN,
                            "Notion-Version": NOTION_VERSION,
                            "Content-Type": "application/json"
                  },
                  body: JSON.stringify({ filter, page_size: 50 }),
          });
          const data = await response.json();
          if (!response.ok) return res.status(500).json({ error: data.message });
          let students = (data.results || [])
            .map(p => mapStudent(p, twoWeeksAgo))
            .filter(s => s.status === "활성 (Active)");
          if (id3) {
                  const suffix = String(id3);
                  students = students.filter(s => {
                            const numStr = String(s.studentIdNum);
                            return numStr.endsWith(suffix) || s.studentId.endsWith(suffix);
                  });
          }
          /* === Task #376: 키 종류별 PII 축소 + householdId ===
             #371이 /api/roster를 줄였지만 이 엔드포인트가 그대로 열려 있어 같은 정보가 샜다.
             rate limit은 1차 방어가 아니다 — 끝 4자리는 경우의 수가 1만 개뿐이고
             서버리스는 인스턴스별로 카운팅돼 사실상 무방비다. 근본 해결은 응답에서 번호를 빼는 것.
             STAFF_SECRET 미설정 시에는 아무것도 바뀌지 않는다(기존 동작 유지). */
          {
            const _staffSecret = process.env.STAFF_SECRET || '';
            if (_staffSecret) {
              let _tok = '';
              try {
                const _h = String((req.headers && req.headers.authorization) || '');
                if (_h.toLowerCase().indexOf('bearer ') === 0) _tok = _h.slice(7).trim();
                else if (req.headers && req.headers['x-api-key']) _tok = String(req.headers['x-api-key']).trim();
                else if (req.query && req.query.apiKey) _tok = String(req.query.apiKey).trim();
              } catch (e) {}

              if (_tok !== _staffSecret) {
                const crypto = require('crypto');
                /* householdId: 끝 4자리가 아니라 정규화한 전체 번호를 HMAC 한다.
                   4자리 해시는 값이 1만 개뿐이라 미리 표를 만들면 그대로 복원된다.
                   REGISTER_TOKEN_SECRET 은 학부모 링크 전용이라 재사용하지 않는다. */
                const _hhSalt = process.env.HOUSEHOLD_SALT || (_staffSecret + ':household');
                const _hh = function (raw) {
                  const d = String(raw || '').replace(/\D/g, '');
                  if (d.length < 7) return null;
                  const nat = d.length > 10 ? d.slice(-10) : d;
                  return crypto.createHmac('sha256', _hhSalt).update('hh:' + nat).digest('hex').slice(0, 16);
                };
                /* 요청자가 직접 입력한 끝 4자리일 때만 마스킹 번호를 돌려준다.
                   id3(AMC 번호) 경로는 입력한 적 없는 4자리를 받게 되므로
                   AMC-001~999 를 훑으면 전원의 끝 4자리가 수집된다 → 플래그만 준다. */
                const _asked4 = String(phone4 || '').replace(/\D/g, '').slice(-4);
                const _has = function (v) { return !!(v && String(v).trim()); };

                students = students.map(function (s) {
                  const o = Object.assign({}, s);
                  const _f = String(o.fatherPhone || ''), _m = String(o.motherPhone || ''), _p = String(o.phone || '');
                  o.householdId = _hh(_f || _m || _p);
                  o.hasFatherPhone = _has(_f);
                  o.hasMotherPhone = _has(_m);
                  o.hasPhone = _has(_p) || o.hasFatherPhone || o.hasMotherPhone;
                  o.hasFatherEmail = _has(o.fatherEmail);
                  o.hasMotherEmail = _has(o.motherEmail);
                  o.hasEmail = o.hasFatherEmail || o.hasMotherEmail;
                  o.hasAddress = _has(o.address);
                  if (_asked4.length === 4) {
                    const _pick = [_f, _m, _p].filter(function (v) {
                      return String(v).replace(/\D/g, '').slice(-4) === _asked4;
                    })[0];
                    o.phoneMasked = _pick ? ('•••-' + _asked4) : null;
                  } else {
                    o.phoneMasked = null;
                  }
                  delete o.fatherPhone; delete o.motherPhone; delete o.phone;
                  delete o.fatherEmail; delete o.motherEmail; delete o.address;
                  delete o.notes;
                  return o;
                });
              }
            }
          }
          return res.status(200).json({ students });
    } catch (e) {
          return res.status(500).json({ error: e.message });
    }
};
