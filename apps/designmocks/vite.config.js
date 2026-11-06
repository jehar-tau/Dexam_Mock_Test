import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { resolveAuthConfiguration } from "./src/authConfiguration.mjs";
import project from "./supabase/project.json" with { type: "json" };

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const deployment = env.VITE_DEPLOYMENT_ENV || mode;
  const stagingTarget = { url: `https://${project.project_ref}.supabase.co`, origin: project.staging_frontend_origin };
  resolveAuthConfiguration({
    mode, deployment, origin: stagingTarget.origin,
    stagingTarget,
    portalEnabled: env.VITE_PORTAL_ENABLED === "true",
    testLoginEnabled: env.VITE_TEST_LOGIN_ENABLED === "true",
    stagingPortalEnabled: env.VITE_STAGING_PORTAL_ENABLED === "true",
    url: env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_ANON_KEY,
    termsVersion: env.VITE_TERMS_VERSION,
  });
  return { plugins: [react()] };
});
