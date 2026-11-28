import { expect, test } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { portalFixtureURL } from "./portal-fixture.js";

test.use({ baseURL: portalFixtureURL });
const axe = fileURLToPath(new URL("../../node_modules/axe-core/axe.min.js", import.meta.url));
const audit = page => page.evaluate(async () => (await window.axe.run(".guides-page", { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] } }))
  .violations.map(item => `${item.id}: ${item.nodes.map(node => node.target.join(" ")).join(" | ")}`));

for (const [device, viewport] of [["desktop", { width: 1280, height: 860 }], ["mobile", { width: 360, height: 760 }]]) {
  test(`anyone can read the guides without signing in (${device})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/guides");
    await expect(page.getByRole("heading", { level: 1, name: "Read what works." })).toBeVisible();
    const cards = page.locator(".editorial-card");
    expect(await cards.count()).toBeGreaterThanOrEqual(20);
    await expect(page.getByText("Written by Snehalkumar Shinde, NID Bengaluru.")).toBeVisible();
    await page.screenshot({ path: info.outputPath(`guides-${device}.png`) });
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await page.getByRole("link", { name: "Drawing when you think you cannot draw" }).click();
    await expect(page).toHaveURL("/guides/drawing-when-you-think-you-cannot-draw");
    await expect(page.getByRole("heading", { level: 1, name: "Drawing when you think you cannot draw" })).toBeVisible();
    await expect(page.locator(".editorial-byline")).toContainText("NID Bengaluru");
    await expect(page.locator("figure.editorial-figure figcaption")).toContainText("via Wikimedia Commons");
    await expect(page.getByRole("complementary", { name: "Practise for free" }).getByRole("link", { name: "Browse free papers" })).toHaveAttribute("href", "/papers");
    await expect(page.getByRole("heading", { name: "Keep reading" })).toBeVisible();
    await expect(page.locator(".editorial-next .editorial-card a").first()).toHaveAttribute("href", /^\/guides\//);
    await expect(page).toHaveTitle("Drawing when you think you cannot draw | DMocks guides");
    await page.screenshot({ path: info.outputPath(`guide-${device}.png`) });
    await page.addScriptTag({ path: axe });
    expect(await audit(page)).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await page.goto("/guides/not-a-guide");
    await expect(page.getByRole("link", { name: "See all guides" })).toBeVisible();
  });
}
