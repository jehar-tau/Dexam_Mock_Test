import { expect, test } from "@playwright/test";
import { portalFixtureURL } from "./portal-fixture.js";
import { asha, audit, backend, extensionAppOrigin, extensionOrigin, fitsWidth, installExtension, openPopup, signIn, uid } from "./community-library-fixture.js";

test.use({ baseURL: portalFixtureURL });
const tab = { url: "https://example.org/sketching-routine?utm_source=newsletter#part-2", title: "A fictional sketching routine | Fictional Studio" };
const panel = page => page.getByRole("region", { name: "Browser extension", exact: true });
// Copying the key takes window focus from the test page, so the popup's focus
// is checked as the active element rather than with toBeFocused.
const active = locator => expect.poll(() => locator.evaluate(element => element === document.activeElement)).toBe(true);
const folder = (page, name) => page.getByRole("region", { name: `Folder ${name}`, exact: true });

async function setup(page, context) {
  await context.grantPermissions(["clipboard-read", "clipboard-write"], { origin: portalFixtureURL });
  const state = backend();
  state.folders.push({ id: uid("f", 1), userId: asha.id, name: "Inspiration" });
  state.previews.set("https://example.org/sketching-routine", { title: "A fictional sketching routine", site: "Fictional Studio" });
  await state.install(page); await installExtension(page);
  return state;
}
async function connectOnSite(page) {
  await signIn(page, asha, "/dashboard/community/saved");
  await panel(page).getByLabel("Name this browser").fill("Chrome on my laptop");
  await panel(page).getByRole("button", { name: "Connect a browser" }).click();
  const field = panel(page).getByLabel("Connection key");
  await expect(field).toBeFocused();
  await expect(field).toHaveValue(/^dmx_[0-9a-f]{64}$/);
  return field.inputValue();
}

test("a student connects the extension, saves the page they are reading, and fetches its preview later", async ({ page, context }) => {
  const state = await setup(page, context);
  const key = await connectOnSite(page);
  await panel(page).getByRole("button", { name: "Copy key" }).click();
  await expect(panel(page).getByText("Key copied.")).toBeVisible();
  await panel(page).getByRole("button", { name: "Done" }).click();
  await expect(panel(page).getByLabel("Connection key")).toHaveCount(0);
  await expect(panel(page)).toContainText("Chrome on my laptop · connected 17 Nov 2026 · not used yet");
  expect(JSON.stringify(state.calls.filter(([name]) => name === "community_extension_tokens").map(call => call[1]))).not.toContain("dmx_");

  await openPopup(page, tab);
  const connectForm = page.getByRole("region", { name: "Connect this browser" });
  await active(page.getByLabel("Connection key"));
  await page.getByLabel("Connection key").fill("dmx_123");
  await connectForm.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("status")).toHaveText("Paste the whole connection key from DMocks. It starts with dmx_.");
  await page.getByLabel("Connection key").fill(key);
  await connectForm.getByRole("button", { name: "Connect" }).click();
  const save = page.getByRole("region", { name: tab.title });
  await expect(save).toBeVisible();
  await expect(save).toContainText("example.org");
  await expect(save.getByLabel("Inspiration")).toBeChecked();
  await active(save.getByLabel("Inspiration"));
  await expect(save.getByLabel("Your note (private)")).toHaveValue(tab.title);
  await save.getByLabel("Your note (private)").fill(`${tab.title}\nTry the twenty-minute warm-up.`);
  await save.getByRole("button", { name: "Save" }).click();
  await active(page.getByRole("heading", { name: "Saved to DMocks" }));
  expect(state.extensionCalls).toEqual([{ p_token: key, p_url: "https://example.org/sketching-routine", p_folder_ids: [uid("f", 1)], p_new_folder: "",
    p_note: `${tab.title}\nTry the twenty-minute warm-up.` }]);
  expect(state.calls.filter(([name]) => name.startsWith("extension_")).every(([, , actor]) => actor === undefined)).toBe(true);
  await page.getByRole("button", { name: "Open my folders" }).click();
  expect(await page.evaluate(() => [localStorage.getItem("fixture-opened"), localStorage.getItem("fixture-closed")])).toEqual([`${extensionAppOrigin}/dashboard/community/saved`, "yes"]);

  await signIn(page, asha, "/dashboard/community/saved");
  const saved = folder(page, "Inspiration").getByRole("article", { name: "Saved link: example.org" });
  await expect(saved).toContainText("Saved from the browser extension. No preview yet.");
  await expect(saved).toContainText("Try the twenty-minute warm-up.");
  await saved.getByRole("button", { name: "Get preview: example.org" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Preview added." })).toBeVisible();
  const previewed = folder(page, "Inspiration").getByRole("article", { name: "Saved link: A fictional sketching routine" });
  await expect(previewed.getByRole("heading", { name: "A fictional sketching routine" })).toBeVisible();
  await expect(previewed.getByRole("button", { name: /Get preview/ })).toHaveCount(0);
  await expect(panel(page)).toContainText("last used 17 Nov 2026");

  await panel(page).getByRole("button", { name: "Disconnect Chrome on my laptop" }).click();
  await expect(panel(page).getByText("Chrome on my laptop is disconnected. Its key no longer works.")).toBeVisible();
  await expect(panel(page).getByText("No browsers connected.")).toBeVisible();
  await page.goto(extensionOrigin + "/popup.html"); // the tab from before is still stored
  await expect(page.getByRole("status")).toHaveText("This connection was removed or has expired. Connect again from DMocks.");
  await active(page.getByLabel("Connection key"));
  expect(await page.evaluate(() => localStorage.getItem("chrome:dmocksKey"))).toBeNull();
});

test("the extension saves into a new folder, refuses browser pages, and can be disconnected from the popup", async ({ page, context }) => {
  const state = await setup(page, context);
  const key = await connectOnSite(page);
  await openPopup(page, { url: "chrome://extensions/", title: "Extensions" });
  await page.getByLabel("Connection key").fill(key);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("heading", { name: "This page can’t be saved. Open an ordinary web page and try again." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Save" })).toHaveCount(0);
  expect(state.extensionCalls).toEqual([]);

  await openPopup(page, { url: "https://www.instagram.com/p/fictional/", title: "Fictional poster on Instagram" });
  const save = page.getByRole("region", { name: "Fictional poster on Instagram" });
  await save.getByLabel("Inspiration").uncheck();
  await save.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("status")).toHaveText("Choose a folder or name a new one.");
  await save.getByLabel("Or a new folder").fill("Poster ideas");
  await save.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Saved to DMocks" })).toBeVisible();
  expect(state.folders.map(item => item.name)).toEqual(["Inspiration", "Poster ideas"]);
  expect(state.links.at(-1)).toMatchObject({ url: "https://www.instagram.com/p/fictional/", status: "skipped", title: null });

  await page.getByRole("button", { name: "Disconnect this browser" }).click();
  await expect(page.getByRole("status")).toHaveText("This browser is disconnected. Remove the connection on DMocks too.");
  await page.reload();
  await expect(page.getByRole("region", { name: "Connect this browser" })).toBeVisible();
});

test("the popup and the connection panel pass the accessibility audit", async ({ page, context }) => {
  await setup(page, context);
  const key = await connectOnSite(page);
  await audit(page); await fitsWidth(page);
  await openPopup(page, tab);
  await expect(page.getByRole("region", { name: "Connect this browser" })).toBeVisible();
  await audit(page, "main");
  await page.getByLabel("Connection key").fill(key);
  await page.getByRole("button", { name: "Connect" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  await audit(page, "main");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("heading", { name: "Saved to DMocks" })).toBeVisible();
  await audit(page, "main");
});
