const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "90c5f86f-1123-4b62-94a1-12c183efd8b1";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();

  const { name, department, isNew, hasAllergy, notes, staff } = req.body;
  if (!name) return res.status(400).json({ error: "이름이 필요합니다" });

  const now = new Date();
  const today       = now.toLocaleDateString("sv-SE",  { timeZone: TIMEZONE });
  const checkInTime = now.toLocaleTimeString("ko-KR",  { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });

  const properties = {
    "이름 (Name)":                 { title:     [{ text: { content: name } }] },
    "주일 날짜 (Date)":            { date:      { start: today } },
    "체크인 시간 (Check-in)":      { rich_text: [{ text: { content: checkInTime } }] },
    "새신자 (New)":                { checkbox:  Boolean(isNew) },
    "알러지 알림 (Allergy Alert)": { checkbox:  Boolean(hasAllergy) },
    "보호자 인계 확인 (Guardian)": { checkbox:  false },
  };
  if (department) properties["부서 (Department)"] = { select: { name: department } };
  if (notes)      properties["특이사항 (Notes)"]  = { rich_text: [{ text: { content: notes } }] };
  if (staff)      properties["간사 (Staff)"]       = { rich_text: [{ text: { content: staff } }] };

  try {
    const page = await notion.pages.create({ parent: { database_id: ATTENDANCE_DB }, properties });
    return res.status(200).json({ success: true, pageId: page.id, checkInTime });
  } catch (e) {
    console.error(e.body || e);
    return res.status(500).json({ error: "체크인 중 오류가 발생했습니다" });
  }
};
