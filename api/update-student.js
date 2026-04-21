const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const body = req.body || {};
    const { pageId, action, name, department, grade, allergy, notes,
            liabilityForm, baptized, photo, status,
            guardianName, signature, timestamp } = body;

    if (!pageId) return res.status(400).json({ error: 'Missing pageId' });

    // LIABILITY action
    if (action === 'liability') {
      const note = 'Signed by ' + (guardianName||'') + ' on ' + (timestamp||new Date().toISOString()) + (signature ? ' | Sig: '+signature : '');
      await notion.pages.update({
        page_id: pageId,
        properties: {
          'Liability Form': { select: { name: '제출 완료' } },
          '특이사항 (Notes)': { rich_text: [{ text: { content: '[LIABILITY] ' + note } }] }
        }
      });
      return res.json({ success: true, action: 'liability', message: 'Liability form recorded' });
    }

    // General update
    const props = {};
    if (name !== undefined) props['이름 (Name)'] = { title: [{ text: { content: name } }] };
    if (department !== undefined) props['부서 (Department)'] = { select: department ? { name: department } : null };
    if (grade !== undefined) props['학년 (Grade)'] = { rich_text: [{ text: { content: grade||'' } }] };
    if (allergy !== undefined) props['알러지 (Allergy)'] = { rich_text: [{ text: { content: allergy||'' } }] };
    if (notes !== undefined) props['특이사항 (Notes)'] = { rich_text: [{ text: { content: notes||'' } }] };
    if (liabilityForm !== undefined) props['Liability Form'] = { select: liabilityForm ? { name: liabilityForm } : null };
    if (status !== undefined) props['상태 (Status)'] = { select: status ? { name: status } : null };

    if (Object.keys(props).length > 0) {
      await notion.pages.update({ page_id: pageId, properties: props });
    }
    return res.json({ success: true, action: 'updated' });

  } catch(e) {
    console.error('update-student error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};