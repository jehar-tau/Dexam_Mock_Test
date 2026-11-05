export const candidateExams = Object.freeze([
  ["uceed", "UCEED"], ["nid", "NID DAT"], ["nift", "NIFT"], ["ceed", "CEED"],
]);

export function normalizeCandidateProfile(value) {
  return {
    displayName: String(value.displayName || "").trim(),
    phone: String(value.phone || "").replace(/[\s()-]/g, ""),
    appearingYear: Number(value.appearingYear),
    city: String(value.city || "").trim(),
    exams: [...new Set(value.exams || [])].sort(),
  };
}

export function validateCandidateProfile(value) {
  const profile = normalizeCandidateProfile(value);
  const allowed = new Set(candidateExams.map(([key]) => key));
  const errors = {};
  if (profile.displayName.length < 2 || profile.displayName.length > 100) errors.displayName = "Enter your full name.";
  if (!/^\+[1-9][0-9]{7,14}$/.test(profile.phone)) errors.phone = "Use an international number, for example +919876543210.";
  if (!Number.isInteger(profile.appearingYear) || profile.appearingYear < 2026 || profile.appearingYear > 2040) errors.appearingYear = "Choose a valid appearing year.";
  if (profile.city.length < 2 || profile.city.length > 120) errors.city = "Enter your city.";
  if (!profile.exams.length || profile.exams.some((exam) => !allowed.has(exam))) errors.exams = "Choose at least one exam.";
  return { profile, errors, valid: Object.keys(errors).length === 0 };
}
