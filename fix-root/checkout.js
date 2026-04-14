const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();

  const { pageId, guardianConfirmed } = req.body;
  if (!pageId) return res.status(400).json({ error: "페이지 ID가 필요합니다" });

  const checkOutTime = new Date().toLocaleTimeString("ko-KR", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  });

  try {
    const response = await fetch(`https://api.notion.com/v1/pages/${pageId}`, {
      method: "PATCH",
      headers: {
        "Authorization": `Bearer ${process.env.NOTION_TOKEN}`,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        properties: {
          "체크아웃 시간 (Check-out)":   { rich_text: [{ text: { content: checkOutTime } }] },
          "보호자 인계 확인 (Guardian)": { checkbox:  Boolean(guardianConfirmed) },
        },
      }),
    });

    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message || "체크아웃 실패" });

    return res.status(200).json({ success: true, checkOutTime });
  } catch (e) {
    return res.status(500).json({ error: "체크아웃 오류: " + e.message });
  }
};
