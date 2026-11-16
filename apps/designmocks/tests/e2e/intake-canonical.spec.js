import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { buildManifest, runtimeQuestion } from "../../scripts/question-bank-import.mjs";
import { RULES_2027 } from "../../scripts/question-runtime.mjs";
import { readIntakeJson, readIntakeUpload } from "../../supabase/functions/_shared/intake-request.mjs";

test.use({ baseURL: portalFixtureURL });
const author = { id: "00000000-0000-4000-8000-000000000107", email: "intake-fixture@example.invalid" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC", "base64");
const figureSha = createHash("sha256").update(png).digest("hex");
const pdf = Buffer.from("%PDF-1.7\nFictional byte-signature fixture");
const extracted = { type: "MCQ", prompt: "Choose the clearest fictional wayfinding design.",
  options: ["A", "B", "C", "D"].map(id => ({ id, text: `Fictional option ${id}` })),
  answer: null, explanation: "", topic: "observation", visualDependency: null, holds: ["intake-human-review"] };

async function fixture(page, { admin = true, loseFirstUploadReceipt = false } = {}) {
  const assets = [], drafts = [], uploads = [], state = { admin, sourceReads:0, holdSource:null };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return state.admin;
      case "admin_question_intake_assets": return assets;
      case "admin_question_drafts": return drafts;
      case "question-intake-extract": {
        const asset = assets.find(item => item.id === input.assetId);
        asset.status = "extracted";
        asset.candidates = [1, 2].map(ordinal => ({ id: `candidate-${ordinal}`, ordinal, pageNumber: ordinal + 1,
          confidence: 0.8, status: "pending", payload: extracted }));
        return { assetId: asset.id, questions: 2, status: "extracted" };
      }
      case "admin_promote_intake_candidate": {
        if (input.p_payload.answer.raw !== "B") return { code: "P0001", message: "Single-choice answer must match an option key" };
        const candidate = assets[0].candidates.find(item => item.id === input.p_candidate_id);
        candidate.status = "promoted";
        const draft = { id: "draft-extracted", sourceName: assets[0].name, status: "pending", payload: {
          ...input.p_payload, provenance: { ...input.p_payload.provenance, intake: { assetId: assets[0].id,
            candidateId: candidate.id, pageNumber: candidate.pageNumber, confidence: candidate.confidence } },
        } };
        drafts.push(draft);
        return draft.id;
      }
      case "admin_reject_intake_candidate":
        assets[0].candidates.find(item => item.id === input.p_candidate_id).status = "rejected";
        assets[0].status = "reviewed";
        return null;
      case "admin_promote_intake_asset": {
        const asset = assets.find(item => item.id === input.p_asset_id);
        asset.status = "reviewed";
        const draft = { id: `draft-manual-${drafts.length}`, sourceName: asset.name, status: "pending", payload: input.p_payload };
        drafts.push(draft);
        return draft.id;
      }
      case "admin_review_question_draft":
        drafts.find(draft => draft.id === input.p_id).status = input.p_decision;
        return null;
      case "admin_export_question_draft": {
        const draft = drafts.find(draft => draft.id === input.p_draft_id);
        draft.status = "exported";
        draft.export = { externalKey: input.p_external_key, contentSha256: "c".repeat(64), payload: {
          ...draft.payload, externalKey: input.p_external_key, holds: [], answer: { ...draft.payload.answer, status: "human-reviewed" },
        } };
        return draft.export;
      }
      default: return emptyAdminRead(procedure);
    }
  });
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/question-intake", async route => {
    const request = route.request();
    const headers = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (request.headers()["content-type"]?.includes("application/json")) {
      const input = await readIntakeJson(new Request(request.url(), {
        method: "POST", headers: {"content-type": request.headers()["content-type"]}, body: request.postDataBuffer(),
      }));
      const asset = assets.find(item => item.id === input.assetId);
      if (!input.figureSha) {
        state.sourceReads++;
        if (state.holdSource) await state.holdSource;
      }
      return route.fulfill({ headers: { ...headers, "Content-Type": "application/octet-stream" }, body: !input.figureSha && asset.mimeType === "application/pdf" ? pdf : png }).catch(() => {});
    }
    const body = request.postDataBuffer();
    const parsed = await readIntakeUpload(new Request(request.url(), {
      method: "POST", headers: {"content-type": request.headers()["content-type"]}, body,
    }));
    if (parsed.assetId) return route.fulfill({ headers, json: { asset: {
      path: `intake/${figureSha}.png`, sha256: figureSha, width: 1, height: 1,
    } } });
    uploads.push(body);
    if (loseFirstUploadReceipt) {
      const {file} = parsed;
      expect(file.name).toBe("fictional-source.pdf");
      expect(file.type).toBe("application/pdf");
      expect(Buffer.from(await file.arrayBuffer())).toEqual(pdf);
      if (uploads.length > 1) return route.fulfill({ headers, json: { ...assets[0], reused: true } });
    }
    const asset = { id: `00000000-0000-4000-8000-${String(111 + assets.length).padStart(12, "0")}`, name:parsed.file.name,
      mimeType:parsed.file.type, byteSize:parsed.file.size, status: "uploaded", candidates: [] };
    assets.push(asset);
    if (loseFirstUploadReceipt) return route.abort("failed");
    return route.fulfill({ headers, json: asset });
  });
  await page.goto("/admin");
  await seedPortalSession(page, author);
  await page.reload();
  return { ...provider, assets, drafts, uploads, state };
}

test("the verified administrator can inspect a private source photo and a revoked account cannot finish opening it", async ({page}) => {
  await page.addInitScript(() => {
    window.intakePhotoUrls = {opened:[], revoked:[]};
    const create = URL.createObjectURL.bind(URL), revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = blob => {
      const url = create(blob);
      window.intakePhotoUrls.opened.push(url);
      return url;
    };
    URL.revokeObjectURL = url => {
      window.intakePhotoUrls.revoked.push(url);
      revoke(url);
    };
  });
  const fixtureState = await fixture(page);
  const upload = page.getByLabel("Private source file");
  const submit = page.getByRole("button", {name:"Upload for extraction"});
  await upload.setInputFiles({name:"fictional-source.pdf",mimeType:"application/pdf",buffer:pdf});
  await submit.click();
  const pdfCard = page.locator(".intake-queue article").filter({hasText:"fictional-source.pdf"});
  await expect(pdfCard.getByRole("button", {name:"Download private source"})).toBeVisible();
  await expect(pdfCard.getByRole("button", {name:"Inspect source photo"})).toHaveCount(0);
  const photoName = `${"fictional-source-photo-".repeat(6)}.png`;
  await upload.setInputFiles({name:photoName,mimeType:"image/png",buffer:png});
  await submit.click();
  const inspect = page.getByRole("button", {name:"Inspect source photo",exact:true});
  await inspect.click();
  const viewer = page.getByRole("dialog", {name:photoName,exact:true});
  await expect(viewer).toBeVisible();
  await expect.poll(() => viewer.getByRole("img", {name:photoName}).evaluate(image => image.naturalWidth)).toBe(1);
  expect(await viewer.evaluate(dialog => dialog.scrollWidth <= dialog.clientWidth)).toBe(true);
  await viewer.getByRole("button", {name:"Rotate right"}).click();
  await expect(viewer.getByRole("status")).toContainText("rotated 90°");
  await viewer.getByRole("button", {name:"Close image"}).click();
  await expect(inspect).toBeFocused();
  expect(await page.evaluate(() => window.intakePhotoUrls.revoked)).toEqual(await page.evaluate(() => window.intakePhotoUrls.opened));

  let release;
  fixtureState.state.holdSource = new Promise(resolve => {release = resolve;});
  await inspect.click();
  await expect.poll(() => fixtureState.state.sourceReads).toBe(2);
  fixtureState.state.admin = false;
  await page.getByRole("button", {name:"Recheck administrator access"}).click();
  await expect(page.getByRole("alert").filter({hasText:"Administrator access has ended"})).toBeVisible();
  release();
  await expect(viewer).toHaveCount(0);
  expect(await page.evaluate(() => window.intakePhotoUrls.opened.length)).toBe(1);
});

test("PDF/photo uploads, private source download, corrected figures and rights export use the actual admin route", async ({ page }) => {
  const state = await fixture(page);
  for (const [name, mimeType, buffer] of [["fictional-source.pdf", "application/pdf", pdf], ["fictional-photo.png", "image/png", png]]) {
    await page.getByLabel("Private source file").setInputFiles({ name, mimeType, buffer });
    await page.getByRole("button", { name: "Upload for extraction" }).click();
    await expect(page.locator(".intake-queue article").filter({ hasText: name })).toBeVisible();
    await expect(page.getByLabel("Private source file")).toHaveValue("");
  }
  expect(state.uploads).toHaveLength(2);
  const asset = page.locator(".intake-queue article").filter({ hasText: "fictional-source.pdf" });
  const download = page.waitForEvent("download");
  await asset.getByRole("button", { name: "Download private source" }).click();
  expect((await download).suggestedFilename()).toBe("fictional-source.pdf");
  await asset.getByRole("button", { name: "Extract with configured model" }).click();
  const candidate = asset.getByRole("region", { name: "Candidate 1", exact: true });
  await expect(candidate.getByLabel("Question wording")).toHaveValue(extracted.prompt);
  await expect(candidate.getByRole("combobox", { name: "Exam", exact: true })).toHaveValue("");
  await expect(candidate.getByLabel("Verified answer")).toHaveValue("");
  await candidate.getByRole("combobox", { name: "Exam", exact: true }).selectOption("uceed");
  await candidate.getByLabel("Verified answer").fill("E");
  await candidate.getByLabel("Does the question require figures?").selectOption("false");
  await candidate.getByRole("checkbox").check();
  await candidate.getByRole("button", { name: "Send to human review" }).click();
  await expect(candidate.getByRole("alert")).toHaveText("Single-choice answer must match an option key");
  await candidate.getByLabel("Verified answer").fill("B");
  await candidate.getByLabel("Does the question require figures?").selectOption("true");
  await candidate.getByRole("button", { name: "Send to human review" }).click();
  await expect(candidate.getByRole("alert")).toHaveText("Attach the reviewed figures required to understand this question.");
  const figures = candidate.getByLabel("Reviewed question figures (PNG)");
  const oversizedRead = await figures.evaluate(input => {
    const oversized = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oversized.png", {type: "image/png"});
    const files = new DataTransfer();
    files.items.add(oversized);
    input.files = files.files;
    const original = File.prototype.arrayBuffer;
    let read = false;
    File.prototype.arrayBuffer = function (...args) {
      if (this.name === "oversized.png") read = true;
      return original.apply(this, args);
    };
    try { input.dispatchEvent(new Event("change", {bubbles: true})); }
    finally { File.prototype.arrayBuffer = original; }
    return read;
  });
  expect(oversizedRead).toBe(false);
  await expect(candidate.getByRole("alert")).toHaveText("Use a complete PNG figure up to 10 MB.");
  await figures.setInputFiles({ name: "invalid.png", mimeType: "image/png", buffer: Buffer.from("<svg/>") });
  await expect(candidate.getByRole("alert")).toHaveText("Use a complete PNG figure up to 10 MB.");
  await figures.setInputFiles({ name: "figure.png", mimeType: "image/png", buffer: png });
  await expect(candidate.locator("code")).toHaveText(`intake/${figureSha}.png`);
  const figureDownload = page.waitForEvent("download");
  await candidate.getByRole("button", { name: "Download prepared figure 1" }).click();
  expect((await figureDownload).suggestedFilename()).toBe(`${figureSha}.png`);

  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const violations = await page.evaluate(async () => (await window.axe.run(".intake-queue", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21aa"] } })).violations);
  expect(violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  await candidate.getByRole("button", { name: "Send to human review" }).press("Enter");
  await expect(candidate.getByText("promoted", { exact: true })).toBeVisible();
  await asset.getByRole("region", { name: "Candidate 2", exact: true }).getByRole("button", { name: "Reject extraction" }).click();
  await expect(asset.getByText("reviewed", { exact: true })).toBeVisible();
  const draft = page.getByRole("article").filter({ has: page.getByRole("button", { name: "Approve for export" }) });
  await expect(draft.locator("pre")).toContainText('"status": "pending"');
  await draft.getByRole("button", { name: "Approve for export" }).click();
  const exported = page.getByRole("article").filter({ has: page.getByLabel("Stable external key") });
  await exported.getByLabel("Stable external key").fill("intake-fixture-original");
  await exported.getByLabel("Rights record").fill("Owner approved this fictional source question.");
  await exported.getByRole("checkbox").check();
  await exported.getByRole("button", { name: "Create canonical review artifact" }).click();
  const artifact = page.getByRole("article").filter({ hasText: "intake-fixture-original" });
  await artifact.getByText("Review JSON", { exact: true }).click();
  const reviewed = JSON.parse(await artifact.locator("details pre").textContent());
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const manifest = buildManifest({ schemaVersion: 1, questions: [reviewed] });
  expect(manifest.objectiveReadyTotal).toBe(1);
  expect(reviewed.provenance.intake.pageNumber).toBe(2);
  expect(runtimeQuestion(reviewed, { rule: RULES_2027.uceed })).toBeNull();
  expect(runtimeQuestion(reviewed, { rule: RULES_2027.uceed, mediaCatalog: [{ sha256: figureSha,
    path: `papers/canonical/${figureSha}.png`, width: 1, height: 1, byteSize: png.length }] }).key.correct).toEqual(["B"]);
  await page.reload();
  const retained = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download retained figure 1" }).click();
  expect((await retained).suggestedFilename()).toBe(`${figureSha}.png`);
  expect(state.unexpected).toEqual([]);
});

test("retrying a committed private upload after reload keeps one asset and its review state", async ({ page }) => {
  const state = await fixture(page, { loseFirstUploadReceipt: true });
  const name = "fictional-source.pdf";
  const input = page.getByLabel("Private source file");
  const upload = page.getByRole("button", { name: "Upload for extraction", exact: true });
  const queue = page.locator(".intake-queue article");
  const select = () => input.setInputFiles({ name, mimeType: "application/pdf", buffer: pdf });

  await select();
  await upload.click();
  await expect(page.getByRole("alert")).toContainText("Couldn’t complete this administrator request. Refresh and try again.");
  expect(state.uploads).toHaveLength(1);
  expect(state.assets).toHaveLength(1);
  const assetId = state.assets[0].id;

  await page.reload();
  await expect(queue).toHaveCount(1);
  await expect(queue.getByText(name, { exact: true })).toBeVisible();
  await queue.getByRole("button", { name: "Extract with configured model" }).click();
  const candidate = queue.getByRole("region", { name: "Candidate 2", exact: true });
  await candidate.getByRole("button", { name: "Reject extraction" }).click();
  await expect(candidate.getByText("rejected", { exact: true })).toBeVisible();

  await select();
  await upload.click();
  await expect(page.getByText(name + " is already in private intake.", { exact: true })).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(queue).toHaveCount(1);
  await expect(candidate.getByText("rejected", { exact: true })).toBeVisible();
  expect(state.assets.map(({ id, status }) => ({ id, status }))).toEqual([{ id: assetId, status: "reviewed" }]);
  expect(state.uploads).toHaveLength(2);

  const downloadPromise = page.waitForEvent("download");
  await queue.getByRole("button", { name: "Download private source" }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(name);
  expect(await readFile(await download.path())).toEqual(pdf);
  expect(state.unexpected).toEqual([]);
});

test("administrators can transcribe several source questions while model extraction awaits configuration", async ({ page }) => {
  const state = await fixture(page);
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/question-intake-extract", async route => route.fulfill({
    status: 503, headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" },
    json: { error: "Question extraction is not configured" },
  }));
  await page.getByLabel("Private source file").setInputFiles({ name: "fictional-photo.png", mimeType: "image/png", buffer: png });
  await page.getByRole("button", { name: "Upload for extraction" }).click();
  const asset = page.locator(".intake-queue article");
  await asset.getByRole("button", { name: "Extract with configured model" }).click();
  await expect(asset.getByRole("alert")).toHaveText("Question extraction is not configured");
  state.assets[0].byteSize = 10485761;
  await page.reload();
  await expect(asset.getByRole("button", { name: "Extract with configured model" })).toBeDisabled();
  await expect(asset.getByText(/Model extraction accepts files up to 10 MB/)).toBeVisible();
  await asset.getByText("Transcribe a question from this source", { exact: true }).click();
  const editor = asset.locator("details form");
  for (const answer of ["2.000000000000000001", "3"]) {
    await editor.getByRole("combobox", { name: "Exam", exact: true }).selectOption("ceed");
    await editor.getByRole("combobox", { name: "Question type", exact: true }).selectOption("NAT");
    await editor.getByLabel("Question wording").fill(`A fictional numeric question with answer ${answer}.`);
    await editor.getByLabel("Verified answer").fill(answer);
    await editor.getByLabel("Does the question require figures?").selectOption("false");
    await editor.getByRole("checkbox").check();
    await editor.getByRole("button", { name: "Send to human review" }).click();
    await expect(editor.getByLabel("Question wording")).toHaveValue("");
  }
  const submissions = state.calls.filter(([name]) => name === "admin_promote_intake_asset");
  expect(submissions).toHaveLength(2);
  expect(submissions[0][1].p_payload.answer).toEqual({ raw: "2.000000000000000001", status: "pending" });
  expect(submissions[0][1].p_payload.holds).toEqual(["intake-human-review"]);
  expect(state.drafts.every(draft => draft.status === "pending")).toBe(true);
  expect(state.unexpected).toEqual([]);
});

for (const denial of [
  { label: "model-worker role denial", message: "Admin access required" },
  { label: "staging tester denial", message: "Private staging requires an approved Google tester" },
]) {
  test(`a late ${denial.label} closes the desk and clears the private intake source`, async ({ page }) => {
    const state = await fixture(page);
    await page.getByLabel("Private source file").setInputFiles({ name: "fictional-source.pdf", mimeType: "application/pdf", buffer: pdf });
    await page.getByRole("button", { name: "Upload for extraction" }).click();
    const asset = page.locator(".intake-queue article").filter({ hasText: "fictional-source.pdf" });
    await expect(asset).toBeVisible();

    let workerCalls = 0;
    await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/question-intake-extract", async route => {
      workerCalls++;
      expect(route.request().postDataJSON()).toEqual({ assetId: "00000000-0000-4000-8000-000000000111" });
      state.state.admin = false;
      await route.fulfill({ status: 403, json: { error: denial.message } });
    });
    await asset.getByRole("button", { name: "Extract with configured model" }).click();

    const access = page.getByRole("region", { name: "Administrator access", exact: true });
    await expect(access.getByRole("alert")).toHaveText("Administrator access has ended. Private views were cleared.");
    await expect(page.getByLabel("Private source file")).toHaveCount(0);
    await expect(page.locator(".intake-queue article")).toHaveCount(0);
    await expect(page.getByText(denial.message, { exact: true })).toHaveCount(0);
    expect(workerCalls).toBe(1);
    expect(state.calls.filter(([name]) => name === "question-intake-extract")).toHaveLength(0);
    expect(state.unexpected).toEqual([]);
  });
}

test("students cannot open private intake controls", async ({ page }) => {
  const state = await fixture(page, { admin: false });
  await expect(page.getByText("This account is not an administrator.")).toBeVisible();
  await expect(page.getByLabel("Private source file")).toHaveCount(0);
  expect(state.calls.every(([name]) => name === "is_dmocks_admin")).toBe(true);
  expect(state.unexpected).toEqual([]);
});

test("revocation during a private source download clears intake without saving a file", async ({page}) => {
  const fixtureState = await fixture(page);
  await page.getByLabel("Private source file").setInputFiles({name: "fictional-source.pdf", mimeType: "application/pdf", buffer: pdf});
  await page.getByRole("button", {name: "Upload for extraction"}).click();
  const asset = page.locator(".intake-queue article").filter({hasText: "fictional-source.pdf"});
  await expect(asset).toBeVisible();

  let downloads = 0;
  page.on("download", () => { downloads++; });
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/question-intake", async route => {
    if (route.request().method() === "OPTIONS") return route.fallback();
    expect(route.request().postDataJSON()).toEqual({assetId: fixtureState.assets[0].id});
    fixtureState.state.admin = false;
    await route.fulfill({status: 403, headers: {"Access-Control-Allow-Origin": "*"}, json: {error: "Admin access required"}});
  });
  await asset.getByRole("button", {name: "Download private source"}).click();
  const access = page.getByRole("region", {name: "Administrator access", exact: true});
  await expect(access.getByRole("alert")).toHaveText("Administrator access has ended. Private views were cleared.");
  await expect(asset).toHaveCount(0);
  expect(downloads).toBe(0);
});
