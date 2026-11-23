// INGESTION REVIEW · LOCAL ONLY
// A development-only page for trying the ingestion output question by question.
// It reads the private work folder at run time (outside the repository) and is never
// part of the Vite app or any build. Start it with:
//   node apps/designmocks/ingestion/review/server.mjs
// Options (environment): DMOCKS_INGESTION_WORK (default ~/dmocks-ingestion-work),
// DMOCKS_INGESTION_REVIEW_PORT (default 6796). It listens on 127.0.0.1 only.
import { createServer } from "node:http";
import { readFile, readdir, realpath, stat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const STATIC = { "/": "index.html", "/app.js": "app.js", "/answer-check.mjs": "answer-check.mjs", "/styles.css": "styles.css" };
const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8", ".json": "application/json; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml" };
const PAPER_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;

async function readJson(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return null; }
}

function insideGit(folder) {
  try { execFileSync("git", ["rev-parse", "--show-toplevel"], { cwd: folder, stdio: "ignore" }); return true; } catch { return false; }
}

export async function listPapers(work) {
  const entries = await readdir(work, { withFileTypes: true }).catch(() => []);
  const papers = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !PAPER_ID.test(entry.name)) continue;
    const stages = [];
    for (const stage of ["01-intake", "02-segments", "03-figures", "04-key", "05-solutions"]) {
      if (await stat(path.join(work, entry.name, stage)).then(() => true, () => false)) stages.push(stage);
    }
    if (stages.includes("02-segments")) papers.push({ id: entry.name, stages });
  }
  return papers.sort((a, b) => a.id.localeCompare(b.id, "en", { numeric: true }));
}

// One record per question from every stage that has run. Missing stages give nulls.
export async function loadPaper(work, paperId) {
  if (!PAPER_ID.test(paperId)) return null;
  const base = path.join(work, paperId);
  const segments = await readJson(path.join(base, "02-segments", "questions.json"));
  if (!segments) return null;
  const figures = await readJson(path.join(base, "03-figures", "figures.json"));
  const key = await readJson(path.join(base, "04-key", "key.json"));
  const check = await readJson(path.join(base, "05-solutions", "check.json"));
  const figureByKey = Object.fromEntries((figures?.questions || []).map(record => [record.key, record]));
  const questions = [];
  for (const question of segments.questions) {
    const solution = await readJson(path.join(base, "05-solutions", `${question.key}.json`));
    const visual = await readJson(path.join(base, "05-solutions", `${question.key}.visual.json`));
    const record = figureByKey[question.key];
    questions.push({
      key: question.key, part: question.part, number: question.number, type: question.type,
      prompt: question.prompt, options: question.options.map(({ key: letter, text }) => ({ key: letter, text })),
      flags: question.flags, ocr: Boolean(question.ocr),
      block: record?.block ? { file: record.block.file, width: record.block.width, height: record.block.height } : null,
      figures: (record?.figures || []).map(figure => ({
        id: figure.id, role: figure.role, file: figure.canonical.file, width: figure.canonical.width, height: figure.canonical.height,
        source: figure.canonical.source, notes: figure.canonical.notes || [], textInside: figure.textInside || [],
        vector: figure.vector?.status === "verified" ? { file: figure.vector.file, metrics: figure.vector.metrics, approval: figure.vector.approval,
          textAsOutlines: Boolean(figure.vector.textAsOutlines) } : figure.vector ? { status: figure.vector.status, reasons: figure.vector.reasons } : null,
        board: figure.vector?.board || null,
      })),
      officialKey: key?.keys?.[question.key] || null,
      solution,
      solutionCheck: check?.results?.[question.key] || null,
      visual,
      visualCheck: check?.results?.[`${question.key}.visual`] || null,
    });
  }
  return { paperId, exam: segments.exam, year: segments.year, keySource: key?.source?.name || null,
    report: { segments: segments.report, key: key?.report || null, solutions: check ? { byStatus: check.byStatus } : null }, questions };
}

// Only images produced by stage 3, by a path relative to 03-figures, never outside it.
export async function figureFile(work, paperId, relative) {
  if (!PAPER_ID.test(paperId) || typeof relative !== "string" || !/^[a-z0-9-]+\/[a-z0-9.-]+\.(png|svg)$/i.test(relative)) return null;
  const root = await realpath(path.join(work, paperId, "03-figures")).catch(() => null);
  if (!root) return null;
  const candidate = await realpath(path.join(root, relative)).catch(() => null);
  if (!candidate || !candidate.startsWith(root + path.sep)) return null;
  return candidate;
}

export function createReviewServer({ work, port }) {
  const allowedHosts = new Set([`127.0.0.1:${port}`, `localhost:${port}`]);
  return createServer(async (request, response) => {
    const send = (status, body, type = "text/plain; charset=utf-8") => {
      response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
        "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'" });
      response.end(body);
    };
    // Refuse anything not addressed to this machine (DNS rebinding) and anything but reads.
    if (!allowedHosts.has(request.headers.host || "")) return send(403, "Local only");
    if (request.method !== "GET") return send(405, "Read only");
    const url = new URL(request.url, `http://${request.headers.host}`);
    try {
      if (STATIC[url.pathname]) {
        const file = path.join(HERE, STATIC[url.pathname]);
        return send(200, await readFile(file), TYPES[path.extname(file)]);
      }
      if (url.pathname === "/api/papers") return send(200, JSON.stringify(await listPapers(work)), TYPES[".json"]);
      const paper = url.pathname.match(/^\/api\/papers\/([^/]+)$/);
      if (paper) {
        const data = await loadPaper(work, paper[1]);
        return data ? send(200, JSON.stringify(data), TYPES[".json"]) : send(404, "No such paper");
      }
      const figure = url.pathname.match(/^\/figures\/([^/]+)\/(.+)$/);
      if (figure) {
        const file = await figureFile(work, figure[1], decodeURIComponent(figure[2]));
        return file ? send(200, await readFile(file), TYPES[path.extname(file)]) : send(404, "Not found");
      }
      return send(404, "Not found");
    } catch {
      return send(500, "Could not read the ingestion output");
    }
  });
}

async function main() {
  const work = path.resolve(process.env.DMOCKS_INGESTION_WORK || path.join(homedir(), "dmocks-ingestion-work"));
  const port = Number(process.env.DMOCKS_INGESTION_REVIEW_PORT || 6796);
  if (!Number.isInteger(port) || port < 1024 || port > 65535 || port === 4190 || (port >= 4399 && port <= 4999)) {
    throw new Error("Choose a port outside 4190 and 4399-4999");
  }
  if (!(await stat(work).then(info => info.isDirectory(), () => false))) throw new Error(`No ingestion work folder at ${work}`);
  if (insideGit(work)) throw new Error("The work folder is inside a Git repository; private papers must stay outside it");
  createReviewServer({ work, port }).listen(port, "127.0.0.1", () => {
    console.log(`Ingestion review (local only): http://127.0.0.1:${port}/  reading ${work}`);
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
