/* Dependency-free backend and admin console for the Dexam Mock Test prototype. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const url = require("url");

const PORT = Number(process.env.PORT) || 4174;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "server", "data");
const USER_BANK_FILE = path.join(DATA_DIR, "user-bank.json");
const MOCKS_FILE = path.join(DATA_DIR, "mocks.json");
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const sandbox = { console: console, window: {} };
vm.createContext(sandbox);
[
  "exams.js",
  "data.js",
  "practice-data.js",
  "practice-batch-1.js",
  "practice-batch-2.js",
  "practice-batch-3.js"
].forEach((name) => {
  const filePath = path.join(ROOT, name);
  if (fs.existsSync(filePath)) {
    try {
      vm.runInContext(fs.readFileSync(filePath, "utf8"), sandbox, { filename: name });
    } catch (error) {
      console.error("[dexam backend] Failed to seed " + name + ": " + error.message);
    }
  }
});

const seedExams = sandbox.window.EXAM_CATALOG || [];
const seedPapers = sandbox.window.MOCK_PAPERS || [];
const seedQuestions = sandbox.window.PRACTICE_BANK || [];
const userBank = fs.existsSync(USER_BANK_FILE) ? JSON.parse(fs.readFileSync(USER_BANK_FILE, "utf8")) : [];
const savedMocks = fs.existsSync(MOCKS_FILE) ? JSON.parse(fs.readFileSync(MOCKS_FILE, "utf8")) : [];
const seedRows = flattenSeedQuestions();

function normText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[\s\-–—\/]+/g, " ")
    .replace(/[^a-z0-9 ]+/g, "")
    .trim();
}

function asArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === "object") return Object.values(value);
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function normOptions(value) {
  if (!value) return [];
  if (Array.isArray(value) && typeof value[0] === "string") {
    return value.map((text, index) => ({ id: "ABCDEFGH"[index], text: text }));
  }
  if (Array.isArray(value) && typeof value[0] === "object") {
    return value.map((option, index) => ({
      id: option.id || "ABCDEFGH"[index],
      text: option.text || option.value || option.label || ""
    })).filter((option) => option.text);
  }
  return [];
}

function normalizeQuestion(raw, defaults) {
  const item = raw && typeof raw === "object" ? raw : { prompt: String(raw) };
  const examId = item.examId || item.exam || defaults.examId || "";
  const exam = seedExams.find(
    (entry) =>
      normText(entry.id || "").includes(normText(examId)) ||
      normText(entry.name || "").includes(normText(examId))
  );
  const examKey = exam ? exam.id : normText(examId) || "general";
  const type = String(item.type || defaults.type || "MCQ").toUpperCase();
  const options = normOptions(item.options);
  const correct = item.correctAnswer || item.correct_answer || item.answer || "";
  const examSections = (exam && exam.officialSections) || [];
  const sectionDefaults = examSections.find((section) => section.type === type) || {};
  const marks = Number.isFinite(Number(item.marks)) ? Number(item.marks) : Number(sectionDefaults.marks || 1);
  const negative = Number.isFinite(Number(item.negative)) ? Number(item.negative) : Number(sectionDefaults.negative || 0);

  return {
    id: String(item.id || item._id || item["$id"] || ""),
    examId: examKey,
    type: type,
    topic: String(item.topic || defaults.topic || "General"),
    difficulty: String(item.difficulty || defaults.difficulty || "Medium"),
    marks: marks,
    negative: negative,
    prompt: String(item.prompt || item.question || item.text || ""),
    options: options.length ? options : undefined,
    correctAnswer: Array.isArray(correct) ? correct : (correct === undefined || correct === null || correct === "" ? undefined : correct),
    solution: String(item.solution || item.explanation || ""),
    source: item.source || defaults.source || "user",
    licence: item.licence || item.license || defaults.licence || "owned",
    status: item.status || defaults.status || "published",
    version: String(item.version || defaults.version || "1")
  };
}

function dedupeKey(question) {
  return [
    question.examId,
    question.type,
    normText(question.topic),
    normText(question.prompt),
    JSON.stringify((question.options || []).map((option) => normText(option.id + " " + option.text))),
    JSON.stringify(question.correctAnswer)
  ].join("::");
}

function flattenSeedQuestions() {
  const rows = [];
  seedPapers.forEach((paper) => {
    (paper.sections || []).forEach((section) => {
      (section.questions || []).forEach((question) => {
        rows.push({
          ...question,
          examId: paper.examId || question.examId,
          type: question.type || section.type,
          topic: question.topic || "General",
          difficulty: question.difficulty,
          marks: question.marks || section.marks,
          negative: question.negative === undefined ? (section.negative || 0) : question.negative,
          source: question.source || "seeded",
          licence: question.licence || question.license || "owned",
          status: question.status || "published",
          version: String(question.version || "1")
        });
      });
    });
  });
  seedQuestions.forEach((question) => {
    rows.push({
      ...question,
      topic: question.topic || "General",
      difficulty: question.difficulty,
      marks: question.marks,
      negative: question.negative,
      source: question.source || "seeded",
      licence: question.licence || question.license || "owned",
      status: question.status || "published",
      version: String(question.version || "1")
    });
  });
  return rows;
}

function parseCsvRows(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuote = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuote = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // Ignore
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

function parseCsvQuestions(text) {
  const rows = parseCsvRows(text);
  if (!rows.length) return [];
  const header = rows[0].map((name) => normText(name));
  const data = rows.slice(1);
  const aliasMap = {
    id: "id",
    exam: "exam",
    topic: "topic",
    difficulty: "difficulty",
    prompt: "prompt",
    question: "prompt",
    correctanswer: "correctAnswer",
    solution: "solution"
  };
  const parsed = [];
  data.forEach((cells) => {
    const item = {};
    header.forEach((key, index) => {
      const mapped = aliasMap[key] || key;
      item[mapped] = cells[index];
    });
    if (!item.prompt) return;
    const options = [];
    ["a", "b", "c", "d", "e", "f"].forEach((suffix) => {
      const letter = suffix.toUpperCase();
      const value = item["option" + suffix];
      if (value) {
        options.push({ id: letter, text: value });
        delete item["option" + suffix];
      }
    });
    item.options = options;
    parsed.push(item);
  });
  return parsed;
}

function parseContent(name, content) {
  const isJson =
    (name || "").toLowerCase().endsWith(".json") ||
    (content || "").trim().startsWith("{") ||
    (content || "").trim().startsWith("[");
  if (isJson) {
    try {
      const data = JSON.parse(content);
      if (Array.isArray(data)) return { questions: data };
      if (data && Array.isArray(data.questions)) return { questions: data.questions };
      if (data && Array.isArray(data.papers)) {
        const flat = [];
        data.papers.forEach((paper) => {
          (paper.sections || []).forEach((section) => {
            (section.questions || []).forEach((question) => {
              flat.push({
                ...question,
                examId: paper.examId || question.examId,
                type: question.type || section.type,
                topic: question.topic || "General",
                marks: question.marks || section.marks,
                negative: question.negative === undefined ? (section.negative || 0) : question.negative,
                source: question.source || "user",
                licence: question.licence || "owned",
                status: question.status || "published",
                version: String(question.version || "1")
              });
            });
          });
        });
        return { questions: flat };
      }
    } catch (error) {
      throw new Error("Unable to parse JSON in " + name + ": " + error.message);
    }
  }
  return { questions: parseCsvQuestions(content) };
}

function ingest(files, defaults) {
  let added = 0;
  let duplicate = 0;
  let rejected = 0;
  const errors = [];
  const nextBank = [...userBank];

  files.forEach((fileData) => {
    const name = fileData.name || "upload";
    let rows = [];
    try {
      rows = asArray(parseContent(name, fileData.content).questions);
    } catch (error) {
      errors.push(error.message);
      return;
    }
    rows.forEach((raw) => {
      const question = normalizeQuestion(raw, {
        examId: fileData.examId || defaults.examId,
        topic: fileData.topic || defaults.topic,
        difficulty: fileData.difficulty || defaults.difficulty,
        source: fileData.source || defaults.source || "user",
        licence: fileData.licence || defaults.licence || "owned",
        status: fileData.status || "published",
        version: "1"
      });

      const key = dedupeKey(question);
      const exists = [...seedRows, ...nextBank].some((item) => dedupeKey(item) === key);
      if (exists) duplicate += 1;
      else {
        nextBank.push(question);
        added += 1;
      }
    });
  });

  if (added) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    fs.writeFileSync(USER_BANK_FILE, JSON.stringify(nextBank, null, 2));
    userBank.length = 0;
    Array.prototype.push.apply(userBank, nextBank);
  }
  return { added: added, duplicate: duplicate, rejected: rejected, errors: errors };
}

function buildMock(payload) {
  const examId = payload.examId || "uceed";
  const type = String(payload.type || "MCQ").toUpperCase();
  const topic = payload.topic;
  const difficulty = payload.difficulty;
  const limit = Math.max(1, Math.min(50, Number(payload.count) || 10));
  const available = [...flattenSeedQuestions(), ...userBank].filter((question) => {
    return (
      (!examId || question.examId === examId) &&
      (!type || type === question.type) &&
      (!topic || (Array.isArray(topic) ? topic.includes(question.topic) : question.topic === topic)) &&
      (!difficulty || question.difficulty === difficulty)
    );
  });
  const paper = {
    id: "generated-" + Date.now(),
    examId: examId,
    examName: (seedExams.find((exam) => exam.id === examId) || {}).name || "Custom Exam",
    year: "practice",
    mode: "custom",
    title: payload.title || "Generated mock",
    subtitle: payload.subtitle || "Created from the local question bank",
    description:
      "A generated paper using the local bank. Topics: " +
      (topic ? (Array.isArray(topic) ? topic.join(", ") : topic) : "all topics") +
      " · difficulty: " +
      (difficulty || "any") +
      " · question type: " +
      type,
    durationMinutes: Number(payload.durationMinutes) || 20,
    totalMarks: 0,
    sections: [
      {
        id: "section-1",
        title: "Section 1",
        label: type === "NAT" ? "Numerical Answer" : type === "MSQ" ? "Multiple Select" : "Multiple Choice",
        type: type,
        marks: null,
        negative: null,
        instructions: "Selected from the current bank.",
        questions: []
      }
    ]
  };
  const chosen = available.slice(0, limit);
  let marks = 0;
  let negative = 0;
  chosen.forEach((question) => {
    paper.sections[0].questions.push(question);
    marks += Number(question.marks || 0);
    negative += Number(question.negative || 0);
  });
  paper.sections[0].marks = chosen.length ? marks / chosen.length : null;
  paper.sections[0].negative = chosen.length ? negative / chosen.length : null;
  paper.totalMarks = marks;
  return paper;
}

function resultJson(res, data, status) {
  res.writeHead(status || 200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function api(req, res) {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname === "/api/health") return resultJson(res, { ok: true, seeded: true, port: PORT });
  if (parsed.pathname === "/api/state") {
    const merged = [...seedRows, ...userBank];
    const exams = seedExams.map((exam) => ({
      id: exam.id,
      name: exam.name,
      topics: exam.topics.map((topic) => topic.name),
      officialPattern: exam.officialPattern
    }));
    const papers = seedPapers.map((paper) => ({
      id: paper.id,
      examId: paper.examId,
      title: paper.title,
      durationMinutes: paper.durationMinutes,
      questions: (paper.sections || []).reduce(
        (sum, section) => sum + (section.questions || []).length,
        0
      )
    }));
    return resultJson(res, {
      exams: exams,
      papers: papers,
      questions: merged,
      counts: {
        total: merged.length,
        byExam: exams.reduce((acc, exam) => {
          const items = merged.filter((question) => question.examId === exam.id);
          acc[exam.name] = {
            total: items.length,
            topics: exam.topics.reduce((topicAcc, topic) => {
              topicAcc[topic] = items.filter((q) => q.topic === topic).length;
              return topicAcc;
            }, {})
          };
          return acc;
        }, {})
      }
    });
  }
  if (parsed.pathname === "/api/questions") {
    const merged = [...seedRows, ...userBank];
    const filtered = merged.filter((question) => {
      if (parsed.query.exam && question.examId !== parsed.query.exam) return false;
      if (parsed.query.topic && question.topic !== parsed.query.topic) return false;
      if (parsed.query.type && question.type !== parsed.query.type) return false;
      if (parsed.query.difficulty && question.difficulty !== parsed.query.difficulty) return false;
      if (parsed.query.search) {
        const search = String(parsed.query.search).toLowerCase();
        const prompt = (question.prompt || "").toLowerCase();
        const solution = (question.solution || "").toLowerCase();
        return prompt.includes(search) || solution.includes(search);
      }
      return true;
    });
    const limit = Math.max(0, Number(parsed.query.limit) || merged.length);
    const offset = Math.max(0, Number(parsed.query.offset) || 0);
    return resultJson(res, {
      total: merged.length,
      shown: filtered.length,
      offset: offset,
      limit: limit,
      questions: filtered.slice(offset, offset + limit)
    });
  }
  if (parsed.pathname === "/api/exams") return resultJson(res, seedExams);
  if (parsed.pathname === "/api/mocks" && req.method === "GET") return resultJson(res, savedMocks);
  if (parsed.pathname === "/api/ingest" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const report = ingest(payload.files || [], payload);
        resultJson(res, report);
      } catch (error) {
        resultJson(res, { error: error.message }, 400);
      }
    });
    return;
  }
  if (parsed.pathname === "/api/mocks" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        const payload = JSON.parse(body || "{}");
        const paper = buildMock(payload);
        if (payload.dryRun === true) {
          resultJson(res, { paper: paper, saved: false });
        } else {
          savedMocks.push(paper);
          fs.mkdirSync(DATA_DIR, { recursive: true });
          fs.writeFileSync(MOCKS_FILE, JSON.stringify(savedMocks, null, 2));
          resultJson(res, { paper: paper, saved: true });
        }
      } catch (error) {
        resultJson(res, { error: error.message }, 400);
      }
    });
    return;
  }
  resultJson(res, { error: "Not found" }, 404);
}

function serveStatic(pathname, res) {
  const finalPath = pathname === "/" ? "index.html" : pathname === "/admin" ? "admin.html" : pathname;
  const filePath = path.join(ROOT, finalPath);
  if (!filePath.startsWith(ROOT)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  const stats = fs.statSync(filePath);
  if (!stats.isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer((req, res) => {
  const parsed = url.parse(req.url, true);
  if (parsed.pathname.startsWith("/api/")) {
    api(req, res);
    return;
  }
  serveStatic(parsed.pathname, res);
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("[dexam backend] admin console: http://127.0.0.1:" + PORT + "/admin.html");
  console.log("[dexam backend] static app:     http://127.0.0.1:" + PORT + "/");
});
