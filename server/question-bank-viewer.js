const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 3000;
let machineReadableBank = null;
let genericBank = null;
let reviewState = {};

// Load question banks on startup
function loadBanks() {
  try {
    const mrPath = path.join(__dirname, '../dexam-bank-machine-readable.json');
    machineReadableBank = JSON.parse(fs.readFileSync(mrPath, 'utf8'));
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
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    const contentTypes = {
      '.html': 'text/html',
      '.css': 'text/css',
      '.js': 'text/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };

    const contentType = contentTypes[ext] || 'text/plain';
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
  const { exam = 'all', type = 'all', status = 'all', search = '', page = '1', limit = '50' } = query;

  // Filter by exam
  if (exam !== 'all') {
    questions = questions.filter(q => q.exam === exam);
  }

  // Filter by type
  if (type !== 'all') {
    questions = questions.filter(q => q.type === type);
  }

  // Filter by answer status
  if (status !== 'all') {
    questions = questions.filter(q => q.answer_status === status);
  }

  // Search in question text
  if (search) {
    const searchLower = search.toLowerCase();
    questions = questions.filter(q =>
      q.question_text.toLowerCase().includes(searchLower) ||
      q.question_no.includes(search) ||
      q.id.includes(search)
    );
  }

  // Pagination
  const total = questions.length;
  const pageNum = parseInt(page) || 1;
  const limit_num = parseInt(limit) || 50;
  const skip = (pageNum - 1) * limit_num;
  const paged = questions.slice(skip, skip + limit_num);

  sendJSON(res, {
    data: paged,
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
    notes: notes !== undefined ? notes : reviewState[id]?.notes || ''
  };
  sendJSON(res, { success: true, state: reviewState[id] });
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
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const query = parsedUrl.query;

  // API Routes
  if (pathname === '/api/questions' && req.method === 'GET') {
    return getQuestions(query, res);
  }

  if (pathname.startsWith('/api/questions/') && req.method === 'GET') {
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

  if (pathname === '/api/summary' && req.method === 'GET') {
    return getSummary(res);
  }

  // Serve static files
  let filePath = path.join(__dirname, '../public', pathname);

  if (pathname === '/') {
    filePath = path.join(__dirname, '../public/index.html');
  }

  // Prevent directory traversal
  const realPath = path.resolve(filePath);
  const publicDir = path.resolve(path.join(__dirname, '../public'));
  const mediaDir = path.resolve(path.join(__dirname, './data/media'));

  if (!realPath.startsWith(publicDir) && !realPath.startsWith(mediaDir)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    res.end('403 Forbidden');
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    return serveFile(filePath, res);
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('404 Not Found');
});

loadBanks();
server.listen(PORT, () => {
  console.log(`Question Bank Viewer running on http://localhost:${PORT}`);
});
