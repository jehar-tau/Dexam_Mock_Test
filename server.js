/* Dependency-free backend and admin console for the Dexam Mock Test prototype. */

const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const url = require("url");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
let DatabaseSync = null;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (error) {
  console.warn("[dexam backend] node:sqlite unavailable: " + error.message);
}

const PORT = Number(process.env.PORT) || 4174;
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "server", "data");
const USER_BANK_FILE = path.join(DATA_DIR, "user-bank.json");
const MOCKS_FILE = path.join(DATA_DIR, "mocks.json");
const OFFICIAL_DB_FILE = path.join(DATA_DIR, "dexam.sqlite");
const GENERIC_BANK_FILE = path.join(DATA_DIR, "generic-question-bank.json");
const NEEDS_KEY_BANK_FILE = path.join(DATA_DIR, "needs-answer-key-bank.json");
const PART_B_BANK_FILE = path.join(DATA_DIR, "part-b-question-bank.json");
const OFFICIAL_MEDIA_DIR = path.join(DATA_DIR, "media");
const OFFICIAL_SOURCES_DIR = path.join(DATA_DIR, "sources");
const INGEST_SCRIPT = path.join(ROOT, "tools", "ingest_official_pdf.py");
const PYTHON_BIN = process.env.PYTHON || "python3";
let officialDb = null;
let officialHasCropReview = false;
const CROP_REVIEW_STATES = ["pending", "approved", "rejected"];
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
    figurePaths: Array.isArray(item.figurePaths) ? item.figurePaths.map(String) : undefined,
    pageImages: Array.isArray(item.pageImages) ? item.pageImages.map(String) : undefined,
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

function getOfficialDb() {
  if (!DatabaseSync) return null;
  if (officialDb) return officialDb;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  officialDb = new DatabaseSync(OFFICIAL_DB_FILE);
  officialDb.exec("PRAGMA journal_mode = WAL;");
  officialDb.exec(`
    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      exam_id TEXT NOT NULL,
      year INTEGER,
      title TEXT NOT NULL,
      source_note TEXT,
      question_pdf TEXT,
      answer_pdf TEXT,
      page_count INTEGER DEFAULT 0,
      imported_at TEXT,
      status TEXT DEFAULT 'imported'
    );
    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      paper_id TEXT NOT NULL,
      question_no TEXT,
      question_type TEXT DEFAULT 'MCQ',
      topic TEXT DEFAULT 'Unassigned',
      subtopic TEXT DEFAULT '',
      difficulty TEXT DEFAULT 'Unassessed',
      prompt TEXT NOT NULL,
      options_json TEXT,
      answer_key TEXT,
      answer_status TEXT DEFAULT 'pending',
      explanation TEXT,
      explanation_status TEXT DEFAULT 'pending',
      explanation_source TEXT,
      reference_url TEXT,
      page_no INTEGER,
      page_images_json TEXT,
      figure_paths_json TEXT,
      crop_review TEXT DEFAULT 'pending',
      content_hash TEXT UNIQUE,
      status TEXT DEFAULT 'review',
      created_at TEXT,
      updated_at TEXT,
      FOREIGN KEY(paper_id) REFERENCES papers(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS imports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      paper_id TEXT,
      files_json TEXT,
      report_json TEXT,
      created_at TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
  `);
  // Older databases gain this column through tools/migrate_crop_review.py, which backs up first.
  officialHasCropReview = officialDb.prepare("PRAGMA table_info(questions)").all()
    .some((column) => column.name === "crop_review");
  return officialDb;
}

function parseJsonValue(value, fallback) {
  if (!value) return fallback;
  try {
    return JSON.parse(value);
  } catch (error) {
    return fallback;
  }
}

function mediaUrl(value) {
  const text = String(value || "").replace(/\\/g, "/");
  const marker = "server/data/media/";
  const index = text.indexOf(marker);
  return index >= 0 ? "/media/" + text.slice(index + marker.length) : text;
}

function normalizeOfficialQuestion(row) {
  if (!row) return null;
  return {
    id: row.id,
    paperId: row.paper_id,
    questionNo: row.question_no,
    type: row.question_type,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    prompt: row.prompt,
    options: parseJsonValue(row.options_json, []),
    answerKey: row.answer_key || "",
    answerStatus: row.answer_status,
    explanation: row.explanation || "",
    explanationStatus: row.explanation_status,
    explanationSource: row.explanation_source || "",
    referenceUrl: row.reference_url || "",
    pageNo: row.page_no,
    pageImages: parseJsonValue(row.page_images_json, []).map(mediaUrl),
    figurePaths: parseJsonValue(row.figure_paths_json, []).map(mediaUrl),
    cropReview: row.crop_review || "pending",
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function officialState() {
  const db = getOfficialDb();
  if (!db) {
    return { available: false, papers: [], counts: { papers: 0, questions: 0, withAnswers: 0, withExplanations: 0, pendingReview: 0 } };
  }
  const papers = db.prepare(`
    SELECT p.*,
      (SELECT COUNT(*) FROM questions q WHERE q.paper_id = p.id) AS question_count,
      (SELECT COUNT(*) FROM questions q WHERE q.paper_id = p.id AND q.answer_key IS NOT NULL AND q.answer_key <> '') AS answer_count,
      (SELECT COUNT(*) FROM questions q WHERE q.paper_id = p.id AND q.explanation_status = 'pending') AS pending_count
    FROM papers p
    ORDER BY p.year DESC, p.exam_id ASC
  `).all().map((row) => ({
    id: row.id,
    examId: row.exam_id,
    year: row.year,
    title: row.title,
    pageCount: row.page_count,
    questionCount: row.question_count,
    answerCount: row.answer_count,
    pendingCount: row.pending_count,
    importedAt: row.imported_at,
    questionPdf: row.question_pdf,
    answerPdf: row.answer_pdf,
    status: row.status
  }));
  const totals = db.prepare(`
    SELECT
      COUNT(*) AS questions,
      SUM(CASE WHEN answer_key IS NOT NULL AND answer_key <> '' THEN 1 ELSE 0 END) AS with_answers,
      SUM(CASE WHEN explanation IS NOT NULL AND explanation <> '' THEN 1 ELSE 0 END) AS with_explanations,
      SUM(CASE WHEN status IN ('review', 'needs-verification') THEN 1 ELSE 0 END) AS pending_review
    FROM questions
  `).get();
  return {
    available: true,
    papers: papers,
    counts: {
      papers: papers.length,
      questions: totals.questions || 0,
      withAnswers: totals.with_answers || 0,
      withExplanations: totals.with_explanations || 0,
      pendingReview: totals.pending_review || 0
    }
  };
}

function officialQuestions(query) {
  const db = getOfficialDb();
  if (!db) return { total: 0, questions: [] };
  const clauses = [];
  const params = {};
  if (query.paperId) {
    clauses.push("paper_id = :paperId");
    params.paperId = query.paperId;
  }
  if (query.examId) {
    clauses.push("paper_id IN (SELECT id FROM papers WHERE exam_id = :examId)");
    params.examId = query.examId;
  }
  if (query.type) {
    clauses.push("question_type = :type");
    params.type = String(query.type).toUpperCase();
  }
  if (query.topic) {
    clauses.push("topic = :topic");
    params.topic = query.topic;
  }
  if (query.status) {
    clauses.push("status = :status");
    params.status = query.status;
  }
  if (query.explanationStatus) {
    clauses.push("explanation_status = :explanationStatus");
    params.explanationStatus = query.explanationStatus;
  }
  if (query.cropReview && officialHasCropReview) {
    clauses.push("figure_paths_json NOT IN ('', '[]') AND COALESCE(crop_review, 'pending') = :cropReview");
    params.cropReview = query.cropReview;
  }
  if (query.search) {
    clauses.push("(prompt LIKE :search OR explanation LIKE :search OR topic LIKE :search)");
    params.search = "%" + query.search + "%";
  }
  const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
  const total = db.prepare("SELECT COUNT(*) AS count FROM questions" + where).get(params).count;
  const limit = Math.max(1, Math.min(500, Number(query.limit) || 50));
  const offset = Math.max(0, Number(query.offset) || 0);
  params.limit = limit;
  params.offset = offset;
  const rows = db.prepare(
    "SELECT * FROM questions" + where + " ORDER BY paper_id DESC, CASE WHEN question_no GLOB 'B*' THEN 1 ELSE 0 END ASC, CAST(question_no AS INTEGER) ASC, question_no ASC LIMIT :limit OFFSET :offset"
  ).all(params);
  return { total: total, shown: rows.length, limit: limit, offset: offset, questions: rows.map(normalizeOfficialQuestion) };
}

function updateOfficialQuestion(id, payload) {
  const db = getOfficialDb();
  if (!db) throw new Error("SQLite is unavailable.");
  const allowed = {
    prompt: "prompt",
    optionsJson: "options_json",
    questionType: "question_type",
    topic: "topic",
    subtopic: "subtopic",
    difficulty: "difficulty",
    answerKey: "answer_key",
    answerStatus: "answer_status",
    explanation: "explanation",
    explanationStatus: "explanation_status",
    explanationSource: "explanation_source",
    referenceUrl: "reference_url",
    status: "status",
    cropReview: "crop_review"
  };
  if (payload.cropReview !== undefined) {
    if (!officialHasCropReview) throw new Error("crop_review column is missing; run tools/migrate_crop_review.py first.");
    if (!CROP_REVIEW_STATES.includes(payload.cropReview)) {
      throw new Error("Crop review must be one of: " + CROP_REVIEW_STATES.join(", ") + ".");
    }
    const current = db.prepare("SELECT figure_paths_json FROM questions WHERE id = ?").get(id);
    if (payload.cropReview === "approved" && current && !parseJsonValue(current.figure_paths_json, []).length) {
      throw new Error("Cannot approve a crop: this question has no figure crop.");
    }
  }
  if (payload.optionsJson !== undefined) {
    try {
      const options = JSON.parse(payload.optionsJson);
      if (!Array.isArray(options)) throw new Error("Options must be an array.");
    } catch (error) {
      throw new Error("Options must be valid JSON: " + error.message);
    }
  }
  const sets = [];
  const params = { id: id };
  Object.entries(allowed).forEach(([key, column]) => {
    if (payload[key] !== undefined) {
      sets.push(column + " = :" + key);
      params[key] = payload[key];
    }
  });
  if (!sets.length) return null;
  sets.push("updated_at = :updatedAt");
  params.updatedAt = new Date().toISOString();
  db.prepare("UPDATE questions SET " + sets.join(", ") + " WHERE id = :id").run(params);
  return normalizeOfficialQuestion(db.prepare("SELECT * FROM questions WHERE id = ?").get(id));
}

function readRequestBody(req, limit) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Upload is too large."));
        req.destroy();
        return;
      }
      body += chunk;
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function decodeBase64File(file, fallbackName) {
  if (!file || !file.contentBase64) throw new Error("Missing file content.");
  const raw = String(file.contentBase64).replace(/^data:[^;]+;base64,/, "");
  return {
    name: path.basename(file.name || fallbackName || "upload.pdf"),
    buffer: Buffer.from(raw, "base64")
  };
}

async function importOfficialPaper(payload) {
  const examId = String(payload.examId || "").toLowerCase();
  const year = Number(payload.year);
  if (!["uceed", "ceed", "nift", "nid"].includes(examId)) {
    throw new Error("Choose a valid exam.");
  }
  if (!Number.isFinite(year) || year < 2000 || year > 2100) {
    throw new Error("Enter a valid exam year.");
  }
  const paperFile = decodeBase64File(payload.paper, examId + "-" + year + "-questions.pdf");
  if (!paperFile.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("The question paper must be a PDF.");
  }
  fs.mkdirSync(OFFICIAL_SOURCES_DIR, { recursive: true });
  const paperPath = path.join(OFFICIAL_SOURCES_DIR, examId + "-" + year + "-questions.pdf");
  fs.writeFileSync(paperPath, paperFile.buffer);
  const args = [
    INGEST_SCRIPT,
    "--paper", paperPath,
    "--exam", examId,
    "--year", String(year),
    "--db", OFFICIAL_DB_FILE,
    "--media-root", OFFICIAL_MEDIA_DIR,
    "--replace",
    "--json"
  ];
  if (payload.title) args.push("--title", String(payload.title));
  if (payload.answers && payload.answers.contentBase64) {
    const answerFile = decodeBase64File(payload.answers, examId + "-" + year + "-answers.pdf");
    const answerExt = path.extname(answerFile.name).toLowerCase() || ".pdf";
    if (![".pdf", ".txt", ".csv"].includes(answerExt)) {
      throw new Error("The answer key must be a PDF, TXT, or CSV file.");
    }
    const answerPath = path.join(OFFICIAL_SOURCES_DIR, examId + "-" + year + "-answers" + answerExt);
    fs.writeFileSync(answerPath, answerFile.buffer);
    args.push("--answers", answerPath);
  }
  if (payload.ollamaModel) {
    args.push("--ollama-model", String(payload.ollamaModel));
  }
  if (payload.ollamaUrl) {
    args.push("--ollama-url", String(payload.ollamaUrl));
  }
  const result = await execFileAsync(PYTHON_BIN, args, {
    cwd: ROOT,
    timeout: 240000,
    maxBuffer: 1024 * 1024 * 4
  });
  const lines = String(result.stdout || "").trim().split(/\r?\n/).filter(Boolean);
  const report = lines.length ? JSON.parse(lines[lines.length - 1]) : {};
  report.stderr = String(result.stderr || "").trim();
  return report;
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
  if (parsed.pathname === "/api/reviewed-papers" && req.method === "GET") {
    const built = require("./server/lib/reviewed-papers").build();
    return resultJson(res, { papers: built.papers, publishable: built.publishable });
  }
  if (parsed.pathname === "/api/exams") return resultJson(res, seedExams);
  if (parsed.pathname === "/api/generic-bank" && req.method === "GET") {
    if (!fs.existsSync(GENERIC_BANK_FILE)) {
      return resultJson(res, { schemaVersion: 1, questionCount: 0, topicCount: 0, topics: [] });
    }
    try {
      return resultJson(res, JSON.parse(fs.readFileSync(GENERIC_BANK_FILE, "utf8")));
    } catch (error) {
      return resultJson(res, { error: "Generic bank is unavailable: " + error.message }, 500);
    }
  }
  if (parsed.pathname === "/api/needs-answer-key-bank" && req.method === "GET") {
    if (!fs.existsSync(NEEDS_KEY_BANK_FILE)) {
      return resultJson(res, { schemaVersion: 1, questionCount: 0, questions: [] });
    }
    try {
      return resultJson(res, JSON.parse(fs.readFileSync(NEEDS_KEY_BANK_FILE, "utf8")));
    } catch (error) {
      return resultJson(res, { error: "Needs-key bank is unavailable: " + error.message }, 500);
    }
  }
  if (parsed.pathname === "/api/part-b-bank" && req.method === "GET") {
    if (!fs.existsSync(PART_B_BANK_FILE)) {
      return resultJson(res, { schemaVersion: 1, questionCount: 0, questions: [] });
    }
    try {
      return resultJson(res, JSON.parse(fs.readFileSync(PART_B_BANK_FILE, "utf8")));
    } catch (error) {
      return resultJson(res, { error: "Part B bank is unavailable: " + error.message }, 500);
    }
  }
  if (parsed.pathname === "/api/official/state" && req.method === "GET") {
    return resultJson(res, officialState());
  }
  if (parsed.pathname === "/api/official/questions" && req.method === "GET") {
    return resultJson(res, officialQuestions(parsed.query));
  }
  if (parsed.pathname === "/api/official/import" && req.method === "POST") {
    readRequestBody(req, 80 * 1024 * 1024)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        return importOfficialPaper(payload);
      })
      .then((report) => resultJson(res, report))
      .catch((error) => resultJson(res, { error: error.message, stderr: error.stderr || "" }, 400));
    return;
  }
  const officialQuestionMatch = parsed.pathname.match(/^\/api\/official\/questions\/([^/]+)$/);
  if (officialQuestionMatch && req.method === "PATCH") {
    readRequestBody(req, 1024 * 1024)
      .then((body) => {
        const payload = JSON.parse(body || "{}");
        const updated = updateOfficialQuestion(decodeURIComponent(officialQuestionMatch[1]), payload);
        if (!updated) throw new Error("Question not found or no fields supplied.");
        return updated;
      })
      .then((updated) => resultJson(res, { question: updated }))
      .catch((error) => resultJson(res, { error: error.message }, 400));
    return;
  }
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
  if (pathname.startsWith("/server/data")) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  let finalPath = pathname === "/" ? "index.html" : pathname === "/admin" ? "admin.html" : pathname;
  if (pathname.startsWith("/media/")) {
    finalPath = path.join("server", "data", "media", pathname.slice("/media/".length));
  }
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
