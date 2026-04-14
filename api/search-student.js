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
            { property: "\uC774\uB984 (Name)", title: { contains: name.trim() } },
            { property: "\uC601\uBB38\uC774\uB984 (Name EN)", rich_text: { contains: name.trim() } },
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
      const dob = props["\uC0DD\uB144\uC6D4\uC77C (DOB)"]?.date?.start || "";
      const lastAttended = props["\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)"]?.date?.start || "";
      const dept = props["\uBD80\uC11C (Department)"]?.select?.name || "";
      const status = props["\uC0C1\uD0DC (Status)"]?.select?.name || "";
      const isVisitor = props["\uBC29\uBB38\uC790 (Visitor)"]?.checkbox || false;
      const fatherName = rt("\uC544\uBC84\uC9C0 \uC774\uB984 (Father Name)");
      const motherName = rt("\uC5B4\uBA38\uB2C8 \uC774\uB984 (Mother Name)");
      const fatherPhone = ph("\uC544\uBC84\uC9C0 \uC5F0\uB77D\uCC98 (Father Phone)");
      const motherPhone = ph("\uC5B4\uBA38\uB2C8 \uC5F0\uB77D\uCC98 (Mother Phone)");

      // Build guardian display string from father/mother
      let guardian = "";
      if (fatherName && motherName) guardian = fatherName + " / " + motherName;
      else if (fatherName) guardian = fatherName;
      else if (motherName) guardian = motherName;
      // Fallback to legacy guardian field
      if (!guardian) guardian = rt("\uBCF4\uD638\uC790 (Guardian)");

      let phone = fatherPhone || motherPhone || ph("\uC5F0\uB77D\uCC98 (Phone)");

      const needsContact = lastAttended ? lastAttended < twoWeeksAgo : !isVisitor;
      const birthdayThisMonth = isBirthdayThisMonth(dob);
      const birthdayToday = isBirthdayToday(dob);

      return {
        id: p.id,
        studentId: props["\uACE0\uC720\uBC88\uD638 (ID)"]?.unique_id
          ? "AMC-" + String(props["\uACE0\uC720\uBC88\uD638 (ID)"].unique_id.number).padStart(3, "0")
          : "",
        name: props["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "",
        nameEN: rt("\uC601\uBB38\uC774\uB984 (Name EN)"),
        department: dept,
        grade: rt("\uD559\uB144 (Grade)"),
        allergy: rt("\uC54C\uB7EC\uC9C0 (Allergy)"),
        notes: rt("\uD2B9\uC774\uC0AC\uD56D (Notes)"),
        status,
        isVisitor,
        liabilityForm: props["Liability Form"]?.select?.name || "\uBBF8\uC81C\uCD9C",
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
      };
    }).filter(s => !s.status || s.status === "\uD65C\uC131 (Active)");

    return res.status(200).json({ students });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};