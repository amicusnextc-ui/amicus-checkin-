const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";

// Dept info: age ranges, location, staff
const DEPT_INFO = {
  "\uc720\uc544\ubd80 (Infant)": {
    age: "\ub9cc 24\uac1c\uc6d4 ~ \ub9cc 3\uc138",
    location: "\uc720\uc544\ubd80 \ubc29",
    staff: "\uc774\uc9c0\ud61c \uac04\uc0ac\ub2d8"
  },
  "\uc720\uce58\ubd80 (Preschool)": {
    age: "\ub9cc 4\uc138 ~ Pre-K",
    location: "\uc720\uce58\ubd80 \ubc29",
    staff: "\uae40\ud5a5\uc219 \uac04\uc0ac\ub2d8"
  },
  "\uc720\ub144\ubd80 (Elementary Jr)": {
    age: "Kinder ~ 2\ud559\ub144",
    location: "\uc720\ub144\ubd80 \ubc29",
    staff: "\ubc15\uc740\ud61c \uac04\uc0ac\ub2d8"
  },
  "\ucd08\ub4f1\ubd80 (Elementary)": {
    age: "3\ud559\ub144 ~ 5\ud559\ub144",
    location: "\ucd08\ub4f1\ubd80 \ubc29",
    staff: "\ubc31\uc9c4\uc8fc \uac04\uc0ac\ub2d8"
  },
  "\uc911\uace0\ub4f1\ubd80 (Middle/High)": {
    age: "6\ud559\ub144 ~ 12\ud559\ub144",
    location: "\uc911\uace0\ub4f1\ubd80 \ubc29",
    staff: "\ubc15\uba85\ucca0 \uc804\ub3c4\uc0ac\ub2d8"
  }
};

function getDeptFromAge(dobStr) {
  if (!dobStr) return null;
  const dob = new Date(dobStr);
  const today = new Date();
  // Calculate age in months and years
  const ageMonths = (today.getFullYear() - dob.getFullYear()) * 12 + (today.getMonth() - dob.getMonth());
  const ageYears = today.getFullYear() - dob.getFullYear() - (today.getMonth() < dob.getMonth() || (today.getMonth() === dob.getMonth() && today.getDate() < dob.getDate()) ? 1 : 0);

  if (ageMonths >= 24 && ageYears <= 3) return "\uc720\uc544\ubd80 (Infant)";
  if (ageYears >= 4 && ageYears <= 5) return "\uc720\uce58\ubd80 (Preschool)"; // Pre-K is ~4-5
  if (ageYears >= 5 && ageYears <= 8) return "\uc720\ub144\ubd80 (Elementary Jr)"; // Kinder-2nd
  if (ageYears >= 8 && ageYears <= 11) return "\ucd08\ub4f1\ubd80 (Elementary)"; // 3rd-5th
  if (ageYears >= 11) return "\uc911\uace0\ub4f1\ubd80 (Middle/High)"; // 6th-12th
  return null;
}

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
    const response = await fetch(`https://api.notion.com/v1/databases/${STUDENT_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: { or: [
          { property: "\uc774\ub984 (Name)", title: { contains: name.trim() } },
          { property: "\uc601\ubb38\uc774\ub984 (Name EN)", rich_text: { contains: name.trim() } },
        ]},
        page_size: 20,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message });

    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Los_Angeles" });
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toLocaleDateString("sv-SE", { timeZone: "America/Los_Angeles" });

    const students = (data.results || []).map(p => {
      const dob = p.properties["\uc0dd\ub144\uc6d4\uc77c (DOB)"]?.date?.start || "";
      const lastAttended = p.properties["\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)"]?.date?.start || "";
      const dept = p.properties["\ubd80\uc11c (Department)"]?.select?.name || "";
      const deptInfo = DEPT_INFO[dept] || {};

      const needsContact = lastAttended && lastAttended < twoWeeksAgo;
      const birthdayThisMonth = isBirthdayThisMonth(dob);
      const birthdayToday = isBirthdayToday(dob);

      return {
        id: p.id,
        studentId: p.properties["\uace0\uc720\ubc88\ud638 (ID)"]?.unique_id
          ? "AMC-" + String(p.properties["\uace0\uc720\ubc88\ud638 (ID)"].unique_id.number).padStart(3, "0") : "",
        name: p.properties["\uc774\ub984 (Name)"]?.title?.[0]?.plain_text || "",
        nameEN: p.properties["\uc601\ubb38\uc774\ub984 (Name EN)"]?.rich_text?.[0]?.plain_text || "",
        department: dept,
        deptInfo,
        guardian: p.properties["\ubcf4\ud638\uc790 (Guardian)"]?.rich_text?.[0]?.plain_text || "",
        phone: p.properties["\uc5f0\ub77d\ucc98 (Phone)"]?.phone_number || "",
        emergency: p.properties["\ube44\uc0c1\uc5f0\ub77d\ucc98 (Emergency)"]?.phone_number || "",
        allergy: p.properties["\uc54c\ub7ec\uc9c0 (Allergy)"]?.rich_text?.[0]?.plain_text || "",
        isVisitor: p.properties["\ubc29\ubb38\uc790 (Visitor)"]?.checkbox || false,
        grade: p.properties["\ud559\ub144 (Grade)"]?.rich_text?.[0]?.plain_text || "",
        notes: p.properties["\ud2b9\uc774\uc0ac\ud56d (Notes)"]?.rich_text?.[0]?.plain_text || "",
        status: p.properties["\uc0c1\ud0dc (Status)"]?.select?.name || "",
        liabilityForm: p.properties["Liability Form"]?.select?.name || "\ubbf8\uc81c\ucd9c",
        dob,
        lastAttended,
        needsContact,
        birthdayThisMonth,
        birthdayToday,
      };
    }).filter(s => !s.status || s.status === "\ud65c\uc131 (Active)");
    return res.status(200).json({ students });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};
