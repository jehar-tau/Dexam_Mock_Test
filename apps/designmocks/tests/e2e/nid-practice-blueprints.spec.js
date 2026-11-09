import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: "http://127.0.0.1:4799" });
const actor = { id: "00000000-0000-4000-8000-000000002151", email: "nid-editor@example.invalid" };
const other = { id: "00000000-0000-4000-8000-000000002152", email: "nid-reader@example.invalid" };
const id = "10000000-0000-4000-8000-000000002151";
const payload = () => ({ schemaVersion: "nid-authored-practice-v1", title: "Original fictional observation practice", purpose: "An authored fictional observation exercise for private review.", durationMinutes: 23, uploadGraceMinutes: 0,
  sections: [{ label: "Observation", kind: "mcq", count: 3, points: 2.5, penalty: 0.25, rubric: [] }] });
const version = (input, revision = 1) => ({ id, payload: structuredClone(input), revision, currentRevision: revision, sha256: createHash("sha256").update(JSON.stringify(input)).digest("hex"), status: "draft", reviewNote: null, reviewedAt: null });
const region = page => page.getByRole("region", { name: "NID practice blueprints", exact: true });
const editor = page => region(page).getByRole("region", { name: "Practice blueprint editor", exact: true });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const endpoint = name => "https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/" + name;

async function fixture(page, { admin = true, count = 1 } = {}) {
  const rows = new Map(), requests = new Map();
  for (let n = 0; n < count; n++) { const key = n ? `10000000-0000-4000-8000-${String(2151 + n).padStart(12, "0")}` : id; rows.set(key, [{ ...version({ ...payload(), title: n ? `Original fictional practice ${n + 1}` : payload().title }), id: key }]); }
  const state = { admin, rows, requests, writes: [] };
  state.respond = (name, input) => {
    if (name === "is_dmocks_admin") return state.admin;
    if (name.startsWith("admin_nid_") || name.includes("_nid_practice_blueprint")) {
      if (!state.admin) return { code: "42501", message: "Admin access required" };
      const versions = rows.get(input.p_id), current = versions?.at(-1);
      if (name === "admin_nid_practice_blueprints") {
        const items = [...rows.values()].map(values => values.at(-1));
        const offset = Math.min(input.p_offset, Math.floor(Math.max(0, items.length - 1) / input.p_limit) * input.p_limit);
        return { items: items.slice(offset, offset + input.p_limit).map(item => ({ ...item, title: item.payload.title })), total: items.length, offset, limit: input.p_limit };
      }
      if (name === "admin_nid_practice_blueprint") {
        const selected = input.p_revision ? versions?.find(value => value.revision === input.p_revision) : current;
        return { item: selected ? { ...selected, currentRevision: current.revision } : null,
          versions: (versions ?? []).slice().reverse().map(value => ({ revision: value.revision, status: value.status })), requestResult: requests.get(input.p_request_id)?.ack ?? null };
      }
      state.writes.push([name, structuredClone(input)]);
      const old = requests.get(input.p_request_id);
      if (old) return old.input === JSON.stringify(input) ? old.ack : { code: "40001", message: "Request conflict" };
      let value;
      if (name === "admin_save_nid_practice_blueprint") {
        if ((current?.revision ?? 0) !== input.p_expected_revision) return { code: "40001", message: "Blueprint changed" };
        value = { ...version(input.p_payload, input.p_expected_revision + 1), id: input.p_id };
        if (!versions) rows.set(input.p_id, [value]); else versions.push(value);
      } else if (name === "admin_review_nid_practice_blueprint") {
        if (!current || current.status !== "draft" || current.revision !== input.p_expected_revision || current.sha256 !== input.p_expected_sha256) return { code: "40001", message: "Blueprint changed" };
        Object.assign(current, { status: input.p_decision, reviewNote: input.p_note }); value = current;
      } else return undefined;
      const ack = { id: value.id, revision: value.revision, sha256: value.sha256, status: value.status };
      requests.set(input.p_request_id, { input: JSON.stringify(input), ack });
      return ack;
    }
    return emptyAdminRead(name);
  };
  const provider = await stubPortalProvider(page, state.respond);
  await page.goto("/admin"); await seedPortalSession(page, actor); await page.reload();
  if (admin) await expect(region(page).getByRole("button", { name: "New NID practice blueprint", exact: true })).toBeVisible();
  return Object.assign(state, provider);
}
async function open(page) { await region(page).getByRole("button", { name: "Open practice blueprint " + payload().title, exact: true }).click(); await expect(editor(page).getByRole("heading", { name: "Revision 1 · draft", exact: true })).toBeVisible(); }
async function fillObjective(page) {
  const form = editor(page);
  await form.getByLabel("Practice title", { exact: true }).fill(payload().title);
  await form.getByRole("textbox", { name: "Practice purpose", exact: true }).fill(payload().purpose);
  await form.getByLabel("Practice duration in minutes", { exact: true }).fill("63");
  await form.getByRole("combobox", { name: "Completed-page upload time", exact: true }).selectOption("0");
  await form.getByLabel("Section 1 label", { exact: true }).fill("Observation");
  await form.getByRole("combobox", { name: "Section 1 response", exact: true }).selectOption("mcq");
  await form.getByLabel("Section 1 question count", { exact: true }).fill("3");
  await form.getByLabel("Section 1 marks per question", { exact: true }).fill("2.5");
  await form.getByLabel("Section 1 wrong-answer penalty", { exact: true }).fill("0.25");
}
async function fillReview(page) {
  const form = editor(page).getByRole("form", { name: "Review NID practice revision", exact: true });
  await form.getByRole("textbox", { name: "Practice review note", exact: true }).fill("Original fictional practice design and authored rubric reviewed, not official NID assessment criteria.");
  await form.getByRole("checkbox").check();
  return form;
}
const deferred = () => { let release; const promise = new Promise(resolve => { release = resolve; }); return { promise, release }; };

test("author mixed practice, review one revision, then preserve that decision when editing a new revision", async ({ page }) => {
  const state = await fixture(page, { count: 0 });
  await region(page).getByRole("button", { name: "New NID practice blueprint", exact: true }).press("Enter");
  for (const label of ["Practice duration in minutes", "Section 1 question count", "Section 1 marks per question"]) await expect(editor(page).getByLabel(label, { exact: true })).toHaveValue("");
  await fillObjective(page);
  const form = editor(page);
  await form.getByRole("button", { name: "Add practice section", exact: true }).click();
  for (const [label, value] of [["Section 2 label", "Visual communication"], ["Section 2 question count", "2"], ["Section 2 marks per question", "30"], ["Section 2 wrong-answer penalty", "0"]]) await form.getByLabel(label, { exact: true }).fill(value);
  await form.getByRole("combobox", { name: "Section 2 response", exact: true }).selectOption("drawing");
  await form.getByRole("combobox", { name: "Completed-page upload time", exact: true }).selectOption("15");
  for (let position = 1; position <= 2; position++) {
    await form.getByRole("button", { name: "Add criterion to section 2", exact: true }).click();
    await form.getByLabel(`Criterion 2.${position} label`, { exact: true }).fill(position === 1 ? "Observation" : "Communication");
    await form.getByLabel(`Criterion 2.${position} marks`, { exact: true }).fill(position === 1 ? "10" : "20");
    await form.getByRole("textbox", { name: `Criterion 2.${position} review guidance`, exact: true }).fill("Credit the clearly communicated fictional visual relationships.");
  }
  await expect(form).toContainText("5 questions · 67.5 maximum practice marks · 63 minutes plus 15 minutes");
  await form.getByRole("button", { name: "Save practice revision", exact: true }).press("Enter");
  await expect(form.getByRole("heading", { name: "Revision 1 · draft", exact: true })).toBeVisible();
  const review = await fillReview(page); await review.getByRole("button", { name: "Record practice review", exact: true }).press("Enter");
  await expect(form.getByRole("heading", { name: "Revision 1 · reviewed", exact: true })).toBeVisible();
  const key = [...state.rows.keys()][0];
  expect(state.rows.get(key)[0].payload.sections[1].rubric.map(row => row.points)).toEqual([10, 20]);
  await form.getByLabel("Practice duration in minutes", { exact: true }).fill("64");
  await form.getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(form.getByRole("heading", { name: "Revision 2 · draft", exact: true })).toBeVisible();
  await expect(form.getByRole("checkbox")).not.toBeChecked(); await expect(form.getByRole("textbox", { name: "Practice review note", exact: true })).toHaveValue("");
  await form.getByRole("combobox", { name: "Saved practice revision", exact: true }).selectOption("1"); await form.getByRole("button", { name: "Open selected practice revision", exact: true }).click();
  await expect(form.getByLabel("Practice duration in minutes", { exact: true })).toHaveValue("63"); await expect(form.getByLabel("Practice title", { exact: true })).toBeDisabled();
  await expect(form.getByRole("button", { name: "Record practice review", exact: true })).toHaveCount(0);
  expect(state.rows.get(key).map(value => value.status)).toEqual(["reviewed", "draft"]);
  expect(state.calls.some(([name]) => /start_|materializ|admin_review_bank|release_mvp|set_launch/.test(name))).toBe(false); expect(state.unexpected).toEqual([]);
});

test("rubric mismatch blocks a write and a response-type change never silently discards its rubric", async ({ page }) => {
  const state = await fixture(page); await open(page); const form = editor(page);
  await form.getByRole("combobox", { name: "Section 1 response", exact: true }).selectOption("written");
  await form.getByLabel("Section 1 wrong-answer penalty", { exact: true }).fill("0"); await form.getByRole("combobox", { name: "Completed-page upload time", exact: true }).selectOption("10");
  await form.getByRole("button", { name: "Add criterion to section 1", exact: true }).click();
  await form.getByLabel("Criterion 1.1 label", { exact: true }).fill("Communication"); await form.getByLabel("Criterion 1.1 marks", { exact: true }).fill("2");
  await form.getByRole("textbox", { name: "Criterion 1.1 review guidance", exact: true }).fill("Credit clear original fictional communication.");
  await form.getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("must equal"); expect(state.writes).toHaveLength(0);
  await form.getByRole("combobox", { name: "Section 1 response", exact: true }).selectOption("mcq"); await form.getByRole("combobox", { name: "Completed-page upload time", exact: true }).selectOption("0");
  await expect(form).toContainText("Remove it explicitly"); await form.getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("Objective sections cannot"); expect(state.writes).toHaveLength(0);
  await form.getByRole("button", { name: "Remove rubric from section 1", exact: true }).click(); await form.getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(form.getByRole("heading", { name: "Revision 2 · draft", exact: true })).toBeVisible(); expect(state.writes).toHaveLength(1); expect(state.unexpected).toEqual([]);
});

test("a changed revision rejects a stale review and reopens current content without its earlier confirmation", async ({ page }) => {
  const state = await fixture(page); await open(page); const form = editor(page), review = await fillReview(page);
  state.rows.get(id).push({ ...version({ ...payload(), durationMinutes: 47 }, 2), id });
  await review.getByRole("button", { name: "Record practice review", exact: true }).click();
  await expect(region(page).getByRole("alert")).toHaveText("This blueprint changed. Open its current revision before continuing.");
  await expect(form.getByRole("button", { name: "Save practice revision", exact: true })).toBeDisabled();
  await region(page).getByRole("button", { name: "Open current blueprint revision", exact: true }).click();
  await expect(form.getByLabel("Practice duration in minutes", { exact: true })).toHaveValue("47"); await expect(form.getByRole("checkbox")).not.toBeChecked();
  await expect(form.getByRole("textbox", { name: "Practice review note", exact: true })).toHaveValue(""); expect(state.rows.get(id).at(-1).status).toBe("draft"); expect(state.writes).toHaveLength(1);
});

test("committed saves with lost replies recover by reading the actor-bound request, without a duplicate write", async ({ page }) => {
  const state = await fixture(page); await open(page);
  await page.route(endpoint("admin_save_nid_practice_blueprint"), async route => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); state.respond("admin_save_nid_practice_blueprint", route.request().postDataJSON()); return route.abort(); });
  await editor(page).getByLabel("Practice duration in minutes", { exact: true }).fill("49"); await editor(page).getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("not confirmed"); await expect(editor(page).getByLabel("Practice title", { exact: true })).toBeDisabled(); expect(state.writes).toHaveLength(1);
  await region(page).getByRole("button", { name: "Check saved blueprint", exact: true }).click();
  await expect(editor(page).getByRole("heading", { name: "Revision 2 · draft", exact: true })).toBeVisible(); await expect(editor(page).getByLabel("Practice duration in minutes", { exact: true })).toHaveValue("49");
  await expect(region(page).getByRole("button", { name: "Retry same blueprint request", exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(1); expect(state.rows.get(id)).toHaveLength(2);
});

test("an uncommitted request stays locked until an explicit retry sends exactly the same command", async ({ page }) => {
  const state = await fixture(page); await open(page); let lost;
  await page.route(endpoint("admin_save_nid_practice_blueprint"), async route => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); lost = route.request().postDataJSON(); return route.abort(); });
  await editor(page).getByLabel("Practice duration in minutes", { exact: true }).fill("51"); await editor(page).getByRole("button", { name: "Save practice revision", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("not confirmed"); await region(page).getByRole("button", { name: "Check saved blueprint", exact: true }).click();
  await expect(region(page)).toContainText("not visible as committed yet"); expect(state.writes).toHaveLength(0);
  await expect(region(page).getByRole("button", { name: "New NID practice blueprint", exact: true })).toBeDisabled();
  await page.unroute(endpoint("admin_save_nid_practice_blueprint")); await region(page).getByRole("button", { name: "Retry same blueprint request", exact: true }).click();
  await expect(editor(page).getByRole("heading", { name: "Revision 2 · draft", exact: true })).toBeVisible(); expect(state.writes).toEqual([["admin_save_nid_practice_blueprint", lost]]); expect(state.rows.get(id)).toHaveLength(2);
});

test("a committed review with an incomplete acknowledgement can be retried exactly once without another decision", async ({ page }) => {
  const state = await fixture(page); await open(page); let lost;
  await page.route(endpoint("admin_review_nid_practice_blueprint"), async route => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); lost = route.request().postDataJSON(); state.respond("admin_review_nid_practice_blueprint", lost); return route.fulfill({ headers: cors, json: { id, revision: 1, status: "reviewed" } }); });
  const review = await fillReview(page); await review.getByRole("button", { name: "Record practice review", exact: true }).click();
  await expect(region(page).getByRole("alert")).toContainText("not confirmed"); await page.unroute(endpoint("admin_review_nid_practice_blueprint"));
  await region(page).getByRole("button", { name: "Retry same blueprint request", exact: true }).click(); await expect(editor(page).getByRole("heading", { name: "Revision 1 · reviewed", exact: true })).toBeVisible();
  expect(state.writes).toEqual([["admin_review_nid_practice_blueprint", lost], ["admin_review_nid_practice_blueprint", lost]]); expect(state.requests.size).toBe(1);
});

test("pending saves dispatch once while duplicate submissions and account replacement cannot expose their late result", async ({ page }) => {
  const state = await fixture(page); await open(page); const began = deferred(), held = deferred();
  await page.route(endpoint("admin_save_nid_practice_blueprint"), async route => { if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors }); const result = state.respond("admin_save_nid_practice_blueprint", route.request().postDataJSON()); began.release(); await held.promise; return route.fulfill({ headers: cors, json: result }); });
  await editor(page).getByLabel("Practice duration in minutes", { exact: true }).fill("52"); const form = editor(page).getByRole("form", { name: "Edit NID practice blueprint", exact: true });
  await form.evaluate(element => { element.requestSubmit(); element.requestSubmit(); }); await began.promise; expect(state.writes).toHaveLength(1);
  await seedPortalSession(page, other); state.admin = false; await page.reload(); held.release();
  await expect(page.getByText("This account is not an administrator.", { exact: true })).toBeVisible(); await expect(region(page)).toHaveCount(0); await expect(page.getByLabel("Practice title", { exact: true })).toHaveCount(0); expect(state.writes).toHaveLength(1);
});

test("role loss clears the blueprint and no student can read the practice queue", async ({ page }) => {
  const state = await fixture(page);
  await open(page);
  const privateReads = () => state.calls.filter(([name]) =>
    name === "admin_nid_practice_blueprints" || name === "admin_nid_practice_blueprint");
  const allowedReads = privateReads().length;
  expect(allowedReads).toBeGreaterThan(0);
  state.admin = false;
  await page.getByRole("button", { name: "Recheck administrator access", exact: true }).press("Enter");
  await expect(page.getByText("Administrator access has ended. Private views were cleared.", { exact: true })).toBeVisible(); await expect(region(page)).toHaveCount(0);
  await seedPortalSession(page, other); await page.reload(); await expect(page.getByText("This account is not an administrator.", { exact: true })).toBeVisible();
  expect(privateReads()).toHaveLength(allowedReads);
  expect(state.writes).toHaveLength(0);
  expect(state.unexpected).toEqual([]);
});

test("paginated practice designs remain separate from the public catalogue and rejection needs a fresh revision", async ({ page }) => {
  const state = await fixture(page, { count: 13 }); await expect(region(page).getByText("1–10 of 13 practice blueprints", { exact: true })).toBeVisible();
  await region(page).getByRole("button", { name: "Next blueprints", exact: true }).click(); await expect(region(page).getByText("11–13 of 13 practice blueprints", { exact: true })).toBeVisible();
  await region(page).getByRole("button", { name: "Previous blueprints", exact: true }).click(); await open(page); const review = await fillReview(page);
  await review.getByRole("button", { name: "Request blueprint correction", exact: true }).click(); await expect(editor(page).getByRole("heading", { name: "Revision 1 · rejected", exact: true })).toBeVisible();
  await expect(editor(page).getByRole("button", { name: "Record practice review", exact: true })).toHaveCount(0); expect(state.rows.get(id)[0].status).toBe("rejected");
  expect(state.calls.some(([name]) => ["available_papers", "admin_configure_exam_mock", "admin_release_mvp_paper"].includes(name))).toBe(false); expect(state.unexpected).toEqual([]);
});

test("a delayed queue response cannot overwrite a refreshed practice list", async ({ page }) => {
  const state = await fixture(page), held = deferred(), began = deferred(); let reads = 0;
  // The desk can render its controls before its first scoped list read settles.
  // Fence that baseline so the fault route holds only the explicit refresh.
  await expect(region(page).getByText("1–1 of 1 practice blueprints", { exact: true })).toBeVisible();
  await page.route(endpoint("admin_nid_practice_blueprints"), async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    const result = state.respond("admin_nid_practice_blueprints", route.request().postDataJSON());
    if (++reads === 1) { began.release(); await held.promise; return route.fulfill({ headers: { ...cors, "x-nid-older": "yes" }, json: { ...result, total: 0, items: [] } }); }
    return route.fulfill({ headers: cors, json: result });
  });
  await region(page).getByRole("button", { name: "Refresh practice blueprints", exact: true }).click(); await began.promise;
  await region(page).getByRole("button", { name: "Refresh practice blueprints", exact: true }).click(); await expect.poll(() => reads).toBe(2);
  const olderResponse = page.waitForResponse(response => response.headers()["x-nid-older"] === "yes"); held.release(); await olderResponse;
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  await expect(region(page).getByText("1–1 of 1 practice blueprints", { exact: true })).toBeVisible(); await expect(region(page).getByRole("button", { name: "Open practice blueprint " + payload().title, exact: true })).toBeVisible();
});

test("practice editing and review remain keyboard accessible in both themes and at 320 pixels", async ({ page }) => {
  const state = await fixture(page); await open(page); const form = editor(page);
  await form.getByLabel("Practice title", { exact: true }).focus(); await page.keyboard.press("Tab"); await expect(form.getByRole("textbox", { name: "Practice purpose", exact: true })).toBeFocused();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(value => { document.documentElement.dataset.theme = value; localStorage.setItem("dmocks-theme", value); }, theme);
    expect(await page.evaluate(async () => (await window.axe.run(".nid-practice-blueprints", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } })).violations)).toEqual([]);
  }
  await page.setViewportSize({ width: 320, height: 780 }); expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
  await expect(form.getByRole("textbox", { name: "Practice review note", exact: true })).toBeVisible(); expect(state.unexpected).toEqual([]);
});
