const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_STUDENT_DB_ID;

function prop(page, name) {
    const p = page.properties[name];
    if (!p) return null;
    switch(p.type) {
      case 'title': return p.title.map(t=>t.plain_text).join('');
      case 'rich_text': return p.rich_text.map(t=>t.plain_text).join('');
      case 'select': return p.select?.name || null;
      case 'date': return p.date?.start || null;
      case 'phone_number': return p.phone_number || null;
      case 'email': return p.email || null;
      case 'checkbox': return p.checkbox;
      case 'auto_increment_id': return p.unique_id?.number ? String(p.unique_id.number) : null;
      default: return null;
    }
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const { dept } = req.query;
    const filter = {
          and: [
            { property: '\ubc29\ubb38\uc790 (Visitor)', checkbox: { equals: false } },
            { property: '\uc0c1\ud0dc (Status)', select: { equals: '\ud65c\uc131 (Active)' } },
                ]
    };
    if (dept) filter.and.push({ property: '\ubd80\uc11c (Department)', select: { equals: dept } });
    try {
          let allPages = [], cursor;
          do {
                  const resp = await notion.databases.query({
                            database_id: DB,
                            filter,
                            sorts: [{ property: '\uc774\ub984 (Name)', direction: 'ascending' }],
                            start_cursor: cursor,
                            page_size: 100
                  });
                  allPages = allPages.concat(resp.results);
                  cursor = resp.has_more ? resp.next_cursor : null;
          } while (cursor);
          const now = new Date();
          const students = allPages.map(page => {
                  const d = prop(page, '\ubd80\uc11c (Department)');
                  const isJrPlus = d && !['\uc720\uc544\ubd80 (Infant)', '\uc720\uce58\ubd80 (Preschool)'].includes(d);
                  const dob = prop(page, '\uc0dd\ub144\uc6d4\uc77c (DOB)');
                  let age = null, isBirthdayMonth = false;
                  if (dob) {
                            const bd = new Date(dob);
                            isBirthdayMonth = bd.getMonth() === now.getMonth();
                            age = now.getFullYear() - bd.getFullYear() - (now.getMonth() < bd.getMonth() || (now.getMonth() === bd.getMonth() && now.getDate() < bd.getDate()) ? 1 : 0);
                  }
                  const fatherPhone = prop(page, '\uc544\ubc84\uc9c0 \uc5f0\ub77d\ucc98 (Father Phone)');
                  const motherPhone = prop(page, '\uc5b4\uba38\ub2c8 \uc5f0\ub77d\ucc98 (Mother Phone)');
                  return {
                            id: page.id,
                            name: prop(page, '\uc774\ub984 (Name)'),
                            nameEN: prop(page, '\uc601\ubb38\uc774\ub984 (Name EN)'),
                            department: d,
                            grade: prop(page, '\ud559\ub144 (Grade)'),
                            school: isJrPlus ? prop(page, '\ud559\uad50 (School)') : null,
                            dob,
                            age,
                            isBirthdayMonth,
                            guardian: prop(page, '\ubcf4\ud638\uc790 (Guardian)'),
                            phone: fatherPhone || motherPhone,
                            fatherName: prop(page, '\uc544\ubc84\uc9c0 \uc774\ub984 (Father Name)'),
                            fatherPhone,
                            fatherEmail: prop(page, '\uc544\ubc84\uc9c0 \uc774\uba54\uc77c (Father Email)'),
                            motherName: prop(page, '\uc5b4\uba38\ub2c8 \uc774\ub984 (Mother Name)'),
                            motherPhone,
                            motherEmail: prop(page, '\uc5b4\uba38\ub2c8 \uc774\uba54\uc77c (Mother Email)'),
                            address: prop(page, '\uc9d1\uc8fc\uc18c (Address)'),
                            allergy: prop(page, '\uc54c\ub7ec\uc9c0 (Allergy)'),
                            notes: prop(page, '\ud2b9\uc774\uc0ac\ud56d (Notes)'),
                            liabilityForm: prop(page, 'Liability Form'),
                            baptized: prop(page, '\uc138\ub840 \uc5ec\ubd80 (Baptized)'),
                            photo: prop(page, '\uc0ac\uc9c4 \ucd94\uc601 (Photo)'),
                            studentId: prop(page, '\uace0\uc720\ubc88\ud638 (ID)'),
                            lastAttended: prop(page, '\ub9c8\uc9c0\ub9c9 \ucd9c\uc11d (Last Attended)'),
                  };
          });
          res.json({ students });
    } catch(e) {
          res.status(500).json({ error: e.message });
    }
};
