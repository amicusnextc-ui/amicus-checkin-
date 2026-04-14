const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { dept, password } = req.query;
  if (!dept || !password) return res.status(400).json({ error: "missing params" });
  const adminPw = process.env.ADMIN_PASSWORD;
  const staffPw = process.env.STAFF_PASSWORD || process.env.ADMIN_PASSWORD;
  if (password !== adminPw && password !== staffPw) {
    return res.status(401).json({ error: "\uC778\uC99D \uC2E4\uD328" });
  }
  try {
    let allResults = [], start_cursor;
    do {
      const body = {
        filter: { property: "\uBD80\uC11C (Department)", select: { equals: dept } },
        sorts: [{ property: "\uC774\uB984 (Name)", direction: "ascending" }],
        page_size: 100,
      };
      if (start_cursor) body.start_cursor = start_cursor;
      const response = await fetch(`https://api.notion.com/v1/databases/${STUDENT_DB}/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.message });
      allResults = [...allResults, ...(data.results || [])];
      start_cursor = data.has_more ? data.next_cursor : undefined;
    } while (start_cursor);
    const students = allResults.map(p => ({
      id: p.id,
      studentId: p.properties["\uACE0\uC720\uBC88\uD638 (ID)"]?.unique_id
        ? "AMC-" + String(p.properties["\uACE0\uC720\uBC88\uD638 (ID)"].unique_id.number).padStart(3, "0") : "",
      name: p.properties["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "",
      nameEN: p.properties["\uC601\uBB38\uC774\uB984 (Name EN)"]?.rich_text?.[0]?.plain_text || "",
      department: p.properties["\uBD80\uC11C (Department)"]?.select?.name || "",
      guardian: p.properties["\uBCF4\uD638\uC790 (Guardian)"]?.rich_text?.[0]?.plain_text || "",
      phone: p.properties["\uC5F0\uB77D\uCC98 (Phone)"]?.phone_number || "",
      allergy: p.properties["\uC54C\uB7EC\uC9C0 (Allergy)"]?.rich_text?.[0]?.plain_text || "",
      isNew: p.properties["\uC0C8\uC2E0\uC790 (New Student)"]?.checkbox || false,
      grade: p.properties["\uD559\uB144 (Grade)"]?.rich_text?.[0]?.plain_text || "",
      notes: p.properties["\uD2B9\uC774\uC0AC\uD56D (Notes)"]?.rich_text?.[0]?.plain_text || "",
      status: p.properties["\uC0C1\uD0DC (Status)"]?.select?.name || "",
      liabilityForm: p.properties["Liability Form"]?.select?.name || "\uBBF8\uC81C\uCD9C",
    })).filter(s => s.status !== "\uBE44\uD65C\uC131 (Inactive)");
    return res.status(200).json({ students, total: students.length });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};