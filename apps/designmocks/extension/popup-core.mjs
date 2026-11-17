// The "Save to DMocks" extension's logic, kept free of browser APIs so it can
// be tested. The popup supplies fetch, storage and the active tab.
import { normalizeLinkUrl } from "./community-link.mjs";

export const KEY_PATTERN = /^dmx_[0-9a-f]{64}$/;
const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export class ExtensionError extends Error {
  constructor(message, code) { super(message); this.code = code; }
}

export function connectionKey(value) {
  const key = String(value ?? "").trim();
  if (!KEY_PATTERN.test(key)) throw new ExtensionError("Paste the whole connection key from DMocks. It starts with dmx_.", "key_format");
  return key;
}

export function validConfig(value) {
  if (!value || typeof value !== "object") throw new ExtensionError("This copy of the extension is not set up.", "config");
  const project = new URL(value.supabaseUrl), app = new URL(value.appOrigin);
  if (project.protocol !== "https:" || app.protocol !== "https:" || typeof value.anonKey !== "string" || !value.anonKey) throw new ExtensionError("This copy of the extension is not set up.", "config");
  return { supabaseUrl: project.origin, anonKey: value.anonKey, appOrigin: app.origin };
}

// The page in the active tab, or an explanation of why it cannot be saved.
export function pageToSave(tab) {
  try {
    const { url, host } = normalizeLinkUrl(tab?.url);
    const title = String(tab?.title ?? "").replace(/\s+/g, " ").trim().slice(0, 300);
    return { url, host, title };
  } catch {
    throw new ExtensionError("This page can’t be saved. Open an ordinary web page and try again.", "page");
  }
}

export function rpcRequest(config, name, args) {
  return [`${config.supabaseUrl}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { apikey: config.anonKey, Authorization: `Bearer ${config.anonKey}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(args),
  }];
}

const messages = {
  community_extension_token: ["This connection was removed or has expired. Connect again from DMocks.", "disconnected"],
  community_link_invalid: ["This page can’t be saved. Open an ordinary web page and try again.", "page"],
  community_folder_unavailable: ["That folder no longer exists. Choose another.", "folders"],
  community_folder_limit: ["You already have 50 folders. Choose an existing one.", "folders"],
  community_save_limit: ["You’ve saved 1,000 links. Remove some on DMocks first.", "limit"],
  community_save_rate: ["You’ve saved a lot this hour. Try again later.", "limit"],
  community_invalid_input: ["Choose a folder or name a new one, and keep the note within 2,000 characters.", "input"],
};
export async function readRpc(response) {
  let body = null;
  try { body = await response.json(); } catch { /* An empty or broken reply is handled below. */ }
  if (response.ok) return body;
  const known = messages[body?.details];
  throw new ExtensionError(known?.[0] ?? "DMocks didn’t answer. Check your connection and try again.", known?.[1] ?? "network");
}

export function folderList(value) {
  if (!value || !Array.isArray(value.folders) || value.folders.length > 50 ||
    !value.folders.every(item => item && uuid.test(item.id) && typeof item.name === "string" && item.name.length >= 1 && item.name.length <= 60)) {
    throw new ExtensionError("DMocks sent something unexpected. Try again.", "network");
  }
  return value.folders.map(item => ({ id: item.id, name: item.name }));
}

export function saveRequest(key, page, folderIds, newFolder, note) {
  const name = String(newFolder ?? "").replace(/\s+/g, " ").trim(), text = String(note ?? "").trim();
  if (!folderIds.length && !name) throw new ExtensionError("Choose a folder or name a new one.", "input");
  if ([...name].length > 60) throw new ExtensionError("Keep the folder name within 60 characters.", "input");
  if ([...text].length > 2000) throw new ExtensionError("Keep the note within 2,000 characters.", "input");
  return { p_token: key, p_url: page.url, p_folder_ids: folderIds, p_new_folder: name, p_note: text };
}

export function savedReply(value) {
  if (!value || !uuid.test(value.linkId) || !Array.isArray(value.folderIds) || !value.folderIds.length || !value.folderIds.every(id => uuid.test(id))) {
    throw new ExtensionError("DMocks sent something unexpected. Check your folders on DMocks.", "network");
  }
  return value;
}
