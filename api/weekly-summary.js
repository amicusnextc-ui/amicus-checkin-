const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
const DEPT_ORDER = ["유아부 (Infant)","유치부 (Preschool)","유년부 (Elementary Jr)","초등부 (Elementary)","중고등부 (Middle/High)"];

module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();

  const now = new Date();
  const today = now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });
  const nowLA = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE }));
  const dow = nowLA.getDay();
  const sunday = new Date(nowLA);
  sunday.setDate(nowLA.getDate() - (dow === 0 ? 0 : dow));
  const sundayStr = String(sunday.getMonth()+1).padStart(2,"0") + "/" + String(sunday.getDate()).padStart(2,"0") + "/" + String(sunday.getFullYear()).slice(2);

  const authHeaders = {
    "Authorization": "Bearer " + process.env.NOTION_TOKEN,
    "Notion-Version": NOTION_VERSION,
    "Content-Type": "application/json"
  };

  async function queryAll(dbId, filter) {
    let all = [], cursor;
    do {
      const body = { page_size: 100 };
      if (filter) body.filter = filter;
      if (cursor) body.start_cursor = cursor;
      const r = await fetch("https://api.notion.com/v1/databases/" + dbId + "/query", {
        method: "POST", headers: authHeaders, body: JSON.stringify(body)
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.message || "Notion query failed");
      all = all.concat(d.results || []);
      cursor = d.has_more ? d.next_cursor : null;
    } while (cursor);
    return all;
  }

  try {
    // 1. All attendance today (all depts)
    const attFilter = { property: "주일 날짜 (Date)", date: { equals: today } };
    const allAtt = await queryAll(ATTENDANCE_DB, attFilter);

    // 2. All active non-visitor students
    const stuFilter = { and: [
      { property: "상태 (Status)", select: { equals: "활성 (Active)" } },
      { property: "방문자 (Visitor)", checkbox: { equals: false } }
    ]};
    const allStu = await queryAll(STUDENT_DB, stuFilter);

    // 3. Build stats
    const ds = {};
    DEPT_ORDER.forEach(function(d) { ds[d] = { checkin: 0, visitor: 0, total: 0 }; });

    allStu.forEach(function(p) {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      if (!ds[dept]) ds[dept] = { checkin: 0, visitor: 0, total: 0 };
      ds[dept].total++;
    });

    allAtt.forEach(function(p) {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      const isNew = p.properties["방문자 (Visitor)"]?.checkbox || false;
      if (!ds[dept]) ds[dept] = { checkin: 0, visitor: 0, total: 0 };
      if (isNew) ds[dept].visitor++; else ds[dept].checkin++;
    });

    const rows = DEPT_ORDER.filter(function(d){ return ds[d] && (ds[d].total>0||ds[d].checkin>0); }).map(function(d) {
      const st = ds[d];
      return { dept: d, short: d.split(" ")[0], checkin: st.checkin, visitor: st.visitor, absent: Math.max(0,st.total-st.checkin), total: st.total };
    });

    const grand = rows.reduce(function(a,r){ a.checkin+=r.checkin;a.visitor+=r.visitor;a.absent+=r.absent;a.total+=r.total;return a;},{checkin:0,visitor:0,absent:0,total:0});

    // 4. If POST: save summary to Notion Attendance DB
    let saved = false;
    if (req.method === "POST") {
      const titleText = "교육부 전체 출석 요약 — " + sundayStr;
      const lines2 = rows.map(function(r){ return r.short+": 출석 "+r.checkin+" / 결석 "+r.absent+" / 방문 "+r.visitor+" / 등록 "+r.total; });
      lines2.push("");
      lines2.push("전체 교육부: 출석 "+grand.checkin+" / 결석 "+grand.absent+" / 방문 "+grand.visitor+" / 총 등록 "+grand.total);
      const summaryText = lines2.join("\n");

      // Check if a summary entry for this Sunday already exists
      let existingId = null;
      try {
        const checkResp = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ filter: { property: "이름 (Name)", title: { equals: titleText } }, page_size: 1 })
        });
        const checkData = await checkResp.json();
        if (checkData.results && checkData.results.length > 0) existingId = checkData.results[0].id;
      } catch(e2) {}

      const notionProps = {
        "이름 (Name)": { title: [{ text: { content: titleText } }] },
        "주일 날짜 (Date)": { date: { start: today } },
        "체크인 시간 (Check-in)": { rich_text: [{ text: { content: "요약" } }] },
        "특이사항 (Notes)": { rich_text: [{ text: { content: summaryText } }] }
      };

      if (existingId) {
        // Update existing
        await fetch("https://api.notion.com/v1/pages/" + existingId, {
          method: "PATCH", headers: authHeaders, body: JSON.stringify({ properties: notionProps })
        });
      } else {
        // Create new
        await fetch("https://api.notion.com/v1/pages", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties: notionProps })
        });
      }
      saved = true;
    }

    return res.status(200).json({ rows, grand, sundayStr, date: today, saved });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};