import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { compilePublishedNotices } from "../../scripts/published-notices.mjs";
import project from "../../supabase/project.json" with { type: "json" };
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

// The public portal built with a notice that admits 16- and 17-year-olds with a guardian's agreement.
const fixture = JSON.parse(readFileSync(new URL("../fixtures/fictional-published-notices.json", import.meta.url), "utf8"));
const eligibility = "This fictional notice admits students aged 16 or older. A student under 18 needs a parent or guardian's agreement.";
const version = compilePublishedNotices({ ...fixture, scope: "release", privacy: { ...fixture.privacy, youngerStudents: eligibility } }, { freeSignup: true }).version;
const site = project.frontend_origin;
const artifact = "http://127.0.0.1:4796";
const student = { id: "00000000-0000-4000-8000-000000000098", email: "younger-student@example.invalid" };
test.use({ baseURL: site, serviceWorkers: "block" });

test.beforeEach(async ({ page }) => {
  await page.route("**/*", route => route.abort());
  await page.route(url => [site, "https://www.dmocks.com"].includes(url.origin), async route => {
    const url = new URL(route.request().url());
    const response = await fetch(artifact + url.pathname + url.search, { redirect: "manual", headers: { "accept-encoding": "identity" } });
    const headers = Object.fromEntries(response.headers);
    delete headers["content-encoding"];
    delete headers["content-length"];
    await route.fulfill({ status: response.status, headers, body: Buffer.from(await response.arrayBuffer()) });
  });
});

for (const [device, viewport] of [["desktop", { width: 1280, height: 860 }], ["mobile", { width: 360, height: 760 }]]) {
  test(`a 16- or 17-year-old confirms a guardian's agreement before starting (${device})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    let accepted = false;
    const { calls, unexpected } = await stubPortalProvider(page, (name, input) => {
      if (name === "free_signup_notice") return { required: true, accepted, version, ageGroup: accepted ? "16_17_guardian" : null };
      if (name === "accept_current_terms") { expect(input).toEqual({ p_version: version, p_age_group: "16_17_guardian" }); accepted = true; return null; }
      if (name === "can_enter_staging_portal") return true;
      if (name === "my_privacy_requests") return [];
      if (name === "finalize_my_expired_attempts") return 0;
    }, project.project_ref);
    await page.goto("/account");
    await expect(page.locator(".account-card")).toContainText("students aged 16 or older; if you are under 18, a parent or guardian must agree first.");
    await seedPortalSession(page, student, project.project_ref);
    await page.evaluate(() => sessionStorage.setItem("dmocks:return-after-sign-in", "/papers/uceed"));
    await page.goto("/account/callback");
    const consent = page.getByRole("region", { name: "Before you start" });
    const confirm = consent.getByRole("button", { name: "Accept and continue" });
    const ages = consent.getByRole("group", { name: "Your age" });
    await expect(ages.getByRole("radio")).toHaveCount(2);
    await expect(consent.getByRole("checkbox", { name: /I am 18 or older/ })).toHaveCount(0);
    await consent.getByRole("checkbox", { name: "I accept the Terms of Use and acknowledge the Privacy Notice." }).check();
    await expect(confirm).toBeDisabled();
    await ages.getByRole("radio", { name: /I am 16 or 17, and a parent or guardian has read these terms and agrees to my account/ }).check();
    await expect(confirm).toBeEnabled();
    await page.screenshot({ path: info.outputPath(`guardian-consent-${device}.png`) });
    await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
    expect(await page.evaluate(async () => (await window.axe.run(".signup-notice", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await confirm.click();
    await expect(page).toHaveURL(site + "/papers/uceed");
    expect(calls.filter(([name]) => name === "accept_current_terms")).toHaveLength(1);
    expect(unexpected).toEqual([]);
  });
}
