import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import project from "./supabase/project.json" with { type: "json" };
import { readPublishedNotices } from "./scripts/published-notices.mjs";

const noticeFile = fileURLToPath(new URL("./tests/fixtures/fictional-published-notices.json", import.meta.url));
const fixtureNotices = readPublishedNotices(noticeFile, { allowFixture: true });
const scope=process.env.DMOCKS_E2E_SCOPE??'mvp';
if(!['mvp','full'].includes(scope))throw new Error('Choose the mvp or full browser scope.');
const fallbackRunner = process.env.DMOCKS_E2E_FALLBACK_RUNNER === '1';
const mvpFiles=['mvp-*.spec.js','controlled-login.spec.js','staging-portal.spec.js','staging-paid-pilot.spec.js','profile-lifecycle.spec.js','account-privacy-lifecycle.spec.js','account-export.spec.js','attempt-identity-lifecycle.spec.js','overview-identity-lifecycle.spec.js','overview-scores.spec.js','bug-report-lifecycle.spec.js','question-quality.spec.js','launch-foundation.spec.js','admin-access-lifecycle.spec.js','bank-review-browser.spec.js','question-export-download.spec.js','nid-practice-blueprints.spec.js','nid-question-bindings.spec.js','drawing-reviewer.spec.js','drawing-reviewer-lifecycle.spec.js','drawing-inspection.spec.js','drawing-upload-validation.spec.js','intake-canonical.spec.js','ai-draft-canonical.spec.js'];
export default defineConfig({
  testMatch: scope === 'full' ? '**/*.spec.js' : [
    ...mvpFiles.map(file => '**/' + file),
    '**/all-india-ranking-consent.spec.js',
    '**/learn-programme.spec.js',
    '**/learn-lifecycle.spec.js',
    '**/learn-practice-context.spec.js',
    '**/learning-editor.spec.js',
    '**/community-images.spec.js',
    '**/community-followup-images.spec.js',
    '**/community-articles.spec.js',
    '**/community-feedback.spec.js',
  ],
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: fallbackRunner ? 2 : process.env.CI ? 3 : undefined,
  timeout: fallbackRunner ? 60_000 : 30_000,
  retries: process.env.CI ? 1 : 0,
  reporter: [[process.env.CI ? "github" : "list"], ["json", {outputFile: "test-results/browser-results.json"}]],
  use: { baseURL: "http://127.0.0.1:4399", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command:"npm exec -- vite --host 127.0.0.1 --port 4999 --strictPort",
      url:"http://127.0.0.1:4999",
      env:{VITE_DEPLOYMENT_ENV:"test",VITE_POST_LAUNCH_PREVIEW:"false",VITE_PORTAL_ENABLED:"true",VITE_TEST_LOGIN_ENABLED:"false",VITE_STAGING_PORTAL_ENABLED:"false",VITE_CHECKOUT_ENABLED:"true",VITE_SUPABASE_URL:"https://dmocks-portal-fixture.supabase.co",VITE_SUPABASE_ANON_KEY:"sb_publishable_dmocks_browser_fixture",VITE_TERMS_VERSION:fixtureNotices.version,VITE_CANDIDATE_PHONE_VERIFICATION_ENABLED:"true",DMOCKS_PUBLISHED_NOTICES_FILE:noticeFile},
      reuseExistingServer:false,timeout:60000,
    },
    {
      command:"npm exec -- vite build --mode production --outDir test-results/mvp-production && npm exec -- vite preview --outDir test-results/mvp-production --host 127.0.0.1 --port 4899 --strictPort",
      url:"http://127.0.0.1:4899",
      env:{VITE_DEPLOYMENT_ENV:"production",VITE_POST_LAUNCH_PREVIEW:"true",VITE_PORTAL_ENABLED:"false",VITE_TEST_LOGIN_ENABLED:"false",VITE_STAGING_PORTAL_ENABLED:"false",VITE_CHECKOUT_ENABLED:"true"},
      reuseExistingServer:false,timeout:60000,
    },
    {
      command:"npm exec -- vite --host 127.0.0.1 --port 4799 --strictPort",
      url:"http://127.0.0.1:4799",
      env:{VITE_DEPLOYMENT_ENV:"test",VITE_POST_LAUNCH_PREVIEW:"false",VITE_PORTAL_ENABLED:"true",VITE_TEST_LOGIN_ENABLED:"false",VITE_STAGING_PORTAL_ENABLED:"false",VITE_CHECKOUT_ENABLED:"true",VITE_SUPABASE_URL:"https://dmocks-portal-fixture.supabase.co",VITE_SUPABASE_ANON_KEY:"sb_publishable_dmocks_browser_fixture",VITE_TERMS_VERSION:"fictional-mvp-fixture",DMOCKS_PUBLISHED_NOTICES_FILE:noticeFile},
      reuseExistingServer:false,timeout:60000,
    },
    {
      command: "npm run dev:e2e",
      url: "http://127.0.0.1:4399",
      env: { VITE_POST_LAUNCH_PREVIEW:"true", VITE_DEPLOYMENT_ENV: "test", VITE_PORTAL_ENABLED: "false", VITE_TEST_LOGIN_ENABLED: "false", VITE_STAGING_PORTAL_ENABLED: "false" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm exec -- vite --host 127.0.0.1 --port 4499 --strictPort",
      url: "http://127.0.0.1:4499",
      env: {
        VITE_POST_LAUNCH_PREVIEW:"true",
        VITE_DEPLOYMENT_ENV: "test",
        VITE_TEST_LOGIN_ENABLED: "true",
        VITE_PORTAL_ENABLED: "false",
        VITE_STAGING_PORTAL_ENABLED: "false",
        VITE_SUPABASE_URL: "https://dmocks-controlled-fixture.supabase.co",
        VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_browser_fixture",
        VITE_TERMS_VERSION: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm exec -- vite --host 127.0.0.1 --port 4599 --strictPort",
      url: "http://127.0.0.1:4599",
      env: {
        VITE_POST_LAUNCH_PREVIEW:"true",
        VITE_DEPLOYMENT_ENV: "test",
        VITE_TEST_LOGIN_ENABLED: "false",
        VITE_PORTAL_ENABLED: "true",
        VITE_STAGING_PORTAL_ENABLED: "false",
        VITE_SUPABASE_URL: "https://dmocks-portal-fixture.supabase.co",
        VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_browser_fixture",
        VITE_TERMS_VERSION: "fictional-portal-fixture",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    ...(!process.env.DMOCKS_PAID_PILOT_ARTIFACT_SITE ? [{
      command: "npm exec -- vite build --mode staging --outDir test-results/staging-paid-pilot && npm exec -- vite preview --mode staging --outDir test-results/staging-paid-pilot --host 127.0.0.1 --port 4689 --strictPort",
      url: "http://127.0.0.1:4689",
      env: {
        VITE_DEPLOYMENT_ENV: "staging",
        VITE_POST_LAUNCH_PREVIEW: "false",
        VITE_TEST_LOGIN_ENABLED: "false",
        VITE_PORTAL_ENABLED: "false",
        VITE_STAGING_PORTAL_ENABLED: "true",
        VITE_CHECKOUT_ENABLED: "false",
        VITE_SUPABASE_URL: `https://${project.project_ref}.supabase.co`,
        VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_staging_browser_fixture",
        VITE_TERMS_VERSION: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    }] : []),
    ...(!process.env.DMOCKS_STAGING_ARTIFACT_SITE ? [{
      command: "npm exec -- vite build --mode staging --outDir test-results/staging-build && npm exec -- vite preview --mode staging --outDir test-results/staging-build --host 127.0.0.1 --port 4699 --strictPort",
      url: "http://127.0.0.1:4699",
      env: {
        VITE_POST_LAUNCH_PREVIEW:"true",
        VITE_DEPLOYMENT_ENV: "staging",
        VITE_TEST_LOGIN_ENABLED: "false",
        VITE_PORTAL_ENABLED: "false",
        VITE_STAGING_PORTAL_ENABLED: "true",
        VITE_SUPABASE_URL: `https://${project.project_ref}.supabase.co`,
        VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_staging_browser_fixture",
        VITE_TERMS_VERSION: "",
      },
      reuseExistingServer: false,
      timeout: 60_000,
    }] : []),
  ],
});
