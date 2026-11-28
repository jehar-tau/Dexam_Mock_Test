// Search details for the public guide pages (/guides/<slug>). Plain data, so
// both the browser (SearchHead) and the prerender (public-discovery) use it.
import { EDITORIAL_AUTHOR, EDITORIAL_DATE } from "./editorial-author.mjs";

export const guidePath = slug => `/guides/${slug}`;
const guidePattern = /^\/guides\/([a-z0-9]+(?:-[a-z0-9]+)*)$/;

export function guideSlug(pathname) {
  return guidePattern.exec(pathname.replace(/\/+$/, ""))?.[1] ?? null;
}

// The page entry pageHead() reads: title, description and Article details.
export function guidePage(article) {
  return {
    title: `${article.title} | DMocks guides`,
    description: article.dek,
    article: { headline: article.title, author: EDITORIAL_AUTHOR.name, datePublished: EDITORIAL_DATE },
  };
}
