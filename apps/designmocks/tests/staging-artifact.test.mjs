import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { stagingArtifactProfile, verifyStagingArtifact } from "../scripts/staging-artifact.mjs";

const sha256 = value => createHash("sha256").update(value).digest("hex");
const project = {
  project_ref: "a".repeat(20),
  frontend_origin: "https://live.example.test",
  staging_frontend_origin: "https://stage.example.test",
};
const values = {
  frontendOrigin: project.staging_frontend_origin,
  providerOrigin: `https://${project.project_ref}.supabase.co`,
  publicKey: "sb_publishable_fictional_staging_key",
};
const jwt = (ref, role = "anon") => `fixture.${Buffer.from(JSON.stringify({ ref, role })).toString("base64url")}.fixture`;

test("the staging profile accepts only reviewed origins and public browser credentials", () => {
  const profile = stagingArtifactProfile(project, values);
  assert.deepEqual(profile, {
    deployment: "staging", backendProfile: "full-staging", frontendOrigin: values.frontendOrigin,
    providerOrigin: values.providerOrigin, publicKeySha256: sha256(values.publicKey),
    stagingPortalEnabled: true, postLaunchPreview: true, checkoutEnabled: false,
    releasedPortalEnabled: false, controlledLoginEnabled: false, phoneVerificationEnabled: false,
  });
  assert.equal(stagingArtifactProfile(project, { ...values, publicKey: jwt(project.project_ref) }).checkoutEnabled, false);
  assert.doesNotMatch(JSON.stringify(profile), /sb_publishable/);
  for (const publicKey of ["", "sb_secret_fictional_key", jwt(project.project_ref, "service_role"), jwt("b".repeat(20)), "sb_publishable_"]) {
    assert.throws(() => stagingArtifactProfile(project, { ...values, publicKey }), /publishable key or an anon key/);
  }
  for (const patch of [
    { frontendOrigin: project.frontend_origin },
    { frontendOrigin: values.frontendOrigin + "/" },
    { providerOrigin: "https://other.supabase.co" },
    { providerOrigin: values.providerOrigin + "?unexpected" },
  ]) assert.throws(() => stagingArtifactProfile(project, { ...values, ...patch }), /exact private staging/);
  assert.throws(() => stagingArtifactProfile({ ...project, frontend_origin: values.frontendOrigin }, values), /exact private staging/);
});

async function bundle(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "dmocks-staging-bundle-fixture-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const site = path.join(directory, "site");
  await mkdir(path.join(site, "assets"), { recursive: true });
  const original = { "assets/app.js": "console.log('fictional fixture');\n", "index.html": "<p>Private fixture</p>\n" };
  for (const [file, content] of Object.entries(original)) await writeFile(path.join(site, file), content);
  const source = { commit: "a".repeat(40), tree: "b".repeat(40), backendInventorySha256: "c".repeat(64) };
  const manifest = {
    schema: "dmocks-private-staging-artifact-v1", source,
    profile: stagingArtifactProfile(project, values),
    files: Object.entries(original).map(([path, content]) => ({ path, bytes: Buffer.byteLength(content), sha256: sha256(content) })),
  };
  const expected = sha256(JSON.stringify(manifest));
  const manifestPath = path.join(directory, "manifest.json");
  await writeFile(manifestPath, JSON.stringify({ ...manifest, bundleSha256: expected }));
  return { directory, expected, site, source, manifest, manifestPath, original };
}

test("artifact verification pins the reviewed digest and all stored site bytes", async t => {
  const artifact = await bundle(t);
  assert.deepEqual(await verifyStagingArtifact(artifact), {
    verified: true, commit: artifact.source.commit, tree: artifact.source.tree, bundleSha256: artifact.expected, fileCount: 2,
  });
  await assert.rejects(verifyStagingArtifact({ ...artifact, expected: "d".repeat(64) }), /reviewed manifest hash/);
  await writeFile(artifact.manifestPath, JSON.stringify({
    ...artifact.manifest, source: { ...artifact.source, tree: "e".repeat(40) }, bundleSha256: artifact.expected,
  }));
  await assert.rejects(verifyStagingArtifact(artifact), /reviewed manifest hash/);
});

test("artifact verification rejects altered, extra, missing and symlink assets", async t => {
  const artifact = await bundle(t);
  const script = path.join(artifact.site, "assets/app.js");
  await writeFile(script, "altered\n");
  await assert.rejects(verifyStagingArtifact(artifact), /site files differ/);
  await writeFile(script, artifact.original["assets/app.js"]);
  await writeFile(path.join(artifact.site, "assets/extra.js"), "");
  await assert.rejects(verifyStagingArtifact(artifact), /site files differ/);
  await rm(path.join(artifact.site, "assets/extra.js"));
  await rm(script);
  await assert.rejects(verifyStagingArtifact(artifact), /site files differ/);
  await symlink(path.join(artifact.site, "index.html"), script);
  await assert.rejects(verifyStagingArtifact(artifact), /non-regular file/);
});
