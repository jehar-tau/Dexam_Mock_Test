// INGESTION REVIEW · LOCAL ONLY. Browser side of the development-only review page.
import { checkAnswer, describeKey } from "/answer-check.mjs";

const $ = selector => document.querySelector(selector);
const state = { paper: null, index: 0, zoom: 1, view: null, step: -1, attempts: {} };
const SVG_NS = "http://www.w3.org/2000/svg";
const OVERLAY_TAGS = new Set(["g", "circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "text", "tspan"]);
const OVERLAY_ATTRS = new Set(["cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points", "d",
  "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap", "stroke-linejoin", "opacity",
  "font-size", "font-weight", "text-anchor", "transform"]);

function store(name, value) {
  try { localStorage.setItem(name, JSON.stringify(value)); } catch { /* private window: keep in memory only */ }
}
function recall(name, fallback) {
  try { return JSON.parse(localStorage.getItem(name)) ?? fallback; } catch { return fallback; }
}
function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (value == null || value === false) continue;
    if (name === "class") node.className = value;
    else if (name.startsWith("on")) node.addEventListener(name.slice(2), value);
    else node.setAttribute(name, value === true ? "" : value);
  }
  for (const child of children.flat()) if (child != null && child !== false) node.append(child instanceof Node ? child : String(child));
  return node;
}

// Overlay fragments come from the drafter's private files. Rebuild them from an allow-list
// so only shapes and text are ever inserted, whatever a file contains.
function safeOverlay(fragment) {
  const doc = new DOMParser().parseFromString(`<svg xmlns="${SVG_NS}">${fragment}</svg>`, "image/svg+xml");
  if (doc.querySelector("parsererror")) return null;
  const copy = source => {
    const tag = source.localName;
    if (!OVERLAY_TAGS.has(tag)) return null;
    const node = document.createElementNS(SVG_NS, tag);
    for (const { name, value } of source.attributes) {
      if (OVERLAY_ATTRS.has(name) && !/url|javascript/i.test(value)) node.setAttribute(name, value);
    }
    for (const child of source.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) node.append(child.textContent);
      else if (child.nodeType === Node.ELEMENT_NODE) { const inner = copy(child); if (inner) node.append(inner); }
    }
    return node;
  };
  const group = document.createElementNS(SVG_NS, "g");
  for (const child of doc.documentElement.children) { const node = copy(child); if (node) group.append(node); }
  return group;
}

function figureUrl(file) {
  return `/figures/${encodeURIComponent(state.paper.paperId)}/${file.split("/").map(encodeURIComponent).join("/")}`;
}

// ------------------------------------------------------------------ list

function attemptKey() { return `ingestion-review:${state.paper.paperId}`; }

function renderList() {
  const list = $("#list");
  list.replaceChildren();
  for (const part of ["A", "B"]) {
    const items = state.paper.questions.map((q, i) => [q, i]).filter(([q]) => q.part === part);
    if (!items.length) continue;
    list.append(el("h3", {}, part === "A" ? "Part A" : "Part B"));
    const grid = el("div", { class: "grid" });
    for (const [q, i] of items) {
      const attempt = state.attempts[q.key];
      const hasSolution = q.solution && q.solutionCheck?.status !== "held";
      grid.append(el("a", {
        href: `#${q.key}`, class: attempt?.result || null, "aria-current": i === state.index ? "true" : null,
        title: `${q.key.toUpperCase()} · ${q.type}${hasSolution ? " · solution drafted" : ""}${q.flags.length ? " · flagged: " + q.flags.join(", ") : ""}`,
        onclick: event => { event.preventDefault(); go(i); },
      }, q.part === "A" ? String(q.number) : `B${q.number}`, q.flags.length ? el("span", { class: "dot", "aria-hidden": "true" }) : null));
    }
    list.append(grid);
  }
  list.append(el("p", { class: "legend" }, "Bar under a number: green correct, orange partly right, red wrong. Orange dot: flagged in ingestion. Keys: ", el("kbd", {}, "←"), " ", el("kbd", {}, "→"), " questions, ", el("kbd", {}, "+"), " ", el("kbd", {}, "−"), " zoom."));
  const attempted = Object.values(state.attempts);
  const correct = attempted.filter(a => a.result === "correct").length;
  $("#score").textContent = attempted.length ? `${correct} of ${attempted.length} attempted correct` : "";
}

// ------------------------------------------------------------------ figure viewer

function views(q) {
  const out = [];
  q.figures.forEach((figure, n) => {
    out.push({ id: `${figure.id}`, label: q.figures.length > 1 ? `Figure ${n + 1}${figure.role && figure.role !== "figure" ? ` (${figure.role})` : ""}` : "Figure",
      src: figure.file, width: figure.width, height: figure.height, figure, vector: false });
    if (figure.vector?.file) out.push({ id: `${figure.id}:svg`, label: `${q.figures.length > 1 ? `Figure ${n + 1} ` : ""}SVG`, src: figure.vector.file,
      width: figure.width, height: figure.height, figure, vector: true });
  });
  if (q.block) out.push({ id: "block", label: "Whole question", src: q.block.file, width: q.block.width, height: q.block.height, figure: null, vector: false });
  return out;
}

function renderViewer(q, revealSolution) {
  const options = views(q);
  if (!options.length) return null;
  const current = options.find(v => v.id === state.view) || options[0];
  state.view = current.id;
  if (state.zoom == null) {  // start at actual size, or smaller if the image is wider than the column
    const column = Math.min(980, window.innerWidth - (window.innerWidth > 760 ? 220 : 0));
    const room = Math.max(240, column - 72);
    state.zoom = Math.min(1, Math.round((room / current.width) * 100) / 100);
  }
  const stage = el("div", { class: `stage${state.zoom >= 2 && !current.vector ? " pixels" : ""}` });
  stage.style.width = `${Math.round(current.width * state.zoom)}px`;
  stage.append(el("img", { src: figureUrl(current.src), alt: `${current.label} for ${q.key.toUpperCase()}`, width: current.width, height: current.height }));
  const overlay = q.solution?.overlay;
  if (revealSolution && overlay && current.figure && overlay.figure === current.figure.id) {
    const svg = document.createElementNS(SVG_NS, "svg");
    svg.setAttribute("class", "overlay");
    svg.setAttribute("viewBox", overlay.viewBox);
    svg.setAttribute("preserveAspectRatio", "none");
    const names = (q.solution.steps || []).map(s => s.overlay).filter(Boolean);
    const shown = state.step < 0 ? names : (q.solution.steps || []).slice(0, state.step + 1).map(s => s.overlay).filter(Boolean);
    for (const [name, fragment] of Object.entries(overlay.steps || {})) {
      if (!shown.includes(name)) continue;
      const group = safeOverlay(fragment);
      if (group) svg.append(group);
    }
    stage.append(svg);
  }
  const tools = el("div", { class: "tools", role: "toolbar", "aria-label": "Figure" },
    options.map(v => el("button", { type: "button", "aria-pressed": String(v.id === current.id), onclick: () => { state.view = v.id; state.zoom = null; render(); } }, v.label)),
    el("span", { class: "sep", "aria-hidden": "true" }),
    el("button", { type: "button", "aria-label": "Shrink", onclick: () => zoom(state.zoom / 1.25) }, "−"),
    el("span", { class: "zoom", "aria-live": "polite" }, `${Math.round(state.zoom * 100)}%`),
    el("button", { type: "button", "aria-label": "Enlarge", onclick: () => zoom(state.zoom * 1.25) }, "+"),
    el("button", { type: "button", onclick: () => zoom(1) }, "Actual size"),
    el("button", { type: "button", onclick: () => fit(current) }, "Fit"));
  const figure = current.figure;
  const notes = [];
  if (figure) {
    notes.push(`${current.vector ? "Verified SVG (awaiting approval)" : figure.source === "embedded" ? "Original embedded pixels" : "Page render"} · ${figure.width} × ${figure.height} px`);
    if (current.vector) notes.push(`ink overlap ${figure.vector.metrics.inkIou}, edge p99 ${figure.vector.metrics.edgeP99} px, SSIM ${figure.vector.metrics.ssim}${figure.vector.textAsOutlines ? ", text as outlines" : ""}`);
    else if (figure.vector?.status) notes.push(`SVG ${figure.vector.status}${figure.vector.reasons?.length ? `: ${figure.vector.reasons.join(", ")}` : ""}`);
    if (figure.notes.length) notes.push(figure.notes.join(", "));
  } else notes.push(`The question as printed, ${current.width} × ${current.height} px`);
  return el("section", { class: "viewer", "aria-label": "Figure viewer" }, tools, el("div", { class: "scroll" }, stage), el("p", { class: "caption" }, notes.join(" · ")));
}

function zoom(value) { state.zoom = Math.min(6, Math.max(0.2, Math.round(value * 100) / 100)); render(); }
function fit(view) {
  const width = $("#question").clientWidth - 80;
  zoom(Math.min(width / view.width, 3));
}

// ------------------------------------------------------------------ question

function chosenLetters(q) {
  return [...document.querySelectorAll(`input[name="answer-${q.key}"]:checked`)].map(input => input.value);
}

function renderAnswerInput(q, attempt, revealed) {
  if (q.type === "NAT") {
    return el("p", { class: "nat" }, el("label", {}, "Your answer ", el("input", { id: "nat", inputmode: "decimal", autocomplete: "off", value: attempt?.answer ?? "", "aria-label": "Your numerical answer" })));
  }
  if (q.type !== "MCQ" && q.type !== "MSQ") return el("p", { class: "muted" }, "Drawing question: no answer to check here.");
  const letters = q.options.length ? q.options : ["A", "B", "C", "D"].map(key => ({ key, text: "" }));
  const correct = revealed ? (describeKey(q.officialKey?.raw, q.type) || "").split(" or ")[0].split(",") : [];
  return el("ul", { class: "options", role: "list" }, letters.map(option => {
    const chosen = attempt?.answer?.includes(option.key);
    const mark = revealed && correct.includes(option.key) ? "correct" : revealed && chosen ? "chosen-wrong" : null;
    return el("li", {}, el("label", { class: mark },
      el("input", { type: q.type === "MCQ" ? "radio" : "checkbox", name: `answer-${q.key}`, value: option.key, checked: chosen }),
      el("span", {}, el("strong", {}, option.key), option.text ? ` ${option.text}` : el("span", { class: "muted" }, " (see the figure)"))));
  }));
}

function keyPanel(q) {
  const key = q.officialKey;
  if (!key) return el("section", { class: "panel" }, el("h2", {}, "Answer key"), el("p", { class: "muted" }, "No key read for this question yet."));
  const bank = { same: "matches the current bank", different: "differs from the current bank", "not-in-bank": "question missing from the bank",
    "bank-missing": "bank has no answer", "bank-unreadable": "bank answer was not a key", "same-bank-was-solved": "matches the bank's solved answer" }[key.bank] || null;
  return el("section", { class: "panel" }, el("h2", {}, "Answer key"), el("dl", {},
    el("dt", {}, "Official key"), el("dd", {}, key.raw ? describeKey(key.raw, q.type) || key.raw : el("span", { class: "muted" }, key.status)),
    el("dt", {}, "As printed"), el("dd", {}, key.printed || "—"),
    el("dt", {}, "Read by"), el("dd", {}, `${key.readBy || "—"} · ${state.paper.keySource || "answer key"}${key.page ? `, page ${key.page}` : ""}`),
    bank ? [el("dt", {}, "Bank"), el("dd", {}, el("span", { class: `chip ${key.bank === "same" ? "good" : "warn"}` }, bank))] : null,
    key.notes?.length ? [el("dt", {}, "Notes"), el("dd", {}, key.notes.join("; "))] : null,
    key.checks?.length ? [el("dt", {}, "Checks"), el("dd", {}, el("span", { class: "chip bad" }, key.checks.join(", ")))] : null));
}

function solutionPanel(q) {
  const s = q.solution;
  if (!s) return el("section", { class: "panel" }, el("h2", {}, "Worked solution"), el("p", { class: "muted" }, "No solution drafted yet."));
  const check = q.solutionCheck || {};
  const steps = s.steps || [];
  return el("section", { class: "panel" },
    el("h2", {}, "Worked solution ", el("span", { class: `chip ${check.status === "held" ? "bad" : check.status === "verified" ? "good" : "warn"}` }, check.status || "unchecked"),
      " ", el("span", { class: "chip" }, `${s.meta?.topic || ""} · ${s.meta?.difficulty || ""} · ${s.meta?.seconds || "?"} s`)),
    el("p", {}, "Answer ", el("strong", {}, String(s.answer?.value ?? "—"))),
    el("p", { class: "idea" }, s.keyIdea),
    el("ol", { class: "steps" }, steps.map((step, i) => el("li", { class: state.step === i ? "on" : null, tabindex: "0",
      onclick: () => { state.step = state.step === i ? -1 : i; render(); },
      onkeydown: event => { if (event.key === "Enter") { state.step = state.step === i ? -1 : i; render(); } } }, step.text))),
    steps.some(st => st.overlay) ? el("div", { class: "actions" },
      el("button", { type: "button", onclick: () => { state.step = Math.max(0, state.step - 1); render(); } }, "Previous step"),
      el("span", { class: "muted" }, state.step < 0 ? "All steps shown" : `Step ${state.step + 1} of ${steps.length}`),
      el("button", { type: "button", onclick: () => { state.step = Math.min(steps.length - 1, state.step + 1); render(); } }, "Next step"),
      el("button", { type: "button", onclick: () => { state.step = -1; render(); } }, "Show all")) : null,
    s.optionCheck?.length ? el("ul", {}, s.optionCheck.map(c => el("li", {}, el("strong", {}, c.option), " ",
      el("span", { class: `verdict-${c.verdict}` }, c.verdict), " — ", c.why))) : null,
    s.trap ? el("p", {}, el("strong", {}, "Trap: "), s.trap) : null,
    s.fastTrack ? el("p", {}, el("strong", {}, "Faster: "), s.fastTrack) : null,
    [...(check.errors || []), ...(check.warnings || [])].length ? el("ul", { class: "problems" }, [...(check.errors || []), ...(check.warnings || [])].map(p => el("li", {}, p))) : null);
}

function render() {
  if (!state.paper) return;
  const q = state.paper.questions[state.index];
  const attempt = state.attempts[q.key];
  const tryFirst = $("#try-first").checked;
  const revealed = !tryFirst || Boolean(attempt) || state.revealed === q.key;
  const main = $("#question");
  const flags = q.flags.map(flag => el("span", { class: "chip warn" }, flag));
  main.replaceChildren(...[
    el("div", { class: "head" }, el("h1", {}, q.part === "A" ? `Q${q.number}` : `Part B · Q${q.number}`),
      el("span", { class: "chip" }, q.type || "type unknown"), q.ocr ? el("span", { class: "chip" }, "text read by OCR") : null, flags),
    el("p", { class: "prompt" }, q.prompt || el("span", { class: "muted" }, "(No text: the question is in the figure.)")),
    renderViewer(q, revealed),
    renderAnswerInput(q, attempt, revealed),
    q.type === "NAT" || q.type === "MCQ" || q.type === "MSQ" ? el("div", { class: "actions" },
      el("button", { type: "button", class: "primary", onclick: () => submit(q) }, "Check my answer"),
      !revealed ? el("button", { type: "button", onclick: () => { state.revealed = q.key; render(); } }, "Show answer and solution") : null,
      attempt ? el("button", { type: "button", onclick: () => { delete state.attempts[q.key]; store(attemptKey(), state.attempts); render(); renderList(); } }, "Try again") : null) : null,
    attempt ? el("p", { class: `result ${attempt.result}`, role: "status" }, {
      correct: "Correct.", partial: "Partly right: every option you chose is correct, but you missed some.", wrong: "Not right.",
      "no-key": "No official key to check against.", "not-a-number": "Enter a number.", unanswered: "Choose an option first." }[attempt.result] || attempt.result) : null,
    revealed ? keyPanel(q) : null,
    revealed ? solutionPanel(q) : el("p", { class: "muted" }, "Answer first, or choose “Show answer and solution”. Turn off “Try first” to see everything at once."),
    el("div", { class: "nav" },
      el("button", { type: "button", disabled: state.index === 0, onclick: () => go(state.index - 1) }, "← Previous"),
      el("button", { type: "button", disabled: state.index === state.paper.questions.length - 1, onclick: () => go(state.index + 1) }, "Next →")),
  ].filter(Boolean));
}

function submit(q) {
  const answer = q.type === "NAT" ? ($("#nat")?.value ?? "") : chosenLetters(q);
  const { result } = checkAnswer(q.officialKey?.raw, q.type, answer);
  if (result === "not-a-number" || result === "unanswered") {
    state.attempts[q.key] = { answer, result };
    render();
    delete state.attempts[q.key];
    return;
  }
  state.attempts[q.key] = { answer, result };
  store(attemptKey(), state.attempts);
  render();
  renderList();
}

function go(index) {
  state.index = Math.max(0, Math.min(state.paper.questions.length - 1, index));
  state.view = null;
  state.zoom = null;
  state.step = -1;
  state.revealed = null;
  const q = state.paper.questions[state.index];
  history.replaceState(null, "", `#${q.key}`);
  render();
  renderList();
  $("#question").focus({ preventScroll: true });
  window.scrollTo({ top: 0 });
}

async function loadPaper(id) {
  $("#question").replaceChildren(el("p", { class: "muted" }, "Loading…"));
  const response = await fetch(`/api/papers/${encodeURIComponent(id)}`);
  if (!response.ok) { $("#question").replaceChildren(el("p", {}, "Could not load this paper.")); return; }
  state.paper = await response.json();
  state.attempts = recall(attemptKey(), {});
  store("ingestion-review:paper", id);
  const wanted = location.hash.slice(1);
  const at = state.paper.questions.findIndex(q => q.key === wanted);
  go(at >= 0 ? at : 0);
}

async function start() {
  const papers = await (await fetch("/api/papers")).json();
  const select = $("#paper");
  if (!papers.length) { $("#question").replaceChildren(el("p", {}, "No ingested papers found in the work folder.")); return; }
  for (const paper of papers) select.append(el("option", { value: paper.id }, `${paper.id.toUpperCase()} (${paper.stages.length} stages)`));
  const remembered = recall("ingestion-review:paper", null);
  select.value = papers.some(p => p.id === remembered) ? remembered : (papers.find(p => p.id === "uceed-2026") || papers[0]).id;
  select.addEventListener("change", () => { history.replaceState(null, "", location.pathname); loadPaper(select.value); });
  $("#try-first").addEventListener("change", render);
  window.addEventListener("hashchange", () => {
    const at = state.paper?.questions.findIndex(q => q.key === location.hash.slice(1)) ?? -1;
    if (at >= 0 && at !== state.index) go(at);
  });
  document.addEventListener("keydown", event => {
    if (event.target.closest("input, select, textarea")) return;
    if (event.key === "ArrowRight") go(state.index + 1);
    else if (event.key === "ArrowLeft") go(state.index - 1);
    else if (event.key === "+" || event.key === "=") zoom(state.zoom * 1.25);
    else if (event.key === "-") zoom(state.zoom / 1.25);
  });
  await loadPaper(select.value);
}

start();
