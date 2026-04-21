const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const REQUESTS_DB = 'd25f9fdaeeb748ac97ffda2f68f776bb';
const ABSENTEES_DB = 'de7bb42e89254fad949dde9123cd4cdb';
const STUDENT_DB = process.env.NOTION_STUDENT_DB || '107828732f784c39bcb0136a4397c758';
const ATTENDANCE_DB = process.env.NOTION_ATTENDANCE_DB || '89b6c47f85a842968493ce28ad93f8de';
const TIMEZONE = 'America/Los_Angeles';

function getServiceSunday() {
  const now = new Date();
  const laDate = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year:'numeric', month:'2-digit', day:'2-digit' }).format(now);
  const [yr,mo,dy] = laDate.split('-').map(Number);
  const laDay = new Date(Date.UTC(yr, mo-1, dy));
  const dow = laDay.getUTCDay();
  if (dow === 6) return null;
  const sunday = new Date(laDay);
  sunday.setUTCDate(laDay.getUTCDate() - dow);
  return sunday.toISOString().split('T')[0];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const type = req.query.type || (req.body && req.body.type);

  try {
    // ══ REQUESTS ══
    if (type === 'requests') {
      if (req.method === 'GET') {
        const dept = req.query.department;
        const filter = dept && dept !== 'all'
          ? { property: '\ube80\uc11c (Department)', select: { equals: dept } }
          : undefined;
        const res2 = await notion.databases.query({
          database_id: REQUESTS_DB,
          sorts: [{ timestamp: 'created_time', direction: 'descending' }],
          filter
        });
        const rows = res2.results.map(p => {
          const pr = p.properties;
          return {
            id: p.id,
            title: pr['\uc81c\ubaa9 (Title)']?.title?.[0]?.text?.content || '',
            content: pr['\uc694\uccad \ub0b4\uc6a9 (Content)']?.rich_text?.[0]?.text?.content || '',
            requester: pr['\uc694\uccad\uc790 (Requester)']?.rich_text?.[0]?.text?.content || '',
            department: pr['\ube80\uc11c (Department)']?.select?.name || '',
            status: pr['\uc0c1\ud0dc (Status)']?.select?.name || '\ub300\uae30\uc911',
            handler: pr['\ub2f4\ub2f9\uc790 (Handler)']?.rich_text?.[0]?.text?.content || '',
            notes: pr['\ucc98\ub9ac \uba54\ubaa8 (Notes)']?.rich_text?.[0]?.text?.content || '',
            createdAt: p.created_time,
          };
        });
        return res.json({ success: true, requests: rows });
      }
      if (req.method === 'POST') {
        const { title, content, requester, department } = req.body;
        const newPage = await notion.pages.create({
          parent: { database_id: REQUESTS_DB },
          properties: {
            '\uc81c\ubaa9 (Title)': { title: [{ text: { content: title || '\uc694\uccad' } }] },
            '\uc694\uccad \ub0b4\uc6a9 (Content)': { rich_text: [{ text: { content: content || '' } }] },
            '\uc694\uccad\uc790 (Requester)': { rich_text: [{ text: { content: requester || '' } }] },
            '\ube80\uc11c (Department)': { select: department ? { name: department } : null },
            '\uc0c1\ud0dc (Status)': { select: { name: '\ub300\uae30\uc911' } },
          }
        });
        return res.json({ success: true, id: newPage.id, action: 'created' });
      }
      if (req.method === 'PATCH') {
        const { id, status, handler, notes } = req.body;
        const props = {};
        if (status) props['\uc0c1\ud0dc (Status)'] = { select: { name: status } };
        if (handler) props['\ub2f4\ub2f9\uc790 (Handler)'] = { rich_text: [{ text: { content: handler } }] };
        if (notes) props['\ucc98\ub9ac \uba54\ubaa8 (Notes)'] = { rich_text: [{ text: { content: notes } }] };
        if (status === '\uc644\ub8cc') {
          const today = new Date().toISOString().split('T')[0];
          props['\uc644\ub8cc\uc77c (Completed)'] = { date: { start: today } };
        }
        await notion.pages.update({ page_id: id, properties: props });
        return res.json({ success: true, action: 'updated', status });
      }
    }

    // ══ ABSENTEES ══
    if (type === 'absentees') {
      if (req.method === 'GET') {
        const dept = req.query.department;
        const serviceSunday = getServiceSunday();
        // Find students absent 2+ weeks: last attended older than 2 sundays ago
        // Get all students
        let filter = { property: '\uc0c1\ud0dc (Status)', select: { equals: '\ud65c\uc131 (Active)' } };
        if (dept && dept !== 'all') {
          filter = { and: [filter, { property: '\ube80\uc11c (Department)', select: { equals: dept } }] };
        }
        const students = await notion.databases.query({ database_id: STUDENT_DB, filter, page_size: 100 });

        // Calculate 2 sundays ago
        const twoWeeksAgo = serviceSunday ? new Date(serviceSunday) : new Date();
        twoWeeksAgo.setUTCDate(twoWeeksAgo.getUTCDate() - 14);
        const twoWeeksAgoStr = twoWeeksAgo.toISOString().split('T')[0];

        const absentees = students.results.filter(p => {
          const lastAttended = p.properties['\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)']?.date?.start;
          return !lastAttended || lastAttended <= twoWeeksAgoStr;
        }).map(p => {
          const pr = p.properties;
          return {
            id: p.id,
            name: pr['\uc774\ub984 (Name)']?.title?.[0]?.text?.content || '',
            department: pr['\ube80\uc11c (Department)']?.select?.name || '',
            grade: pr['\ud559\ub144 (Grade)']?.rich_text?.[0]?.text?.content || '',
            lastAttended: pr['\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)']?.date?.start || null,
            phone: pr['\uc5b4\uba38\ub2c8 \uc5f0\ub77d\ucc98 (Mother Phone)']?.rich_text?.[0]?.text?.content || pr['\uc5f0\ub77d\ucc98 (Phone)']?.phone_number || '',
          };
        });

        // Also check if there's already a contact record this week
        const weekFilter = serviceSunday
          ? { property: '\uc8fc\uac04 \uae30\uc900\uc77c (Week)', date: { equals: serviceSunday } }
          : undefined;
        const contactRecs = weekFilter
          ? await notion.databases.query({ database_id: ABSENTEES_DB, filter: weekFilter, page_size: 100 })
          : { results: [] };

        const contactedMap = {};
        contactRecs.results.forEach(p => {
          const name = p.properties['\ud559\uc0dd \uc774\ub984 (Student)']?.title?.[0]?.text?.content;
          if (name) contactedMap[name] = {
            contacted: p.properties['\uc5f0\ub77d \uc5ec\ubd80 (Contacted)']?.select?.name || '\ubbf8\uc5f0\ub77d',
            reason: p.properties['\uc5f0\ub77d \uc0ac\uc720 \/ \uba54\ubaa8 (Reason)']?.rich_text?.[0]?.text?.content || '',
            staff: p.properties['\uc5f0\ub77d\ud55c \uac04\uc0ac (Staff)']?.rich_text?.[0]?.text?.content || '',
            recordId: p.id,
          };
        });

        const result = absentees.map(a => ({ ...a, ...(contactedMap[a.name] || { contacted: '\ubbf8\uc5f0\ub77d' }) }));
        return res.json({ success: true, absentees: result, serviceSunday, count: result.length });
      }

      if (req.method === 'POST') {
        const { studentId, studentName, department, grade, lastAttended, reason, staffName, recordId } = req.body;
        const serviceSunday = getServiceSunday();
        const today = new Date().toISOString().split('T')[0];

        if (recordId) {
          // Update existing record
          await notion.pages.update({
            page_id: recordId,
            properties: {
              '\uc5f0\ub77d \uc5ec\ubd80 (Contacted)': { select: { name: '\uc5f0\ub77d\ud568' } },
              '\uc5f0\ub77d \uc0ac\uc720 \/ \uba54\ubaa8 (Reason)': { rich_text: [{ text: { content: reason || '' } }] },
              '\uc5f0\ub77d\ud55c \uac04\uc0ac (Staff)': { rich_text: [{ text: { content: staffName || '' } }] },
              '\uc5f0\ub77d\uc77c (Contact Date)': { date: { start: today } },
            }
          });
          return res.json({ success: true, action: 'updated' });
        }

        // Create new record
        const props = {
          '\ud559\uc0dd \uc774\ub984 (Student)': { title: [{ text: { content: studentName || '' } }] },
          '\ube80\uc11c (Department)': { rich_text: [{ text: { content: department || '' } }] },
          '\ud559\ub144 (Grade)': { rich_text: [{ text: { content: grade || '' } }] },
          '\uc5f0\ub77d \uc5ec\ubd80 (Contacted)': { select: { name: '\uc5f0\ub77d\ud568' } },
          '\uc5f0\ub77d \uc0ac\uc720 \/ \uba54\ubaa8 (Reason)': { rich_text: [{ text: { content: reason || '' } }] },
          '\uc5f0\ub77d\ud55c \uac04\uc0ac (Staff)': { rich_text: [{ text: { content: staffName || '' } }] },
          '\uc5f0\ub77d\uc77c (Contact Date)': { date: { start: today } },
        };
        if (lastAttended) props['\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)'] = { date: { start: lastAttended } };
        if (serviceSunday) props['\uc8fc\uac04 \uae30\uc900\uc77c (Week)'] = { date: { start: serviceSunday } };

        const newPage = await notion.pages.create({ parent: { database_id: ABSENTEES_DB }, properties: props });
        return res.json({ success: true, id: newPage.id, action: 'created' });
      }
    }

    return res.status(400).json({ error: 'Unknown type. Use ?type=requests or ?type=absentees' });

  } catch(e) {
    console.error('staff-ops error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
