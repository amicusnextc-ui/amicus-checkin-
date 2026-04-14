const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "90c5f86f-1123-4b62-94a1-12c183efd8b1";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const { name } = req.query;
  if (!name) return res.status(400).json({ error: "이름이 필요합니다" });

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });

  try {
    const response = await notion.databases.query({
      database_id: ATTENDANCE_DB,
      filter: {
        and: [
          { property: "이름 (Name)",      title: { equals: name.trim() } },
          { property: "주일 날짜 (Date)", date:  { equals: today }       },
        ],
      },
      page_size: 1,
    });

    if (!response.results.length) {
      return res.status(200).json({ status: "not_checked_in", record: null });
    }

    const p        = response.results[0];
    const checkIn  = p.properties["체크인 시간 (Check-in)"]?.rich_text?.[0]?.plain_text  || "";
    const checkOut = p.properties["체크아웃 시간 (Check-out)"]?.rich_text?.[0]?.plain_text || "";

    return res.status(200).json({
      status: checkOut ? "checked_out" : "checked_in",
      record: { id: p.id, checkIn, checkOut },
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "상태 확인 중 오류가 발생했습니다" });
  }
};
