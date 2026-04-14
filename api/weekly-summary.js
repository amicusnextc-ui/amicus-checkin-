const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
const DEPT_ORDER = ["유아부 (Infant)","유치부 (Preschool)","유년부 (Elementary Jr)","초등부 (Elementary)","중고등부 (Middle/High)"];
const STAFF_MAP = {"유아부 (Infant)":"이지혜","유치부 (Preschool)":"김향숙","유년부 (Elementary Jr)":"박은혜","초등부 (Elementary)":"백진주","중고등부 (Middle/High)":"박명철 전도사님"};

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
  const twoWeeksAgo = new Date(sunday);
  twoWeeksAgo.setDate(sunday.getDate() - 13);
  const twoWeeksAgoStr = twoWeeksAgo.toLocaleDateString("sv-SE", { timeZone: TIMEZONE });

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
    const attFilter = { property: "주일 날짜 (Date)", date: { equals: today } };
    const allAtt = await queryAll(ATTENDANCE_DB, attFilter);

    const stuFilter = { and: [
      { property: "상태 (Status)", select: { equals: "활성 (Active)" } },
      { property: "방문자 (Visitor)", checkbox: { equals: false } }
    ]};
    const allStu = await queryAll(STUDENT_DB, stuFilter);

    // Recent attendance (last 14 days) for 2+ week absence detection
    const recentFilter = { property: "주일 날짜 (Date)", date: { on_or_after: twoWeeksAgoStr } };
    const recentAtt = await queryAll(ATTENDANCE_DB, recentFilter);
    const recentAttIds = new Set();
    recentAtt.forEach(function(p){
      const rel = p.properties["학생 (Student)"]?.relation || [];
      rel.forEach(function(r){ recentAttIds.add(r.id); });
    });

    // Today checkin student IDs
    const todayIds = new Set();
    allAtt.forEach(function(p){
      const rel = p.properties["학생 (Student)"]?.relation || [];
      rel.forEach(function(r){ todayIds.add(r.id); });
    });

    const ds = {};
    DEPT_ORDER.forEach(function(d) { ds[d] = { attended: 0, visitors: 0, total: 0, newThisMonth: 0 }; });

    allStu.forEach(function(p) {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      if (!ds[dept]) ds[dept] = { attended: 0, visitors: 0, total: 0, newThisMonth: 0 };
      ds[dept].total++;
    });

    allAtt.forEach(function(p) {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      const isNew = p.properties["방문자 (Visitor)"]?.checkbox || false;
      if (!ds[dept]) ds[dept] = { attended: 0, visitors: 0, total: 0, newThisMonth: 0 };
      if (isNew) ds[dept].visitors++; else ds[dept].attended++;
    });

    // Build absentList: active students with no attendance in last 14 days
    const absentList = [];
    allStu.forEach(function(p) {
      if (!recentAttIds.has(p.id)) {
        const dept = p.properties["부서 (Department)"]?.select?.name || "";
        const nameArr = p.properties["이름 (Name)"]?.title || [];
        const nameEN = p.properties["English Name"]?.rich_text?.[0]?.text?.content || "";
        const lastDateArr = p.properties["마지막 출석일 (Last Attended)"]?.date;
        absentList.push({
          id: p.id,
          name: nameArr[0]?.text?.content || "(이름없음)",
          nameEN: nameEN,
          dept: dept,
          staff: STAFF_MAP[dept] || dept.split(" ")[0],
          lastAttended: lastDateArr?.start || null
        });
      }
    });
    absentList.sort(function(a,b){ return (a.dept||"").localeCompare(b.dept||""); });

    const depts = DEPT_ORDER.filter(function(d){ return ds[d] && (ds[d].total>0||ds[d].attended>0); }).map(function(d) {
      const st = ds[d];
      return { dept: d, short: d.split(" ")[0], attended: st.attended, visitors: st.visitors, absent: Math.max(0,st.total-st.attended), total: st.total, newThisMonth: st.newThisMonth };
    });

    const total = depts.reduce(function(a,r){ a.attended+=r.attended;a.visitors+=r.visitors;a.absent+=r.absent;a.total+=r.total;a.newThisMonth+=r.newThisMonth;return a;},{attended:0,visitors:0,absent:0,total:0,newThisMonth:0});

    // Keep backward compat: also include rows/grand
    const rows = depts.map(function(d){ return {dept:d.dept,short:d.short,checkin:d.attended,visitor:d.visitors,absent:d.absent,total:d.total}; });
    const grand = {checkin:total.attended,visitor:total.visitors,absent:total.absent,total:total.total};

    let saved = false;
    if (req.method === "POST") {
      const titleText = "교육부 전체 출석 요약 — " + sundayStr;
      const lines2 = depts.map(function(r){ return r.short+": 출석 "+r.attended+" / 결석 "+r.absent+" / 방문 "+r.visitors+" / 등록 "+r.total; });
      lines2.push("");
      lines2.push("전체 교육부: 출석 "+total.attended+" / 결석 "+total.absent+" / 방문 "+total.visitors+" / 완등록 "+total.total);
      const summaryText = lines2.join("\n");
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
        await fetch("https://api.notion.com/v1/pages/" + existingId, {
          method: "PATCH", headers: authHeaders, body: JSON.stringify({ properties: notionProps })
        });
      } else {
        await fetch("https://api.notion.com/v1/pages", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties: notionProps })
        });
      }
      saved = true;
    }

    return res.status(200).json({ depts, total, rows, grand, sundayStr, date: today, saved, absentList });
  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};