// CSV for the Admin "Student contacts" download (admin_student_contacts, migration
// 202611280200): only students who gave marketing permission.
const columns = [["name", "Name"], ["phone", "Phone"], ["exams", "Exams"], ["appearingYear", "Appearing year"],
  ["studyStage", "Stage"], ["city", "City"], ["state", "State"], ["permissionSince", "Permission given"]];
const cell = value => {
  let text = Array.isArray(value) ? value.join(" ").toUpperCase() : value == null ? "" : String(value);
  // A leading =, +, - or @ would make a spreadsheet treat the cell as a formula.
  if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
};
export function studentContactsCsv(rows) {
  if (!Array.isArray(rows)) throw new Error("Invalid contact list");
  return [columns.map(([, label]) => label).join(","), ...rows.map(row => columns.map(([key]) => cell(row?.[key])).join(","))].join("\r\n") + "\r\n";
}
