import { expect, test } from "@playwright/test";
import { portalFixtureURL, seedPortalSession, stubPortalProvider } from "./portal-fixture.js";
import { asha, audit, backend, body, fitsWidth, ravi, signIn, uid } from "./community-library-fixture.js";

test.use({ baseURL: portalFixtureURL });
const status = (page, text) => page.getByRole("status").filter({ hasText: text });
const notePanel = page => page.locator(".community-note-panel");
const results = page => page.locator(".community-prep-results");

function seed() {
  const state = backend();
  const plan = state.seed(ravi, "A fictional plan for the two hours", { kind: "discussion", exam: "uceed", topic: "Time management", body: "Spend twenty minutes on the first section, then check the clock." });
  const colour = state.seed(ravi, "A fictional colour wheel question", { kind: "discussion", exam: "nid", topic: "Colour", body: "How do you pick a palette under time pressure?" });
  const mine = state.seed(asha, "My fictional sketching routine", { body });
  const grid = state.link("https://example.org/perspective-grids", { title: "A fictional guide to perspective grids", description: "Two-point grids for the studio test." });
  state.folders.push({ id: uid("f", 1), userId: asha.id, name: "Studio test" });
  state.saves.push({ userId: asha.id, postId: plan.id, folderId: uid("f", 1), savedAt: "2026-11-17T00:00:01.000000+00:00" });
  state.linkSaves.push({ userId: asha.id, linkId: grid.id, folderId: uid("f", 1), savedAt: "2026-11-17T00:00:02.000000+00:00" });
  state.notes.push({ userId: asha.id, linkId: grid.id, body: "Practise the grid twice a week" });
  state.drafts.push({ id: uid("d", 1), userId: asha.id, exam: "nid", topic: "Portfolio", title: "An unfinished fictional portfolio note", body: "Notes about the portfolio review.", updatedAt: "2026-11-17T00:00:03.000000+00:00" });
  return { state, plan, colour, mine, grid };
}

test("a student keeps private notes on posts, saves a Learn programme, and finds everything from My prep", async ({ page }) => {
  const { state, plan, colour } = seed();
  await state.install(page); await signIn(page, asha, `/dashboard/community/post/${plan.id}`);
  await expect(notePanel(page)).toContainText("My private note (none yet)");
  await notePanel(page).getByText("My private note").click();
  await notePanel(page).getByLabel("Note for yourself").fill("Try this split on the next mock.");
  await notePanel(page).getByRole("button", { name: "Save note" }).click();
  await expect(notePanel(page).getByRole("status")).toHaveText("Note saved. Only you can see it.");
  await page.goto(`/dashboard/community/post/${colour.id}`);
  await notePanel(page).getByText("My private note").click();
  await notePanel(page).getByLabel("Note for yourself").fill("Ask a teacher about palettes.");
  await notePanel(page).getByRole("button", { name: "Save note" }).click();
  await expect(notePanel(page).getByRole("status")).toHaveText("Note saved. Only you can see it.");
  await page.reload();
  await expect(notePanel(page).getByLabel("Note for yourself")).toHaveValue("Ask a teacher about palettes.");
  await expect(notePanel(page)).toHaveAttribute("open", "");

  await page.goto("/dashboard/learn/programme/cube-nets");
  const save = page.getByRole("button", { name: "Save to my prep" });
  await expect(save).toHaveAttribute("aria-pressed", "false");
  await save.click();
  await expect(status(page, "Saved to your prep space.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Saved to my prep" })).toHaveAttribute("aria-pressed", "true");
  expect(state.learnSaves).toMatchObject([{ userId: asha.id, programme: "cube-nets", title: "Cube nets" }]);

  await page.getByRole("link", { name: "Open my prep" }).click();
  await expect(page).toHaveURL(/\/dashboard\/community\/prep$/);
  const counts = page.getByRole("list", { name: "What you have kept" });
  await expect(counts).toContainText("2 saved in 1 folder");
  await expect(counts).toContainText("3 notes");
  await expect(counts).toContainText("1 post by you");
  await expect(counts).toContainText("1 Learn programme");
  await expect(page.getByRole("region", { name: "Learn programmes" }).getByRole("link", { name: "Cube nets" })).toHaveAttribute("href", "/dashboard/learn/programme/cube-nets");
  await expect(page.getByRole("region", { name: "Your notes" })).toContainText("Practise the grid twice a week");
  await expect(page.getByRole("region", { name: "Your posts" }).getByRole("link", { name: "My fictional sketching routine" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Drafts" })).toContainText("An unfinished fictional portfolio note");

  const search = page.getByRole("search");
  await search.getByLabel("Search everything you kept or wrote").fill("x");
  await search.getByRole("button", { name: "Search" }).click();
  await expect(status(page, "Search for 2 to 100 characters.")).toBeVisible();
  for (const [query, expected] of [["next mock", "A fictional plan for the two hours"], ["GRID twice", "A fictional guide to perspective grids"], ["palettes", "A fictional colour wheel question"],
    ["cube nets", "Cube nets"], ["portfolio review", "An unfinished fictional portfolio note"], ["gesture", "My fictional sketching routine"]]) {
    await search.getByLabel("Search everything you kept or wrote").fill(query);
    await search.getByRole("button", { name: "Search" }).click();
    await expect(status(page, `1 result for “${query}”.`)).toBeVisible();
    await expect(results(page).getByRole("heading", { name: expected })).toBeVisible();
  }
  await expect(results(page)).toContainText("Your post");
  await search.getByLabel("Search everything you kept or wrote").fill("grid twice");
  await search.getByRole("button", { name: "Search" }).click();
  const external = results(page).getByRole("link", { name: /A fictional guide to perspective grids/ });
  await expect(external).toHaveAttribute("rel", "noopener noreferrer nofollow ugc");
  await expect(results(page)).toContainText("Your note: Practise the grid twice a week");
  await search.getByLabel("Search everything you kept or wrote").fill("nothing like this");
  await search.getByRole("button", { name: "Search" }).click();
  await expect(status(page, "Nothing matches “nothing like this”. Try fewer words.")).toBeVisible();

  await page.goto("/dashboard/community/saved");
  await expect(page.getByRole("region", { name: "Folder Studio test" })).toBeVisible();
  expect(state.notes.filter(item => item.postId).map(item => item.body)).toEqual(["Try this split on the next mock.", "Ask a teacher about palettes."]);
});

test("notes stay private, can be cleared, and the prep space is empty for a new student", async ({ page }) => {
  const { state, plan } = seed();
  state.notes.push({ userId: asha.id, postId: plan.id, body: "Only Asha sees this.", updatedAt: "2026-11-17T00:00:04.000000+00:00" });
  await state.install(page); await signIn(page, ravi, `/dashboard/community/post/${plan.id}`);
  await expect(notePanel(page)).toContainText("(none yet)");
  await expect(page.getByText("Only Asha sees this.")).toHaveCount(0);
  await page.goto("/dashboard/community/prep");
  await expect(page.getByRole("region", { name: "Learn programmes" })).toContainText("Open any Learn programme and choose Save to my prep.");
  await expect(page.getByRole("region", { name: "Your notes" })).toContainText("Add a private note on any post");

  await signIn(page, asha, `/dashboard/community/post/${plan.id}`);
  await expect(notePanel(page).getByLabel("Note for yourself")).toHaveValue("Only Asha sees this.");
  await notePanel(page).getByRole("button", { name: "Clear" }).click();
  await notePanel(page).getByRole("button", { name: "Save note" }).click();
  await expect(notePanel(page).getByRole("status")).toHaveText("Note removed.");
  expect(state.notes.some(item => item.postId === plan.id)).toBe(false);
});

test("My prep and the note panel pass the accessibility audit without horizontal scroll", async ({ page }) => {
  const { state, plan } = seed();
  state.learnSaves.push({ userId: asha.id, programme: "cube-nets", title: "Cube nets", savedAt: "2026-11-17T00:00:05.000000+00:00" });
  await state.install(page); await signIn(page, asha, "/dashboard/community/prep");
  await page.getByRole("search").getByLabel("Search everything you kept or wrote").fill("fictional");
  await page.getByRole("search").getByRole("button", { name: "Search" }).click();
  await expect(results(page).locator("li").first()).toBeVisible();
  await audit(page); await fitsWidth(page);
  await page.goto(`/dashboard/community/post/${plan.id}`);
  await notePanel(page).getByText("My private note").click();
  await expect(notePanel(page).getByLabel("Note for yourself")).toBeVisible();
  await audit(page); await fitsWidth(page);
});

test("the released build keeps My prep behind Coming later and shows no prep control on Learn", async ({ page }) => {
  const provider = await stubPortalProvider(page, () => undefined);
  await page.goto("http://127.0.0.1:4999/"); await seedPortalSession(page, ravi);
  await page.goto("http://127.0.0.1:4999/dashboard/community/prep");
  await expect(page.getByText("COMING LATER", { exact: true })).toBeVisible();
  await page.goto("http://127.0.0.1:4999/dashboard/learn/programme/cube-nets");
  await expect(page.getByRole("heading", { name: /Learn by/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /my prep/ })).toHaveCount(0);
  expect(provider.calls).toEqual([]); expect(provider.unexpected).toEqual([]);
});
