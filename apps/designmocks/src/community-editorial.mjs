// Editorial articles for Community → Articles. Each lives in
// src/community-editorial/<slug>.md with a small frontmatter block; the format
// and voice are in docs/community/EDITORIAL_STYLE.md. The body uses the same
// Markdown subset as student articles and is rendered by CommunityArticle.
import { ARTICLE_EXAMS, articleStats, parseArticle } from "./community-article.mjs";
import { IMAGES } from "./learn/decks/images.js";

// Owner's decision, 28 Nov 2026: editorial articles carry the owner's name.
// Credential added by the owner on 28 Nov 2026.
export const EDITORIAL_AUTHOR = Object.freeze({ name: "Snehalkumar Shinde", initials: "SS", credential: "NID Bengaluru",
  bio: "Snehalkumar Shinde studied design at NID Bengaluru and writes the DMocks guides for students preparing for NID, UCEED, NIFT and CEED." });
export const EDITORIAL_DATE = "2026-11-28";
export const EDITORIAL_THEMES = Object.freeze({ planning: "Planning", papers: "Papers & time", mindset: "Mindset", skills: "Skills" });
export const EDITORIAL_COVERS = Object.freeze(["clock", "calendar", "sketch", "eye", "cube", "path", "calm", "conversation", "papers", "compass", "balance", "home", "bulb", "target"]);

// Feed order: themes interleaved so the first screen shows a mix.
export const EDITORIAL_ORDER = Object.freeze([
  "how-to-review-a-mock-test",
  "choosing-between-nid-uceed-nift-and-ceed",
  "a-calm-routine-for-exam-morning",
  "train-your-observation-in-ten-minutes-a-day",
  "final-30-days-before-nid-dat-prelims",
  "negative-marking-when-to-attempt-and-when-to-leave",
  "what-to-do-after-a-bad-mock",
  "drawing-when-you-think-you-cannot-draw",
  "a-twelve-week-uceed-plan-around-school",
  "the-two-pass-method-for-objective-papers",
  "when-your-mind-goes-blank-in-a-drawing-task",
  "getting-better-at-mental-rotation-and-cube-questions",
  "board-exams-and-design-entrance-at-the-same-time",
  "using-old-papers-without-memorising-them",
  "comparison-social-media-and-staying-in-your-lane",
  "perspective-and-memory-drawing-basics",
  "preparing-for-ceed-with-a-full-time-job",
  "managing-time-in-drawing-sections",
  "staying-consistent-when-motivation-drops",
  "nift-cat-from-a-theme-to-a-concept",
  "self-study-or-coaching-an-honest-guide",
  "nift-gat-where-the-marks-come-from",
  "for-parents-supporting-a-child-who-wants-design-school",
  "building-design-awareness-for-general-questions",
  "talking-about-your-work-in-studio-tests-and-interviews",
]);

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function parseEditorial(raw, file = "") {
  const text = String(raw ?? "").replace(/\r\n?/g, "\n");
  const match = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(text);
  if (!match) throw new Error(`${file}: missing frontmatter`);
  const meta = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([a-z]+):\s*(.*?)\s*(?:#.*)?$/.exec(line.trim());
    if (pair) meta[pair[1]] = pair[2].replace(/^["']|["']$/g, "");
  }
  const exams = meta.exams === "all" || !meta.exams ? [...ARTICLE_EXAMS]
    : meta.exams.split(",").map(exam => exam.trim().toLowerCase()).filter(Boolean);
  const body = match[2].trim();
  const { words, minutes } = articleStats(body);
  return Object.freeze({
    slug: meta.slug ?? "", title: meta.title ?? "", dek: meta.dek ?? "", theme: meta.theme ?? "", cover: meta.cover ?? "", photo: meta.photo || null,
    exams: Object.freeze(exams), allExams: exams.length === ARTICLE_EXAMS.length, body, words, minutes, file,
  });
}

// Everything that would stop an editorial file from being shown.
export function editorialProblems(article) {
  const problems = [];
  const name = article.file || article.slug;
  if (!slugPattern.test(article.slug)) problems.push(`${name}: slug must be lowercase words joined by hyphens`);
  if (article.file && !article.file.endsWith(`/${article.slug}.md`)) problems.push(`${name}: file name must match the slug`);
  if (article.title.length < 8 || article.title.length > 160) problems.push(`${name}: title must be 8–160 characters`);
  if (!article.dek || article.dek.length > 200) problems.push(`${name}: dek must be 1–200 characters`);
  if (!EDITORIAL_THEMES[article.theme]) problems.push(`${name}: unknown theme "${article.theme}"`);
  if (!EDITORIAL_COVERS.includes(article.cover)) problems.push(`${name}: unknown cover "${article.cover}"`);
  // Photos come from the openly licensed, credited set in src/learn/decks/images.js.
  if (article.photo && !IMAGES[article.photo]) problems.push(`${name}: unknown photo "${article.photo}"`);
  if (!article.exams.length || article.exams.some(exam => !ARTICLE_EXAMS.includes(exam))) problems.push(`${name}: exams must be "all" or from ${ARTICLE_EXAMS.join(", ")}`);
  if (article.words < 700 || article.words > 1900) problems.push(`${name}: ${article.words} words; keep it between 700 and 1,900`);
  if (/^#\s/m.test(article.body)) problems.push(`${name}: use ## and ### headings only`);
  if (/https?:\/\/|www\.|\]\(|<[a-z]/i.test(article.body)) problems.push(`${name}: links and HTML are not supported`);
  if (/^\|.*\|\s*$/m.test(article.body)) problems.push(`${name}: tables are not supported`);
  if (!parseArticle(article.body).some(block => block.type === "heading")) problems.push(`${name}: needs at least one ## section`);
  return problems;
}

export function orderEditorial(list) {
  const rank = slug => { const index = EDITORIAL_ORDER.indexOf(slug); return index < 0 ? EDITORIAL_ORDER.length : index; };
  return [...list].sort((a, b) => rank(a.slug) - rank(b.slug) || a.slug.localeCompare(b.slug));
}

export function filterEditorial(list, { theme = null, exam = null } = {}) {
  return list.filter(article => (!theme || article.theme === theme) && (!exam || article.exams.includes(exam)));
}

// Same theme first, then articles that share an exam.
export function relatedEditorial(article, list, count = 3) {
  const others = list.filter(other => other.slug !== article.slug);
  const shared = other => other.exams.some(exam => article.exams.includes(exam));
  return [...others.filter(other => other.theme === article.theme), ...others.filter(other => other.theme !== article.theme && shared(other))].slice(0, count);
}

export function editorialPhoto(article) {
  return article.photo && IMAGES[article.photo] ? { id: article.photo, ...IMAGES[article.photo] } : null;
}

export function editorialExamLabel(article) {
  return article.allExams ? "All exams" : article.exams.map(exam => exam === "nid" ? "NID" : exam.toUpperCase()).join(" · ");
}
