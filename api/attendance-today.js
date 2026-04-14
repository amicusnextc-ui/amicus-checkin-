const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { password } = req.query;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "auth failed" });
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  try {
    let allResults = [], start_cursor;
    do {
      const body = {
        filter: { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: today } },
        page_size: 100,
      };
      if (start_cursor) body.start_cursor = start_cursor;
      const response = await fetch(`https://api.notion.com/v1/databases/${ATTENDANCE_DB}/query`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.message });
      allResults = [...allResults, ...(data.results || [])];
      start_cursor = data.has_more ? data.next_cursor : undefined;
    } while (start_cursor);
    const records = allResults.map(p => ({
      id: p.id,
      name: p.properties["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "",
      department: p.properties["\uBD80\uC11C (Department)"]?.select?.name || "",
      checkIn: p.properties["\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)"]?.rich_text?.[0]?.plain_text || "",
      checkOut: p.properties["\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)"]?.rich_text?.[0]?.plain_text || "",
      staff: p.properties["\uAC04\uC0AC (Staff)"]?.rich_text?.[0]?.plain_text || "",
      guardianConfirmed: p.properties["\uBCF4\uD638\uC790 \uC778\uACC4 \uD655\uC778 (Guardian)"]?.checkbox || false,
      isNew: p.properties["\uC0C8\uC2E0\uC790 (New)"]?.checkbox || false,
      hasAllergy: p.properties["\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)"]?.checkbox || false,
      notes: p.properties["\uD2B9\uC774\uC0AC\uD56D (Notes)"]?.rich_text?.[0]?.plain_text || "",
    }));
    return res.status(200).json({ records, date: today, total: records.length });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};