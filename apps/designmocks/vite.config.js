import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { resolveAuthConfiguration } from "./src/authConfiguration.mjs";
import { publicCatalogueConfiguration } from "./src/public-catalogue-config.mjs";
import { allowPostLaunchPreview, allowReleasedLearn } from "./src/launch-scope.mjs";
import { readPublishedNotices } from "./scripts/published-notices.mjs";
import { publicDiscovery } from "./scripts/public-discovery.mjs";
import project from "./supabase/project.json" with { type: "json" };

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), ["VITE_", "DMOCKS_PUBLISHED_NOTICES_FILE"]);
  const deployment = env.VITE_DEPLOYMENT_ENV || mode;
  const portalEnabled = env.VITE_PORTAL_ENABLED === "true";
  const checkoutEnabled = env.VITE_CHECKOUT_ENABLED === "true";
  if (command === "build" && deployment === "test" && portalEnabled && checkoutEnabled && mode !== "test") {
    throw new Error("The private checkout requires an explicit Test build.");
  }
  const stagingReview = command === "build" && env.VITE_STAGING_REVIEW_PREVIEW === "true";
  if (stagingReview) {
    if (mode !== "staging" || deployment !== "staging" || process.env.NODE_ENV !== "production") {
      throw new Error("The hosted review preview requires a production-optimized staging build.");
    }
    if (portalEnabled || checkoutEnabled || env.VITE_TEST_LOGIN_ENABLED === "true" ||
        env.VITE_STAGING_PORTAL_ENABLED === "true" || env.VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED === "true" ||
        env.VITE_POST_LAUNCH_PREVIEW === "true" ||
        env.VITE_CANDIDATE_PHONE_VERIFICATION_ENABLED === "true" ||
        env.VITE_SUPABASE_URL || env.VITE_SUPABASE_ANON_KEY || env.DMOCKS_PUBLISHED_NOTICES_FILE) {
      throw new Error("Build the hosted review preview without sign-in, backend, checkout or release configuration.");
    }
  }
  const compiledNotices = readPublishedNotices(env.DMOCKS_PUBLISHED_NOTICES_FILE, {
    allowFixture: command === "serve" && deployment === "test" && mode !== "production",
    freeSignup: env.VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED === "true" && !checkoutEnabled,
  });
  const notices = compiledNotices?.version === env.VITE_TERMS_VERSION ? compiledNotices : null;
  const stagingTarget = { url: `https://${project.project_ref}.supabase.co`, origin: project.staging_frontend_origin };
  const checkoutTarget = { url: stagingTarget.url, origin: project.frontend_origin };
  const auth = resolveAuthConfiguration({
    mode, deployment, origin: deployment === "production" || mode === "test" ? project.frontend_origin : stagingTarget.origin,
    productionOrigin: project.frontend_origin, stagingTarget, checkoutTarget, portalEnabled, checkoutEnabled,
    testLoginEnabled: env.VITE_TEST_LOGIN_ENABLED === "true",
    stagingPortalEnabled: env.VITE_STAGING_PORTAL_ENABLED === "true",
    controlledPublicPortalEnabled: env.VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED === "true",
    url: env.VITE_SUPABASE_URL,
    key: env.VITE_SUPABASE_ANON_KEY,
    termsVersion: env.VITE_TERMS_VERSION,
    noticeVersion: notices?.version,
  });
  publicCatalogueConfiguration({
    enabled: env.VITE_PUBLIC_CATALOG_ENABLED === "true", deployment,
    origin: deployment === 'production' ? project.frontend_origin : stagingTarget.origin,
    productionOrigin: project.frontend_origin, productionProvider: stagingTarget.url,
    url: env.VITE_SUPABASE_URL, key: env.VITE_SUPABASE_ANON_KEY,
  });
  const includeLearnContent = stagingReview || allowReleasedLearn(auth.portalReady) ||
    (mode !== "production" && allowPostLaunchPreview(deployment, env.VITE_POST_LAUNCH_PREVIEW === "true"));

  // The informational Site is the accepted search surface. Staging, merchant Test,
  // and the separately gated commercial portal do not publish this discovery profile.
  // On sales day the public portal keeps its discovery pages with checkout open.
  const publicBuild = mode === "production" && deployment === "production" && !portalEnabled
    && (!checkoutEnabled || auth.controlledPublicPortalMode)
    && env.VITE_TEST_LOGIN_ENABLED !== "true" && env.VITE_STAGING_PORTAL_ENABLED !== "true";

  return {
    plugins: [react(), publicDiscovery(publicBuild), {
      name: "drawing-decoder-notices",
      apply: "build",
      async generateBundle(_options, bundle) {
        if (!Object.keys(bundle).some(file => file.endsWith(".wasm"))) return;
        const decoder = new URL("./node_modules/@imagemagick/magick-wasm/", import.meta.url);
        const notices = await Promise.all(["LICENSE", "NOTICE"].map(name => readFile(new URL(name, decoder), "utf8")));
        this.emitFile({ type: "asset", fileName: "assets/drawing-decoder-notices.txt",
          source: "DMocks drawing photo decoder. Source: https://github.com/dlemstra/magick-wasm/tree/0.0.46\n\n" + notices.join("\n\n") });
      },
    }, {
      name: "dmocks-learn-image-isolation",
      apply: "build",
      async writeBundle({dir}) {
        // Vite copies public files even when the routes that use them are disabled.
        if (!includeLearnContent) await rm(join(dir, "learn-images"), {recursive: true, force: true});
      },
    }],
    define: {
      __DMOCKS_STAGING_REVIEW_PREVIEW__: JSON.stringify(stagingReview),
      __DMOCKS_PUBLIC_DISCOVERY__: JSON.stringify(publicBuild),
      __DMOCKS_PUBLISHED_NOTICES__: JSON.stringify(notices),
      __DMOCKS_INCLUDE_LEARN__: JSON.stringify(includeLearnContent),
    },
  };
});
