const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "90c5f86f-1123-4b62-94a1-12c183efd8b1";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const { password } = req.query;
  if (!password || password !== process.env.ADMIN_PASSWORD) {
    return res.status(401).json({ error: "인증이 필요합니다" });
  }

  const today = new Date().toLocaleDateString("sv-SE", { timeZone: TIMEZONE });

  try {
    let allResults = [];
    let start_cursor = undefined;

    do {
      const body = {
        filter: { property: "주일 날짜 (Date)", date: { equals: today } },
        sorts:  [{ property: "체크인 시간 (Check-in)", direction: "ascending" }],
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
      if (!response.ok) return res.status(500).json({ error: data.message || "Notion API 오류" });

      allResults = [...allResults, ...(data.results || [])];
      start_cursor = data.has_more ? data.next_cursor : undefined;
    } while (start_cursor);

    const records = allResults.map(p => ({
      id:                p.id,
      name:              p.properties["이름 (Name)"]?.title?.[0]?.plain_text || "",
      department:        p.properties["부서 (Department)"]?.select?.name || "",
      checkIn:           p.properties["체크인 시간 (Check-in)"]?.rich_text?.[0]?.plain_text  || "",
      checkOut:          p.properties["체크아웃 시간 (Check-out)"]?.rich_text?.[0]?.plain_text || "",
      staff:             p.properties["간사 (Staff)"]?.rich_text?.[0]?.plain_text || "",
      guardianConfirmed: p.properties["보호자 인계 확인 (Guardian)"]?.checkbox || false,
      isNew:             p.properties["새신자 (New)"]?.checkbox || false,
      hasAllergy:        p.properties["알러지 알림 (Allergy Alert)"]?.checkbox || false,
      notes:             p.properties["특이사항 (Notes)"]?.rich_text?.[0]?.plain_text || "",
    }));

    return res.status(200).json({ records, date: today, total: records.length });
  } catch (e) {
    return res.status(500).json({ error: "데이터 로드 오류: " + e.message });
  }
};
