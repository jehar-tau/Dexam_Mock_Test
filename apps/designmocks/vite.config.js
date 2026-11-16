import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveAuthConfiguration } from "./src/authConfiguration.mjs";
import { allowPostLaunchPreview, allowReleasedLearn } from "./src/launch-scope.mjs";
import { readPublishedNotices } from "./scripts/published-notices.mjs";
import project from "./supabase/project.json" with { type: "json" };

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "DMOCKS_PUBLISHED_NOTICES_FILE"]);
  const deployment = env.VITE_DEPLOYMENT_ENV || mode;
  const portalEnabled = env.VITE_PORTAL_ENABLED === "true";
  const checkoutEnabled = env.VITE_CHECKOUT_ENABLED === "true";
  if (command === "build" && deployment === "test" && portalEnabled && checkoutEnabled && mode !== "test") {
    throw new Error("The private checkout requires an explicit Test build.");
  }
  const compiledNotices = readPublishedNotices(env.DMOCKS_PUBLISHED_NOTICES_FILE, {
    allowFixture: command === "serve" && deployment === "test" && mode !== "production",
  });
  const notices = compiledNotices?.version === env.VITE_TERMS_VERSION ? compiledNotices : null;
  const stagingTarget = { url: `https://${project.project_ref}.supabase.co`, origin: project.staging_frontend_origin };
  const checkoutTarget = { url: stagingTarget.url, origin: project.frontend_origin };
  const auth = resolveAuthConfiguration({
    mode, deployment, origin: deployment === "production" || mode === "test" ? project.frontend_origin : stagingTarget.origin,
    productionOrigin: project.frontend_origin, stagingTarget, checkoutTarget, portalEnabled, checkoutEnabled,
    testLoginEnabled: env.VITE_TEST_LOGIN_ENABLED === "true",
    stagingPortalEnabled: env.VITE_STAGING_PORTAL_ENABLED === "true",
    url: env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_ANON_KEY,
    termsVersion: env.VITE_TERMS_VERSION,
    noticeVersion: notices?.version,
  });
  const includeLearnImages = allowReleasedLearn(auth.portalReady) ||
    (mode !== "production" && allowPostLaunchPreview(deployment, env.VITE_POST_LAUNCH_PREVIEW === "true"));

  return {
    plugins: [react(), {
      name: "dmocks-learn-image-isolation",
      apply: "build",
      async writeBundle({dir}) {
        // Vite copies public files even when the routes that use them are disabled.
        if (!includeLearnImages) await rm(join(dir, "learn-images"), {recursive: true, force: true});
      },
    }],
    define: { __DMOCKS_PUBLISHED_NOTICES__: JSON.stringify(notices) },
  };
});
