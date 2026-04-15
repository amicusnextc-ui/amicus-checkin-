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

  // Get current LA date components
  const laDateStr = now.toLocaleDateString("sv-SE", { timeZone: TIMEZONE }); // "YYYY-MM-DD"
  const [laYear, laMon, laDay] = laDateStr.split("-").map(Number);
  const laDow = new Date(now.toLocaleString("en-US", { timeZone: TIMEZONE })).getDay(); // 0=Sun

  // Most recent Sunday (ISO YYYY-MM-DD) computed purely in LA calendar
  const sundayOffset = laDow === 0 ? 0 : laDow; // days to go back
  const sundayDate = new Date(laYear, laMon - 1, laDay - sundayOffset);
  const sundayISO = sundayDate.getFullYear() + "-" +
    String(sundayDate.getMonth() + 1).padStart(2, "0") + "-" +
    String(sundayDate.getDate()).padStart(2, "0");

  const today = laDateStr;
  const isToday = today === sundayISO;

  // Display label MM/DD/YY
  const sundayStr = String(sundayDate.getMonth()+1).padStart(2,"0") + "/" +
    String(sundayDate.getDate()).padStart(2,"0") + "/" +
    String(sundayDate.getFullYear()).slice(2);

  // Two weeks ago (for absence detection)
  const twoWeeksAgoDate = new Date(sundayDate);
  twoWeeksAgoDate.setDate(sundayDate.getDate() - 13);
  const twoWeeksAgoStr = twoWeeksAgoDate.getFullYear() + "-" +
    String(twoWeeksAgoDate.getMonth() + 1).padStart(2, "0") + "-" +
    String(twoWeeksAgoDate.getDate()).padStart(2, "0");

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
    // Query attendance for the most recent Sunday
    const attFilter = { property: "주일 날짜 (Date)", date: { equals: sundayISO } };
    const allAtt = await queryAll(ATTENDANCE_DB, attFilter);

    const stuFilter = { and: [
      { property: "상태 (Status)", select: { equals: "활성 (Active)" } },
      { property: "방문자 (Visitor)", checkbox: { equals: false } }
    ]};
    const allStu = await queryAll(STUDENT_DB, stuFilter);

    // Recent attendance (last 14 days) for absence detection
    const recentFilter = { property: "주일 날짜 (Date)", date: { on_or_after: twoWeeksAgoStr } };
    const recentAtt = await queryAll(ATTENDANCE_DB, recentFilter);

    const recentAttIds = new Set();
    recentAtt.forEach(p => {
      (p.properties["학생 (Student)"]?.relation || []).forEach(r => recentAttIds.add(r.id));
    });

    const ds = {};
    DEPT_ORDER.forEach(d => { ds[d] = { attended: 0, visitors: 0, total: 0 }; });

    allStu.forEach(p => {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      if (!ds[dept]) ds[dept] = { attended: 0, visitors: 0, total: 0 };
      ds[dept].total++;
    });

    allAtt.forEach(p => {
      const dept = p.properties["부서 (Department)"]?.select?.name || "";
      const isNew = p.properties["방문자 (Visitor)"]?.checkbox || false;
      if (!ds[dept]) ds[dept] = { attended: 0, visitors: 0, total: 0 };
      if (isNew) ds[dept].visitors++;
      else ds[dept].attended++;
    });

    // Absent list
    const absentList = [];
    allStu.forEach(p => {
      if (!recentAttIds.has(p.id)) {
        const dept = p.properties["부서 (Department)"]?.select?.name || "";
        const nameArr = p.properties["이름 (Name)"]?.title || [];
        const lastDateArr = p.properties["마지막 출석일 (Last Attended)"]?.date;
        absentList.push({
          id: p.id,
          name: nameArr[0]?.text?.content || "(이름없음)",
          dept,
          staff: STAFF_MAP[dept] || dept.split(" ")[0],
          lastAttended: lastDateArr?.start || null
        });
      }
    });
    absentList.sort((a,b) => (a.dept||"").localeCompare(b.dept||""));

    // Liability list
    const liabilityList = [];
    allStu.forEach(p => {
      const liab = p.properties["Liability Form"]?.select?.name || "";
      if (liab !== "제출 완료") {
        const dept = p.properties["부서 (Department)"]?.select?.name || "";
        const nameArr = p.properties["이름 (Name)"]?.title || [];
        liabilityList.push({
          id: p.id, name: nameArr[0]?.text?.content || "(이름없음)",
          dept, staff: STAFF_MAP[dept] || dept.split(" ")[0],
          liabilityStatus: liab || "미제출"
        });
      }
    });
    liabilityList.sort((a,b) => (a.dept||"").localeCompare(b.dept||""));

    // Photo list
    const photoList = [];
    allStu.forEach(p => {
      const photo = p.properties["사진 촬영 (Photo)"]?.select?.name || "";
      if (photo !== "촬영 완료") {
        const dept = p.properties["부서 (Department)"]?.select?.name || "";
        const nameArr = p.properties["이름 (Name)"]?.title || [];
        photoList.push({
          id: p.id, name: nameArr[0]?.text?.content || "(이름없음)",
          dept, staff: STAFF_MAP[dept] || dept.split(" ")[0],
          photoStatus: photo || "미촬영"
        });
      }
    });
    photoList.sort((a,b) => (a.dept||"").localeCompare(b.dept||""));

    const depts = DEPT_ORDER.filter(d => ds[d] && (ds[d].total > 0 || ds[d].attended > 0))
      .map(d => {
        const st = ds[d];
        return {
          dept: d, short: d.split(" ")[0],
          attended: st.attended, visitors: st.visitors,
          absent: Math.max(0, st.total - st.attended),
          total: st.total
        };
      });

    const total = depts.reduce((a,r) => {
      a.attended += r.attended; a.visitors += r.visitors;
      a.absent += r.absent; a.total += r.total;
      return a;
    }, { attended:0, visitors:0, absent:0, total:0 });

    const rows = depts.map(d => ({ dept:d.dept, short:d.short, checkin:d.attended, visitor:d.visitors, absent:d.absent, total:d.total }));
    const grand = { checkin:total.attended, visitor:total.visitors, absent:total.absent, total:total.total };

    let saved = false;
    if (req.method === "POST") {
      const titleText = "교육부 전체 출석 요약 — " + sundayStr;
      const lines2 = depts.map(r => r.short + ": 출석 " + r.attended + " / 결석 " + r.absent + " / 방문 " + r.visitors + " / 등록 " + r.total);
      lines2.push("");
      lines2.push("전체 교육부: 출석 " + total.attended + " / 결석 " + total.absent + " / 방문 " + total.visitors + " / 완등록 " + total.total);
      const summaryText = lines2.join("\n");

      let existingId = null;
      try {
        const checkResp = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", {
          method: "POST", headers: authHeaders,
          body: JSON.stringify({ filter: { property: "이름 (Name)", title: { equals: titleText } }, page_size: 1 })
        });
        const checkData = await checkResp.json();
        if (checkData.results?.length > 0) existingId = checkData.results[0].id;
      } catch(e2) {}

      const notionProps = {
        "이름 (Name)": { title: [{ text: { content: titleText } }] },
        "주일 날짜 (Date)": { date: { start: sundayISO } },
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

    return res.status(200).json({
      depts, total, rows, grand,
      sundayStr, sundayISO,
      date: today, isToday,
      saved, absentList, liabilityList, photoList
    });

  } catch(e) {
    return res.status(500).json({ error: e.message });
  }
};
