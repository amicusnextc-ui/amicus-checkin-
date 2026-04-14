const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "name required" });
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${ATTENDANCE_DB}/query`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({ filter: { and: [
        { property: "\uC774\uB984 (Name)", title: { equals: name.trim() } },
        { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: today } },
      ]}, page_size: 1 }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message });
    if (!data.results?.length) return res.status(200).json({ status: "not_checked_in", record: null });
    const p = data.results[0];
    const checkIn = p.properties["\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)"]?.rich_text?.[0]?.plain_text || "";
    const checkOut = p.properties["\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)"]?.rich_text?.[0]?.plain_text || "";
    return res.status(200).json({ status: checkOut ? "checked_out" : "checked_in", record: { id: p.id, checkIn, checkOut } });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};