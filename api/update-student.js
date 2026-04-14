const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const DB = process.env.NOTION_STUDENT_DB_ID;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const {
    pageId, name, nameEN, department, grade, school, dob,
    guardian, phone,
    fatherName, fatherPhone, fatherEmail,
    motherName, motherPhone, motherEmail,
    address, allergy, notes, liabilityForm, baptized, photo, status
  } = req.body;

  const props = {};
  if (name !== undefined)        props['\uc774\ub984 (Name)'] = { title: [{ text: { content: name } }] };
  if (nameEN !== undefined)      props['\uc601\ubb38\uc774\ub984 (Name EN)'] = { rich_text: [{ text: { content: nameEN||'' } }] };
  if (department !== undefined)  props['\ubd80\uc11c (Department)'] = { select: department ? { name: department } : null };
  if (grade !== undefined)       props['\ud559\ub144 (Grade)'] = { rich_text: [{ text: { content: grade||'' } }] };
  if (school !== undefined)      props['\ud559\uad50 (School)'] = { rich_text: [{ text: { content: school||'' } }] };
  if (dob !== undefined)         props['\uc0dd\ub144\uc6d4\uc77c (DOB)'] = dob ? { date: { start: dob } } : { date: null };
  if (guardian !== undefined)    props['\ubcf4\ud638\uc790 (Guardian)'] = { rich_text: [{ text: { content: guardian||'' } }] };
  if (phone !== undefined)       props['\uc5f0\ub77d\ucc98 (Phone)'] = { phone_number: phone||null };
  if (fatherName !== undefined)  props['\uc544\ubc84\uc9c0 \uc774\ub984 (Father Name)'] = { rich_text: [{ text: { content: fatherName||'' } }] };
  if (fatherPhone !== undefined) props['\uc544\ubc84\uc9c0 \uc5f0\ub77d\ucc98 (Father Phone)'] = { phone_number: fatherPhone||null };
  if (fatherEmail !== undefined) props['\uc544\ubc84\uc9c0 \uc774\uba54\uc77c (Father Email)'] = { email: fatherEmail||null };
  if (motherName !== undefined)  props['\uc5b4\uba38\ub2c8 \uc774\ub984 (Mother Name)'] = { rich_text: [{ text: { content: motherName||'' } }] };
  if (motherPhone !== undefined) props['\uc5b4\uba38\ub2c8 \uc5f0\ub77d\ucc98 (Mother Phone)'] = { phone_number: motherPhone||null };
  if (motherEmail !== undefined) props['\uc5b4\uba38\ub2c8 \uc774\uba54\uc77c (Mother Email)'] = { email: motherEmail||null };
  if (address !== undefined)     props['\uc9d1\uc8fc\uc18c (Address)'] = { rich_text: [{ text: { content: address||'' } }] };
  if (allergy !== undefined)     props['\uc54c\ub7ec\uc9c0 (Allergy)'] = { rich_text: [{ text: { content: allergy||'' } }] };
  if (notes !== undefined)       props['\ud2b9\uc774\uc0ac\ud56d (Notes)'] = { rich_text: [{ text: { content: notes||'' } }] };
  if (liabilityForm !== undefined) props['Liability Form'] = { select: liabilityForm ? { name: liabilityForm } : null };
  if (baptized !== undefined)    props['\uc138\ub840 \uc5ec\ubd80 (Baptized)'] = { select: baptized ? { name: baptized } : null };
  if (photo !== undefined)       props['\uc0ac\uc9c4 \ucd2c\uc601 (Photo)'] = { select: photo ? { name: photo } : null };
  if (status !== undefined)      props['\uc0c1\ud0dc (Status)'] = { select: status ? { name: status } : null };

  try {
    if (pageId) {
      await notion.pages.update({ page_id: pageId, properties: props });
      res.json({ success: true, action: 'updated' });
    } else {
      const page = await notion.pages.create({ parent: { database_id: DB }, properties: props });
      res.json({ success: true, action: 'created', pageId: page.id });
    }
  } catch(e) { res.status(500).json({ error: e.message }); }
};
