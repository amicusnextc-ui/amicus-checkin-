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
          name: props["이름 (Name)"]?.title?.[0]?.plain_text || "",
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
          baptized: props["세례 여부 (Baptized)"]?.select?.name || "",
          photo: props["사진 촬영 (Photo)"]?.select?.name || "",
          householdMatch: true,
    };
}

module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
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
          return res.status(200).json({ students });
    } catch (e) {
          return res.status(500).json({ error: e.message });
    }
};
