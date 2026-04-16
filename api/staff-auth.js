module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (req.method !== "GET") return res.status(405).end();
  const { name, password } = req.query;
  if (!name || !password) return res.status(400).json({ error: "missing params" });
  const STAFF = {
    "\uC774\uC9C0\uD61C": "\uC720\uC544\uBD80 (Infant)",
    "\uAE40\uD5A5\uC219": "\uC720\uCE58\uBD80 (Preschool)",
    "\uBC15\uC740\uD61C": "\uC720\uB144\uBD80 (Elementary Jr)",
    "\uBC31\uC9C4\uC8FC": "\uCD08\uB4F1\uBD80 (Elementary)",
    "\uBC15\uBA85\uCCA0": "\uC911\uACE0\uB4F1\uBD80 (Youth)",
  };
  const sharedPw = process.env.STAFF_PASSWORD || process.env.ADMIN_PASSWORD;
  if (password !== sharedPw) return res.status(401).json({ ok: false, error: "\uBE44\uBC00\uBC88\uD638\uAC00 \uD2C0\uB838\uC2B5\uB2C8\uB2E4" });
  const dept = STAFF[name];
  if (!dept) return res.status(404).json({ ok: false, error: "\uAC04\uC0AC \uC815\uBCF4\uB97C \uCC3E\uC744 \uC218 \uC5C6\uC2B5\uB2C8\uB2E4" });
  return res.status(200).json({ ok: true, name, dept });
};
