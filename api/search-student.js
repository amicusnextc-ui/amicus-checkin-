const { Client } = require("@notionhq/client");

const notion = new Client({ auth: process.env.NOTION_TOKEN });
const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "b0b38280-725c-439e-a62b-8526dee1569c";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();

  const { name } = req.query;
  if (!name || !name.trim()) return res.status(400).json({ error: "이름을 입력해주세요" });

  try {
    const response = await notion.databases.query({
      database_id: STUDENT_DB,
      filter: {
        or: [
          { property: "이름 (Name)",      title:     { contains: name.trim() } },
          { property: "영문이름 (Name EN)", rich_text: { contains: name.trim() } },
        ],
      },
      page_size: 20,
    });

    const students = response.results
      .map(p => ({
        id:         p.id,
        name:       p.properties["이름 (Name)"]?.title?.[0]?.plain_text || "",
        nameEN:     p.properties["영문이름 (Name EN)"]?.rich_text?.[0]?.plain_text || "",
        department: p.properties["부서 (Department)"]?.select?.name || "",
        guardian:   p.properties["보호자 (Guardian)"]?.rich_text?.[0]?.plain_text || "",
        phone:      p.properties["연락처 (Phone)"]?.phone_number || "",
        allergy:    p.properties["알러지 (Allergy)"]?.rich_text?.[0]?.plain_text || "",
        isNew:      p.properties["새신자 (New Student)"]?.checkbox || false,
        grade:      p.properties["학년 (Grade)"]?.rich_text?.[0]?.plain_text || "",
        notes:      p.properties["특이사항 (Notes)"]?.rich_text?.[0]?.plain_text || "",
        status:     p.properties["상태 (Status)"]?.select?.name || "",
      }))
      .filter(s => !s.status || s.status === "활성 (Active)");

    return res.status(200).json({ students });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "검색 중 오류가 발생했습니다" });
  }
};
