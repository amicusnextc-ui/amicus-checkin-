const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { name } = req.query;
  if (!name || !name.trim()) return res.status(400).json({ error: "ì´ë¦ì ìë ¥í´ì£¼ì¸ì" });
  try {
    const response = await fetch(`https://api.notion.com/v1/databases/${STUDENT_DB}/query`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filter: { or: [
          { property: "ì´ë¦ (Name)",       title:     { contains: name.trim() } },
          { property: "ìë¬¸ì´ë¦ (Name EN)", rich_text: { contains: name.trim() } },
        ]},
        page_size: 20,
      }),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || "Notion API ì¤ë¥" });
    const students = (data.results || []).map(p => ({
      id:         p.id,
      name:       p.properties["ì´ë¦ (Name)"]?.title?.[0]?.plain_text || "",
      nameEN:     p.properties["ìë¬¸ì´ë¦ (Name EN)"]?.rich_text?.[0]?.plain_text || "",
      department: p.properties["ë¶ì (Department)"]?.select?.name || "",
      guardian:   p.properties["ë³´í¸ì (Guardian)"]?.rich_text?.[0]?.plain_text || "",
      phone:      p.properties["ì°ë½ì² (Phone)"]?.phone_number || "",
      allergy:    p.properties["ìë¬ì§ (Allergy)"]?.rich_text?.[0]?.plain_text || "",
      isNew:      p.properties["ìì ì (New Student)"]?.checkbox || false,
      grade:      p.properties["íë (Grade)"]?.rich_text?.[0]?.plain_text || "",
      notes:      p.properties["í¹ì´ì¬í­ (Notes)"]?.rich_text?.[0]?.plain_text || "",
      status:     p.properties["ìí (Status)"]?.select?.name || "",
    })).filter(s => !s.status || s.status === "íì± (Active)");
    return res.status(200).json({ students });
  } catch (e) {
    return res.status(500).json({ error: "ê²ì ì¤ ì¤ë¥: " + e.message });
  }
};
