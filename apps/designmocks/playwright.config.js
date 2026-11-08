import { defineConfig, devices } from "@playwright/test";
import project from "./supabase/project.json" with { type: "json" };

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 3 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: { baseURL: "http://127.0.0.1:4399", trace: "retain-on-failure" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "npm run dev:e2e",
      url: "http://127.0.0.1:4399",
      env: { VITE_DEPLOYMENT_ENV: "test", VITE_PORTAL_ENABLED: "false", VITE_TEST_LOGIN_ENABLED: "false", VITE_STAGING_PORTAL_ENABLED: "false" },
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm exec -- vite --host 127.0.0.1 --port 4499 --strictPort",
      url: "http://127.0.0.1:4499",
      env: {
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
    {
      command: "npm exec -- vite build --mode staging --outDir test-results/staging-build && npm exec -- vite preview --mode staging --outDir test-results/staging-build --host 127.0.0.1 --port 4699 --strictPort",
      url: "http://127.0.0.1:4699",
      env: {
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
    },
  ],
});
