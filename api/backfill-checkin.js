const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();

  const { records, password } = req.body;
  if (!password || password !== process.env.ADMIN_PASSWORD) return res.status(401).json({ error: "auth failed" });
  if (!records || !Array.isArray(records)) return res.status(400).json({ error: "records array required" });

  const headers = {
    "Authorization": "Bearer " + process.env.NOTION_TOKEN,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
  };

  const results = [];
  for (const rec of records) {
    const { name, department, date, checkInTime, studentId } = rec;
    // Check for duplicate
    const dupCheck = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", {
      method: "POST", headers,
      body: JSON.stringify({ filter: { and: [
        { property: "\uC774\uB984 (Name)", title: { equals: name } },
        { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: date } }
      ]}, page_size: 1 })
    });
    const dupData = await dupCheck.json();
    if (dupData.results && dupData.results.length > 0) {
      results.push({ name, date, status: "already_exists" });
      continue;
    }
    const properties = {
      "\uC774\uB984 (Name)": { title: [{ text: { content: name } }] },
      "\uC8FC\uC77C \uB0A0\uC9DC (Date)": { date: { start: date } },
      "\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)": { rich_text: [{ text: { content: checkInTime || "10:30" } }] },
      "\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)": { rich_text: [{ text: { content: "12:00" } }] },
      "\uBCF4\uD638\uC790 \uC778\uACC4 \uD655\uC778 (Guardian)": { checkbox: false },
      "\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)": { checkbox: false },
    };
    if (department) properties["\uBD80\uC11C (Department)"] = { select: { name: department } };
    const r = await fetch("https://api.notion.com/v1/pages", {
      method: "POST", headers,
      body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties })
    });
    const d = await r.json();
    if (!r.ok) { results.push({ name, date, status: "error", error: d.message }); continue; }
    // Update last attended
    if (studentId) {
      fetch("https://api.notion.com/v1/pages/" + studentId, {
        method: "PATCH", headers,
        body: JSON.stringify({ properties: { "\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)": { date: { start: date } } } })
      }).catch(() => {});
    }
    results.push({ name, date, status: "created", id: d.id });
  }
  return res.status(200).json({ results, total: results.length, created: results.filter(r => r.status === "created").length });
};
