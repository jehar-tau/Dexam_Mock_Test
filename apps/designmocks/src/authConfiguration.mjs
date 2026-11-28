const closed = Object.freeze({ authReady: false, portalReady: false, testLoginMode: false, stagingPortalMode: false, controlledPublicPortalMode: false, checkoutReady: false });
export const publishedNoticeVersionPattern = /^dmocks-notices-v1-[a-f0-9]{64}$/;

export function resolveAuthConfiguration({
  mode, deployment, origin, stagingTarget, checkoutTarget, productionOrigin,
  portalEnabled = false, testLoginEnabled = false, stagingPortalEnabled = false, controlledPublicPortalEnabled = false,
  checkoutEnabled = false, url, key, termsVersion, noticeVersion,
}) {
  if ([portalEnabled, testLoginEnabled, stagingPortalEnabled, controlledPublicPortalEnabled].filter(Boolean).length > 1)
    throw new Error("Choose one mode for sign-in or portal access.");
  if (controlledPublicPortalEnabled) {
    if (mode !== "production" || deployment !== "production" ||
        !stagingTarget?.url || url !== stagingTarget.url || !productionOrigin)
      throw new Error("Controlled public portal requires the approved origin and designated Test project.");
    // Sales day: checkout opens on the public portal only with the reviewed paid notices compiled in.
    if (checkoutEnabled === true && (typeof termsVersion !== "string" || !publishedNoticeVersionPattern.test(termsVersion) || noticeVersion !== termsVersion))
      throw new Error("Opening checkout on the public portal requires matching reviewed customer notices.");
    if (origin !== productionOrigin) return closed;
  }
  if (testLoginEnabled && !["development", "staging", "test"].includes(deployment))
    throw new Error("Controlled login testing cannot be enabled in a production release.");
  if (testLoginEnabled && mode === "production" && deployment === "development")
    throw new Error("Use an explicitly staged build for controlled login; do not ship development login configuration.");
  if (!portalEnabled && !testLoginEnabled && !stagingPortalEnabled && !controlledPublicPortalEnabled) return closed;
  if (portalEnabled && (deployment === "staging" || mode === "staging"))
    throw new Error("Use private staging portal mode for staging acceptance.");
  if (portalEnabled && deployment === "production") {
    if (stagingTarget?.url && url?.toLowerCase() === stagingTarget.url)
      throw new Error("The production portal requires a separate Supabase project.");
    if (!productionOrigin) throw new Error("The production portal requires its approved origin.");
    if (origin !== productionOrigin) return closed;
  }
  if (portalEnabled && checkoutEnabled === true && (mode === "test" || (deployment === "test" && mode !== "development"))) {
    if (mode !== "test" || deployment !== "test")
      throw new Error("The private checkout requires an explicit Test build.");
    if (!checkoutTarget?.url || !checkoutTarget.origin || url !== checkoutTarget.url)
      throw new Error("The private checkout requires the designated DMocks Test project.");
    if (origin !== checkoutTarget.origin) return closed;
    if (typeof termsVersion !== "string" || !publishedNoticeVersionPattern.test(termsVersion) || noticeVersion !== termsVersion)
      throw new Error("The private checkout requires matching reviewed customer notices.");
  }
  if (stagingPortalEnabled) {
    if (deployment !== "staging" || mode !== "staging")
      throw new Error("The private portal requires an explicit staging build.");
    if (!stagingTarget?.url || !stagingTarget.origin || url !== stagingTarget.url)
      throw new Error("The private portal requires the designated DMocks staging project.");
    if (origin !== stagingTarget.origin) return closed;
  }
  if (!url || !key || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url))
    throw new Error("Google login needs the independent Supabase HTTPS URL and public client key.");
  if (key.startsWith("sb_secret_"))
    throw new Error("Server keys must never be used in browser configuration.");
  if (!key.startsWith("sb_publishable_")) {
    try {
      const parts = key.split(".");
      if (parts.length !== 3 || JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))).role !== "anon") throw new Error();
    } catch {
      throw new Error("Only a public publishable or anon-role key belongs in browser configuration.");
    }
  }
  if (portalEnabled && !termsVersion)
    throw new Error("The released portal requires its published terms version.");
  return {
    authReady: true,
    portalReady: portalEnabled || stagingPortalEnabled || controlledPublicPortalEnabled,
    testLoginMode: testLoginEnabled,
    stagingPortalMode: stagingPortalEnabled,
    controlledPublicPortalMode: controlledPublicPortalEnabled,
    checkoutReady: (portalEnabled || controlledPublicPortalEnabled) && checkoutEnabled === true && typeof noticeVersion === "string" && noticeVersion === termsVersion,
  };
}

export function authCallbackMessage(search = "", hash = "") {
  const query = new URLSearchParams(search);
  const fragment = new URLSearchParams(hash.replace(/^#/, ""));
  const error = query.get("error") || fragment.get("error");
  if (!error) return "";
  return error === "access_denied"
    ? "Google sign-in was cancelled or access was denied. You can try again."
    : "Google sign-in could not be completed. Please try again or contact support.";
}
