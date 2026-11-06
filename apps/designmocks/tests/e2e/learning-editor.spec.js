import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { emptyAdminRead, portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });

const administrator = { id: "00000000-0000-4000-8000-000000000094", email: "lesson-admin@example.invalid" };
const student = { id: "00000000-0000-4000-8000-000000000095", email: "lesson-student@example.invalid" };
const fixture = {
  id: "50000000-0000-4000-8000-000000000094", slug: "directional-contrast", exam: "nid", topic: "visual-hierarchy",
  title: "Directional contrast", summary: "Use contrast to establish a clear reading order.",
  body: "A synthetic lesson for browser verification.", ordinal: 1,
};
const revisedBody = "An edited synthetic lesson for browser verification.";

test("administrators draft, edit, publish and withdraw a lesson that students can complete", async ({ page }) => {
  let lesson;
  let completed = false;
  let actor = administrator;
  const { calls, unexpected } = await stubPortalProvider(page, (procedure, input) => {
    switch (procedure) {
      case "is_dmocks_admin": return actor === administrator;
      case "admin_learning_lessons": return lesson ? [lesson] : [];
      case "admin_save_learning_draft":
        lesson = { ...fixture, body: input.p_body, version: (lesson?.version ?? 0) + 1, published: false };
        return lesson.id;
      case "admin_set_learning_publication":
        lesson = { ...lesson, version: lesson.version + 1, published: input.p_publish };
        return true;
      case "learning_catalog": return lesson?.published ? [{ ...fixture, completed }] : [];
      case "learning_progress": return { total: Number(Boolean(lesson?.published)), completed: Number(lesson?.published && completed) || 0,
        percent: lesson?.published && completed ? 100 : 0 };
      case "read_learning_lesson": return { ...fixture, body: lesson.body, completed };
      case "complete_learning_lesson": completed = true; return null;
      default: return emptyAdminRead(procedure);
    }
  });
  const openAs = async (account, path) => {
    actor = account;
    await seedPortalSession(page, account);
    await page.goto(path);
  };

  await page.goto("/admin");
  await openAs(administrator, "/admin");
  const editor = page.getByRole("region", { name: "Theory lessons" });
  await expect(editor.getByText("No theory lessons yet.")).toBeVisible();
  await editor.getByText("Add a theory lesson", { exact: true }).click();
  await editor.getByLabel("Lesson URL slug").fill(fixture.slug);
  await editor.getByRole("combobox", { name: "Exam", exact: true }).selectOption(fixture.exam);
  await editor.getByLabel("Topic", { exact: true }).fill(fixture.topic);
  await editor.getByLabel("Title", { exact: true }).fill(fixture.title);
  await editor.getByLabel("Summary", { exact: true }).fill(fixture.summary);
  await editor.getByLabel("Lesson body").fill(fixture.body);
  await editor.getByRole("button", { name: "Save lesson draft" }).click();
  await expect(editor.getByText("Lesson draft saved.")).toBeVisible();

  await openAs(student, "/dashboard/learn");
  await expect(page.getByText("No theory lessons have been published yet.")).toBeVisible();
  await openAs(administrator, "/admin");
  const card = editor.getByRole("article", { name: fixture.title });
  await card.getByRole("button", { name: "Edit draft" }).press("Enter");
  await card.getByLabel("Lesson body").fill(revisedBody);
  await page.addScriptTag({ path: fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url)) });
  const violations = await page.evaluate(async () => {
    const result = await window.axe.run('[aria-labelledby="theory-lesson-editor"]', {
      runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] },
    });
    return result.violations.map(({ id, nodes }) => ({ id, targets: nodes.map(({ target }) => target) }));
  });
  expect(violations).toEqual([]);
  await card.getByRole("button", { name: "Save lesson draft" }).click();
  await expect(editor.getByText("Lesson draft saved.")).toBeVisible();
  await card.getByLabel("Publication rights evidence").fill("      ");
  await card.getByRole("button", { name: "Publish lesson" }).click();
  await expect(editor.getByRole("alert")).toHaveText("Give a reason between 5 and 1,000 characters.");
  expect(calls.some(([name]) => name === "admin_set_learning_publication")).toBe(false);
  await card.getByLabel("Publication rights evidence").fill("Original lesson with documented permission.");
  await card.getByRole("button", { name: "Publish lesson" }).click();
  await expect(editor.getByText("Lesson published in Learn.")).toBeVisible();
  await expect(card.getByRole("button", { name: "Edit draft" })).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(page.viewportSize().width);

  await openAs(student, "/dashboard/learn");
  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByText(revisedBody)).toBeVisible();
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByRole("button", { name: "Lesson complete" })).toBeDisabled();
  await page.getByRole("button", { name: "All lessons" }).click();
  await expect(page.getByText("100% complete")).toBeVisible();
  await openAs(administrator, "/admin");
  await card.getByLabel("Reason for withdrawing").fill("Revise the theory examples.");
  await card.getByRole("button", { name: "Withdraw lesson" }).click();
  await expect(editor.getByText("Lesson withdrawn from Learn.")).toBeVisible();
  await openAs(student, "/dashboard/learn");
  await expect(page.getByText("No theory lessons have been published yet.")).toBeVisible();
  await expect(page.getByText(revisedBody)).toHaveCount(0);
  expect(calls.filter(([name]) => name === "admin_set_learning_publication")).toEqual([
    ["admin_set_learning_publication", { p_id: fixture.id, p_expected_version: 2, p_publish: true, p_reason: "Original lesson with documented permission." }],
    ["admin_set_learning_publication", { p_id: fixture.id, p_expected_version: 3, p_publish: false, p_reason: "Revise the theory examples." }],
  ]);
  expect(calls).toContainEqual(["admin_save_learning_draft", { p_id: fixture.id, p_expected_version: 1, p_slug: fixture.slug,
    p_exam: fixture.exam, p_topic: fixture.topic, p_title: fixture.title, p_summary: fixture.summary, p_body: revisedBody, p_ordinal: 1 }]);
  expect(unexpected).toEqual([]);
});

test("a student with an open lesson loses the reader when the lesson is withdrawn", async ({ page }) => {
  let published = true;
  const { calls, unexpected } = await stubPortalProvider(page, (procedure) => {
    switch (procedure) {
      case "learning_catalog": return published ? [fixture] : [];
      case "learning_progress": return { total: Number(published), completed: 0, percent: 0 };
      case "read_learning_lesson": return fixture;
      case "complete_learning_lesson": return { code: "P0001", message: "Lesson not found" };
      default: return undefined;
    }
  });
  await page.goto("/dashboard/learn");
  await seedPortalSession(page, student);
  await page.reload();
  await page.getByRole("button", { name: "Start lesson" }).click();
  await expect(page.getByText(fixture.body)).toBeVisible();
  published = false;
  await page.getByRole("button", { name: "Mark complete" }).click();
  await expect(page.getByText("This lesson is no longer available.")).toBeVisible();
  await expect(page.getByText(fixture.body)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Start lesson" })).toHaveCount(0);
  await page.getByRole("button", { name: "Refresh lessons" }).click();
  await expect(page.getByText("No theory lessons have been published yet.")).toBeVisible();
  expect(calls).toContainEqual(["complete_learning_lesson", { p_lesson_id: fixture.id }]);
  expect(unexpected).toEqual([]);
});
