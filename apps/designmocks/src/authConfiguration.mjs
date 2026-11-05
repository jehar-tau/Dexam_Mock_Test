// Authentication testing and paid/public portal release are separate switches.
export function resolveAuthConfiguration({ mode, deployment, portalEnabled = false, testLoginEnabled = false, url, key, termsVersion }) {
  if (portalEnabled && testLoginEnabled)
    throw new Error("Choose controlled login testing or the released portal, not both.");
  if (testLoginEnabled && !["development", "staging", "test"].includes(deployment))
    throw new Error("Controlled login testing cannot be enabled in a production release.");
  if (testLoginEnabled && mode === "production" && deployment === "development")
    throw new Error("Use an explicitly staged build for controlled login; do not ship development login configuration.");
  if (!portalEnabled && !testLoginEnabled)
    return { authReady: false, portalReady: false, testLoginMode: false };
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
  return { authReady: true, portalReady: portalEnabled, testLoginMode: testLoginEnabled };
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
