const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const dept = req.query.dept || "";
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });

  try {
    // Query attendance records for today
    const filter = {
      and: [
        { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: today } }
      ]
    };
    if (dept) {
      filter.and.push({ property: "\uBD80\uC11C (Department)", select: { equals: dept } });
    }

    let allRecords = [], cursor;
    do {
      const resp = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + process.env.NOTION_TOKEN,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ filter, page_size: 100, start_cursor: cursor || undefined })
      });
      const data = await resp.json();
      if (!resp.ok) return res.status(500).json({ error: data.message });
      allRecords = allRecords.concat(data.results || []);
      cursor = data.has_more ? data.next_cursor : null;
    } while (cursor);

    // For each attendance record, look up student details from student DB
    const studentNames = [...new Set(allRecords.map(r => r.properties["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "").filter(Boolean))];

    // Batch-fetch student info
    const studentMap = {};
    for (const name of studentNames) {
      try {
        const sr = await fetch("https://api.notion.com/v1/databases/" + STUDENT_DB + "/query", {
          method: "POST",
          headers: {
            "Authorization": "Bearer " + process.env.NOTION_TOKEN,
            "Notion-Version": NOTION_VERSION,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            filter: { property: "\uC774\uB984 (Name)", title: { equals: name } },
            page_size: 1
          })
        });
        const sd = await sr.json();
        if (sd.results && sd.results.length > 0) {
          const p = sd.results[0];
          const rt = (prop, field) => p.properties[field]?.rich_text?.[0]?.plain_text || "";
          const ph = (field) => p.properties[field]?.phone_number || "";
          studentMap[name] = {
            nameEN: rt(p, "\uC601\uBB38\uC774\uB984 (Name EN)"),
            grade: rt(p, "\uD559\uB144 (Grade)"),
            dob: p.properties["\uC0DD\uB144\uC6D4\uC77C (DOB)"]?.date?.start || "",
            allergy: rt(p, "\uC54C\uB7EC\uC9C0 (Allergy)"),
            fatherName: rt(p, "\uC544\uBC84\uC9C0 \uC774\uB984 (Father Name)"),
            motherName: rt(p, "\uC5B4\uBA38\uB2C8 \uC774\uB984 (Mother Name)"),
            fatherPhone: ph("\uC544\uBC84\uC9C0 \uC5F0\uB77D\uCC98 (Father Phone)"),
            motherPhone: ph("\uC5B4\uBA38\uB2C8 \uC5F0\uB77D\uCC98 (Mother Phone)"),
            guardian: rt(p, "\uBCF4\uD638\uC790 (Guardian)"),
            phone: ph("\uC5F0\uB77D\uCC98 (Phone)")
          };
        }
      } catch(e) {}
    }

    const records = allRecords.map(p => {
      const name = p.properties["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "";
      const checkIn = p.properties["\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)"]?.rich_text?.[0]?.plain_text || "";
      const checkOut = p.properties["\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)"]?.rich_text?.[0]?.plain_text || "";
      const dept2 = p.properties["\uBD80\uC11C (Department)"]?.select?.name || "";
      const isNew = p.properties["\uBC29\uBB38\uC790 (Visitor)"]?.checkbox || false;
      const hasAllergy = p.properties["\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)"]?.checkbox || false;
      const notes = p.properties["\uD2B9\uC774\uC0AC\uD56D (Notes)"]?.rich_text?.[0]?.plain_text || "";
      const student = studentMap[name] || {};
      return {
        id: p.id,
        name,
        nameEN: student.nameEN || "",
        department: dept2,
        checkIn,
        checkOut,
        isNew,
        hasAllergy,
        allergy: student.allergy || "",
        grade: student.grade || "",
        dob: student.dob || "",
        fatherName: student.fatherName || "",
        motherName: student.motherName || "",
        fatherPhone: student.fatherPhone || "",
        motherPhone: student.motherPhone || "",
        guardian: student.guardian || "",
        phone: student.phone || "",
        notes
      };
    });

    // Sort: checked-in first, then by name
    records.sort((a, b) => {
      if (a.checkOut && !b.checkOut) return 1;
      if (!a.checkOut && b.checkOut) return -1;
      return a.name.localeCompare(b.name, "ko");
    });

    return res.status(200).json({ records, date: today });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};