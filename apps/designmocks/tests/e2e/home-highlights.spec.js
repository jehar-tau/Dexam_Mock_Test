import { expect, test } from "@playwright/test";

// Home proof points: exams and colleges, the founder, and big numbers.
for (const [device, viewport] of [["desktop", { width: 1280, height: 860 }], ["mobile", { width: 360, height: 760 }]]) {
  test(`the home page shows the exams, colleges, founder and numbers (${device})`, async ({ page }, info) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(page.locator(".hero-copy .eyebrow")).toContainText("UCEED · CEED · NID DAT · NIFT");
    const paths = page.getByRole("list", { name: "Exams and colleges" });
    for (const [exam, college] of [["UCEED", "IIT B.Des."], ["CEED", "IIT M.Des."], ["NID DAT", "NID"], ["NIFT", "NIFT"]])
      await expect(paths.getByRole("link", { name: `${exam} ${college}` })).toBeVisible();
    await expect(page.locator(".founder-note")).toContainText("Built by Snehalkumar Shinde");
    await expect(page.locator(".founder-note")).toContainText("Cleared NID DAT and CEED");
    const numbers = page.getByRole("region", { name: "DMocks in numbers" });
    await expect(numbers).toContainText("3,200");
    await expect(numbers).toContainText("new mock papers every month");
    if (device === "desktop") await expect(page.locator(".founder-note")).toBeInViewport();
    await page.screenshot({ path: info.outputPath(`home-${device}.png`), fullPage: false });
    await numbers.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`home-numbers-${device}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(viewport.width);
    await paths.getByRole("link", { name: "CEED IIT M.Des." }).click();
    await expect(page).toHaveURL(/\/tests\/ceed$/);
  });
}
