module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const STAFF = [
    { name: "\uC774\uC9C0\uD61C", dept: "\uC720\uC544\uBD80 (Infant)" },
    { name: "\uAE40\uD5A5\uC219", dept: "\uC720\uCE58\uBD80 (Preschool)" },
    { name: "\uBC15\uC740\uD61C", dept: "\uC720\uB144\uBD80 (Elementary Jr)" },
    { name: "\uBC31\uC9C4\uC8FC", dept: "\uCD08\uB4F1\uBD80 (Elementary)" },
    { name: "\uBC15\uBA85\uCCA0", dept: "\uC911\uACE0\uB4F1\uBD80 (Middle/High)" },
  ];
  return res.status(200).json({ staff: STAFF });
};