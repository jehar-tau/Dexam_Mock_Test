// Builds the "Save to DMocks" browser extension into dist-extension/.
//   VITE_SUPABASE_URL=https://<ref>.supabase.co VITE_SUPABASE_ANON_KEY=<public key> DMOCKS_APP_ORIGIN=https://dmocks.com node scripts/build-extension.mjs
// The public key is the same one the web app ships. No secret goes into the extension.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
export const EXTENSION_SOURCES = Object.freeze({ "popup.html": "extension/popup.html", "popup.css": "extension/popup.css", "popup.js": "extension/popup.js",
  "popup-core.mjs": "extension/popup-core.mjs", "community-link.mjs": "supabase/functions/_shared/community-link.mjs" });

export function extensionConfig({ supabaseUrl, anonKey, appOrigin }) {
  const project = new URL(supabaseUrl), app = new URL(appOrigin);
  if (project.protocol !== "https:" || !/\.supabase\.co$/.test(project.hostname)) throw new Error("Use the project's https://<ref>.supabase.co address.");
  if (app.protocol !== "https:") throw new Error("Use the site's https:// origin.");
  if (typeof anonKey !== "string" || !anonKey || /service|secret/i.test(anonKey)) throw new Error("Use the public (anon) key, never a service or secret key.");
  return { supabaseUrl: project.origin, anonKey, appOrigin: app.origin };
}

export function extensionManifest(config, version = "0.1.0") {
  return {
    manifest_version: 3,
    name: "Save to DMocks",
    version,
    description: "Save the page you are reading into your private DMocks prep folders.",
    action: { default_popup: "popup.html", default_title: "Save to DMocks" },
    // activeTab: the address and title of the tab you click on, only when you click.
    permissions: ["activeTab", "storage"],
    host_permissions: [`${config.supabaseUrl}/*`],
  };
}

export async function buildExtension(options, outDir = new URL("dist-extension/", root)) {
  const config = extensionConfig(options), manifest = extensionManifest(config, options.version);
  await rm(outDir, { recursive: true, force: true }); await mkdir(outDir, { recursive: true });
  for (const [name, source] of Object.entries(EXTENSION_SOURCES)) await writeFile(new URL(name, outDir), await readFile(new URL(source, root)));
  await writeFile(new URL("manifest.json", outDir), JSON.stringify(manifest, null, 2) + "\n");
  await writeFile(new URL("config.json", outDir), JSON.stringify(config, null, 2) + "\n");
  return { manifest, config, outDir: fileURLToPath(outDir) };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { outDir } = await buildExtension({ supabaseUrl: process.env.VITE_SUPABASE_URL, anonKey: process.env.VITE_SUPABASE_ANON_KEY, appOrigin: process.env.DMOCKS_APP_ORIGIN });
  console.log(`Built the extension in ${outDir}. Load it from chrome://extensions with "Load unpacked".`);
}
