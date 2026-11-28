// Builds the public dmocks.com frontend from this checkout without any
// operator machine: the controlled student portal on the DMocks Test backend,
// with checkout and sales closed. Used by .github/workflows/dmocks-site.yml.
//
// Inputs (environment):
//   DMOCKS_SUPABASE_PUBLISHABLE_KEY  the backend's public browser key (sb_publishable_…)
//   DMOCKS_PUBLISHED_NOTICES_JSON    the reviewed customer notice bundle, as JSON text
//     or DMOCKS_PUBLISHED_NOTICES_FILE, a path to the same JSON
//   DMOCKS_RELEASED_STUDENT_MODULES  optional modules to release (default "practice"); add
//     "drawing-review" to open teacher marking of drawing photos
// Flags:
//   --cname <host>     write a CNAME file for GitHub Pages
//   --inventory <file> write the SHA-256 of every output file
//   --keep-assets <dir> carry the last 14 days of hashed assets between deploys,
//     so a page opened before a deploy can still load its lazy chunks
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { readPublishedNotices } from "./published-notices.mjs";
import project from "../supabase/project.json" with { type: "json" };

const { values: flags } = parseArgs({ options: { cname: { type: "string" }, inventory: { type: "string" }, "keep-assets": { type: "string" } } });
const app = fileURLToPath(new URL("..", import.meta.url));
const dist = join(app, "dist");

const key = process.env.DMOCKS_SUPABASE_PUBLISHABLE_KEY ?? "";
if (!/^sb_publishable_[A-Za-z0-9_-]{24,}$/.test(key)) throw new Error("Set DMOCKS_SUPABASE_PUBLISHABLE_KEY to the backend's sb_publishable_ key");

let noticesFile = process.env.DMOCKS_PUBLISHED_NOTICES_FILE ?? "", scratch = "";
if (process.env.DMOCKS_PUBLISHED_NOTICES_JSON) {
  scratch = mkdtempSync(join(tmpdir(), "dmocks-notices-"));
  noticesFile = join(scratch, "customer-notices.json");
  writeFileSync(noticesFile, process.env.DMOCKS_PUBLISHED_NOTICES_JSON);
}
if (!noticesFile) throw new Error("Set DMOCKS_PUBLISHED_NOTICES_JSON or DMOCKS_PUBLISHED_NOTICES_FILE");
const notices = readPublishedNotices(noticesFile, { freeSignup: true });

const env = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(VITE_|DMOCKS_)/.test(name)));
Object.assign(env, {
  VITE_DEPLOYMENT_ENV: "production", VITE_PORTAL_ENABLED: "false", VITE_CHECKOUT_ENABLED: "false",
  VITE_PUBLIC_CATALOG_ENABLED: "false", VITE_CONTROLLED_PUBLIC_PORTAL_ENABLED: "true",
  VITE_SUPABASE_URL: `https://${project.project_ref}.supabase.co`, VITE_SUPABASE_ANON_KEY: key,
  VITE_TERMS_VERSION: notices.version, DMOCKS_PUBLISHED_NOTICES_FILE: noticesFile,
});
const modules = process.env.DMOCKS_RELEASED_STUDENT_MODULES ?? "practice";
if (modules) env.VITE_RELEASED_STUDENT_MODULES = modules;

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: app, env, stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${command} ${args.join(" ")} failed`);
};
try {
  run("npm", ["run", "build:production"]);
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}
run("node", ["scripts/check-preview-isolation.mjs", "--allow-learn-images"]);

const files = [];
const walk = dir => { for (const name of readdirSync(dir)) { const path = join(dir, name); statSync(path).isDirectory() ? walk(path) : files.push(path); } };
walk(dist);
for (const file of files) {
  const name = relative(dist, file);
  if (/papers-preview/i.test(name)) throw new Error(`Preview file in the public build: ${name}`);
  if (/\.(js|html)$/.test(name) && readFileSync(file).includes("/papers-preview")) throw new Error(`Preview route in ${name}`);
}
if (!existsSync(join(dist, "papers.html")) || !existsSync(join(dist, "404.html"))) throw new Error("papers.html or 404.html is missing");
if (existsSync(join(dist, "checkout.html"))) throw new Error("checkout.html must not be published");
if (readFileSync(join(dist, "index.html"), "utf8").includes("sb_secret_")) throw new Error("A secret key reached the bundle");

const inventory = Object.fromEntries(files.map(file => [relative(dist, file), createHash("sha256").update(readFileSync(file)).digest("hex")])
  .sort(([a], [b]) => (a < b ? -1 : 1)));
if (flags.inventory) writeFileSync(flags.inventory, JSON.stringify(inventory, null, 2));
if (flags.cname) writeFileSync(join(dist, "CNAME"), flags.cname + "\n");
if (flags["keep-assets"]) {
  const history = flags["keep-assets"], manifestFile = join(history, "first-seen.json"), now = Date.now();
  mkdirSync(history, { recursive: true });
  const seen = existsSync(manifestFile) ? JSON.parse(readFileSync(manifestFile, "utf8")) : {};
  // Hashed chunks sit directly in assets/; folders below it are not carried.
  for (const name of readdirSync(join(dist, "assets"))) {
    if (!statSync(join(dist, "assets", name)).isFile()) continue;
    seen[name] ??= now;
    copyFileSync(join(dist, "assets", name), join(history, name));
  }
  let carried = 0;
  for (const [name, first] of Object.entries(seen)) {
    if (now - first > 14 * 86400000 || !existsSync(join(history, name))) {
      delete seen[name]; rmSync(join(history, name), { force: true }); continue;
    }
    if (!existsSync(join(dist, "assets", name))) { copyFileSync(join(history, name), join(dist, "assets", name)); carried++; }
  }
  writeFileSync(manifestFile, JSON.stringify(seen));
  console.log(`Carried ${carried} earlier assets`);
}
console.log(`Built ${Object.keys(inventory).length} files with notices ${notices.version}${modules ? `, modules: ${modules}` : ""}`);
