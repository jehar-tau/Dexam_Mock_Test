import assert from "node:assert/strict";
import test from "node:test";
import {checkPrivateStorage} from "../scripts/check-private-storage.mjs";

const token = "fixture." + Buffer.from('{"role":"authenticated"}').toString("base64url") + ".signature";
const config = {origin: "http://127.0.0.1:63021", key: "sb_publishable_fixture", serviceKey: "sb_secret_fixture_server", token,
  fixture: "dmocks-storage-probe/00000000-0000-4000-8000-000000000001.png"};

const listedFixture = () => Response.json([{name: config.fixture.split("/")[1]}]);

test("checks every bucket for unsigned reads, direct signing and listing", async () => {
  let count = 0;
  const report = await checkPrivateStorage({...config, fetchImpl: async (url, request) => {
    if (url.endsWith("/auth/v1/user")) return new Response(null, {status: 200});
    if (new Headers(request.headers).get("apikey") === config.serviceKey) {
      assert.equal(request.headers.has("authorization"), false);
      if (url.includes("/object/list/")) return listedFixture();
      assert.equal(request.method, url.includes("/object/sign/") ? "POST" : "HEAD");
      return new Response(null, {status: 200});
    }
    count++;
    assert.ok(url.startsWith(config.origin + "/storage/v1/object/"));
    assert.equal(request.redirect, "error");
    if (url.includes("/object/list/")) {
      assert.equal(request.method, "POST");
      assert.deepEqual(JSON.parse(request.body), {prefix: "dmocks-storage-probe", search: config.fixture.split("/")[1], limit: 1});
      return Response.json([]);
    }
    if (url.includes("/object/sign/")) {
      assert.equal(request.method, "POST");
      assert.deepEqual(JSON.parse(request.body), {expiresIn: 60});
      assert.ok([undefined, "Bearer " + token].includes(request.headers.Authorization));
    } else {
      assert.equal(request.method, "HEAD");
      assert.equal(request.headers.Authorization, url.includes("/object/authenticated/") ? "Bearer " + token : undefined);
    }
    return new Response(null, {status: 404});
  }});
  assert.equal(count, 28);
  assert.ok(report.results.every(bucket => bucket.results.some(result => result.access === "signed-in-signing" && result.denied)));
  assert.equal(report.passed, true);
  assert.ok(!JSON.stringify(report).includes(token));
  assert.ok(!JSON.stringify(report).includes(config.fixture));
});

test("exposure and provider failure both fail the probe", async () => {
  for (const status of [200, 503]) {
    const report = await checkPrivateStorage({...config, fetchImpl: async (url, request) => new Response(null, {status: url.endsWith("/auth/v1/user") || new Headers(request.headers).get("apikey") === config.serviceKey ? 200 : status})});
    assert.equal(report.passed, false);
  }
});

test("rejects unrelated hosts, arbitrary object paths and service credentials", async () => {
  for (const change of [{origin: "https://dmocks.com"}, {fixture: "drawings/actual.png"}, {key: "sb_secret_fixture"}]) {
    await assert.rejects(checkPrivateStorage({...config, ...change, fetchImpl: async () => assert.fail("Unexpected request")}));
  }
});

test("a missing control object cannot produce a passing denial report", async () => {
  const report = await checkPrivateStorage({...config, fetchImpl: async url =>
    new Response(null, {status: url.endsWith("/auth/v1/user") ? 200 : 404})});
  assert.equal(report.passed, false);
  assert.ok(report.results.every(bucket => !bucket.verified && bucket.results.length === 0));
});

test("legacy server tokens still authenticate fixture checks while foreign tokens fail before dispatch", async () => {
  const legacyKey = claims => "fixture." + Buffer.from(JSON.stringify(claims)).toString("base64url") + ".signature";
  const key = legacyKey({role: "service_role"});
  let fixtureChecks = 0;
  const report = await checkPrivateStorage({...config, serviceKey: key, fetchImpl: async (url, request) => {
    if (url.endsWith("/auth/v1/user")) return new Response(null, {status: 200});
    const headers = new Headers(request.headers);
    if (headers.get("apikey") !== key) return new Response(null, {status: 404});
    assert.equal(headers.get("authorization"), "Bearer " + key);
    if (url.includes("/object/list/")) return listedFixture();
    if (request.method === "HEAD") fixtureChecks++;
    return new Response(null, {status: 200});
  }});
  assert.equal(report.passed, true);
  assert.equal(fixtureChecks, 4);
  await assert.rejects(checkPrivateStorage({...config, serviceKey: legacyKey({role: "service_role", ref: "x".repeat(20)}),
    fetchImpl: async () => assert.fail("Unexpected request")}), /different provider project/);
});

test("a direct signing grant fails even when unsigned reads are denied", async () => {
  const report = await checkPrivateStorage({...config, fetchImpl: async (url, request) => {
    if (url.endsWith("/auth/v1/user") || new Headers(request.headers).get("apikey") === config.serviceKey) {
      return url.includes("/object/list/") ? listedFixture() : new Response(null, {status: 200});
    }
    if (url.includes("/object/sign/") && request.headers.Authorization) {
      return Response.json({signedURL: "/private?token=fictional-signature"});
    }
    return new Response(null, {status: 404});
  }});
  assert.equal(report.passed, false);
  assert.ok(report.results.every(bucket =>
    bucket.results.filter(result => !result.denied).map(result => result.access).join() === "signed-in-signing"));
  assert.doesNotMatch(JSON.stringify(report), /fictional-signature/);
});

test("listing must find the exact fixture with the server key and hide it from browser roles", async () => {
  for (const controlPresent of [false, true]) {
    const report = await checkPrivateStorage({...config, fetchImpl: async (url, request) => {
      const service = new Headers(request.headers).get("apikey") === config.serviceKey;
      if (!url.includes("/object/list/")) return new Response(null, {status: service || url.endsWith("/auth/v1/user") ? 200 : 404});
      if (service) return controlPresent ? listedFixture() : Response.json([{name: "unrelated.png"}]);
      return request.headers.Authorization ? listedFixture() : Response.json([]);
    }});
    assert.equal(report.passed, false);
    assert.ok(report.results.every(bucket => bucket.listingVerified === controlPresent));
    assert.ok(report.results.every(bucket => !bucket.results.find(row => row.access === "signed-in-listing").denied));
    assert.ok(!JSON.stringify(report).includes(config.fixture.split("/")[1]));
  }
});

test("a missing signing route cannot count as a denial", async () => {
  const report = await checkPrivateStorage({...config, fetchImpl: async (url, request) => {
    if (url.includes("/object/sign/")) return new Response(null, {status: 404});
    if (new Headers(request.headers).get("apikey") === config.serviceKey) {
      return url.includes("/object/list/") ? listedFixture() : new Response(null, {status: 200});
    }
    return new Response(null, {status: url.endsWith("/auth/v1/user") ? 200 : 404});
  }});
  assert.equal(report.passed, false);
  assert.ok(report.results.every(bucket => !bucket.signingVerified && bucket.listingVerified));
});
