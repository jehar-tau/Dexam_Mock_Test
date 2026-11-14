import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {pathToFileURL} from "node:url";

const digest = /^[a-f0-9]{64}$/;
const roles = ["anon", "authenticated", "service", "auth_hook"];

function readInventory(inventory) {
  assert.ok([1, 2].includes(inventory?.version) && Array.isArray(inventory.functions)
    && inventory.functions.length > 0, "Use a complete staging RPC inventory");
  const entries = new Map();
  for (const row of inventory.functions) {
    assert.ok(typeof row?.signature === "string" && row.signature.startsWith("public.")
      && (inventory.version === 1 || typeof row.definition_sha256 === "string" && digest.test(row.definition_sha256))
      && roles.every(role => typeof row[role] === "boolean") && !entries.has(row.signature),
    "Invalid or duplicate staging RPC signature");
    entries.set(row.signature, row);
  }
  return entries;
}

export function compareStagingRpcs(source, staging) {
  assert.equal(source?.version, staging?.version, "Use the same staging RPC inventory version for both targets");
  const compareDefinitions = source?.version === 2;
  const expected = readInventory(source);
  const actual = readInventory(staging);
  const missingFunctions = [];
  const extraFunctions = [];
  const missingGrants = [];
  const extraGrants = [];
  const changedDefinitions = [];
  for (const signature of [...new Set([...expected.keys(), ...actual.keys()])].sort()) {
    const before = expected.get(signature);
    const after = actual.get(signature);
    if (!before) extraFunctions.push(signature);
    if (!after) missingFunctions.push(signature);
    if (compareDefinitions && before && after && before.definition_sha256 !== after.definition_sha256) {
      changedDefinitions.push(signature);
    }
    for (const role of roles) {
      if (before?.[role] && !after?.[role]) missingGrants.push({signature, role});
      if (after?.[role] && !before?.[role]) extraGrants.push({signature, role});
    }
  }
  return {
    scope: compareDefinitions ? "public-rpc-definitions-and-grants" : "public-rpc-grants-only",
    ...(compareDefinitions ? {changedDefinitions} : {}),
    matchesMigrationBaseline: ![missingFunctions, extraFunctions, missingGrants, extraGrants, changedDefinitions].some(rows => rows.length),
    expectedFunctionCount: expected.size,
    observedFunctionCount: actual.size,
    missingFunctions, extraFunctions, missingGrants, extraGrants,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const [source, staging] = process.argv.slice(2);
    assert.ok(source && staging && process.argv.length === 4,
      "Usage: node scripts/compare-staging-rpcs.mjs SOURCE.json STAGING.json");
    const report = compareStagingRpcs(JSON.parse(await readFile(source, "utf8")), JSON.parse(await readFile(staging, "utf8")));
    console.log(JSON.stringify(report, null, 2));
    if (!report.matchesMigrationBaseline) process.exitCode = 2;
  } catch {
    console.error("Compare two complete staging RPC inventories: source JSON followed by staging JSON.");
    process.exitCode = 1;
  }
}
