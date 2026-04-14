const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).end();
  const { name, department, isNew, hasAllergy, notes, staff, studentId } = req.body;
  if (!name) return res.status(400).json({ error: "name required" });

  const now = new Date();
  const today = now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  const checkInTime = now.toLocaleTimeString("ko-KR", { timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false });

  // Check for duplicate check-in today
  try {
    const checkRes = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        filter: {
          and: [
            { property: "\uC774\uB984 (Name)", title: { equals: name.trim() } },
            { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: today } },
          ]
        },
        page_size: 1
      }),
    });
    const checkData = await checkRes.json();
    if (checkData.results && checkData.results.length > 0) {
      const existing = checkData.results[0];
      const checkInProp = existing.properties["\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)"]?.rich_text?.[0]?.plain_text || "";
      const checkOutProp = existing.properties["\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)"]?.rich_text?.[0]?.plain_text || "";
      if (!checkOutProp) {
        return res.status(200).json({ success: true, alreadyCheckedIn: true, pageId: existing.id, checkInTime: checkInProp });
      }
    }
  } catch(e) {}

  // Create new attendance record
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

  const response = await fetch("https://api.notion.com/v1/pages", {
    method: "POST",
    headers: {
      "Authorization": "Bearer " + process.env.NOTION_TOKEN,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties }),
  });
  const data = await response.json();
  if (!response.ok) return res.status(500).json({ error: data.message || "checkin failed" });

  // Update student's last attended date (fire and forget)
  if (studentId && !isNew) {
    fetch("https://api.notion.com/v1/pages/" + studentId, {
      method: "PATCH",
      headers: {
        "Authorization": "Bearer " + process.env.NOTION_TOKEN,
        "Notion-Version": NOTION_VERSION,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ properties: { "\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)": { date: { start: today } } } })
    }).catch(() => {});
  }

  return res.status(200).json({ success: true, alreadyCheckedIn: false, pageId: data.id, checkInTime });
};