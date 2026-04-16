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

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { name } = req.query;
  if (!name || !name.trim()) return res.status(400).json({ error: "name required" });

  try {
    const response = await fetch("https://api.notion.com/v1/databases/" + STUDENT_DB + "/query", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          or: [
            { property: "이름 (Name)", title: { contains: name.trim() } },
            { property: "영문이름 (Name EN)", rich_text: { contains: name.trim() } },
          ]
        },
        page_size: 20,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message });

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toLocaleDateString("sv-SE", { timeZone: TIMEZONE });

    const students = (data.results || []).map(p => {
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

      let phone = fatherPhone || motherPhone || ph("연락처 (Phone)");

      const needsContact = lastAttended ? lastAttended < twoWeeksAgo : !isVisitor;
      const birthdayThisMonth = isBirthdayThisMonth(dob);
      const birthdayToday = isBirthdayToday(dob);

      return {
        id: p.id,
        studentId: props["고유번호 (ID)"]?.unique_id
          ? "AMC-" + String(props["고유번호 (ID)"].unique_id.number).padStart(3, "0")
          : "",
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
      };
    }).filter(s => !s.status || s.status === "활성 (Active)");

    return res.status(200).json({ students });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
