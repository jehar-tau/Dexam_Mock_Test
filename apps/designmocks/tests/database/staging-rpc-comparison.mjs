import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {compareStagingRpcs} from "../../scripts/compare-staging-rpcs.mjs";

const [source, paid] = await Promise.all(process.argv.slice(2).map(async file => JSON.parse(await readFile(file, "utf8"))));
assert.equal(source.version, 2);
assert.ok(source.functions.every(row => /^[a-f0-9]{64}$/.test(row.definition_sha256)));
assert.equal(compareStagingRpcs(source, source).matchesMigrationBaseline, true);
const difference = compareStagingRpcs(source, paid);
assert.equal(difference.matchesMigrationBaseline, false);
assert.ok(difference.changedDefinitions.includes("public.prepare_order()"));
assert.ok(difference.changedDefinitions.includes("public.start_attempt(uuid)"));
assert.ok(!difference.changedDefinitions.includes("public.read_attempt(uuid)"));
assert.ok(difference.missingGrants.some(({signature, role}) => signature === "public.public_all_india_top_ten()" && role === "anon"));
assert.ok(difference.missingGrants.some(({signature, role}) => signature === "public.learning_catalog()" && role === "authenticated"));
assert.ok(!difference.missingGrants.some(({signature, role}) => signature === "public.before_designmocks_user_created(jsonb)" && role === "auth_hook"));
assert.ok(!difference.extraGrants.some(({role}) => role === "anon"));
console.log("PASS: actual PostgreSQL inventory distinguishes staging portal grants from the paid MVP profile.");
