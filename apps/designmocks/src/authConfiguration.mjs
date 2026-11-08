const closed = Object.freeze({ authReady: false, portalReady: false, testLoginMode: false, stagingPortalMode: false, checkoutReady: false });

export function resolveAuthConfiguration({
  mode, deployment, origin, stagingTarget,
  portalEnabled = false, testLoginEnabled = false, stagingPortalEnabled = false, checkoutEnabled = false, url, key, termsVersion,
}) {
  if ([portalEnabled, testLoginEnabled, stagingPortalEnabled].filter(Boolean).length > 1)
    throw new Error("Choose one mode for sign-in or portal access.");
  if (testLoginEnabled && !["development", "staging", "test"].includes(deployment))
    throw new Error("Controlled login testing cannot be enabled in a production release.");
  if (testLoginEnabled && mode === "production" && deployment === "development")
    throw new Error("Use an explicitly staged build for controlled login; do not ship development login configuration.");
  if (!portalEnabled && !testLoginEnabled && !stagingPortalEnabled) return closed;
  if (portalEnabled && (deployment === "staging" || mode === "staging"))
    throw new Error("Use private staging portal mode for staging acceptance.");
  if (portalEnabled && deployment === "production" && stagingTarget?.url && url?.toLowerCase() === stagingTarget.url)
    throw new Error("The production portal requires a separate Supabase project.");
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
    portalReady: portalEnabled || stagingPortalEnabled,
    testLoginMode: testLoginEnabled,
    stagingPortalMode: stagingPortalEnabled,
    checkoutReady: portalEnabled && checkoutEnabled === true,
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
