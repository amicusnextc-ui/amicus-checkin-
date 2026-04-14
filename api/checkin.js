const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();
  const { name, department, isNew, hasAllergy, notes, staff } = req.body;
  if (!name) return res.status(400).json({ error: "ì´ë¦ì´ íìí©ëë¤" });
  const now = new Date();
  const today       = now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  const checkInTime = now.toLocaleTimeString("ko-KR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  const properties = {
    "ì´ë¦ (Name)":                 { title:     [{ text: { content: name } }] },
    "ì£¼ì¼ ë ì§ (Date)":            { date:      { start: today } },
    "ì²´í¬ì¸ ìê° (Check-in)":      { rich_text: [{ text: { content: checkInTime } }] },
    "ìì ì (New)":                { checkbox:  Boolean(isNew) },
    "ìë¬ì§ ìë¦¼ (Allergy Alert)": { checkbox:  Boolean(hasAllergy) },
    "ë³´í¸ì ì¸ê³ íì¸ (Guardian)": { checkbox:  false },
  };
  if (department) properties["ë¶ì (Department)"] = { select: { name: department } };
  if (notes)      properties["í¹ì´ì¬í­ (Notes)"]  = { rich_text: [{ text: { content: notes } }] };
  if (staff)      properties["ê°ì¬ (Staff)"]       = { rich_text: [{ text: { content: staff } }] };
  try {
    const response = await fetch("https://api.notion.com/v1/pages", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || "ì²´í¬ì¸ ì¤í¨" });
    return res.status(200).json({ success: true, pageId: data.id, checkInTime });
  } catch (e) {
    return res.status(500).json({ error: "ì²´í¬ì¸ ì¤ë¥: " + e.message });
  }
};
