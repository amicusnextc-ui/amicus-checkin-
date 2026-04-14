const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
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
    await notion.pages.update({
      page_id: pageId,
      properties: {
        "체크아웃 시간 (Check-out)":   { rich_text: [{ text: { content: checkOutTime } }] },
        "보호자 인계 확인 (Guardian)": { checkbox:  Boolean(guardianConfirmed) },
      },
    });
    return res.status(200).json({ success: true, checkOutTime });
  } catch (e) {
    console.error(e.body || e);
    return res.status(500).json({ error: "체크아웃 중 오류가 발생했습니다" });
  }
};
