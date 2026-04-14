const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { password } = req.query;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "ì¸ì¦ì´ íìí©ëë¤" });
  }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  try {
    let allResults = [];
    let start_cursor = undefined;
    do {
      const body = {
        filter: { property: "ì£¼ì¼ ë ì§ (Date)", date: { equals: today } },
        sorts:  [{ property: "ì²´í¬ì¸ ìê° (Check-in)", direction: "ascending" }],
        page_size: 100,
      };
      if (start_cursor) body.start_cursor = start_cursor;
      const response = await fetch(`https://api.notion.com/v1/databases/${ATTENDANCE_DB}/query`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
          "Notion-Version": NOTION_VERSION,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) return res.status(500).json({ error: data.message || "Notion API ì¤ë¥" });
      allResults = [...allResults, ...(data.results || [])];
      start_cursor = data.has_more ? data.next_cursor : undefined;
    } while (start_cursor);
    const records = allResults.map(p => ({
      id:                p.id,
      name:              p.properties["ì´ë¦ (Name)"]?.title?.[0]?.plain_text || "",
      department:        p.properties["ë¶ì (Department)"]?.select?.name || "",
      checkIn:           p.properties["ì²´í¬ì¸ ìê° (Check-in)"]?.rich_text?.[0]?.plain_text  || "",
      checkOut:          p.properties["ì²´í¬ìì ìê° (Check-out)"]?.rich_text?.[0]?.plain_text || "",
      staff:             p.properties["ê°ì¬ (Staff)"]?.rich_text?.[0]?.plain_text || "",
      guardianConfirmed: p.properties["ë³´í¸ì ì¸ê³ íì¸ (Guardian)"]?.checkbox || false,
      isNew:             p.properties["ìì ì (New)"]?.checkbox || false,
      hasAllergy:        p.properties["ìë¬ì§ ìë¦¼ (Allergy Alert)"]?.checkbox || false,
      notes:             p.properties["í¹ì´ì¬í­ (Notes)"]?.rich_text?.[0]?.plain_text || "",
    }));
    return res.status(200).json({ records, date: today, total: records.length });
  } catch (e) {
    return res.status(500).json({ error: "ë°ì´í° ë¡ë ì¤ë¥: " + e.message });
  }
};
