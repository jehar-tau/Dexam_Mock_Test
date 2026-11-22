import test from "node:test";
import assert from "node:assert/strict";
import { controlledMediaOrigin } from "../supabase/functions/_shared/controlled-media-origin.mjs";

const base = { portalOrigin: "https://private-staging.example", checkoutOrigin: null,
  configuredPublicOrigin: "https://dmocks.com", stagingTesterRequired: "true" };

test("controlled public media requires the exact domain and tester guard", () => {
  assert.equal(controlledMediaOrigin({ ...base, requestedOrigin: base.portalOrigin }), base.portalOrigin);
  assert.equal(controlledMediaOrigin({ ...base, requestedOrigin: "https://dmocks.com" }), "https://dmocks.com");
  for (const patch of [{ requestedOrigin: "https://www.dmocks.com" },
    { requestedOrigin: "https://dmocks.com.example.invalid" },
    { requestedOrigin: "https://dmocks.com", configuredPublicOrigin: undefined },
    { requestedOrigin: "https://dmocks.com", configuredPublicOrigin: "https://www.dmocks.com" },
    { requestedOrigin: "https://dmocks.com", stagingTesterRequired: "false" },
    { requestedOrigin: null }])
    assert.equal(controlledMediaOrigin({ ...base, ...patch }), null);
});

test("the existing explicit checkout origin remains independent", () => {
  assert.equal(controlledMediaOrigin({ ...base, requestedOrigin: "https://checkout.example",
    checkoutOrigin: "https://checkout.example", stagingTesterRequired: "false" }), "https://checkout.example");
});
