const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();
  const { pageId, guardianConfirmed } = req.body;
  if (!pageId) return res.status(400).json({ error: "pageId required" });
  const checkOutTime = new Date().toLocaleTimeString("ko-KR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: { "Authorization": `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify({ properties: {
        "\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)": { rich_text: [{ text: { content: checkOutTime } }] },
        "\uBCF4\uD638\uC790 \uC778\uACC4 \uD655\uC778 (Guardian)": { checkbox: Boolean(guardianConfirmed) },
      }}),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || "checkout failed" });
    return res.status(200).json({ success: true, checkOutTime });
  } catch (e) { return res.status(500).json({ error: e.message }); }
};