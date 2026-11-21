// Fail CI if fictional preview account views leak into a production bundle.
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
const allowLearnImages = process.argv.includes("--allow-learn-images");
const rootEntries = await readdir("dist");
if (!allowLearnImages) assert.ok(!rootEntries.includes("learn-images"), "Learn preview images leaked into a closed build");
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(js|html)$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      if (!allowLearnImages) {
        assert.doesNotMatch(entry.name, /^(Learn|LearnProgramme)-/, "Interactive Learn code in a closed build");
        assert.ok(!source.includes("Embroidery and weaves"), "Signed-in Learn lesson content in a closed build");
      }
      for (const marker of ["Sample Student", "illustrative-uceed", "original-visual-design-paper-v1", "/portal-preview", "/exam-mocks-preview", "/all-india-preview", "/topic-practice-preview", "/learn-preview", "/community-preview", "/profile-preview", "/drawing-uploads-preview", "/question-report-preview", "Fictional All India mock", "PortalPreview", "OFFLINE SYNC PREVIEW", "PRIVATE INTAKE PREVIEW", "drawing-review-lifecycle-preview", "Draw a portable reading light.", "Run accessibility check", "/learn-programme-preview", "Development preview. Progress is saved only in this browser."])
        assert.ok(!source.includes(marker), `Local QA content leaked into ${path}: ${marker}`);
    }
  }
}
await check("dist");
console.log("Build passes preview isolation checks.");
