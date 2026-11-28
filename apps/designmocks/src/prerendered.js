// The build-time HTML of the first page's main content (scripts/public-discovery.mjs),
// read once before React renders. A lazily loaded page shows it while its code loads,
// instead of blanking and making the page jump. It is this site's own static output.
const initial = typeof document === "undefined" ? null
  : { path: location.pathname.replace(/\/+$/, "") || "/", html: document.querySelector("#root #main")?.innerHTML ?? "" };

export function prerenderedMain(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  return initial && initial.path === path && initial.html.trim() ? initial.html : null;
}
