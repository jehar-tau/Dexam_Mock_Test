import { realpath, stat } from "node:fs/promises";
import { extname, isAbsolute, join, relative, sep } from "node:path";
export async function serveArtifact(route, site, url) {
  let pathname;
  try {
    pathname = decodeURIComponent(url.pathname);
  } catch {
    return route.fulfill({ status: 400 });
  }
  const segments = pathname.slice(1).split("/");
  if (segments.some(segment => segment === "." || segment === ".." || /[\\\0]/.test(segment))) {
    return route.fulfill({ status: 404 });
  }
  const entry = route.request().isNavigationRequest() && !extname(pathname)
    ? "index.html"
    : segments.join("/");
  if (entry !== "index.html" && entry !== "favicon.svg" && !entry.startsWith("assets/")) {
    return route.fulfill({ status: 404 });
  }
  const file = await realpath(join(site, entry)).catch(error => {
    if (!["ENOENT", "ENOTDIR"].includes(error.code)) throw error;
    return null;
  });
  if (!file) return route.fulfill({ status: 404 });
  const fromSite = relative(site, file);
  if (fromSite === ".." || fromSite.startsWith(".." + sep) || isAbsolute(fromSite) || !(await stat(file)).isFile()) {
    return route.fulfill({ status: 404 });
  }
  return route.fulfill({ path: file });
}
