import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { promisify } from "node:util";
import project from "../supabase/project.json" with { type: "json" };

export function reviewStagingGoogleRedirect(report) {
  if (report?.dry_run !== true || report.wrote !== false ||
      report.target?.kind !== "linked" || report.target.project_ref !== project.project_ref ||
      !Array.isArray(report.changes)) {
    throw new Error("Expected a read-only config report for the reviewed staging project");
  }
  const fields = ["auth.additional_redirect_urls", "auth.external.google.enabled"];
  const values = fields.map(field => {
    const entries = report.changes.filter(change => Array.isArray(change?.path) && change.path.join(".") === field);
    if (entries.length !== 1) throw new Error("The provider did not identify the staging Google redirect settings");
    return entries[0].remote;
  });
  const [redirects, googleEnabled] = values;
  if (!Array.isArray(redirects) || !redirects.every(url => typeof url === "string") ||
      typeof googleEnabled !== "boolean") {
    throw new Error("The staging Google redirect settings were malformed");
  }
  const callback = new URL("/account/callback", project.staging_frontend_origin).href;
  const callbackAllowed = redirects.includes(callback);
  return {
    projectRef: project.project_ref, callback, googleEnabled, callbackAllowed,
    passed: googleEnabled && callbackAllowed,
  };
}

async function readStagingConfig() {
  const directory = await mkdtemp(join(tmpdir(), "dmocks-auth-read-"));
  try {
    const supabase = join(directory, "supabase");
    await mkdir(supabase, { mode: 0o700 });
    // A minimal local config lets config pull report both remote Auth fields.
    await writeFile(join(supabase, "config.toml"), 'project_id = "dmocks-staging-auth-inspection"\n', { mode: 0o600 });
    const { stdout } = await promisify(execFile)("supabase", [
      "config", "pull", "--dry-run", `--remote=${project.project_ref}`,
      "--output-format", "json", "--workdir", directory,
    ], { timeout: 30000, maxBuffer: 1024 * 1024 });
    return JSON.parse(stdout);
  } catch {
    // Provider output can include unrelated configuration. Do not print it.
    throw new Error("Could not read staging Auth settings using the authenticated Supabase CLI");
  } finally {
    await rm(directory, { recursive: true });
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  try {
    if (process.argv.length !== 2) throw new Error("Run the staging Google redirect check without arguments");
    const report = reviewStagingGoogleRedirect(await readStagingConfig());
    console.log(JSON.stringify(report, null, 2));
    if (!report.passed) process.exitCode = 2;
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
