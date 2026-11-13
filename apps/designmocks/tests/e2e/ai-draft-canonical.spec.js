import { expect, test } from "@playwright/test";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { buildManifest, runtimeQuestion } from "../../scripts/question-bank-import.mjs";
import { RULES_2027 } from "../../scripts/question-runtime.mjs";
import { readJsonObject } from "../../supabase/functions/_shared/request-json.mjs";

test.use({ baseURL: portalFixtureURL });

const author = { id: "00000000-0000-4000-8000-000000000104", email: "draft-fixture@example.invalid" };
const draftId = "50000000-0000-4000-8000-000000000104";
const requestId = "50000000-0000-4000-8000-000000000105";
const payload = {
  type: "MCQ", prompt: "Choose the clearest original wayfinding design.",
  options: ["A", "B", "C", "D"].map((key) => ({ key, text: "Fictional option " + key, asset: null })),
  answer: { raw: "B", status: "pending" }, explanation: "A clear visual hierarchy aids navigation.",
  topic: "observation", assets: [], visualDependency: false, sourceKind: "generated", licence: "original-ai-draft",
  holds: ["ai-generated-human-review"], provenance: { exam: "uceed", basisExternalKeys: ["ai-fixture-basis"] },
};

test("AI drafts surface reference denials and need human approval and rights evidence before canonical export", async ({ page }) => {
  let request, isAdmin = true;
  let draft;
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return isAdmin;
      case "admin_question_drafts": return draft ? [draft] : [];
      case "admin_ai_draft_requests": return request ? [request] : [];
      case "ai-question-draft":
        if (input.basisExternalKeys[0] !== "ai-fixture-basis") {
          return { code: "P0001", error: "Every basis question must be active, hold-free and rights-approved" };
        }
        request = { id: requestId, ...input, status: "succeeded" };
        draft = { id: draftId, sourceName: "AI request fictional fixture", status: "pending", payload };
        return { requestId, draftId, status: "succeeded" };
      case "admin_review_question_draft":
        draft = { ...draft, status: input.p_decision };
        return null;
      case "admin_export_question_draft":
        draft = { ...draft, status: "exported", export: { externalKey: input.p_external_key, contentSha256: "a".repeat(64),
          payload: { ...payload, externalKey: input.p_external_key, answer: { ...payload.answer, status: "human-reviewed" }, holds: [] } } };
        return draft.export;
      default: return emptyAdminRead(procedure);
    }
  });
  await page.route("**/functions/v1/ai-question-draft", async route => {
    const request = route.request();
    if (request.method() === "POST") {
      const input = await readJsonObject(new Request(request.url(), {
        method: "POST", headers: {"content-type": request.headers()["content-type"]}, body: request.postDataBuffer(),
      }), 64 * 1024, "draft");
      expect(input.basisExternalKeys).toHaveLength(1);
    }
    await route.fallback();
  });
  await page.goto("/admin");
  await seedPortalSession(page, author);
  await page.reload();
  const editor = page.getByRole("region", { name: "Generate an AI-assisted question draft" });
  await editor.getByLabel("Topic", { exact: true }).fill("observation");
  await editor.getByLabel("Rights-approved basis keys").fill("ai-fixture-rights-open");
  await editor.getByLabel("Generation brief").fill("Create an original wayfinding question for review.");
  await editor.getByRole("button", { name: "Generate review draft" }).click();
  await expect(editor.getByRole("alert")).toHaveText("Every basis question must be active, hold-free and rights-approved");
  await editor.getByLabel("Rights-approved basis keys").fill(" ai-fixture-basis ");
  await editor.getByRole("button", { name: "Generate review draft" }).press("Enter");
  await expect(editor.getByRole("status")).toHaveText("AI draft created and sent to human review.");
  const card = page.getByRole("article").filter({ hasText: "AI request fictional fixture" });
  await expect(card.locator("pre")).toContainText("ai-generated-human-review");
  await expect(card.getByRole("button", { name: "Create canonical review artifact" })).toHaveCount(0);
  await card.getByRole("button", { name: "Approve for export" }).click();
  await card.getByLabel("Stable external key").fill("ai-fixture-original");
  await card.getByLabel("Rights record").fill("Fictional author approved this original question.");
  await card.getByRole("checkbox").check();
  await card.getByRole("button", { name: "Create canonical review artifact" }).click();
  await card.getByText("Review JSON", { exact: true }).click();
  const reviewed = JSON.parse(await card.locator("details pre").textContent());
  const manifest = buildManifest({ schemaVersion: 1, questions: [payload, reviewed] });
  expect(manifest.eligibleTotal).toBe(1);
  expect(runtimeQuestion(manifest.records[0].payload, { rule: RULES_2027.uceed }).key.correct).toEqual(["B"]);
  expect(calls).toContainEqual(["admin_review_question_draft", { p_id: draftId, p_decision: "approved", p_note: null }]);
  expect(calls).toContainEqual(["admin_export_question_draft", { p_draft_id: draftId, p_external_key: "ai-fixture-original",
    p_rights_confirmed: true, p_rights_note: "Fictional author approved this original question." }]);
  expect(unexpected).toEqual([]);
});

test("a late model-worker role denial closes the desk and clears AI reference and draft inputs", async ({ page }) => {
  let isAdmin = true;
  const { calls, unexpected } = await stubPortalProvider(page, procedure => {
    if (procedure === "is_dmocks_admin") return isAdmin;
    return emptyAdminRead(procedure);
  });
  await page.goto("/admin");
  await seedPortalSession(page, author);
  await page.reload();
  const editor = page.getByRole("region", { name: "Generate an AI-assisted question draft" });
  await editor.getByLabel("Topic", { exact: true }).fill("observation");
  await editor.getByLabel("Rights-approved basis keys").fill("ai-fixture-basis");
  await editor.getByLabel("Generation brief").fill("Create a fictional original question for review.");

  let workerCalls = 0;
  await page.route("https://dmocks-portal-fixture.supabase.co/functions/v1/ai-question-draft", async route => {
    workerCalls++;
    expect(route.request().postDataJSON()).toMatchObject({
      topic: "observation", basisExternalKeys: ["ai-fixture-basis"],
      instruction: "Create a fictional original question for review.",
    });
    isAdmin = false;
    await route.fulfill({ status: 403, json: { error: "Admin access required" } });
  });
  await editor.getByRole("button", { name: "Generate review draft" }).click();

  const access = page.getByRole("region", { name: "Administrator access", exact: true });
  await expect(access.getByRole("alert")).toHaveText("Administrator access has ended. Private views were cleared.");
  await expect(page.getByRole("region", { name: "Generate an AI-assisted question draft" })).toHaveCount(0);
  await expect(page.getByLabel("Rights-approved basis keys")).toHaveCount(0);
  await expect(page.getByLabel("Generation brief")).toHaveCount(0);
  await expect(page.getByRole("article").filter({ hasText: "AI request" })).toHaveCount(0);
  await expect(page.getByText("Admin access required", { exact: true })).toHaveCount(0);
  expect(workerCalls).toBe(1);
  expect(calls.filter(([name]) => name === "ai-question-draft")).toHaveLength(0);
  expect(unexpected).toEqual([]);
});
