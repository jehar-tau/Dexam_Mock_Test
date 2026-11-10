import { fileURLToPath } from "node:url";
import { realpathSync } from "node:fs";
import { parseArgs } from "node:util";
import { openPrivateDMocksTransport } from "./private-bank-provider.mjs";
import { finishDrawingRemoval, isDrawingRemovalPath } from "../supabase/functions/_shared/drawing-removal.mjs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;

export async function runDrawingRemovalCleanup(config, { apply = false, limit = 25, fetchImpl = fetch } = {}) {
  if (!["development", "staging"].includes(config.environment)) throw new Error("Use an approved nonproduction drawing cleanup target");
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new Error("Choose a drawing cleanup limit from 1 to 50");
  const provider = openPrivateDMocksTransport(config, { fetchImpl, requestLabel: "Drawing cleanup", timeoutMs: 5000 });
  if (apply && config.environment === "staging" && config.stagingAck !== `PURGE_REMOVED_DRAWINGS_ON_${provider.origin}`) {
    throw new Error("Exact staging acknowledgement is required for drawing cleanup");
  }
  const rows = await provider.rpc("service_pending_drawing_removals", { p_limit: limit });
  if (!Array.isArray(rows) || rows.length > limit || rows.some(row => !uuid.test(row?.id ?? "") || !isDrawingRemovalPath(row.storagePath)) ||
    new Set(rows.map(row => row.id)).size !== rows.length || new Set(rows.map(row => row.storagePath)).size !== rows.length) {
    throw new Error("The pending drawing removal batch could not be verified");
  }
  const summary = { mode: apply ? "cleanup" : "dry-run", selected: rows.length, confirmed: 0, pending: rows.length, limitReached: rows.length === limit };
  if (!apply) return summary;
  const remove = async storagePath => {
    const response = await provider.fetch(`${provider.origin}/storage/v1/object/drawing-submissions`, {
      method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ prefixes: [storagePath] }),
    });
    await response.body?.cancel();
  };
  const confirm = (id, storagePath) => provider.rpc("service_confirm_drawing_removal", { p_id: id, p_storage_path: storagePath });
  for (const row of rows) {
    if (await finishDrawingRemoval({ ...row, remove, confirm })) summary.confirmed += 1;
  }
  summary.pending -= summary.confirmed;
  return summary;
}

async function main() {
  const { values } = parseArgs({ options: { apply: { type: "boolean" }, limit: { type: "string" } } });
  const result = await runDrawingRemovalCleanup({
    url: process.env.DMOCKS_SUPABASE_URL, serviceRoleKey: process.env.DMOCKS_SUPABASE_SERVICE_ROLE_KEY,
    allowOrigin: process.env.DMOCKS_DRAWING_CLEANUP_ALLOW_ORIGIN, environment: process.env.DMOCKS_DRAWING_CLEANUP_ENVIRONMENT,
    stagingAck: process.env.DMOCKS_DRAWING_CLEANUP_STAGING_ACK,
  }, { apply: values.apply, limit: Number(values.limit ?? 25) });
  console.log(JSON.stringify(result));
  if (values.apply && result.pending) process.exitCode = 2;
}

if (process.argv[1] && realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url))) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
