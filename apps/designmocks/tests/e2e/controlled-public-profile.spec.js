import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import project from "../../supabase/project.json" with { type: "json" };
import { seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

// The required profile step on the public portal build (port 4797), after ten minutes of use.
const site = project.frontend_origin;
const artifact = "http://127.0.0.1:" + Number(process.env.DMOCKS_CONTROLLED_PUBLIC_TEST_PORT || 4797);
const student = { id: "00000000-0000-4000-8000-000000000099", email: "profile-student@example.invalid" };
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

function portal(page, profile, onSave) {
  return stubPortalProvider(page, (name, input) => {
    if (name === "free_signup_notice") return { required: false, accepted: false, version: null };
    if (name === "can_enter_staging_portal") return true;
    if (["my_privacy_requests", "available_papers", "my_attempt_history", "learning_catalog", "learning_progress", "free_year_paper_catalog", "my_year_paper_attempts"].includes(name)) return [];
    if (name === "my_pass") return { active: false, expiresAt: null };
    if (name === "finalize_my_expired_attempts") return 0;
    if (name === "my_overview_analytics") return { completed: 0, waitingForResults: 0, objectiveAccuracy: null, objectiveAnswered: 0, topics: [], exams: [], drawingReviews: { pending: 0, released: 0 } };
    if (name === "my_candidate_profile") return profile.current;
    if (name === "save_candidate_profile") return onSave(input);
  }, project.project_ref);
}

async function signInAfterTenMinutes(page) {
  await page.goto("/account");
  await seedPortalSession(page, student, project.project_ref);
  await page.evaluate(id => localStorage.setItem(`dmocks:active-ms:${id}`, String(10 * 60 * 1000)), student.id);
}

for (const [device, viewport] of [["desktop", { width: 1280, height: 860 }], ["mobile", { width: 360, height: 760 }]]) {
  test(`after ten minutes a student completes their profile before carrying on (${device})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    const profile = { current: { displayName: null, phone: null, phoneVerified: false, appearingYear: null, city: null, exams: [], completed: false, studyStage: null, state: null, marketingConsent: false } };
    const saves = [];
    await portal(page, profile, input => {
      saves.push(input);
      profile.current = { displayName: input.p_display_name, phone: input.p_phone, phoneVerified: false, appearingYear: Number(input.p_appearing_year), city: input.p_city,
        exams: input.p_exams, completed: false, studyStage: input.p_study_stage, state: input.p_state, marketingConsent: input.p_marketing_consent };
      return profile.current;
    });
    await signInAfterTenMinutes(page);
    await page.goto("/dashboard");
    const gate = page.getByRole("dialog", { name: "Tell us about your preparation." });
    await expect(gate).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(gate).toBeVisible();
    await gate.getByLabel("Student name").fill("Fictional Profile Student");
    await gate.getByLabel("Phone number").fill("+919000000099");
    await gate.getByLabel("City").fill("Pune");
    await gate.getByLabel("Where you are now").selectOption("class_12");
    await gate.getByLabel("State").selectOption("Maharashtra");
    await gate.getByRole("checkbox", { name: "UCEED" }).check();
    const consent = gate.getByRole("checkbox", { name: /may contact me by phone, WhatsApp or email/ });
    await expect(consent).not.toBeChecked();
    await consent.check();
    await page.screenshot({ path: info.outputPath(`profile-step-${device}.png`) });
    await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
    expect(await page.evaluate(async () => (await window.axe.run(".profile-gate", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations.map(item => item.id))).toEqual([]);
    await gate.getByRole("button", { name: "Save and continue" }).click();
    await expect(gate).toHaveCount(0);
    expect(saves).toEqual([{ p_display_name: "Fictional Profile Student", p_phone: "+919000000099", p_appearing_year: saves[0].p_appearing_year, p_city: "Pune",
      p_exams: ["uceed"], p_study_stage: "class_12", p_state: "Maharashtra", p_marketing_consent: true }]);
    await page.reload();
    await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  });
}

test("the step waits for ten minutes, skips the account pages, and asks only what an older backend stores", async ({ page }) => {
  const profile = { current: { displayName: null, phone: null, phoneVerified: false, appearingYear: null, city: null, exams: [], completed: false } };
  await portal(page, profile, () => profile.current);
  await page.goto("/account");
  await seedPortalSession(page, student, project.project_ref);
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: /Welcome to your next attempt/ })).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.evaluate(id => localStorage.setItem(`dmocks:active-ms:${id}`, String(10 * 60 * 1000)), student.id);
  await page.goto("/account");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.goto("/dashboard");
  const gate = page.getByRole("dialog", { name: "Tell us about your preparation." });
  await expect(gate).toBeVisible();
  await expect(gate.getByLabel("Where you are now")).toHaveCount(0);
  await expect(gate.getByRole("checkbox", { name: /may contact me/ })).toHaveCount(0);
});
