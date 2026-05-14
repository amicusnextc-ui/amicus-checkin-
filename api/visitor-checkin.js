const STUDENT_DB = process.env.NOTION_STUDENT_DB_ID || "107828732f784c39bcb0136a4397c758";
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB_ID || "89b6c47f85a842968493ce28ad93f8de";
const NOTION_VERSION = "2022-06-28";
const TIMEZONE = "America/Los_Angeles";
function getDept(m){const y=m/12;if(m<48)return "\uC720\uC544\uBD80 (Infant)";if(y<6)return "\uC720\uCE58\uBD80 (Preschool)";if(y<9)return "\uC720\uB144\uBD80 (Elementary Jr)";if(y<12)return "\uCD08\uB4F1\uBD80 (Elementary)";return "\uC911\uACE0\uB4F1\uBD80 (Youth)";}
function calcAge(dob){if(!dob)return 0;const d=new Date(dob),n=new Date();let m=(n.getFullYear()-d.getFullYear())*12+(n.getMonth()-d.getMonth());if(n.getDate()<d.getDate())m--;return m;}
module.exports = async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin","*");
    res.setHeader("Access-Control-Allow-Methods","POST,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers","Content-Type");
    if(req.method==="OPTIONS") return res.status(200).end();
    if(req.method!=="POST") return res.status(405).end();
    const body = req.body || {};
    // BACKFILL MODE
    if (body.mode === 'backfill') {
          const { records } = body;
          if (!records || !Array.isArray(records)) return res.status(400).json({ error: "records array required" });
          const headers = { "Authorization": "Bearer " + process.env.NOTION_TOKEN, "Notion-Version": NOTION_VERSION, "Content-Type": "application/json" };
          const results = [];
          for (const rec of records) {
                  const { name, department, date, checkInTime, studentId } = rec;
                  const dupR = await fetch("https://api.notion.com/v1/databases/" + ATTENDANCE_DB + "/query", { method: "POST", headers, body: JSON.stringify({ filter: { and: [ { property: "\uC774\uB984 (Name)", title: { equals: name } }, { property: "\uC8FC\uC77C \uB0A0\uC9DC (Date)", date: { equals: date } } ]}, page_size: 1 }) });
                  const dupD = await dupR.json();
                  if (dupD.results && dupD.results.length > 0) { results.push({ name, date, status: "exists" }); continue; }
                  const props = {
                            "\uC774\uB984 (Name)": { title: [{ text: { content: name } }] },
                            "\uC8FC\uC77C \uB0A0\uC9DC (Date)": { date: { start: date } },
                            "\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)": { rich_text: [{ text: { content: checkInTime || "10:30" } }] },
                            "\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)": { rich_text: [{ text: { content: "12:00" } }] },
                            "\uBCF4\uD638\uC790 \uC778\uACC4 \uD655\uC778 (Guardian)": { checkbox: false },
                            "\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)": { checkbox: false },
                  };
                  if (department) props["\uBD80\uC11C (Department)"] = { select: { name: department } };
                  const r = await fetch("https://api.notion.com/v1/pages", { method: "POST", headers, body: JSON.stringify({ parent: { database_id: ATTENDANCE_DB }, properties: props }) });
                  const d = await r.json();
                  if (!r.ok) { results.push({ name, date, status: "error", error: d.message }); continue; }
                  if (studentId) { fetch("https://api.notion.com/v1/pages/" + studentId, { method: "PATCH", headers, body: JSON.stringify({ properties: { "\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)": { date: { start: date } } } }) }).catch(()=>{}); }
                  results.push({ name, date, status: "created" });
          }
          return res.status(200).json({ results, created: results.filter(r=>r.status==="created").length, existing: results.filter(r=>r.status==="exists").length });
    }
    // NORMAL VISITOR CHECKIN
    const{name,nameEN,dob,guardian,phone,allergy,notes,grade,school,studentPhone,instagram,invitedBy,parentEmail,parentPhone,visitReason}=body;
    if(!name||!dob)return res.status(400).json({error:"\uC774\uB984\uACFC \uC0DD\uB144\uC6D4\uC77C \uD544\uC218"});
    // NOTE: nameEN is validated in the frontend (youth.html requires it; index.html does not).
    // Do NOT add a backend check here \u2014 index.html submits with empty nameEN and would 400.
    // Day-of-week gate: match /api/checkin behavior
    const nowGate = new Date();
    const laDateGate = new Intl.DateTimeFormat('en-CA', {timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit'}).format(nowGate);
    const [yGate, mGate, dGate] = laDateGate.split('-').map(Number);
    const dowGate = new Date(Date.UTC(yGate, mGate-1, dGate)).getUTCDay();
    // Saturday: allowed with director auth (handled by !== 0 branch below)
    if (dowGate !== 0) {
      if (body.directorPassword !== process.env.DIRECTOR_PASSWORD) {
        return res.status(403).json({ error: '일요일 외 방문자 등록은 디렉터 인증이 필요합니다', requiresDirectorAuth: true });
      }
    }
    try{
          const ageMonths=calcAge(dob);const dept=getDept(ageMonths);
          const today=new Date().toLocaleDateString("sv-SE",{timeZone:TIMEZONE});
          const hasAllergy=allergy&&allergy.trim()&&allergy.toLowerCase()!=="\uC5C6\uC74C"&&allergy.toLowerCase()!=="none";
          const headers2={"Authorization":`Bearer ${process.env.NOTION_TOKEN}`,"Notion-Version":NOTION_VERSION,"Content-Type":"application/json"};
          // ── DEDUP CHECK ── (skip if force=true)
          if (!body.force) {
            const dupCheck = await fetch("https://api.notion.com/v1/databases/" + STUDENT_DB + "/query", {
              method: "POST", headers: headers2,
              body: JSON.stringify({
                filter: {
                  and: [
                    { property: "\uC774\uB984 (Name)", title: { equals: name } },
                    { property: "\uC0C1\uD0DC (Status)", select: { equals: "\uD65C\uC131 (Active)" } }
                  ]
                },
                page_size: 5
              })
            });
            const dupData = await dupCheck.json();
            if (dupData.results && dupData.results.length > 0) {
              const matches = dupData.results.map(p => {
                const nm = p.properties["\uC774\uB984 (Name)"]?.title?.[0]?.plain_text || "";
                const dp = p.properties["\uBD80\uC11C (Department)"]?.select?.name || "";
                const isVis = p.properties["\uBC29\uBB38\uC790 (Visitor)"]?.checkbox || false;
                const dobExisting = p.properties["\uC0DD\uB144\uC6D4\uC77C (DOB)"]?.date?.start || null;
                return { id: p.id, name: nm, dept: dp, isVisitor: isVis, dob: dobExisting };
              });
              return res.status(200).json({ duplicate: true, matches: matches });
            }
          }
          const sr=await fetch("https://api.notion.com/v1/pages",{method:"POST",headers:headers2,body:JSON.stringify({parent:{database_id:STUDENT_DB},properties:{
                  "\uC774\uB984 (Name)":{title:[{text:{content:name}}]},
                  "\uC601\uBB38\uC774\uB984 (Name EN)":{rich_text:[{text:{content:nameEN||""}}]},
                  "\uBD80\uC11C (Department)":{select:{name:dept}},
                  "\uBCF4\uD638\uC790 (Guardian)":{rich_text:[{text:{content:guardian||""}}]},
                  "\uC5B4\uBA38\uB2C8 \uC5F0\uB77D\uCC98 (Mother Phone)":parentPhone?{phone_number:parentPhone}:(phone?{phone_number:phone}:{phone_number:null}),
                  "\uC5B4\uBA38\uB2C8 \uC774\uBA54\uC77C (Mother Email)":parentEmail?{email:parentEmail}:{email:null},
                  "\uC5F0\uB77D\uCC98 (Phone)":studentPhone?{phone_number:studentPhone}:{phone_number:null},
                  "\uD559\uAD50 (School)":{rich_text:[{text:{content:school||""}}]},
                  "Instagram":{rich_text:[{text:{content:instagram||""}}]},
                  "\uCD08\uB300\uC790 (Invited By)":{rich_text:[{text:{content:invitedBy||""}}]},
                  ...(visitReason?{"\uBC29\uBB38 \uC774\uC720 (Visit Reason)":{select:{name:visitReason}}}:{}),
                  "\uC54C\uB7EC\uC9C0 (Allergy)":{rich_text:[{text:{content:allergy||"\uC5C6\uC74C"}}]},
                  "\uD559\uB144 (Grade)":{rich_text:[{text:{content:grade||""}}]},
                  "\uD2B9\uC774\uC0AC\uD56D (Notes)":{rich_text:[{text:{content:notes||""}}]},
                  "\uBC29\uBB38\uC790 (Visitor)":{checkbox:true},
                  "\uC0C1\uD0DC (Status)":{select:{name:"\uD65C\uC131 (Active)"}},
                  "\uBC29\uBB38 \uD69F\uC218 (Visit Count)":{number:1},
                  "\uB4F1\uB85D\uC77C (Registered)":{date:{start:today}},
                  "\uB9C8\uC9C0\uB9C9 \uCD9C\uC11D (Last Attended)":{date:{start:today}}
          }})});
          const sd=await sr.json();if(!sr.ok)return res.status(500).json({error:sd.message});
          const now=new Date();const timeStr=now.toLocaleTimeString("ko-KR",{timeZone:TIMEZONE,hour:"2-digit",minute:"2-digit"});
          const ar=await fetch("https://api.notion.com/v1/pages",{method:"POST",headers:headers2,body:JSON.stringify({parent:{database_id:ATTENDANCE_DB},properties:{
                  "\uC774\uB984 (Name)":{title:[{text:{content:name}}]},
                  "\uBD80\uC11C (Department)":{select:{name:dept}},
                  "\uC8FC\uC77C \uB0A0\uC9DC (Date)":{date:{start:today}},
                  "\uCCB4\uD06C\uC778 \uC2DC\uAC04 (Check-in)":{rich_text:[{text:{content:timeStr}}]},
                  "\uBC29\uBB38\uC790 (Visitor)":{checkbox:true},
                  "\uC54C\uB7EC\uC9C0 \uC54C\uB9BC (Allergy Alert)":{checkbox:hasAllergy},
                  "\uD2B9\uC774\uC0AC\uD56D (Notes)":{rich_text:[{text:{content:notes||""}}]},
                  ...(String(dept||"").indexOf("\uC911\uACE0\uB4F1\uBD80") === 0 ? { "\uCCB4\uD06C\uC544\uC6C3 \uC2DC\uAC04 (Check-out)": { rich_text: [{ text: { content: "AUTO" } }] } } : {})
          }})});
          const ad=await ar.json();if(!ar.ok)return res.status(500).json({error:ad.message});
          return res.status(200).json({ok:true,studentId:sd.id,pageId:ad.id,department:dept,checkInTime:timeStr,ageMonths});
    }catch(e){return res.status(500).json({error:e.message});}
};
