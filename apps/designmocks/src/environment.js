const mode = import.meta.env.MODE;
const deployment = import.meta.env.VITE_DEPLOYMENT_ENV || mode;

const allowed = new Set(["development", "staging", "production", "test"]);
if (!allowed.has(deployment)) {
  throw new Error(`Unsupported deployment environment: ${deployment}`);
}

export const environment = Object.freeze({
  mode,
  deployment,
  production: deployment === "production",
  staging: deployment === "staging",
  release: import.meta.env.VITE_RELEASE || "local",
});

export function validatePortalConfiguration({ enabled, url, key, termsVersion }) {
  if (!enabled) return false;
  if (!url || !key || !termsVersion) {
    throw new Error(
      `Portal configuration is incomplete for ${deployment}. Sign-in stays disabled.`,
    );
  }
  if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(url)) {
    throw new Error("VITE_SUPABASE_URL must be an HTTPS Supabase project URL.");
  }
  return true;
}
