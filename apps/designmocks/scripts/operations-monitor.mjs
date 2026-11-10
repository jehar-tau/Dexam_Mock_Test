import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { openOperationsProvider, operationsConfiguration, readOperationsHealth } from "./operations-sweep.mjs";

const alertWindowMs = 15 * 60 * 1000;
const loopback = new Set(["localhost", "127.0.0.1", "[::1]"]);
const verificationSchema = "dmocks-operations-alert-verification-v1";
const verificationIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

function alertDestination({ alertUrl, alertAllowOrigin, alertToken, key }, databaseOrigin) {
  if (!alertUrl && !alertAllowOrigin && !alertToken) return null;
  if (!alertUrl || !alertAllowOrigin || typeof alertToken !== "string"
    || !/^[A-Za-z0-9._~+/=-]{16,256}$/.test(alertToken) || alertToken === key || alertToken.startsWith("sb_secret_")) {
    throw new Error("An explicit alert destination and separate receiver token are required");
  }
  const target = new URL(alertUrl);
  if (target.protocol !== "https:" && !(target.protocol === "http:" && loopback.has(target.hostname))) {
    throw new Error("Alert destination must use HTTPS outside localhost");
  }
  if (target.username || target.password || target.search || target.hash || target.origin !== alertAllowOrigin
    || target.origin === databaseOrigin) throw new Error("Alert destination must match the approved separate origin");
  return { href: target.href, token: alertToken };
}

function alertFindings(health) {
  if (!health) return [{ code: "health_unavailable", severity: "P1" }];
  const { apiProfileReady, queues } = health;
  const findings = [];
  if (!apiProfileReady) findings.push({ code: "api_permissions_invalid", severity: "P1" });
  if (queues.unverifiedPasses) findings.push({ code: "unverified_active_passes", severity: "P1", count: queues.unverifiedPasses });
  if (queues.paymentReviews) findings.push({ code: "payments_need_review", severity: "P2", count: queues.paymentReviews });
  if (queues.stalePendingOrders) findings.push({ code: "stale_orders", severity: "P2", count: queues.stalePendingOrders });
  if (queues.staleAttempts) findings.push({ code: "stale_attempts", severity: "P2", count: queues.staleAttempts });
  if (!findings.length && health.status === "degraded") findings.push({ code: "health_degraded", severity: "P2" });
  return findings;
}

async function deliverAlert(destination, report, identity, fetchImpl) {
  const key = createHash("sha256").update(JSON.stringify(identity)).digest("hex");
  try {
    const response = await fetchImpl(destination.href, {
      method: "POST", redirect: "error", signal: AbortSignal.timeout(10000),
      headers: {
        authorization: `Bearer ${destination.token}`, "content-type": "application/json",
        "idempotency-key": key,
      },
      body: JSON.stringify(report),
    });
    await response.body?.cancel().catch(() => {});
    return response.ok;
  } catch {
    return false;
  }
}

export async function runOperationsMonitor(config, { fetchImpl = fetch, now = new Date(), verificationId } = {}) {
  const { origin, rpc, environment, expectedPaymentMode } = openOperationsProvider(config, {
    fetchImpl, acknowledgement: "CHECK_PAID_MVP_HEALTH_ON",
  });
  if (typeof config.releaseSha !== "string" || !/^[0-9a-f]{40}$/.test(config.releaseSha)) {
    throw new Error("A full verified release SHA is required");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new Error("Invalid operations clock");
  const destination = alertDestination(config, origin);
  if (verificationId !== undefined) {
    if (typeof verificationId !== "string" || !verificationIdPattern.test(verificationId)) {
      throw new Error("Use a UUID for the alert delivery check");
    }
    if (!destination) throw new Error("An approved alert receiver is required for the delivery check");
  }
  let health;
  try {
    health = await readOperationsHealth(rpc, { requireMonitor: true });
  } catch {
    // Provider diagnostics can contain credentials or data. Only the fixed finding leaves this process.
  }
  const paymentMode = health?.paymentMode ?? null;
  const mismatch = health && paymentMode !== expectedPaymentMode;
  const findings = mismatch ? [{ code: "payment_mode_mismatch", severity: "P1" }] : alertFindings(health);
  const status = !health || mismatch ? "unavailable" : findings.length ? "degraded" : health.status;
  const { releaseSha } = config;
  const checkedAt = now.toISOString();
  const report = {
    schema: "dmocks-operations-alert-v1", environment, paymentMode, expectedPaymentMode, releaseSha, checkedAt,
    status, queues: mismatch ? null : health?.queues ?? null, findings,
  };
  if (verificationId !== undefined) {
    if (findings.length) return { ...report, verificationId, delivery: "blocked" };
    const verification = { schema: verificationSchema, environment, paymentMode, releaseSha, checkedAt, verificationId };
    const accepted = await deliverAlert(destination, verification,
      [verificationSchema, origin, environment, paymentMode, releaseSha, verificationId], fetchImpl);
    return { ...report, verificationId, delivery: accepted ? "accepted" : "failed" };
  }
  if (!findings.length) return { ...report, delivery: "not_needed" };
  if (!destination) return { ...report, delivery: "unconfigured" };
  const accepted = await deliverAlert(destination, report, [
    origin, environment, paymentMode, releaseSha, findings.map(finding => finding.code),
    Math.floor(now.getTime() / alertWindowMs),
  ], fetchImpl);
  return { ...report, delivery: accepted ? "accepted" : "failed" };
}

async function main() {
  const env = process.env;
  const { values } = parseArgs({ options: { "verify-delivery": { type: "string" } } });
  const result = await runOperationsMonitor({
    ...operationsConfiguration(env), releaseSha: env.DMOCKS_OPERATIONS_RELEASE_SHA,
    alertUrl: env.DMOCKS_OPERATIONS_ALERT_URL, alertAllowOrigin: env.DMOCKS_OPERATIONS_ALERT_ALLOW_ORIGIN,
    alertToken: env.DMOCKS_OPERATIONS_ALERT_TOKEN,
  }, { verificationId: values["verify-delivery"] });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if (result.delivery === "failed" || result.delivery === "blocked") process.exitCode = 1;
  else if (result.findings.length) process.exitCode = 2;
}
if (import.meta.main ?? (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))) {
  main().catch(error => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
