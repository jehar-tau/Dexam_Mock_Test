import test from "node:test";
import assert from "node:assert/strict";
import { portalItems, portalModules } from "../src/portalModel.mjs";

test("student navigation has unique routes and the required launch areas", () => {
  assert.deepEqual(portalItems.map((item) => item.label), ["Overview", "Exam-wise mocks", "All India mocks", "Topic practice", "Learn", "Community"]);
  assert.equal(new Set(portalItems.map((item) => item.to)).size, portalItems.length);
  assert.equal(portalItems.filter((item) => item.released).length, 1);
});

test("every locked module has transparent release copy", () => {
  for (const item of portalItems.filter((entry) => !entry.released)) {
    const key = item.to.split("/").at(-1);
    assert.ok(portalModules[key], `${key} needs module copy`);
    assert.ok(portalModules[key][1].length > 30);
  }
});
