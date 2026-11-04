#!/usr/bin/env node
/**
 * Local UI server to review extracted psychometric test questions
 * Run: node review-psychometric-server.js
 * Open: http://localhost:4000
 */

const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const dbPath = path.join(__dirname, 'server/data/dexam.sqlite');
const db = new sqlite3.Database(dbPath);

app.use(express.json());
app.use(express.static('public'));
app.use('/figures', express.static(path.join(__dirname, 'server/data/figures')));

// API: Get all extracted questions
app.get('/api/questions', (req, res) => {
  const { section, type, page = 1, limit = 10 } = req.query;
  let query = "SELECT * FROM questions WHERE paper_id='uceed-book-1'";
  const params = [];

  if (section) {
    query += " AND id LIKE ?";
    params.push(`%${section}%`);
  }
  if (type) {
    query += " AND question_type = ?";
    params.push(type);
  }

  const offset = (page - 1) * limit;
  query += ` LIMIT ? OFFSET ?`;
  params.push(parseInt(limit), offset);

  db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows || []);
  });
});

// API: Get question count
app.get('/api/stats', (req, res) => {
  db.all(
    "SELECT question_type, COUNT(*) as count FROM questions WHERE paper_id='uceed-book-1' GROUP BY question_type",
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });

      db.all(
        "SELECT SUBSTR(id, INSTR(id, '-') + 1, INSTR(SUBSTR(id, INSTR(id, '-') + 1), '-') - 1) as section, COUNT(*) as count FROM questions WHERE paper_id='uceed-book-1' GROUP BY section",
        (err, sections) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ byType: rows || [], bySection: sections || [] });
        }
      );
    }
  );
});

// Serve HTML UI
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Psychometric Questions Reviewer</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: #f5f5f5;
          color: #333;
        }
        .container {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
        }
        header {
          background: #c76a2d;
          color: white;
          padding: 30px 0;
          margin-bottom: 30px;
          border-radius: 8px;
        }
        header h1 { font-size: 28px; margin-bottom: 10px; }
        header p { font-size: 14px; opacity: 0.9; }
        .stats {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin: 20px 0;
          margin-bottom: 30px;
        }
        .stat-card {
          background: white;
          padding: 15px;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          text-align: center;
        }
        .stat-card .number { font-size: 24px; font-weight: bold; color: #c76a2d; }
        .stat-card .label { font-size: 12px; color: #666; margin-top: 5px; }
        .filters {
          background: white;
          padding: 20px;
          border-radius: 6px;
          margin-bottom: 20px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          display: flex;
          gap: 15px;
          flex-wrap: wrap;
          align-items: center;
        }
        .filters select, .filters input {
          padding: 8px 12px;
          border: 1px solid #ddd;
          border-radius: 4px;
          font-size: 14px;
        }
        .filters button {
          padding: 8px 16px;
          background: #c76a2d;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: 600;
        }
        .questions-list {
          display: grid;
          gap: 15px;
        }
        .question-card {
          background: white;
          padding: 20px;
          border-radius: 6px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          border-left: 4px solid #c76a2d;
        }
        .question-header {
          display: flex;
          justify-content: space-between;
          align-items: start;
          margin-bottom: 12px;
        }
        .question-id {
          font-weight: 600;
          color: #c76a2d;
          font-size: 13px;
        }
        .question-type {
          display: inline-block;
          padding: 4px 8px;
          background: #f0f0f0;
          border-radius: 3px;
          font-size: 12px;
          font-weight: 600;
        }
        .question-text {
          margin-bottom: 12px;
          font-size: 15px;
          line-height: 1.5;
          color: #222;
        }
        .options {
          background: #f9f9f9;
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 10px;
        }
        .option {
          padding: 6px 0;
          font-size: 14px;
          color: #555;
        }
        .option.correct {
          color: #27ae60;
          font-weight: 600;
        }
        .answer-key {
          font-size: 13px;
          color: #27ae60;
          font-weight: 600;
        }
        .pagination {
          display: flex;
          gap: 10px;
          justify-content: center;
          margin-top: 30px;
        }
        .pagination button {
          padding: 8px 12px;
          border: 1px solid #ddd;
          background: white;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .pagination button.active {
          background: #c76a2d;
          color: white;
          border-color: #c76a2d;
        }
        .pagination button:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .loading {
          text-align: center;
          padding: 40px;
          color: #666;
        }
        .empty {
          text-align: center;
          padding: 40px;
          background: white;
          border-radius: 6px;
          color: #999;
        }
        .figures {
          margin-top: 15px;
          padding-top: 15px;
          border-top: 1px solid #eee;
        }
        .figures h4 {
          font-size: 12px;
          color: #666;
          margin-bottom: 10px;
          text-transform: uppercase;
          font-weight: 600;
        }
        .figure-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
          gap: 10px;
        }
        .figure-item {
          position: relative;
          overflow: hidden;
          border-radius: 4px;
          background: #f0f0f0;
        }
        .figure-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          cursor: pointer;
        }
        .figure-item:hover img {
          opacity: 0.8;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <header>
          <h1>📝 Psychometric Questions Reviewer</h1>
          <p>Review and validate all 221 extracted questions from "Ultimate Psychometric Tests"</p>
        </header>

        <div class="stats" id="stats">
          <div class="loading">Loading statistics...</div>
        </div>

        <div class="filters">
          <select id="sectionFilter">
            <option value="">All Sections</option>
            <option value="personality">Personality Assessment</option>
            <option value="numerical">Numerical Reasoning</option>
            <option value="verbal">Verbal Reasoning</option>
            <option value="nonverbal">Non-Verbal Reasoning</option>
          </select>
          <select id="typeFilter">
            <option value="">All Types</option>
            <option value="MCQ">MCQ (Single Choice)</option>
            <option value="MSQ">MSQ (Multiple Select)</option>
            <option value="NAT">NAT (Numerical)</option>
            <option value="TEXT">Text</option>
          </select>
          <button onclick="loadQuestions(1)">Filter</button>
        </div>

        <div class="questions-list" id="questions">
          <div class="loading">Loading questions...</div>
        </div>

        <div class="pagination" id="pagination"></div>
      </div>

      <script>
        let currentPage = 1;
        const itemsPerPage = 10;

        async function loadStats() {
          const res = await fetch('/api/stats');
          const data = await res.json();
          const html = data.bySection.map(s =>
            \`<div class="stat-card"><div class="number">\${s.count}</div><div class="label">\${s.section}</div></div>\`
          ).join('');
          document.getElementById('stats').innerHTML = html;
        }

        async function loadQuestions(page = 1) {
          currentPage = page;
          const section = document.getElementById('sectionFilter').value;
          const type = document.getElementById('typeFilter').value;
          const url = new URLSearchParams({ page, limit: itemsPerPage, section, type });

          const res = await fetch('/api/questions?' + url);
          const questions = await res.json();

          if (!questions.length) {
            document.getElementById('questions').innerHTML = '<div class="empty">No questions found</div>';
            document.getElementById('pagination').innerHTML = '';
            return;
          }

          const html = questions.map(q => {
            const figureJSON = q.figure_paths_json ? JSON.parse(q.figure_paths_json) : [];
            return \`
            <div class="question-card">
              <div class="question-header">
                <div class="question-id">\${q.id}</div>
                <div class="question-type">\${q.question_type}</div>
              </div>
              <div class="question-text">\${q.prompt}</div>
              <div class="options">
                \${JSON.parse(q.options_json || '[]').map(opt => \`
                  <div class="option \${opt.position === q.answer_key ? 'correct' : ''}">
                    <strong>\${opt.position}.</strong> \${opt.text}
                  </div>
                \`).join('')}
              </div>
              <div class="answer-key">✓ Answer: \${q.answer_key}</div>
              \${figureJSON.length > 0 ? \`
                <div class="figures">
                  <h4>📎 Related Diagrams</h4>
                  <div class="figure-grid">
                    \${figureJSON.map(fig => \`
                      <div class="figure-item" title="Page \${fig.page} - \${fig.type}">
                        <img src="/\${fig.path}" alt="Page \${fig.page}" />
                      </div>
                    \`).join('')}
                  </div>
                </div>
              \` : ''}
            </div>
          \`; }).join('');

          document.getElementById('questions').innerHTML = html;
          renderPagination(questions.length === itemsPerPage);
        }

        function renderPagination(hasMore) {
          const html = \`
            <button onclick="loadQuestions(\${currentPage - 1})" \${currentPage === 1 ? 'disabled' : ''}>← Previous</button>
            <span>Page \${currentPage}</span>
            <button onclick="loadQuestions(\${currentPage + 1})" \${!hasMore ? 'disabled' : ''}>Next →</button>
          \`;
          document.getElementById('pagination').innerHTML = html;
        }

        // Initial load
        loadStats();
        loadQuestions(1);
      </script>
    </body>
    </html>
  `);
});

const PORT = 4000;
app.listen(PORT, () => {
  console.log(\`
✓ Psychometric Questions Reviewer running on http://localhost:\${PORT}

Open in your browser to review all 221 extracted questions.
  \`);
});
