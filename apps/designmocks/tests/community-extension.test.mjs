import test from "node:test";
import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildExtension, extensionConfig, extensionManifest, EXTENSION_SOURCES } from "../scripts/build-extension.mjs";

// popup-core imports ./community-link.mjs, which the build copies beside it.
const staged = await mkdtemp(join(tmpdir(), "dmocks-extension-core-"));
await copyFile(fileURLToPath(new URL("../extension/popup-core.mjs", import.meta.url)), join(staged, "popup-core.mjs"));
await copyFile(fileURLToPath(new URL("../supabase/functions/_shared/community-link.mjs", import.meta.url)), join(staged, "community-link.mjs"));
const core = await import(pathToFileURL(join(staged, "popup-core.mjs")).href);
test.after(() => rm(staged, { recursive: true, force: true }));

const key = "dmx_" + "a1".repeat(32), config = { supabaseUrl: "https://fixture.supabase.co", anonKey: "sb_publishable_fixture", appOrigin: "https://dmocks.example.org" };
const id = n => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

test("connection keys must be the whole key", () => {
  assert.equal(core.connectionKey(`  ${key}  `), key);
  for (const value of ["", "dmx_123", key.toUpperCase(), key + "0", "Bearer " + key]) assert.throws(() => core.connectionKey(value), { code: "key_format" });
});

test("only ordinary web pages can be saved, with the address normalized and the title trimmed", () => {
  assert.deepEqual(core.pageToSave({ url: "https://Example.org/plan?utm_source=x#top", title: "  A   fictional   plan  " }), { url: "https://example.org/plan", host: "example.org", title: "A fictional plan" });
  for (const url of ["chrome://extensions/", "chrome-extension://abc/popup.html", "file:///Users/me/notes.pdf", "about:blank", "http://localhost:4190/", undefined])
    assert.throws(() => core.pageToSave({ url, title: "x" }), { code: "page" }, String(url));
  assert.equal(core.pageToSave({ url: "https://example.org/", title: "x".repeat(400) }).title.length, 300);
});

test("requests use the public key only and send the connection key as an argument", async () => {
  const [url, init] = core.rpcRequest(core.validConfig(config), "extension_community_folders", { p_token: key });
  assert.equal(url, "https://fixture.supabase.co/rest/v1/rpc/extension_community_folders");
  assert.equal(init.headers.Authorization, "Bearer sb_publishable_fixture");
  assert.deepEqual(JSON.parse(init.body), { p_token: key });
  assert.throws(() => core.validConfig({ ...config, supabaseUrl: "http://fixture.supabase.co" }), { code: "config" });
});

test("server replies become sentences, and a removed key asks to connect again", async () => {
  const reply = (status, body) => new Response(JSON.stringify(body), { status });
  assert.deepEqual(await core.readRpc(reply(200, { folders: [] })), { folders: [] });
  await assert.rejects(core.readRpc(reply(403, { details: "community_extension_token", message: "private" })), { code: "disconnected" });
  await assert.rejects(core.readRpc(reply(500, { message: "private diagnostic" })), error => error.code === "network" && !error.message.includes("private"));
  await assert.rejects(core.readRpc(new Response("not json", { status: 502 })), { code: "network" });
});

test("folder lists and save replies are checked; a save needs a folder", () => {
  assert.deepEqual(core.folderList({ folders: [{ id: id(1), name: "Inspiration", extra: 1 }] }), [{ id: id(1), name: "Inspiration" }]);
  for (const value of [null, { folders: [{ id: "x", name: "A" }] }, { folders: [{ id: id(1), name: "" }] }]) assert.throws(() => core.folderList(value));
  const page = { url: "https://example.org/plan", host: "example.org", title: "A plan" };
  assert.deepEqual(core.saveRequest(key, page, [id(1)], "  ", "  Note  "), { p_token: key, p_url: page.url, p_folder_ids: [id(1)], p_new_folder: "", p_note: "Note" });
  assert.throws(() => core.saveRequest(key, page, [], "", ""), /Choose a folder/);
  assert.throws(() => core.saveRequest(key, page, [id(1)], "", "x".repeat(2001)), /2,000/);
  assert.equal(core.savedReply({ linkId: id(2), folderIds: [id(1)] }).linkId, id(2));
  assert.throws(() => core.savedReply({ linkId: id(2), folderIds: [] }));
});

test("the manifest asks only for the clicked tab, storage and the project's own address", () => {
  const manifest = extensionManifest(extensionConfig(config));
  assert.equal(manifest.manifest_version, 3);
  assert.deepEqual(manifest.permissions, ["activeTab", "storage"]);
  assert.deepEqual(manifest.host_permissions, ["https://fixture.supabase.co/*"]);
  for (const forbidden of ["tabs", "history", "cookies", "webRequest", "scripting", "<all_urls>", "bookmarks"]) assert.ok(!JSON.stringify(manifest).includes(`"${forbidden}"`), forbidden);
  assert.equal(manifest.content_scripts, undefined); assert.equal(manifest.background, undefined);
  assert.throws(() => extensionConfig({ ...config, supabaseUrl: "https://evil.example.org" }), /supabase\.co/);
  assert.throws(() => extensionConfig({ ...config, anonKey: "sb_secret_fixture" }), /public/);
  assert.throws(() => extensionConfig({ ...config, appOrigin: "http://dmocks.example.org" }), /https/);
});

test("the build writes every file the popup loads and nothing else", async () => {
  const out = await mkdtemp(join(tmpdir(), "dmocks-extension-build-"));
  try {
    const { manifest } = await buildExtension(config, pathToFileURL(out + "/"));
    assert.deepEqual((await readdir(out)).sort(), [...Object.keys(EXTENSION_SOURCES), "config.json", "manifest.json"].sort());
    assert.deepEqual(JSON.parse(await readFile(join(out, "config.json"), "utf8")), config);
    assert.deepEqual(JSON.parse(await readFile(join(out, "manifest.json"), "utf8")), manifest);
    const html = await readFile(join(out, "popup.html"), "utf8");
    assert.ok(!/<script(?![^>]*type="module" src="popup.js")/.test(html), "only the popup module script");
    assert.ok(!/\son[a-z]+\s*=/i.test(html), "no inline handlers");
  } finally { await rm(out, { recursive: true, force: true }); }
});
