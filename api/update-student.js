const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();
  const { id, name, dept, nameEN, grade, guardian, phone, allergy, notes, isNew, password } = req.body;
  if (!name || !guardian || !password) return res.status(400).json({ error: "missing required fields" });
  const passwords = {
    "\uC720\uC544\uBD80 (Infant)": process.env.INFANT_PASSWORD,
    "\uC720\uCE58\uBD80 (Preschool)": process.env.PRESCHOOL_PASSWORD,
    "\uC720\uB144\uBD80 (Elementary Jr)": process.env.ELEMENTARYJR_PASSWORD,
    "\uCD08\uB4F1\uBD80 (Elementary)": process.env.ELEMENTARY_PASSWORD,
    "\uC911\uACE0\uB4F1\uBD80 (Middle/High)": process.env.MIDDLEHIGH_PASSWORD,
  };
  const adminPw = process.env.ADMIN_PASSWORD;
  const deptPw = passwords[dept];
  if (password !== adminPw && (!deptPw || password !== deptPw)) {
    return res.status(401).json({ error: "\uC778\uC99D \uC2E4\uD328" });
  }
  const properties = {
    "\uC774\uB984 (Name)": { title: [{ text: { content: name } }] },
    "\uBD80\uC11C (Department)": { select: { name: dept } },
    "\uBCF4\uD638\uC790 (Guardian)": { rich_text: [{ text: { content: guardian } }] },
    "\uC0C8\uC2E0\uC790 (New Student)": { checkbox: Boolean(isNew) },
    "\uC0C1\uD0DC (Status)": { select: { name: "\uD65C\uC131 (Active)" } },
  };
  if (nameEN) properties["\uC601\uBB38\uC774\uB984 (Name EN)"] = { rich_text: [{ text: { content: nameEN } }] };
  if (grade) properties["\uD559\uB144 (Grade)"] = { rich_text: [{ text: { content: grade } }] };
  if (phone) properties["\uC5F0\uB77D\uCC98 (Phone)"] = { phone_number: phone };
  if (allergy) properties["\uC54C\uB7EC\uC9C0 (Allergy)"] = { rich_text: [{ text: { content: allergy } }] };
  if (notes) properties["\uD2B9\uC774\uC0AC\uD56D (Notes)"] = { rich_text: [{ text: { content: notes } }] };
  try {
    let url = "https://api.notion.com/v1/pages";
    let method = "POST";
    let bodyData = { parent: { database_id: STUDENT_DB }, properties };
    if (id) { url = `https://api.notion.com/v1/pages/${id}`; method = "PATCH"; bodyData = { properties }; }
    const response = await fetch(url, {
      method,
      headers: { "Authorization": `Bearer ${process.env.NOTION_TOKEN}`, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" },
      body: JSON.stringify(bodyData),
    });
    const data = await response.json();
    if (!response.ok) return res.status(500).json({ error: data.message });
    return res.status(200).json({ success: true, id: data.id });
  } catch(e) { return res.status(500).json({ error: e.message }); }
};