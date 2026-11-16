import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: 'http://127.0.0.1:4799' });
const editor = { id: "00000000-0000-4000-8000-000000000121", email: "bank-review@example.invalid" };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4+vEFAAWtAs+P9YeZAAAAAElFTkSuQmCC", "base64");
const figureURL = "https://bank-figure-fixture.invalid/figure.png";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const changedMessage = "Question changed. Refresh the bank and review it again.";

async function fixture(page, { admin = true, fullPortal = false } = {}) {
  const questions = Array.from({ length: 52 }, (_, index) => {
    const n = index + 1;
    return { externalKey: `bank-review-${String(n).padStart(3, "0")}`, exam: n % 2 ? "uceed" : "ceed", type: "MCQ",
      topic: n % 2 ? "observation" : "spatial", licence: "owned", active: n !== 52, approved: false, rightsConfirmed: false,
      runtimeReady: n !== 51, reviewVersion: `version-${n}-1`, reviewNote: "", sourceCommit: "a".repeat(40), contentSha256: "b".repeat(64),
      prompt: n === 26 ? `${"Fictional full wording. ".repeat(30)}50%_literal` : `Fictional question ${n}`,
      options: [{ key: "A", text: "Fictional first option" }, { key: "B", text: "Fictional second option" }],
      answer: { raw: "B", status: "human-reviewed" }, explanation: "The fictional second option preserves the intended visual order.",
      runtimeKey: { kind: "mcq", correct: ["B"] }, marking: { correct: 3, wrong: -0.71 },
      context: { exam: "ceed", cycle: 2027, version: "fictional-test" }, media: n === 26 ? [{ ordinal: 1, width: 1, height: 1, available: true }] : [],
    };
  });
  const state = { questions };
  const provider = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return admin;
      case "admin_search_bank_questions": {
        const matching = questions.filter(q => (!input.p_exam || q.exam === input.p_exam) && (!input.p_topic || q.topic === input.p_topic)
          && (!input.p_type || q.type === input.p_type) && (!input.p_search || `${q.externalKey} ${q.topic} ${q.prompt}`.toLowerCase().includes(input.p_search.toLowerCase()))
          && ({ pending: q.active && q.runtimeReady && !q.approved, approved: q.active && q.approved,
            unavailable: q.active && !q.runtimeReady, inactive: !q.active, all: true }[input.p_status]));
        const offset = Math.min(input.p_offset, Math.floor(Math.max(0, matching.length - 1) / input.p_limit) * input.p_limit);
        return { items: matching.slice(offset, offset + input.p_limit).map(q => ({ ...q, prompt: q.prompt.slice(0, 500) })),
          total: matching.length, offset, limit: input.p_limit, topics: ["observation", "spatial"],
          summary: { active: 51, available: 50, approved: questions.filter(q => q.approved).length, inactive: 1 } };
      }
      case "admin_bank_question": {
        const q = questions.find(q => q.externalKey === input.p_external_key);
        return input.p_expected_version === q.reviewVersion ? q : { code: "40001", message: changedMessage };
      }
      case "admin_prepare_bank_answer_correction": {
        const q = questions.find(q => q.externalKey === input.p_external_key);
        if (q.reviewVersion !== input.p_expected_version) return { code: "40001", message: changedMessage };
        const payloadText = JSON.stringify({ externalKey: q.externalKey, prompt: q.prompt, type: q.type,
          provenance: { exam: q.exam }, holds: [], answer: { raw: input.p_answer, status: "human-reviewed" } });
        return { replacesContentSha256: q.contentSha256, sourceCommit: q.sourceCommit, packet: {
          format: "dmocks-question-export-v1", artifactId: editor.id, externalKey: q.externalKey, payloadText,
          contentSha256: createHash("sha256").update(payloadText).digest("hex"), rightsNote: input.p_review_note,
          sourceType: "manual", createdAt: "2026-11-14T00:00:00Z", publicationState: "git-review-required",
        } };
      }
      case "bank-review-media": return { images: [{ ordinal: 1, width: 1, height: 1, url: figureURL }] };
      case "admin_review_bank_question": {
        const q = questions.find(q => q.externalKey === input.p_external_key);
        if (input.p_expected_version !== q.reviewVersion) return { code: "40001", message: changedMessage };
        q.approved = input.p_approved;
        q.rightsConfirmed = input.p_rights_confirmed;
        q.reviewNote = input.p_note;
        q.reviewVersion += "-reviewed";
        return null;
      }
      default: return emptyAdminRead(procedure);
    }
  });
  await page.route(figureURL, route => route.fulfill({ body: png, contentType: "image/png" }));
  await page.goto(fullPortal ? portalFixtureURL + "/admin" : "/admin");
  await seedPortalSession(page, editor);
  await page.reload();
  return { ...state, ...provider };
}

test("bank review shows separate accepted choices and complete multiple-select sets", async ({ page }) => {
  const state = await fixture(page);
  const options = ["A", "B", "C", "D"].map(key => ({ key, text: `Fictional option ${key}` }));
  Object.assign(state.questions[0], {
    options, answer: { raw: "D OR B", status: "human-reviewed" },
    runtimeKey: { kind: "mcq", correct: ["D", "B"] },
  });
  Object.assign(state.questions[1], {
    type: "MSQ", options, answer: { raw: "AD or BC", status: "human-reviewed" },
    runtimeKey: { kind: "msq", alternatives: [["A", "D"], ["B", "C"]] },
    marking: { correct: 4, wrong: -1, partial: true },
  });
  const bank = page.getByRole("region", { name: "Imported bank review", exact: true });
  const review = bank.getByRole("region", { name: "Question review", exact: true });
  await bank.getByRole("button", { name: "Open question bank-review-001", exact: true }).press("Enter");
  await expect(review.locator("dd")).toHaveText(["D OR B", "D or B", "Correct 3 · Wrong -0.71"]);
  await review.getByRole("button", { name: "Close question", exact: true }).press("Enter");
  await bank.getByRole("button", { name: "Open question bank-review-002", exact: true }).press("Enter");
  await expect(review.locator("dd")).toHaveText(["AD or BC", "A, D or B, C", "Correct 4 · Wrong -1 · Partial credit applies"]);
  expect(state.calls.some(([name]) => name === "admin_review_bank_question")).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test('NID and NIFT conversion previews explain proposed use without releasing or starting a paper',async({page})=>{
 const state=await fixture(page),bank=page.getByRole('region',{name:'Imported bank review',exact:true}),q=state.questions[50];
 Object.assign(q,{exam:'nid',type:'DESCRIPTIVE',answer:null,runtimeKey:null,marking:null,context:null,options:[],reviewVersion:'nid-drawing-proposal',media:[]});
 await bank.getByLabel('Review status').selectOption('unavailable');await bank.getByRole('button',{name:'Search bank',exact:true}).click();await bank.getByRole('button',{name:'Open question bank-review-051',exact:true}).click();
 let review=bank.getByRole('region',{name:'Question review',exact:true}),preview=review.getByRole('region',{name:'Student exam preview',exact:true});await expect(preview).toContainText('NID · DAT Prelims creative practice');await expect(preview).toContainText('Proposed practice placement; conversion is still required.');await expect(preview).toContainText('does not publish the question or start an exam');await expect(preview).toContainText('drawing/written pages');await expect(review.getByRole('region',{name:'Conversion checklist',exact:true})).toContainText('Verify the NID delivery blueprint');await expect(review.locator('input[type=file]')).toHaveCount(0);await review.getByRole('button',{name:'Close question',exact:true}).click();
 Object.assign(q,{type:'MCQ',answer:{raw:'A',status:'human-reviewed'},options:['A','B','C'].map(key=>({key,text:'Original option '+key})),reviewVersion:'nid-objective-proposal'});
 await bank.getByRole('button',{name:'Search bank',exact:true}).click();await bank.getByRole('button',{name:'Open question bank-review-051',exact:true}).click();review=bank.getByRole('region',{name:'Question review',exact:true});await expect(review.getByRole('region',{name:'Student exam preview',exact:true})).toContainText('NID · DAT Prelims aptitude practice');await expect(review.getByRole('region',{name:'Conversion checklist',exact:true}).getByRole('listitem')).toHaveText(['Verify the NID delivery blueprint, timing and marking/rubric before conversion.']);await expect(review.getByRole('button',{name:'Approve for practice',exact:true})).toBeDisabled();await review.getByRole('button',{name:'Close question',exact:true}).click();
 Object.assign(q,{exam:'nift',type:'MCQ',answer:{raw:'A',status:'human-reviewed'},options:['A','A','C','D'].map(key=>({key,text:'Original option '+key})),reviewVersion:'nift-objective-proposal'});
 await bank.getByRole('button',{name:'Search bank',exact:true}).click();await bank.getByRole('button',{name:'Open question bank-review-051',exact:true}).click();review=bank.getByRole('region',{name:'Question review',exact:true});await expect(review.getByRole('region',{name:'Student exam preview',exact:true})).toContainText('NIFT · B.Des. GAT');await expect(review.getByRole('region',{name:'Conversion checklist',exact:true})).toContainText('Provide exactly four uniquely labelled options.');await review.getByRole('checkbox').check();await expect(review.getByRole('button',{name:'Approve for practice',exact:true})).toBeDisabled();
 expect(state.calls.some(([name])=>['start_attempt','start_exam_mock','admin_review_bank_question','upsert_nift_question_bank_runtime_batch'].includes(name))).toBe(false);expect(state.unexpected).toEqual([]);
});

test("the complete bank is paginated, filtered and reviewed with private figures on the actual admin route", async ({ page }) => {
  const state = await fixture(page);
  const bank = page.getByRole("region", { name: "Imported bank review", exact: true });
  await expect(bank.getByText("1–25 of 50 matching questions")).toBeVisible();
  await expect(bank.getByRole("button", { name: "Open question bank-review-026", exact: true })).toHaveCount(0);
  await bank.getByRole("button", { name: "Next questions" }).press("Enter");
  await expect(bank.getByText("26–50 of 50 matching questions")).toBeVisible();
  await bank.getByRole("button", { name: "Open question bank-review-026", exact: true }).click();
  const review = bank.getByRole("region", { name: "Question review", exact: true });
  await expect(review.getByText(state.questions[25].prompt, { exact: true }).first()).toBeVisible();
  await expect(review.getByRole("listitem").filter({ hasText: "Fictional second option" }).first()).toBeVisible();
  await expect(review.getByText("Correct 3 · Wrong -0.71")).toBeVisible();
  await expect(review.locator("dd")).toHaveText(["B", "B", "Correct 3 · Wrong -0.71"]);
  await review.getByLabel("Review note").fill("Original fictional content and answer reviewed.");
  await review.getByRole("checkbox").check();
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Open private figures" }).click();
  await expect(review.getByRole("img", { name: "Question figure 1" })).toBeVisible();
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toBeEnabled();
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  expect(await page.evaluate(async () => (await window.axe.run(".bank-review-browser", {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
  })).violations)).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);
  const dashboardReads = state.calls.filter(([name]) => name === "admin_launch_readiness").length;
  await review.getByRole("button", { name: "Approve for practice", exact: true }).press("Enter");
  await expect(bank.getByText("Review saved. The question bank has been refreshed.")).toBeVisible();
  await expect(review).toHaveCount(0);
  await expect(bank.getByText("26–49 of 49 matching questions")).toBeVisible();
  expect(state.calls).toContainEqual(["admin_review_bank_question", { p_external_key: "bank-review-026", p_approved: true,
    p_rights_confirmed: true, p_note: "Original fictional content and answer reviewed.", p_expected_version: "version-26-1" }]);
  expect(state.calls.filter(([name]) => name === "admin_launch_readiness")).toHaveLength(dashboardReads + 1);
  expect(state.calls.filter(([name]) => name === "admin_exam_mock_blueprints")).toHaveLength(0);
  await bank.getByRole("combobox", { name: "Review status", exact: true }).selectOption("approved");
  await bank.getByRole("combobox", { name: "Bank exam", exact: true }).selectOption("ceed");
  await bank.getByRole("combobox", { name: "Bank topic", exact: true }).selectOption("spatial");
  await bank.getByLabel("Find a question").fill("50%_literal");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await expect(bank.getByText("1–1 of 1 matching questions")).toBeVisible();
  expect(state.calls).toContainEqual(["admin_search_bank_questions", { p_exam: "ceed", p_type: null, p_status: "approved",
    p_topic: "spatial", p_search: "50%_literal", p_limit: 25, p_offset: 0 }]);
  expect(state.unexpected).toEqual([]);
});

test("a changed question cannot be approved from an open review and refreshed details reset confirmation", async ({ page }) => {
  const state = await fixture(page);
  const bank = page.getByRole("region", { name: "Imported bank review", exact: true });
  await bank.getByRole("button", { name: "Open question bank-review-001", exact: true }).click();
  const review = bank.getByRole("region", { name: "Question review", exact: true });
  await review.getByLabel("Review note").fill("Fictional source and answer reviewed.");
  const rightsLabel = "I checked the question and confirm DMocks has the right to use it.";
  const rightsConfirmation = review.getByRole("checkbox", { name: rightsLabel, exact: true });
  await review.getByText(rightsLabel, { exact: true }).click();
  await expect(rightsConfirmation).toBeChecked();
  state.questions[0].reviewVersion = "version-1-2";
  state.questions[0].prompt = "Changed fictional source wording.";
  await review.getByRole("button", { name: "Approve for practice", exact: true }).click();
  await expect(review.getByRole("alert")).toHaveText(changedMessage);
  expect(state.questions[0].approved).toBe(false);
  await bank.getByRole("button", { name: "Refresh bank" }).click();
  await expect(review).toHaveCount(0);
  await bank.getByRole("button", { name: "Open question bank-review-001", exact: true }).click();
  await expect(review.getByText("Changed fictional source wording.").first()).toBeVisible();
  await expect(rightsConfirmation).not.toBeChecked();
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toBeDisabled();
  expect(state.unexpected).toEqual([]);
});

test("incomplete private figures block approval while corrections, inactive records and unconverted records remain reviewable", async ({ page }) => {
  const state = await fixture(page);
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/bank-review-media", route => route.fulfill({
    headers: cors, json: { images: [] },
  }));
  const bank = page.getByRole("region", { name: "Imported bank review", exact: true });
  await bank.getByLabel("Find a question").fill("bank-review-026");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await bank.getByRole("button", { name: "Open question bank-review-026", exact: true }).click();
  const review = bank.getByRole("region", { name: "Question review", exact: true });
  await review.getByLabel("Review note").fill("The required figure needs correction.");
  await review.getByRole("checkbox").check();
  await review.getByRole("button", { name: "Open private figures" }).click();
  await expect(review.getByRole("alert")).toHaveText("The question figures are incomplete. Refresh the figures before approving.");
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toBeDisabled();
  await review.getByRole("button", { name: "Request correction", exact: true }).click();
  await expect(review).toHaveCount(0);
  expect(state.questions[25].approved).toBe(false);
  expect(state.questions[25].rightsConfirmed).toBe(false);
  await bank.getByLabel("Find a question").fill("");
  await bank.getByRole("combobox", { name: "Review status", exact: true }).selectOption("inactive");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await bank.getByRole("button", { name: "Open question bank-review-052", exact: true }).click();
  await expect(review.getByText("This record is inactive in the current bank.")).toBeVisible();
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toHaveCount(0);
  await bank.getByRole("combobox", { name: "Review status", exact: true }).selectOption("unavailable");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await bank.getByRole("button", { name: "Open question bank-review-051", exact: true }).click();
  await expect(review.getByText("This question needs a verified conversion before practice approval.")).toBeVisible();
  await expect(review.getByRole("region", { name: "Student exam preview", exact: true })).toContainText("CEED · Part A");
  await expect(review.getByRole("region", { name: "Conversion checklist", exact: true })).toContainText("Provide exactly four uniquely labelled options");
  await review.getByRole("checkbox").check();
  await expect(review.getByRole("button", { name: "Approve for practice", exact: true })).toBeDisabled();
  expect(state.unexpected).toEqual([]);
});

test("a delayed search cannot replace a newer bank query", async ({ page }) => {
  const state = await fixture(page);
  const bank = page.getByRole("region", { name: "Imported bank review", exact: true });
  await expect(bank.getByText("1–25 of 50 matching questions")).toBeVisible({ timeout: 15000 });
  let release, began;
  const pending = new Promise(resolve => { release = resolve; });
  const started = new Promise(resolve => { began = resolve; });
  await page.route("https://dmocks-portal-fixture.supabase.co/rest/v1/rpc/admin_search_bank_questions", async route => {
    if (route.request().method() === "OPTIONS") return route.fulfill({ status: 204, headers: cors });
    if (route.request().postDataJSON().p_search !== "delayed-query") return route.fallback();
    began();
    await pending;
    await route.fulfill({ headers: cors, json: { items: [], total: 0, offset: 0, limit: 25, topics: [] } });
  });
  await bank.getByLabel("Find a question").fill("delayed-query");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await started;
  await bank.getByLabel("Find a question").fill("bank-review-026");
  await bank.getByRole("button", { name: "Search bank", exact: true }).click();
  await expect(bank.getByText("1–1 of 1 matching questions")).toBeVisible();
  const oldResponse = page.waitForResponse(response => response.request().postDataJSON()?.p_search === "delayed-query");
  release();
  await oldResponse;
  await expect(bank.getByRole("button", { name: "Open question bank-review-026", exact: true })).toBeVisible();
  await expect(bank.getByText("No questions match these filters.")).toHaveCount(0);
  expect(state.unexpected).toEqual([]);
});

test("students cannot load bank questions or private review figures from the admin route", async ({ page }) => {
  const state = await fixture(page, { admin: false });
  await expect(page.getByText("This account is not an administrator.", { exact: true })).toBeVisible();
  await expect(page.getByRole("region", { name: "Imported bank review", exact: true })).toHaveCount(0);
  expect(state.calls.some(([name]) => ["admin_search_bank_questions", "admin_bank_question", "bank-review-media"].includes(name))).toBe(false);
  expect(state.unexpected).toEqual([]);
});

test("an administrator downloads a version-pinned answer correction for Git review", async ({ page }) => {
  const state = await fixture(page, { fullPortal: true });
  state.questions[0].holdReason = "Held after multiple student reports.";
  await page.getByRole("button", {name: "Open question bank-review-001", exact: true}).click();
  const review = page.getByRole("region", {name: "Question review"});
  await expect(review.getByText("Held after multiple student reports.")).toBeVisible();
  await expect(review.getByRole("button", {name: "Approve for practice"})).toHaveCount(0);
  await review.getByText("Prepare answer correction", {exact: true}).click();
  await review.getByLabel("Proposed answer").fill("A");
  await review.getByLabel("Source evidence").fill("Verified against the fictional answer key.");
  const pending = page.waitForEvent("download");
  await review.getByRole("button", {name: "Download correction for Git review"}).click();
  const download = await pending;
  const packet = JSON.parse(await readFile(await download.path(), "utf8"));
  expect(packet.sourceCommit).toBe("a".repeat(40));
  expect(packet.contentSha256).toBe(createHash("sha256").update(packet.payloadText).digest("hex"));
  expect(packet.replacesContentSha256).toBe("b".repeat(64));
  expect(JSON.parse(packet.payloadText).answer).toEqual({raw: "A", status: "human-reviewed"});
  expect(state.calls).toContainEqual(["admin_prepare_bank_answer_correction", {
    p_external_key: "bank-review-001", p_expected_version: "version-1-1",
    p_answer: "A", p_review_note: "Verified against the fictional answer key.",
  }]);
  expect(state.questions[0].answer.raw).toBe("B");
});

test("paid MVP bank review hides the full portal correction action", async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole("button", {name: "Open question bank-review-001", exact: true}).click();
  const review = page.getByRole("region", {name: "Question review"});
  await expect(review.getByRole("button", {name: "Request correction", exact: true})).toBeVisible();
  await expect(review.getByText("Prepare answer correction", {exact: true})).toHaveCount(0);
  expect(state.calls.some(([name]) => name === "admin_prepare_bank_answer_correction")).toBe(false);
});
