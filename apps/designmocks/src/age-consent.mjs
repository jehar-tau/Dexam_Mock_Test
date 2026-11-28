// Owner's decision, 28 Nov 2026: students aged 16 or 17 may use DMocks with a parent or
// guardian's agreement. The sign-up asks for an age group only once the published notice
// itself allows under-18s (scripts/published-notices.mjs reads the age from its text), so
// the screen never says more than the Terms a student is accepting.
export function ageConsentFor(notices) {
  const minimumAge = Number.isInteger(notices?.minimumAge) ? notices.minimumAge : 18;
  const guardianConsent = minimumAge < 18;
  const younger = minimumAge === 17 ? "17" : `${minimumAge} or 17`;
  return Object.freeze({
    minimumAge, guardianConsent,
    ageGroups: guardianConsent ? Object.freeze([
      { value: "18_plus", label: "I am 18 or older" },
      { value: "16_17_guardian", label: `I am ${younger}, and a parent or guardian has read these terms and agrees to my account` },
    ]) : Object.freeze([]),
  });
}

// Accept the displayed notice, with the age group when the notice asks for one. A backend
// without the age-group migration (202611280199) still records the acceptance.
export async function acceptNotice(rpc, version, { guardianConsent, ageGroup }) {
  if (!guardianConsent) return rpc("accept_current_terms", { p_version: version });
  if (!["18_plus", "16_17_guardian"].includes(ageGroup)) throw new Error("Choose an age group");
  const result = await rpc("accept_current_terms", { p_version: version, p_age_group: ageGroup });
  if (result?.error?.code === "PGRST202") return rpc("accept_current_terms", { p_version: version });
  return result;
}
