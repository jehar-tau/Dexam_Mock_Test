#!/usr/bin/env node
// Splits the machine-readable bank into reviewed (publishable), flagged, and not-yet-reviewed files.
const fs = require("fs");
const path = require("path");
const { loadBank, isPublishable, readJson, REVIEW_STATE_FILE } = require("../server/lib/reviewed-papers");

const out = path.join(__dirname, "..", "server", "data", "exports", "review-split");
fs.mkdirSync(out, { recursive: true });
const state = readJson(REVIEW_STATE_FILE, {});
const groups = { "reviewed-bank": [], "flagged-or-unscorable": [], "unreviewed-bank": [] };
loadBank().questions.forEach((q) => {
  const r = state[q.id];
  if (!r || (!r.marked && !r.flagged)) groups["unreviewed-bank"].push(q);
  else if (isPublishable(q, state)) groups["reviewed-bank"].push(q);
  else groups["flagged-or-unscorable"].push({ ...q, reviewState: r });
});
Object.entries(groups).forEach(([name, questions]) => {
  fs.writeFileSync(path.join(out, name + ".json"), JSON.stringify({ generatedAt: new Date().toISOString(), count: questions.length, questions }, null, 1));
  console.log(name + ": " + questions.length);
});
