import { publishedNotices } from "./platform.js";
import { ageConsentFor } from "./age-consent.mjs";

export { acceptNotice } from "./age-consent.mjs";
export const { minimumAge, guardianConsent, ageGroups } = ageConsentFor(publishedNotices);
