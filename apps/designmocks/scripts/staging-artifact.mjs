import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, realpathSync } from "node:fs";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { runPreflight, verifyTrackedFiles } from "./release-source-preflight.mjs";
import { compilePublishedNotices } from "./published-notices.mjs";
import { publishedNoticeVersionPattern } from "../src/authConfiguration.mjs";

const appPath = "apps/designmocks";
const stagingSchema = "dmocks-private-staging-artifact-v1";
const checkoutSchema = "dmocks-private-checkout-artifact-v1";
const gitIdPattern = /^[0-9a-f]{40}$/;
const digestPattern = /^[0-9a-f]{64}$/;
const sha256 = value => createHash("sha256").update(value).digest("hex");
const hashManifest = value => sha256(JSON.stringify(value));
const buildEnvironment = () => ({ PATH: process.env.PATH, TMPDIR: tmpdir(), TZ: "UTC", LC_ALL: "C" });

function exactHttpsOrigin(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.origin === value;
  } catch {
    return false;
  }
}

function isPublicKey(key, projectRef) {
  if (typeof key !== "string") return false;
  if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
  try {
    const claims = JSON.parse(Buffer.from(key.split(".")[1], "base64url"));
    return claims.role === "anon" && claims.ref === projectRef;
  } catch {
    return false;
  }
}

export function stagingArtifactProfile(project, { frontendOrigin, providerOrigin, publicKey, paidPilot = false }) {
  if (!/^[a-z0-9]{20}$/.test(project?.project_ref ?? "") || !exactHttpsOrigin(frontendOrigin) ||
      !exactHttpsOrigin(project.frontend_origin) || frontendOrigin !== project.staging_frontend_origin ||
      frontendOrigin === project.frontend_origin || frontendOrigin === providerOrigin ||
      providerOrigin !== `https://${project.project_ref}.supabase.co`) {
    throw new Error("Use the exact private staging and provider origins in the reviewed DMocks project");
  }
  if (!isPublicKey(publicKey, project.project_ref)) {
    throw new Error("Supply a publishable key or an anon key for the designated staging project");
  }
  return {
    deployment: "staging", backendProfile: paidPilot ? "paid-mvp" : "full-staging", frontendOrigin, providerOrigin, publicKeySha256: sha256(publicKey),
    stagingPortalEnabled: true, postLaunchPreview: !paidPilot, checkoutEnabled: false,
    releasedPortalEnabled: false, controlledLoginEnabled: false, phoneVerificationEnabled: false,
  };
}

export function checkoutArtifactProfile(project, { frontendOrigin, providerOrigin, publicKey, noticeVersion }) {
  if (!/^[a-z0-9]{20}$/.test(project?.project_ref ?? "") || !exactHttpsOrigin(frontendOrigin) ||
      frontendOrigin !== project.frontend_origin || frontendOrigin === project.staging_frontend_origin ||
      frontendOrigin === providerOrigin || providerOrigin !== `https://${project.project_ref}.supabase.co`) {
    throw new Error("Use the exact Test checkout and provider origins in the reviewed DMocks project");
  }
  if (!isPublicKey(publicKey, project.project_ref)) {
    throw new Error("Supply a publishable key or an anon key for the designated Test project");
  }
  if (typeof noticeVersion !== "string" || !publishedNoticeVersionPattern.test(noticeVersion)) {
    throw new Error("Supply the reviewed customer notice version for Test checkout");
  }
  return {
    deployment: "test", backendProfile: "paid-mvp", frontendOrigin, providerOrigin, publicKeySha256: sha256(publicKey),
    stagingPortalEnabled: false, postLaunchPreview: false, checkoutEnabled: true,
    releasedPortalEnabled: true, controlledLoginEnabled: false, phoneVerificationEnabled: false, noticeVersion,
  };
}

async function checkoutNoticeInput(noticesPath, expectedVersion) {
  if (typeof noticesPath !== "string" || !path.isAbsolute(noticesPath) ||
      typeof expectedVersion !== "string" || !publishedNoticeVersionPattern.test(expectedVersion)) {
    throw new Error("Supply an absolute customer notice file and its reviewed version");
  }
  const info = await lstat(noticesPath);
  if (!info.isFile() || info.size > 65_536) throw new Error("Use a readable reviewed customer notice file");
  const bytes = await readFile(noticesPath);
  let notices;
  try {
    notices = compilePublishedNotices(JSON.parse(bytes.toString("utf8")));
  } catch {
    throw new Error("The Test checkout artifact requires a reviewed release notice bundle");
  }
  if (notices.version !== expectedVersion) throw new Error("The customer notice does not match its reviewed version");
  return { bytes, version: notices.version };
}

function run(command, args, { cwd, env, input, encoding = "utf8", failure, timeout = 60000 }) {
  const result = spawnSync(command, args, { cwd, env, input, encoding, timeout, maxBuffer: 64 * 1024 * 1024 });
  if (result.error || result.status !== 0) throw new Error(failure);
  return result.stdout;
}

async function outputDirectory(output, env) {
  if (typeof output !== "string" || !path.isAbsolute(output) || !path.basename(output)) {
    throw new Error("Choose a new absolute artifact directory");
  }
  const target = path.join(await realpath(path.dirname(output)), path.basename(output));
  const parent = path.dirname(target);
  if (spawnSync("git", ["rev-parse", "--git-dir"], { cwd: parent, env, stdio: "ignore" }).status === 0) {
    throw new Error("The artifact directory must be outside Git worktrees");
  }
  if (existsSync(target)) throw new Error("The artifact directory already exists");
  return target;
}

async function siteFiles(directory) {
  const files = [];
  async function visit(relative) {
    const absolute = path.join(directory, relative);
    const info = await lstat(absolute);
    if (info.isDirectory()) {
      for (const name of await readdir(absolute)) await visit(path.join(relative, name));
    } else {
      if (!info.isFile()) throw new Error("The artifact contains a non-regular file");
      const bytes = await readFile(absolute);
      files.push({ path: relative.split(path.sep).join("/"), bytes: bytes.length, sha256: sha256(bytes) });
    }
  }
  if (!(await lstat(directory)).isDirectory()) throw new Error("The artifact site must be a regular directory");
  await visit("");
  files.sort((first, second) => first.path < second.path ? -1 : first.path > second.path ? 1 : 0);
  if (!files.some(file => file.path === "index.html" && file.bytes > 0)) throw new Error("The artifact is missing its application entry page");
  return files;
}

async function verifyArtifact({ directory, expected }, schema) {
  if (!digestPattern.test(expected ?? "")) throw new Error("Supply the reviewed full SHA-256 of the artifact");
  if (!(await lstat(directory)).isDirectory() || (await readdir(directory)).sort().join(",") !== "manifest.json,site") {
    throw new Error("The artifact directory must contain exactly manifest.json and site");
  }
  const manifestPath = path.join(directory, "manifest.json");
  if (!(await lstat(manifestPath)).isFile()) throw new Error("The artifact manifest must be a regular file");
  const { bundleSha256, ...manifest } = JSON.parse(await readFile(manifestPath, "utf8"));
  if (manifest.schema !== schema || !gitIdPattern.test(manifest.source?.commit ?? "") ||
      !gitIdPattern.test(manifest.source?.tree ?? "") || bundleSha256 !== expected || hashManifest(manifest) !== expected) {
    throw new Error("The artifact does not match the reviewed manifest hash");
  }
  const files = await siteFiles(path.join(directory, "site"));
  if (JSON.stringify(files) !== JSON.stringify(manifest.files)) throw new Error("The artifact site files differ from the reviewed manifest");
  return { verified: true, commit: manifest.source.commit, tree: manifest.source.tree, bundleSha256, fileCount: files.length };
}

export function verifyStagingArtifact(options) { return verifyArtifact(options, stagingSchema); }
export function verifyCheckoutArtifact(options) { return verifyArtifact(options, checkoutSchema); }

async function buildArtifact({ cwd = process.cwd(), commit, tree, frontendOrigin, providerOrigin, publicKey, output,
  noticesPath, expectedNoticeVersion, paidPilot }, schema) {
  const preflight = await runPreflight({ cwd, commit, tree });
  const env = buildEnvironment();
  const repositoryRoot = run("git", ["rev-parse", "--show-toplevel"], { cwd, env, failure: "Could not identify the reviewed source repository" }).trim();
  const project = JSON.parse(run("git", ["show", `${preflight.head}:${appPath}/supabase/project.json`], {
    cwd: repositoryRoot, env, failure: "Could not read the reviewed DMocks project",
  }));
  const notice = schema === checkoutSchema ? await checkoutNoticeInput(noticesPath, expectedNoticeVersion) : null;
  const profile = notice
    ? checkoutArtifactProfile(project, { frontendOrigin, providerOrigin, publicKey, noticeVersion: notice.version })
    : stagingArtifactProfile(project, { frontendOrigin, providerOrigin, publicKey, paidPilot });
  const target = await outputDirectory(output, env);
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "dmocks-artifact-source-"));
  let ownedOutput = false;
  try {
    const archive = run("git", ["archive", "--format=tar", preflight.head, "--", appPath], {
      cwd: repositoryRoot, env, encoding: "buffer", failure: "Could not extract the reviewed Git source",
    });
    run("tar", ["-xf", "-"], { cwd: sourceRoot, env, input: archive, failure: "Could not read the reviewed source archive" });
    const files = await verifyTrackedFiles({ repositoryRoot, sourceRoot, commit: preflight.head, subtree: appPath });
    const lockfile = files.find(file => file.path === `${appPath}/package-lock.json`);
    if (!lockfile) throw new Error("The reviewed source needs a package lockfile");
    const mode = profile.deployment;
    const blockedInputs = new Set([".env", ".env.local", `.env.${mode}`, `.env.${mode}.local`, ".npmrc"]);
    if (files.some(file => blockedInputs.has(file.path.slice(appPath.length + 1)))) {
      throw new Error("The reviewed source contains an environment or package manager override");
    }
    const app = path.join(sourceRoot, appPath);
    const userConfig = path.join(sourceRoot, "npm-user-config");
    const globalConfig = path.join(sourceRoot, "npm-global-config");
    await Promise.all([writeFile(userConfig, ""), writeFile(globalConfig, "")]);
    const npmFlags = [`--userconfig=${userConfig}`, `--globalconfig=${globalConfig}`];
    run("npm", ["ci", "--offline", "--ignore-scripts", "--no-audit", "--no-fund", ...npmFlags], {
      cwd: app, env, failure: "Could not install the locked dependencies from the npm cache", timeout: 120000,
    });
    const npm = run("npm", ["--version", ...npmFlags], { cwd: app, env, failure: "Could not verify the npm version" }).trim();
    const noticeFile = path.join(sourceRoot, "reviewed-notices.json");
    if (notice) await writeFile(noticeFile, notice.bytes, { mode: 0o600, flag: "wx" });
    run(process.execPath, ["node_modules/vite/bin/vite.js", "build", "--mode", mode], {
      cwd: app, env: {
        ...env, VITE_DEPLOYMENT_ENV: mode, VITE_RELEASE: preflight.head,
        VITE_SUPABASE_URL: providerOrigin, VITE_SUPABASE_ANON_KEY: publicKey,
        VITE_STAGING_PORTAL_ENABLED: String(profile.stagingPortalEnabled), VITE_POST_LAUNCH_PREVIEW: String(profile.postLaunchPreview),
        VITE_PORTAL_ENABLED: String(profile.releasedPortalEnabled), VITE_CHECKOUT_ENABLED: String(profile.checkoutEnabled),
        VITE_TEST_LOGIN_ENABLED: String(profile.controlledLoginEnabled),
        VITE_CANDIDATE_PHONE_VERIFICATION_ENABLED: String(profile.phoneVerificationEnabled),
        ...(notice ? { VITE_TERMS_VERSION: notice.version, DMOCKS_PUBLISHED_NOTICES_FILE: noticeFile } : {}),
      }, failure: "Could not build the reviewed private portal source",
    });
    run(process.execPath, ["scripts/check-preview-isolation.mjs"], {
      cwd: app, env, failure: "Local development views entered the private portal build",
    });
    const dist = path.join(app, "dist");
    const manifest = {
      schema, source: { commit: preflight.head, tree: preflight.tree, backendInventorySha256: preflight.inventory.sha256 },
      profile, toolchain: { node: process.versions.node, npm, platform: process.platform, arch: process.arch,
        lockfileSha256: lockfile.sha256 },
      files: await siteFiles(dist),
    };
    const bundleSha256 = hashManifest(manifest);
    await mkdir(target, { mode: 0o700 });
    ownedOutput = true;
    await cp(dist, path.join(target, "site"), { recursive: true, errorOnExist: true, force: false });
    await writeFile(path.join(target, "manifest.json"), JSON.stringify({ ...manifest, bundleSha256 }, null, 2) + "\n", {
      mode: 0o600, flag: "wx",
    });
    return await verifyArtifact({ directory: target, expected: bundleSha256 }, schema);
  } catch (error) {
    if (ownedOutput) await rm(target, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(sourceRoot, { recursive: true, force: true });
  }
}

export function buildStagingArtifact(options) { return buildArtifact(options, stagingSchema); }
export function buildCheckoutArtifact(options) { return buildArtifact(options, checkoutSchema); }

async function main() {
  const [action, ...args] = process.argv.slice(2);
  let result;
  if (action === "build" || action === "build-checkout") {
    const checkout = action === "build-checkout";
    const { values } = parseArgs({ args, options: {
      commit: { type: "string" }, tree: { type: "string" }, output: { type: "string" },
      "frontend-origin": { type: "string" }, "provider-origin": { type: "string" },
      ...(checkout ? { notices: { type: "string" }, "expect-notice-version": { type: "string" } } : { "paid-pilot": { type: "boolean" } }),
    } });
    const build = checkout ? buildCheckoutArtifact : buildStagingArtifact;
    result = await build({
      commit: values.commit, tree: values.tree, output: values.output,
      frontendOrigin: values["frontend-origin"], providerOrigin: values["provider-origin"],
      publicKey: checkout ? process.env.DMOCKS_CHECKOUT_PUBLISHABLE_KEY : process.env.DMOCKS_STAGING_PUBLISHABLE_KEY,
      noticesPath: values.notices, expectedNoticeVersion: values["expect-notice-version"], paidPilot: values["paid-pilot"],
    });
  } else if (action === "verify" || action === "verify-checkout") {
    const { values } = parseArgs({ args, options: { artifact: { type: "string" }, expect: { type: "string" } } });
    const verify = action === "verify-checkout" ? verifyCheckoutArtifact : verifyStagingArtifact;
    result = await verify({ directory: values.artifact, expected: values.expect });
  } else {
    throw new Error("Choose build or verify for the private staging artifact, or build-checkout or verify-checkout for private Test checkout");
  }
  process.stdout.write(JSON.stringify(result, null, 2) + "\n");
}

if (import.meta.main ?? (process.argv[1] && existsSync(process.argv[1]) &&
    realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)))) {
  main().catch(error => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
