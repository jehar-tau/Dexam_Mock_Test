// Fail CI if local-only fictional account views leak into a production bundle.
import { readdir, readFile } from "node:fs/promises";
import assert from "node:assert/strict";
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) await check(path);
    else if (/\.(js|html)$/.test(entry.name)) {
      const source = await readFile(path, "utf8");
      for (const marker of ["Sample Student", "illustrative-uceed", "portal-preview/report", "portal-preview/pending", "Fictional All India mock", "PortalPreview", "OFFLINE SYNC PREVIEW", "PRIVATE INTAKE PREVIEW", "drawing-review-lifecycle-preview", "Draw a portable reading light.", "Run accessibility check"])
        assert.ok(!source.includes(marker), `Local QA content leaked into ${path}: ${marker}`);
    }
  }
}
await check("dist");
console.log("Production bundle excludes the local portal fixture and accessibility panel.");
