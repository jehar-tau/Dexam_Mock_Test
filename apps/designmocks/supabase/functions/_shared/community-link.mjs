// Link previews for Community. Shared by the Edge functions and the browser.
// The server fetches only a page's title, site name and description, as plain
// text. Nothing is embedded and no remote image is loaded.

export const LINK_URL_MAX = 2000;
export const LINK_TITLE_MAX = 200;
export const LINK_SITE_MAX = 100;
export const LINK_DESCRIPTION_MAX = 400;
export const LINK_FETCH_BYTES = 512 * 1024;
export const LINK_FETCH_MS = 6000;
export const LINK_REDIRECTS = 3;

export class CommunityLinkError extends Error {
  constructor(message, code, status = 400) { super(message); this.code = code; this.status = status; }
}

// Social and messaging sites. A student may save these privately, with their
// own note, but they are never fetched and never accepted for the Links feed.
const socialHosts = ["instagram.com", "facebook.com", "fb.com", "fb.watch", "x.com", "twitter.com", "tiktok.com", "snapchat.com", "threads.net",
  "wa.me", "whatsapp.com", "t.me", "telegram.me", "telegram.org", "discord.gg", "discord.com", "linkedin.com", "pinterest.com", "reddit.com"];
const within = (host, list) => list.some(item => host === item || host.endsWith("." + item));
export const isSocialHost = host => within(host, socialHosts);

function ipv4(host) {
  const parts = host.split(".");
  if (parts.length !== 4 || !parts.every(part => /^\d{1,3}$/.test(part) && Number(part) <= 255)) return null;
  return parts.map(Number);
}
// Loopback, private, link-local, carrier-grade NAT, multicast, reserved and documentation ranges.
export function privateIPv4(parts) {
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 192 && b === 0) || (a === 198 && (b === 18 || b === 19)) || (a === 198 && b === 51) || (a === 203 && b === 0) || a >= 224;
}
export function privateIPv6(address) {
  const value = address.toLowerCase().replace(/^\[|\]$/g, "");
  if (value === "::" || value === "::1") return true;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (mapped) return privateIPv4(ipv4(mapped[1]) ?? [0]);
  return /^(fc|fd|fe8|fe9|fea|feb|ff)/.test(value) || value.startsWith("2001:db8") || value.startsWith("64:ff9b");
}
// Hosts a server must never contact: addresses written as numbers, local names
// and anything without a public suffix.
export function blockedHost(host) {
  if (!host || host.length > 253) return true;
  if (host.startsWith("[") || host.includes(":")) return true; // IPv6 literal
  if (ipv4(host)) return true;
  if (/^\d+$/.test(host) || /^0x/i.test(host)) return true;
  if (!host.includes(".")) return true;
  return /(^|\.)(localhost|local|internal|intranet|lan|home|corp|localdomain|test|invalid|example|onion)$/.test(host);
}

// Returns { url, host } for an address a student may save, or throws.
export function normalizeLinkUrl(raw) {
  const text = String(raw ?? "").trim();
  if (!text || text.length > LINK_URL_MAX) throw new CommunityLinkError("Paste a web address of up to 2,000 characters.", "link_invalid");
  let url;
  try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(text) ? text : `https://${text}`); }
  catch { throw new CommunityLinkError("That doesn’t look like a web address.", "link_invalid"); }
  if (!["https:", "http:"].includes(url.protocol)) throw new CommunityLinkError("Use a web address that starts with https://.", "link_invalid");
  if (url.username || url.password) throw new CommunityLinkError("Remove the sign-in details from the address.", "link_invalid");
  if (url.port && !((url.protocol === "https:" && url.port === "443") || (url.protocol === "http:" && url.port === "80"))) throw new CommunityLinkError("Use an ordinary web address without a port number.", "link_invalid");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (blockedHost(host)) throw new CommunityLinkError("That address can’t be saved. Use a public website.", "link_blocked");
  url.hash = "";
  url.hostname = host;
  // Drop common tracking parameters so the same page saves once.
  for (const key of [...url.searchParams.keys()]) if (/^(utm_[a-z]+|fbclid|gclid|igshid|mc_[a-z]+|ref_src|si)$/i.test(key)) url.searchParams.delete(key);
  const normalized = url.toString();
  if (normalized.length > LINK_URL_MAX) throw new CommunityLinkError("Paste a web address of up to 2,000 characters.", "link_invalid");
  return { url: normalized, host };
}

const entities = { amp: "&", lt: "<", gt: ">", quot: "\"", apos: "'", nbsp: " ", ndash: "–", mdash: "—", hellip: "…", rsquo: "’", lsquo: "‘", rdquo: "”", ldquo: "“" };
export function plainText(value, max) {
  const decoded = String(value ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/&#(\d{1,7});/g, (_, code) => { const n = Number(code); return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : " "; })
    .replace(/&#x([0-9a-f]{1,6});/gi, (_, code) => { const n = parseInt(code, 16); return n > 31 && n < 0x110000 ? String.fromCodePoint(n) : " "; })
    .replace(/&([a-z]+);/gi, (match, name) => entities[name.toLowerCase()] ?? match)
    .replace(/<[^>]*>/g, " ") // tags that arrived as entities
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, " ")
    .replace(/\s+/g, " ").trim();
  const characters = [...decoded];
  return characters.length <= max ? decoded : characters.slice(0, max - 1).join("").trimEnd() + "…";
}
function attribute(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(tag);
  return match ? match[2] ?? match[3] ?? match[4] ?? "" : null;
}
// Reads only <title> and <meta> tags from the start of a page.
export function extractLinkMetadata(html, host) {
  const head = String(html).slice(0, LINK_FETCH_BYTES).split(/<\/head\s*>/i)[0];
  const meta = new Map();
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attribute(tag, "property") ?? attribute(tag, "name") ?? "").toLowerCase(), content = attribute(tag, "content");
    if (key && content !== null && !meta.has(key)) meta.set(key, content);
  }
  const titleTag = /<title\b[^>]*>([\s\S]*?)<\/title\s*>/i.exec(head)?.[1];
  const title = plainText(meta.get("og:title") ?? meta.get("twitter:title") ?? titleTag ?? "", LINK_TITLE_MAX);
  const site = plainText(meta.get("og:site_name") ?? meta.get("application-name") ?? host, LINK_SITE_MAX);
  const description = plainText(meta.get("og:description") ?? meta.get("description") ?? meta.get("twitter:description") ?? "", LINK_DESCRIPTION_MAX);
  return { title: title || null, site: site || host, description: description || null };
}

async function readLimited(response, limit) {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks = []; let size = 0;
  try {
    while (size < limit) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value.subarray(0, limit - size)); size += Math.min(value.length, limit - size);
    }
  } finally { await reader.cancel().catch(() => {}); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  return new TextDecoder("utf-8").decode(bytes);
}

/**
 * @param {string} address
 * @param {{ fetch?: typeof fetch, resolve?: ((host: string) => Promise<string[] | null>) | null, signal?: AbortSignal, timeoutMs?: number, maxBytes?: number }} [options]
 */
// Fetches a preview. `resolve(host)` returns the host's addresses, or null when
// the runtime cannot look them up. Each redirect is checked like the first
// address. Returns { url, host, status, title, site, description }.
export async function fetchLinkPreview(address, { fetch: get = globalThis.fetch, resolve = null, signal, timeoutMs = LINK_FETCH_MS, maxBytes = LINK_FETCH_BYTES } = {}) {
  let current = normalizeLinkUrl(address);
  if (isSocialHost(current.host)) return { ...current, status: "skipped", title: null, site: current.host, description: null };
  const deadline = AbortSignal.timeout(timeoutMs), active = signal ? AbortSignal.any([signal, deadline]) : deadline;
  for (let hop = 0; hop <= LINK_REDIRECTS; hop++) {
    if (resolve) {
      const addresses = await resolve(current.host);
      if (addresses && (!addresses.length || addresses.some(item => ipv4(item) ? privateIPv4(ipv4(item)) : privateIPv6(item)))) {
        return { ...current, status: "unavailable", title: null, site: current.host, description: null };
      }
    }
    let response;
    try {
      response = await get(current.url, { redirect: "manual", signal: active, headers: { Accept: "text/html,application/xhtml+xml;q=0.9", "User-Agent": "DMocksLinkPreview/1.0" } });
    } catch { return { ...current, status: "unavailable", title: null, site: current.host, description: null }; }
    if (response.status >= 300 && response.status < 400) {
      const next = response.headers.get("location");
      await response.body?.cancel().catch(() => {});
      if (!next || hop === LINK_REDIRECTS) return { ...current, status: "unavailable", title: null, site: current.host, description: null };
      try { current = normalizeLinkUrl(new URL(next, current.url).toString()); }
      catch { return { ...current, status: "unavailable", title: null, site: current.host, description: null }; }
      if (isSocialHost(current.host)) return { ...current, status: "skipped", title: null, site: current.host, description: null };
      continue;
    }
    const type = response.headers.get("content-type") ?? "";
    if (!response.ok || !/^(text\/html|application\/xhtml\+xml)\b/i.test(type)) {
      await response.body?.cancel().catch(() => {});
      return { ...current, status: "unavailable", title: null, site: current.host, description: null };
    }
    try {
      const metadata = extractLinkMetadata(await readLimited(response, maxBytes), current.host);
      return { ...current, status: "fetched", ...metadata };
    } catch { return { ...current, status: "unavailable", title: null, site: current.host, description: null }; }
  }
  return { ...current, status: "unavailable", title: null, site: current.host, description: null };
}
