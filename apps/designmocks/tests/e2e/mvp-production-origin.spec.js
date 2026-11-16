import { execFileSync } from "node:child_process";
import { mkdtemp, realpath, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import project from "../../supabase/project.json" with { type: "json" };
import { serveArtifact } from "./local-artifact-fixture.js";
import { seedPortalSession } from "./portal-fixture.js";

const app = fileURLToPath(new URL("../../", import.meta.url));
const approved = project.frontend_origin;
const otherOrigins = [new URL(approved).protocol + "//www." + new URL(approved).host, project.staging_frontend_origin];
const providerRef = "dmocksprodfixture001";
const provider = "https://" + providerRef + ".supabase.co";
const student = { id: "00000000-0000-4000-8000-000000009681", email: "fictional-production@example.invalid" };

let directory, site;
test.use({ serviceWorkers: "block" });

test.beforeAll(async () => {
  const suppliedSite = process.env.DMOCKS_PRODUCTION_ARTIFACT_SITE;
  if (suppliedSite !== undefined) {
    if (!isAbsolute(suppliedSite)) throw new Error("Use an absolute DMOCKS_PRODUCTION_ARTIFACT_SITE");
    site = await realpath(suppliedSite);
    return;
  }
  directory = await mkdtemp(join(tmpdir(), "dmocks-production-origin-"));
  site = join(directory, "site");
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith("VITE_") && key !== "DMOCKS_PUBLISHED_NOTICES_FILE"));
  execFileSync(process.execPath, [join(app, "node_modules/vite/bin/vite.js"), "build", "--mode", "production", "--outDir", site], {
    cwd: app,
    env: {
      ...env, VITE_DEPLOYMENT_ENV: "production", VITE_PORTAL_ENABLED: "true", VITE_CHECKOUT_ENABLED: "false",
      VITE_SUPABASE_URL: provider, VITE_SUPABASE_ANON_KEY: "sb_publishable_dmocks_production_fixture",
      VITE_TERMS_VERSION: "fictional-production-terms",
    },
    stdio: "pipe",
  });
  site = await realpath(site);
});

test.afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

test("the production artifact opens Google sign-in only from the approved origin", async ({ page }) => {
  const providerRequests = [];
  await page.route("**/*", route => route.abort());
  await page.route(url => [approved, ...otherOrigins].includes(url.origin), route =>
    serveArtifact(route, site, new URL(route.request().url())));
  await page.route(url => url.hostname.endsWith(".supabase.co"), route => {
    const request = new URL(route.request().url());
    providerRequests.push(request);
    if (request.origin !== provider || request.pathname !== "/auth/v1/authorize") return route.abort();
    return route.fulfill({ contentType: "text/html", body: "<p>Fictional Google sign-in</p>" });
  });
  const google = page.getByRole("button", { name: "Continue with Google", exact: true });

  for (const origin of otherOrigins) {
    await page.goto(origin + "/account");
    await seedPortalSession(page, student, providerRef);
    await page.reload();
    await expect(google).toBeDisabled();
    await expect(page.getByText(student.email)).toHaveCount(0);
  }
  expect(providerRequests).toEqual([]);

  await page.goto(approved + "/plans");
  await expect(page.getByRole("button", { name: "Pay ₹1,193 with Razorpay", exact: true })).toHaveCount(0);
  await page.goto(approved + "/account");
  await expect(google).toBeEnabled();
  await google.click();
  await expect(page.getByText("Fictional Google sign-in", { exact: true })).toBeVisible();
  expect(providerRequests).toHaveLength(1);
  expect(providerRequests[0].searchParams.get("redirect_to")).toBe(approved + "/account/callback");
});
