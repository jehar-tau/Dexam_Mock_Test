const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
const PROJECT_ROOT = path.resolve(__dirname, '..');
const REVIEW_STATE_FILE = path.join(__dirname, 'review-state.json');
let machineReadableBank = null;
let genericBank = null;
let reviewState = {};

// Load review state from file
function loadReviewState() {
  try {
    if (fs.existsSync(REVIEW_STATE_FILE)) {
      const data = fs.readFileSync(REVIEW_STATE_FILE, 'utf8');
      reviewState = JSON.parse(data);
      console.log(`Loaded review state for ${Object.keys(reviewState).length} questions`);
    }
  } catch (err) {
    console.error('Error loading review state:', err.message);
  }
}

// Save review state to file
function saveReviewState() {
  try {
    const tmp = REVIEW_STATE_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(reviewState, null, 2), 'utf8');
    fs.renameSync(tmp, REVIEW_STATE_FILE);
  } catch (err) {
    console.error('Error saving review state:', err.message);
  }
}

// Load question banks on startup
function loadBanks() {
  try {
    machineReadableBank = require('./lib/reviewed-papers').loadBank();
    console.log(`Loaded machine-readable bank: ${machineReadableBank.summary.total_questions} questions`);
  } catch (err) {
    console.error('Error loading machine-readable bank:', err.message);
  }

  try {
    const gbPath = path.join(__dirname, 'data/generic-question-bank.json');
    genericBank = JSON.parse(fs.readFileSync(gbPath, 'utf8'));
    console.log(`Loaded generic bank: ${genericBank.questionCount} questions`);
  } catch (err) {
    console.error('Error loading generic bank:', err.message);
  }
}

// Serve static files
function serveFile(filePath, res) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      console.error(`Error reading file ${filePath}:`, err.message);
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
}

// Send JSON response
function sendJSON(res, data, statusCode = 200) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// API: Get questions
function getQuestions(query, res) {
  if (!machineReadableBank) {
    return sendJSON(res, { error: 'Question bank not loaded' }, 500);
  }

  let questions = [...machineReadableBank.questions];
  const { exam = 'all', type = 'all', status = 'all', search = '', page = '1', limit = '50', review = 'all', session = '' } = query;

  if (exam !== 'all') {
    questions = questions.filter(q => q.exam === exam);
  }

  if (type !== 'all') {
    questions = questions.filter(q => q.type === type);
  }

  if (status !== 'all') {
    questions = questions.filter(q => q.answer_status === status);
  }

  if (review === 'pending') {
    questions = questions.filter(q => !reviewState[q.id]?.marked && !reviewState[q.id]?.flagged);
  } else if (review === 'reviewed') {
    questions = questions.filter(q => reviewState[q.id]?.marked || reviewState[q.id]?.flagged);
  } else if (review === 'flagged') {
    questions = questions.filter(q => reviewState[q.id]?.flagged);
  }
  if (session) {
    questions = questions.filter(q => reviewState[q.id]?.session === session);
  }

  if (search) {
    const searchLower = search.toLowerCase();
    questions = questions.filter(q =>
      q.question_text.toLowerCase().includes(searchLower) ||
      q.question_no.includes(search) ||
      q.id.includes(search)
    );
  }

  const total = questions.length;
  const pageNum = parseInt(page) || 1;
  const limit_num = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limit_num;
  const paged = questions.slice(skip, skip + limit_num);

  // Add reviewState to each question
  const pagedWithReviewState = paged.map(q => ({
    ...q,
    reviewState: reviewState[q.id] || { marked: false, flagged: false, notes: '' }
  }));

  sendJSON(res, {
    data: pagedWithReviewState,
    total,
    page: pageNum,
    limit: limit_num,
    totalPages: Math.ceil(total / limit_num)
  });
}

// API: Get single question
function getQuestion(id, res) {
  if (!machineReadableBank) {
    return sendJSON(res, { error: 'Question bank not loaded' }, 500);
  }

  const question = machineReadableBank.questions.find(q => q.id === id);
  if (!question) {
    return sendJSON(res, { error: 'Question not found' }, 404);
  }

  const withReview = {
    ...question,
    reviewState: reviewState[id] || { marked: false, flagged: false, notes: '' }
  };

  sendJSON(res, withReview);
}

// API: Get summary
function getSummary(res) {
  if (!machineReadableBank) {
    return sendJSON(res, { error: 'Question bank not loaded' }, 500);
  }

  const summary = {
    ...machineReadableBank.summary,
    types: {},
    statuses: {}
  };

  machineReadableBank.questions.forEach(q => {
    summary.types[q.type] = (summary.types[q.type] || 0) + 1;
    summary.statuses[q.answer_status] = (summary.statuses[q.answer_status] || 0) + 1;
  });

  sendJSON(res, summary);
}

// API: Mark question
function markQuestion(id, body, res) {
  const { marked, flagged, notes } = body;
  reviewState[id] = {
    marked: marked !== undefined ? marked : reviewState[id]?.marked || false,
    flagged: flagged !== undefined ? flagged : reviewState[id]?.flagged || false,
    notes: notes !== undefined ? notes : reviewState[id]?.notes || '',
    session: body.session || reviewState[id]?.session || '',
    at: new Date().toISOString()
  };
  saveReviewState();
  sendJSON(res, { success: true, state: reviewState[id] });
}

// API: Review stats (whole bank)
function getReviewStats(res) {
  const total = machineReadableBank ? machineReadableBank.questions.length : 0;
  const entries = Object.values(reviewState);
  const done = entries.filter(e => e.marked || e.flagged).length;
  const flagged = entries.filter(e => e.flagged).length;
  const sessions = {};
  entries.forEach(e => { if (e.session) sessions[e.session] = (sessions[e.session] || 0) + 1; });
  sendJSON(res, {
    total, reviewed: done, flagged, remaining: total - done,
    remainingPercent: total ? Math.round(((total - done) / total) * 100) : 0,
    sessions
  });
}

// API: Save a timestamped backup snapshot
function saveBackup(res) {
  const dir = path.join(__dirname, 'review-backups');
  fs.mkdirSync(dir, { recursive: true });
  const name = `review-state-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
  fs.writeFileSync(path.join(dir, name), JSON.stringify(reviewState, null, 2), 'utf8');
  sendJSON(res, { success: true, file: `server/review-backups/${name}`, count: Object.keys(reviewState).length });
}

// API: Compare with generic bank
function compareQuestion(id, res) {
  const question = machineReadableBank?.questions.find(q => q.id === id);

  if (!question) {
    return sendJSON(res, { error: 'Question not found' }, 404);
  }

  const comparison = {
    machineReadable: question,
    inGenericBank: false,
    genericBankMatch: null
  };

  if (genericBank) {
    const genMatch = genericBank.topics?.flatMap(t => t.questions || [])
      .find(q => q.id === id || q.questionId === id);

    if (genMatch) {
      comparison.inGenericBank = true;
      comparison.genericBankMatch = genMatch;
    }
  }

  sendJSON(res, comparison);
}

// Parse POST body
function parsePostBody(req, callback) {
  let body = '';
  req.on('data', chunk => {
    body += chunk.toString();
  });
  req.on('end', () => {
    try {
      const data = body ? JSON.parse(body) : {};
      callback(data);
    } catch (err) {
      callback({});
    }
  });
}

// Main request handler
const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // Decode URL
  try {
    pathname = decodeURIComponent(pathname);
  } catch (e) {
    pathname = parsedUrl.pathname;
  }

  // API Routes
  if (pathname === '/api/questions' && req.method === 'GET') {
    return getQuestions(query, res);
  }

  if (pathname.startsWith('/api/questions/') && req.method === 'GET' && !pathname.endsWith('/mark')) {
    const id = pathname.replace('/api/questions/', '');
    if (id && !id.includes('/')) {
      return getQuestion(id, res);
    }
  }

  if (pathname.startsWith('/api/questions/') && pathname.endsWith('/mark') && req.method === 'POST') {
    const id = pathname.replace('/api/questions/', '').replace('/mark', '');
    return parsePostBody(req, (body) => markQuestion(id, body, res));
  }

  if (pathname.startsWith('/api/compare/') && req.method === 'GET') {
    const id = pathname.replace('/api/compare/', '');
    return compareQuestion(id, res);
  }

  if (pathname === '/api/review-stats' && req.method === 'GET') {
    return getReviewStats(res);
  }

  if (pathname === '/api/review-save' && req.method === 'POST') {
    return saveBackup(res);
  }

  if (pathname === '/api/review-export' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="review-state.json"' });
    return res.end(JSON.stringify(reviewState, null, 2));
  }

  if (pathname === '/api/summary' && req.method === 'GET') {
    return getSummary(res);
  }

  // Static file routes
  if (pathname === '/') {
    const filePath = path.join(__dirname, '../public/index.html');
    return serveFile(filePath, res);
  }

  // Serve from public folder
  if (pathname.startsWith('/') && !pathname.startsWith('/api/')) {
    const filePath = path.join(PROJECT_ROOT, pathname);
    const realPath = path.resolve(filePath);
    
    if (realPath.startsWith(PROJECT_ROOT)) {
      if (fs.existsSync(realPath) && fs.statSync(realPath).isFile()) {
        return serveFile(realPath, res);
      }
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

loadBanks();
loadReviewState();
server.listen(PORT, () => {
  console.log(`Question Bank Viewer running on http://localhost:${PORT}`);
  console.log(`Project root: ${PROJECT_ROOT}`);
});
