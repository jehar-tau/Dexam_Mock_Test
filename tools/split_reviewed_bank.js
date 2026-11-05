#!/usr/bin/env node
// Splits the machine-readable bank into reviewed (publishable), flagged, and not-yet-reviewed files.
const fs = require("fs");
const path = require("path");
const { loadBank, isPublishable, isDrawingReady, readJson, REVIEW_STATE_FILE } = require("../server/lib/reviewed-papers");

const out = path.join(__dirname, "..", "server", "data", "exports", "review-split");
fs.mkdirSync(out, { recursive: true });
const state = readJson(REVIEW_STATE_FILE, {});
const groups = { "reviewed-bank": [], "reviewed-drawing": [], "flagged": [], "reviewed-not-scorable": [], "unreviewed-bank": [] };
loadBank().questions.forEach((q) => {
  const r = state[q.id];
  if (!r || (!r.marked && !r.flagged)) groups["unreviewed-bank"].push(q);
  else if (r.flagged) groups["flagged"].push({ ...q, reviewState: r });
  else if (isPublishable(q, state)) groups["reviewed-bank"].push(q);
  else if (isDrawingReady(q, state)) groups["reviewed-drawing"].push(q);
  else groups["reviewed-not-scorable"].push({ ...q, reviewState: r });
});
Object.entries(groups).forEach(([name, questions]) => {
  fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: questions.length, questions }, null, 1));
  console.log(name + ": " + questions.length);
});
