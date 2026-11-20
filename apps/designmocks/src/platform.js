import { createClient } from "@supabase/supabase-js";
import { environment } from "./environment.js";
import { resolveAuthConfiguration } from "./authConfiguration.mjs";
import { project_ref, frontend_origin, staging_frontend_origin } from "../supabase/project.json";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const designatedProvider = `https://${project_ref}.supabase.co`;
// This app must have its own provider project; no Dexam values are imported.
export const termsVersion = import.meta.env.VITE_TERMS_VERSION;
export const publishedNotices = __DMOCKS_PUBLISHED_NOTICES__;
export const { authReady, portalReady, testLoginMode, stagingPortalMode, checkoutReady } = resolveAuthConfiguration({
  mode: environment.mode,
  deployment: environment.deployment,
  origin: import.meta.env.SSR ? frontend_origin : window.location.origin,
  stagingTarget: { url: designatedProvider, origin: staging_frontend_origin },
  checkoutTarget: { url: designatedProvider, origin: frontend_origin },
  productionOrigin: frontend_origin,
  portalEnabled: import.meta.env.VITE_PORTAL_ENABLED === "true",
  checkoutEnabled: import.meta.env.VITE_CHECKOUT_ENABLED === "true",
  testLoginEnabled: import.meta.env.VITE_TEST_LOGIN_ENABLED === "true",
  stagingPortalEnabled: import.meta.env.VITE_STAGING_PORTAL_ENABLED === "true",
  url,
  key,
  termsVersion,
  noticeVersion: publishedNotices?.version,
});
export const platform = authReady && !import.meta.env.SSR
  ? createClient(url, key, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
      },
    })
  : null;
export async function googleLogin() {
  if (!platform)
    throw new Error(
      "Student sign-in is not active in this preview. The sample is open to explore.",
    );
  const { error } = await platform.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: window.location.origin + "/account/callback",
      scopes: "openid email profile",
    },
  });
  if (error) throw error;
}
