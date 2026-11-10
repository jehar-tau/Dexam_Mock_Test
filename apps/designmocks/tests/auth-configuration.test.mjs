import test from "node:test";
import assert from "node:assert/strict";
import { resolveAuthConfiguration, authCallbackMessage } from "../src/authConfiguration.mjs";

const base = { deployment: "staging", url: "https://fixture-project.supabase.co", key: "sb_publishable_fictional_fixture" };
const closed = { authReady: false, portalReady: false, testLoginMode: false, stagingPortalMode: false, checkoutReady: false };
test("closed defaults do not instantiate authentication or paid access", () => {
  assert.deepEqual(resolveAuthConfiguration({ deployment: "production" }), closed);
});
test("controlled login works without accepting draft purchase terms", () => {
  assert.deepEqual(resolveAuthConfiguration({ ...base, testLoginEnabled: true }), { ...closed, authReady: true, testLoginMode: true });
});
test("test login cannot become a production release or coincide with paid portal release", () => {
  assert.throws(() => resolveAuthConfiguration({ ...base, deployment: "production", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, mode: "production", deployment: "development", testLoginEnabled: true }));
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true, testLoginEnabled: true, termsVersion: "fixture" }));
  assert.throws(() => resolveAuthConfiguration({ ...base, deployment: "production", portalEnabled: true }));
  assert.deepEqual(resolveAuthConfiguration({ ...base, deployment: "production", portalEnabled: true, termsVersion: "fixture" }), {
    ...closed, authReady: true, portalReady: true, checkoutReady: false,
  });
});
test("opening checkout requires its separate explicit switch and a matching customer notice revision",()=>{
 const version='fictional-approved-terms';
 const input={...base,deployment:'production',portalEnabled:true,termsVersion:version,noticeVersion:version};
 for(const checkoutEnabled of[undefined,false,'true',1])assert.equal(resolveAuthConfiguration({...input,checkoutEnabled}).checkoutReady,false);
 assert.equal(resolveAuthConfiguration({...input,checkoutEnabled:true}).checkoutReady,true);
 for (const noticeVersion of [undefined, null, "earlier-version"]) {
  const configuration=resolveAuthConfiguration({...input,checkoutEnabled:true,noticeVersion});
  assert.equal(configuration.checkoutReady,false);
  assert.equal(configuration.portalReady,true);
 }
 assert.equal(resolveAuthConfiguration({...base,testLoginEnabled:true,checkoutEnabled:true}).checkoutReady,false);
 assert.equal(resolveAuthConfiguration({deployment:'production',checkoutEnabled:true}).checkoutReady,false);
});
test("the private staging portal pins the build, browser origin and backend with checkout closed", () => {
  const stagingTarget = { url: base.url, origin: "https://approved-staging.example" };
  const input = { ...base, mode: "staging", origin: stagingTarget.origin, stagingTarget, stagingPortalEnabled: true };
  assert.deepEqual(resolveAuthConfiguration(input), { ...closed, authReady: true, portalReady: true, stagingPortalMode: true });
  for (const origin of ["https://dmocks.com", "https://approved-staging.example.invalid", "http://127.0.0.1:4190"]) {
    assert.deepEqual(resolveAuthConfiguration({ ...input, origin }), closed);
  }
  for (const replacement of [{ mode: "production" }, { deployment: "production" }, { deployment: "test" }, { url: "https://other-project.supabase.co" },
    { key: "sb_secret_fixture" }, { testLoginEnabled: true }, { portalEnabled: true }]) {
    assert.throws(() => resolveAuthConfiguration({ ...input, ...replacement }));
  }
  assert.throws(() => resolveAuthConfiguration({ ...base, portalEnabled: true, termsVersion: "fixture" }), /private staging/);
  assert.throws(() => resolveAuthConfiguration({ ...base, url: base.url.toUpperCase(), deployment: "production", portalEnabled: true,
    termsVersion: "fixture", stagingTarget }), /separate Supabase/);
});
const checkoutOrigin = "https://merchant-test.example";
const checkoutNoticeVersion = "dmocks-notices-v1-" + "a".repeat(64);
const packagedCheckout = {
  ...base, mode: "test", deployment: "test", checkoutTarget: { url: base.url, origin: checkoutOrigin },
  origin: checkoutOrigin, portalEnabled: true, checkoutEnabled: true,
  termsVersion: checkoutNoticeVersion, noticeVersion: checkoutNoticeVersion,
};
const checkoutReady = { ...closed, authReady: true, portalReady: true, checkoutReady: true };

test("the private checkout build opens only on the exact approved origin", () => {
  assert.deepEqual(resolveAuthConfiguration(packagedCheckout), checkoutReady);
  for (const origin of [undefined, "http://127.0.0.1:4190", "https://merchant-test.example.invalid"]) {
    assert.deepEqual(resolveAuthConfiguration({ ...packagedCheckout, origin, key: "sb_secret_fictional" }), closed);
  }
});

test("packaged checkout rejects a mismatched build, backend or published notice", () => {
  for (const patch of [
    { mode: "production" },
    { deployment: "production" },
    { url: "https://other-project.supabase.co" },
    { checkoutTarget: undefined },
    { noticeVersion: undefined },
    { noticeVersion: "dmocks-notices-v1-" + "b".repeat(64) },
    { noticeVersion: "unversioned", termsVersion: "unversioned" },
  ]) assert.throws(() => resolveAuthConfiguration({ ...packagedCheckout, ...patch }), JSON.stringify(patch));
});

test("the Vite development Test checkout fixture remains available", () => {
  assert.deepEqual(resolveAuthConfiguration({
    ...packagedCheckout, mode: "development", checkoutTarget: undefined, origin: "http://127.0.0.1:4190",
    termsVersion: "fictional-dev-notice", noticeVersion: "fictional-dev-notice",
  }), checkoutReady);
});

test("browser authentication rejects server keys, invalid projects and missing configuration", () => {
  for (const replacement of [{key: "sb_secret_fictional"}, {key: ""}, {url: "https://invalid.example"}, {key: "invalid-client-key"}, {key: "a."+Buffer.from(JSON.stringify({role:"service_role"})).toString("base64url")+".c"}]) {
    assert.throws(() => resolveAuthConfiguration({ ...base, ...replacement, testLoginEnabled: true }));
  }
  const anon = "a."+Buffer.from(JSON.stringify({role:"anon"})).toString("base64url")+".c";
  assert.equal(resolveAuthConfiguration({ ...base, key: anon, testLoginEnabled: true }).authReady, true);
});
test("callback failure and cancellation display safe messages, never provider parameters", () => {
  assert.match(authCallbackMessage("?error=access_denied&error_description=private-value"), /cancelled/);
  assert.match(authCallbackMessage("", "#error=server_error&error_description=private-value"), /could not be completed/);
  assert.equal(authCallbackMessage("?code=private-value"), "");
  assert.ok(!authCallbackMessage("?error=other&error_description=private-value").includes("private-value"));
});
