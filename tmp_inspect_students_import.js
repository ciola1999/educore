const XLSX = require("xlsx");
const wb = XLSX.readFile(
  "e:/Data Meksa/Educore/template-import-students.xlsx",
  { cellDates: true },
);
const ws = wb.Sheets[wb.SheetNames[0]];
const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: true });
const matrix = XLSX.utils.sheet_to_json(ws, {
  header: 1,
  defval: "",
  raw: true,
});
console.log("SHEET:", wb.SheetNames[0]);
console.log("HEADER:", matrix[0]);
console.log("ROW2_OBJ:", rows[0]);
console.log("ROW2_RAW:", matrix[1]);
