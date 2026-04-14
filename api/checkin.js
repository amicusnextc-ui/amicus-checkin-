const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "POST") return res.status(405).end();
  const { name, department, isNew, hasAllergy, notes, staff } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });
  const now = new Date();
  const today = now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  const checkInTime = now.toLocaleTimeString("ko-KR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  const properties = {
    "\uC774\uB984 (Name)": { title: [{ text: { content: name } }] },
    "\uC8FC\uC77C \uB0A0\uC9DC (Date)": { date: { start: today } },
    "\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)": { rich_text: [{ text: { content: checkInTime } }] },
    "\uC0C8\uC2E0\uC790 (New)": { checkbox: Boolean(isNew) },
    "\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)": { checkbox: Boolean(hasAllergy) },
    "\uBCF4\uD638\uC790 \uC778\uACC4 \uD655\uC778 (Guardian)": { checkbox: false },
  };
  if (department) properties["\uBD80\uC11C (Department)"] = { select: { name: department } };
  if (notes) properties["\uD2B9\uC774\uC0AC\uD56D (Notes)"] = { rich_text: [{ text: { content: notes } }] };
  if (staff) properties["\uAC04\uC0AC (Staff)"] = { rich_text: [{ text: { content: staff } }] };
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
    if (!response.ok) return res.status(500).json({ error: data.message || "checkin failed" });
    return res.status(200).json({ success: true, pageId: data.id, checkInTime });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};