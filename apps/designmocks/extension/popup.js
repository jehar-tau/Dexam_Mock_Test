import { ExtensionError, connectionKey, folderList, pageToSave, readRpc, rpcRequest, saveRequest, savedReply, validConfig } from "./popup-core.mjs";

const $ = id => document.getElementById(id);
const views = ["connect", "save", "done"];
let config, key, page;

function show(view) { for (const name of views) $(name).hidden = name !== view; $("disconnect").hidden = view === "connect"; }
function say(text, error = false) { $("status").textContent = text; $("status").className = error ? "error" : ""; }
async function call(name, args) {
  const [url, init] = rpcRequest(config, name, args);
  let response;
  try { response = await fetch(url, init); } catch { throw new ExtensionError("DMocks didn’t answer. Check your connection and try again.", "network"); }
  return readRpc(response);
}
function disconnected(message) { key = null; chrome.storage.local.remove("dmocksKey"); show("connect"); say(message, true); $("key").focus(); }

async function openSave() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try { page = pageToSave(tab); } catch (error) { show("save"); $("save-form").hidden = true; $("page-title").textContent = error.message; return; }
  const folders = folderList(await call("extension_community_folders", { p_token: key }));
  $("page-host").textContent = page.host;
  $("page-title").textContent = page.title || page.url;
  $("note").value = page.title;
  const box = $("folders");
  box.replaceChildren(Object.assign(document.createElement("legend"), { textContent: "Save into" }));
  for (const [index, folder] of folders.entries()) {
    const label = document.createElement("label"), input = Object.assign(document.createElement("input"), { type: "checkbox", value: folder.id, checked: index === 0 });
    label.append(input, document.createTextNode(folder.name)); box.append(label);
  }
  if (!folders.length) { box.append(Object.assign(document.createElement("p"), { className: "small", textContent: "You have no folders yet. Name one below." })); $("new-folder").value = "Saved from the web"; }
  show("save"); say("");
  (box.querySelector("input") ?? $("new-folder")).focus();
}

$("connect-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    const value = connectionKey($("key").value);
    folderList(await call("extension_community_folders", { p_token: value }));
    key = value; await chrome.storage.local.set({ dmocksKey: value }); $("key").value = "";
    say("Connected."); await openSave();
  } catch (error) { say(error.message, true); $("key").focus(); }
  finally { button.disabled = false; }
});

$("save-form").addEventListener("submit", async event => {
  event.preventDefault();
  const button = event.submitter; button.disabled = true;
  try {
    const ids = [...$("folders").querySelectorAll("input:checked")].map(input => input.value);
    savedReply(await call("extension_save_community_link", saveRequest(key, page, ids, $("new-folder").value, $("note").value)));
    show("done"); say(""); $("done-title").focus();
  } catch (error) {
    if (error.code === "disconnected") disconnected(error.message); else say(error.message, true);
  } finally { button.disabled = false; }
});

$("open-saved").addEventListener("click", () => { chrome.tabs.create({ url: `${config.appOrigin}/dashboard/community/saved` }); window.close(); });
$("disconnect").addEventListener("click", () => disconnected("This browser is disconnected. Remove the connection on DMocks too."));

(async () => {
  try {
    config = validConfig(await (await fetch(chrome.runtime.getURL("config.json"))).json());
    key = (await chrome.storage.local.get("dmocksKey")).dmocksKey ?? null;
    if (!key) { show("connect"); $("key").focus(); return; }
    await openSave();
  } catch (error) {
    if (error.code === "disconnected") disconnected(error.message);
    else { show("connect"); say(error.message ?? "Something went wrong.", true); }
  }
})();
