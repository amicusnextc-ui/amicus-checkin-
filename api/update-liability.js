const { Client } = require('@notionhq/client');
const notion = new Client({ auth: process.env.NOTION_TOKEN });
const STUDENT_DB = process.env.NOTION_STUDENT_DB || '107828732f784c39bcb0136a4397c758';

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { studentId, guardianName, signature, timestamp, signedText } = req.body;
    if (!studentId) return res.status(400).json({ error: 'Missing studentId' });

    const signedNote = signedText || ('Signed by ' + guardianName + ' at ' + timestamp);

    await notion.pages.update({
      page_id: studentId,
      properties: {
        'liabilityForm': { checkbox: true },
        '특이사항 (Notes)': {
          rich_text: [{
            text: { content: '[LIABILITY] ' + signedNote }
          }]
        }
      }
    });

    return res.status(200).json({ ok: true, message: 'Liability form recorded' });
  } catch (err) {
    console.error('update-liability error:', err);
    return res.status(500).json({ error: err.message });
  }
};
