module.exports = async (req, res) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  // ===== 간사 명단 - 이곤 수정하세요 =====
  const STAFF = [
    { name: "간사1 (샘플)", dept: "유아부 (Infant)" },
    { name: "간사2 (샘플)", dept: "유치부 (Preschool)" },
    { name: "간사3 (샘플)", dept: "유년부 (Elementary Jr)" },
    { name: "간사4 (샘플)", dept: "초등부 (Elementary)" },
    { name: "간사5 (샘플)", dept: "중고등부 (Middle/High)" },
  ];
  // ==========================================
  return res.status(200).json({ staff: STAFF });
};