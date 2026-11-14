import assert from "node:assert/strict";
import test from "node:test";
import {recoverStagingQuestionJobs} from "../scripts/recover-question-jobs.mjs";
import project from "../supabase/project.json" with {type: "json"};

const origin = `https://${project.project_ref}.supabase.co`;
const config = {url: origin, allowOrigin: origin, environment: "staging", key: "sb_secret_fictional"};
const health = {
  scope: "paid-mvp-v1", apiProfileReady: false, monitorVersion: 1, paymentMode: "test",
  checkedAt: "2026-11-14T02:00:00Z", status: "attention", unverifiedPasses: 0,
  staleAttempts: 0, expiredAttempts: 0, stalePendingOrders: 0, paymentReviews: 0,
  openBugs: 0, pendingQuestionReports: 0,
};

function fixture(...responses) {
  const calls = [];
  return {calls, fetchImpl: async (url, options) => {
    assert.ok(url.startsWith(origin + "/rest/v1/rpc/"));
    calls.push([url.split("/").at(-1), JSON.parse(options.body)]);
    return Response.json(responses.shift());
  }};
}

test("staging recovery works with private portal grants and reports only bounded counts", async () => {
  const f = fixture(health, {intake: 100, aiDrafts: 2, private: "omitted"});
  assert.deepEqual(await recoverStagingQuestionJobs(config, f), {
    scope: "staging-question-job-recovery", intake: 100, aiDrafts: 2, limitReached: true,
  });
  assert.deepEqual(f.calls, [["admin_operational_health", {}], ["recover_expired_question_jobs", {p_limit: 100}]]);
});

test("recovery refuses wrong targets and Live or unverified health before any write", async () => {
  for (const target of [{...config, environment: "production"}, {...config, url: "https://wrong.example"}]) {
    const f = fixture();
    await assert.rejects(recoverStagingQuestionJobs(target, f), /designated private/);
    assert.deepEqual(f.calls, []);
  }
  for (const report of [{...health, paymentMode: "live"}, {}]) {
    const f = fixture(report);
    await assert.rejects(recoverStagingQuestionJobs(config, f), /Test mode|not verified/);
    assert.deepEqual(f.calls, [["admin_operational_health", {}]]);
  }
});

test("recovery rejects impossible or missing counts", async () => {
  for (const result of [null, {intake: 101, aiDrafts: 0}, {intake: 0, aiDrafts: "1"}]) {
    await assert.rejects(recoverStagingQuestionJobs(config, fixture(health, result)), /recovery counts/);
  }
});
