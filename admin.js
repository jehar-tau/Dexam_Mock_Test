/* Backend console logic for the Dexam Mock Test prototype. */

const examSelect = document.getElementById("exam");
const mockExamSelect = document.getElementById("mockExam");
const topicInput = document.getElementById("topic");
const difficultyInput = document.getElementById("difficulty");
const sourceInput = document.getElementById("source");
const filesInput = document.getElementById("files");
const ingestBtn = document.getElementById("ingestBtn");
const uploadMsg = document.getElementById("uploadMsg");
const stats = document.getElementById("stats");
const tbody = document.getElementById("tbody");
const searchInput = document.getElementById("search");
const filterBtn = document.getElementById("filterBtn");
const filterInfo = document.getElementById("filterInfo");
const moreBtn = document.getElementById("moreBtn");
const mocksTbody = document.getElementById("mocksTbody");
const mockExam = document.getElementById("mockExam");
const mockType = document.getElementById("mockType");
const mockTopic = document.getElementById("mockTopic");
const mockDifficulty = document.getElementById("mockDifficulty");
const mockCount = document.getElementById("mockCount");
const mockDuration = document.getElementById("mockDuration");
const buildMockBtn = document.getElementById("buildMockBtn");
const mockMsg = document.getElementById("mockMsg");
const mockOutput = document.getElementById("mockOutput");
const officialExam = document.getElementById("officialExam");
const officialYear = document.getElementById("officialYear");
const officialTitle = document.getElementById("officialTitle");
const officialPaper = document.getElementById("officialPaper");
const officialAnswers = document.getElementById("officialAnswers");
const officialOllama = document.getElementById("officialOllama");
const officialImportBtn = document.getElementById("officialImportBtn");
const officialImportMsg = document.getElementById("officialImportMsg");
const officialImportReport = document.getElementById("officialImportReport");
const officialStats = document.getElementById("officialStats");
const officialPapersTbody = document.getElementById("officialPapersTbody");
const officialPaperFilter = document.getElementById("officialPaperFilter");
const officialTypeFilter = document.getElementById("officialTypeFilter");
const officialStatusFilter = document.getElementById("officialStatusFilter");
const officialExplanationFilter = document.getElementById("officialExplanationFilter");
const officialSearch = document.getElementById("officialSearch");
const officialFilterBtn = document.getElementById("officialFilterBtn");
const officialQuestionInfo = document.getElementById("officialQuestionInfo");
const officialQuestionsTbody = document.getElementById("officialQuestionsTbody");
const officialMoreBtn = document.getElementById("officialMoreBtn");
const officialEditor = document.getElementById("officialEditor");
const editQuestionId = document.getElementById("editQuestionId");
const editTopic = document.getElementById("editTopic");
const editSubtopic = document.getElementById("editSubtopic");
const editDifficulty = document.getElementById("editDifficulty");
const editAnswer = document.getElementById("editAnswer");
const editStatus = document.getElementById("editStatus");
const editExplanationStatus = document.getElementById("editExplanationStatus");
const editExplanation = document.getElementById("editExplanation");
const editReference = document.getElementById("editReference");
const saveOfficialBtn = document.getElementById("saveOfficialBtn");
const cancelOfficialBtn = document.getElementById("cancelOfficialBtn");
const officialEditMsg = document.getElementById("officialEditMsg");

let state = null;
let shown = 25;
let filter = { search: "" };
let officialState = null;
let officialShown = 50;
let officialFilter = { paperId: "", type: "", status: "", explanationStatus: "", search: "" };
let officialQuestionRows = [];

function populateSelect(select, options, placeholder) {
  select.innerHTML = "";
  if (placeholder) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    select.appendChild(option);
  }
  options.forEach((option) => {
    const item = document.createElement("option");
    item.value = option.value ?? option;
    item.textContent = option.label ?? option.name ?? option;
    select.appendChild(item);
  });
}

function card(title, sub) {
  return `<div class="card"><strong>${title}</strong><small>${sub}</small></div>`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function readFileBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function renderOfficialStats(bank) {
  if (!bank || !bank.available) {
    officialStats.innerHTML = card("SQLite unavailable", "This Node build cannot load node:sqlite.");
    return;
  }
  officialStats.innerHTML = [
    card("Papers", bank.counts.papers),
    card("Official questions", bank.counts.questions),
    card("With answer key", bank.counts.withAnswers),
    card("With explanations", bank.counts.withExplanations),
    card("Pending review", bank.counts.pendingReview)
  ].join("");
}

function renderOfficialPapers(bank) {
  const papers = (bank && bank.papers) || [];
  officialPapersTbody.innerHTML = papers
    .map(
      (paper) => `<tr>
        <td>${escapeHtml(paper.title)}</td>
        <td>${escapeHtml(paper.year)}</td>
        <td>${paper.questionCount}</td>
        <td>${paper.answerCount}</td>
        <td>${paper.pendingCount}</td>
        <td><button class="secondary" data-paper="${escapeHtml(paper.id)}">Review</button></td>
      </tr>`
    )
    .join("");
  Array.from(officialPapersTbody.querySelectorAll("button[data-paper]")).forEach((button) => {
    button.addEventListener("click", () => {
      officialFilter.paperId = button.dataset.paper;
      officialPaperFilter.value = button.dataset.paper;
      officialShown = 50;
      loadOfficialQuestions();
    });
  });

  const current = officialPaperFilter.value;
  officialPaperFilter.innerHTML = '<option value="">All papers</option>' + papers
    .map((paper) => `<option value="${escapeHtml(paper.id)}">${escapeHtml(paper.title)}</option>`)
    .join("");
  officialPaperFilter.value = current;
}

function renderOfficialQuestions(result) {
  officialQuestionRows = result.questions || [];
  const rows = officialQuestionRows.map((question) => {
    const page = question.pageImages && question.pageImages[0];
    const answerClass = question.answerKey ? "good" : "warn";
    const explanationClass = question.explanationStatus === "verified" ? "good" : question.explanationStatus === "ai-draft" ? "warn" : "bad";
    const prompt = String(question.prompt || "").slice(0, 260);
    return `<tr>
      <td>${escapeHtml(question.questionNo)}</td>
      <td>${escapeHtml(question.type)}</td>
      <td>${escapeHtml(question.topic)}</td>
      <td><span class="pill ${answerClass}">${escapeHtml(question.answerKey || "pending")}</span></td>
      <td class="prompt">${escapeHtml(prompt)}${question.prompt && question.prompt.length > 260 ? "…" : ""}
        <div class="muted">${escapeHtml(question.id)} ${page ? `· <a href="${escapeHtml(page)}" target="_blank" rel="noreferrer">page image</a>` : ""}</div>
      </td>
      <td><span class="pill ${explanationClass}">${escapeHtml(question.explanationStatus)}</span><br /><button class="secondary" data-edit="${escapeHtml(question.id)}">Edit</button></td>
    </tr>`;
  });
  officialQuestionsTbody.innerHTML = rows.join("");
  officialQuestionInfo.textContent = `Showing ${officialQuestionRows.length} of ${result.total} matching questions.`;
  officialMoreBtn.style.display = result.total > officialShown ? "" : "none";
  Array.from(officialQuestionsTbody.querySelectorAll("button[data-edit]")).forEach((button) => {
    button.addEventListener("click", () => openOfficialEditor(button.dataset.edit));
  });
}

function openOfficialEditor(id) {
  const question = officialQuestionRows.find((item) => item.id === id);
  if (!question) return;
  editQuestionId.value = question.id;
  editTopic.value = question.topic || "";
  editSubtopic.value = question.subtopic || "";
  editDifficulty.value = question.difficulty || "";
  editAnswer.value = question.answerKey || "";
  editStatus.value = question.status || "review";
  editExplanationStatus.value = question.explanationStatus || "pending";
  editExplanation.value = question.explanation || "";
  editReference.value = question.referenceUrl || "";
  officialEditor.style.display = "";
  officialEditor.scrollIntoView({ behavior: "smooth", block: "start" });
}

function loadOfficialState() {
  return fetch("/api/official/state")
    .then((response) => response.json())
    .then((bank) => {
      officialState = bank;
      renderOfficialStats(bank);
      renderOfficialPapers(bank);
      return bank;
    });
}

function loadOfficialQuestions() {
  const params = new URLSearchParams();
  params.set("limit", String(officialShown));
  params.set("offset", "0");
  if (officialFilter.paperId) params.set("paperId", officialFilter.paperId);
  if (officialFilter.type) params.set("type", officialFilter.type);
  if (officialFilter.status) params.set("status", officialFilter.status);
  if (officialFilter.explanationStatus) params.set("explanationStatus", officialFilter.explanationStatus);
  if (officialFilter.search) params.set("search", officialFilter.search);
  return fetch("/api/official/questions?" + params.toString())
    .then((response) => response.json())
    .then((result) => {
      renderOfficialQuestions(result);
      return result;
    });
}

function renderStats(bank) {
  const examCards = Object.entries(bank.counts.byExam).map(([name, info]) => {
    const topics = Object.entries(info.topics).sort((a, b) => b[1] - a[1]);
    const topTopics = topics.slice(0, 6).map(([topic, count]) => `${topic}: ${count}`).join(" · ");
    return card(name, `Total ${info.total}. ${topTopics}`);
  });
  stats.innerHTML = [
    card("Total questions", bank.counts.total),
    card("Papers", bank.papers.length) ,
  ].concat(examCards).join("");
}

function renderQuestions() {
  const qs = state.questions || [];
  const search = (filter.search || "").toLowerCase();
  const filtered = search
    ? qs.filter((q) => (q.prompt || "").toLowerCase().includes(search) || (q.solution || "").toLowerCase().includes(search))
    : qs;

  const slice = filtered.slice(0, shown);
  tbody.innerHTML = slice
    .map(
      (q) => `<tr>
        <td>${q.examId}</td>
        <td>${q.topic}</td>
        <td>${q.type}</td>
        <td>${q.marks}</td>
        <td>${q.prompt}</td>
        <td>${q.correctAnswer !== undefined ? JSON.stringify(q.correctAnswer) : ""}<br /><small>${q.solution || ""}</small></td>
      </tr>`
    )
    .join("");

  filterInfo.textContent = `Showing ${slice.length} of ${filtered.length} (total ${qs.length}).`;
  moreBtn.style.display = filtered.length > shown ? "" : "none";
}

function renderMocks() {
  fetch("/api/mocks")
    .then((response) => response.json())
    .then((mocks) => {
      mocksTbody.innerHTML = (mocks || [])
        .map(
          (mock, index) => `<tr>
            <td>${mock.examName}</td>
            <td>${mock.title}</td>
            <td>${mock.durationMinutes}</td>
            <td>${mock.sections.reduce((sum, section) => sum + section.questions.length, 0)}</td>
            <td>${mock.totalMarks}</td>
            <td><button class="secondary" data-index="${index}">Show</button></td>
          </tr>`
        )
        .join("");
      Array.from(mocksTbody.querySelectorAll("button")).forEach((button) => {
        button.addEventListener("click", () => {
          const mock = (state.papers || [])[Number(button.dataset.index)] || {};
          mockOutput.textContent = JSON.stringify(mock, null, 2);
          mockOutput.style.display = "";
        });
      });
    });
}

function loadState() {
  fetch("/api/state")
    .then((response) => response.json())
    .then((bank) => {
      state = bank;
      populateSelect(examSelect, bank.exams.map((exam) => ({ value: exam.id, label: exam.name })), "All exams");
      populateSelect(mockExamSelect, bank.exams.map((exam) => ({ value: exam.id, label: exam.name })), "All exams");
      populateSelect(officialExam, bank.exams.map((exam) => ({ value: exam.id, label: exam.name })), "Choose exam");
      renderStats(bank);
      shown = 25;
      renderQuestions();
      renderMocks();
      loadOfficialState().then(() => loadOfficialQuestions());
    });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

ingestBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  const files = Array.from(filesInput.files || []);
  if (!files.length) {
    uploadMsg.textContent = "Select one or more JSON or CSV files to upload.";
    return;
  }
  const payload = {
    examId: examSelect.value,
    topic: topicInput.value,
    difficulty: difficultyInput.value,
    source: sourceInput.value,
    files: []
  };
  for (const file of files) {
    const content = await readFile(file);
    payload.files.push({ name: file.name, content: content });
  }
  const response = await fetch("/api/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const report = await response.json();
  uploadMsg.textContent = `Added ${report.added}, duplicate ${report.duplicate}, rejected ${report.rejected}.` +
    (report.errors && report.errors.length ? ` Errors: ${report.errors.join(" | ")}` : "");
  loadState();
});

filterBtn.addEventListener("click", (event) => {
  event.preventDefault();
  filter.search = searchInput.value;
  shown = 25;
  renderQuestions();
});

moreBtn.addEventListener("click", (event) => {
  event.preventDefault();
  shown = Math.min(state.questions.length, shown + 50);
  renderQuestions();
});

buildMockBtn.addEventListener("click", (event) => {
  event.preventDefault();
  const payload = {
    examId: mockExam.value,
    type: mockType.value,
    topic: mockTopic.value,
    difficulty: mockDifficulty.value,
    count: Number(mockCount.value) || 10,
    durationMinutes: Number(mockDuration.value) || 20
  };
  fetch("/api/mocks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
    .then((response) => response.json())
    .then((result) => {
      if (result.paper) {
        mockMsg.textContent = `Created ${result.saved ? "and saved" : "a"} mock paper.`;
        mockOutput.textContent = JSON.stringify(result.paper, null, 2);
        mockOutput.style.display = "";
        renderMocks();
      } else if (result.error) {
        mockMsg.textContent = result.error;
      }
    });
});

officialImportBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  officialImportMsg.textContent = "";
  officialImportReport.style.display = "none";
  const paperFile = (officialPaper.files || [])[0];
  if (!paperFile) {
    officialImportMsg.textContent = "Choose a question-paper PDF first.";
    return;
  }
  officialImportBtn.disabled = true;
  officialImportMsg.textContent = "Extracting PDF, saving page images, and writing SQLite…";
  try {
    const payload = {
      examId: officialExam.value,
      year: Number(officialYear.value),
      title: officialTitle.value,
      paper: { name: paperFile.name, contentBase64: await readFileBase64(paperFile) },
      ollamaModel: officialOllama.value
    };
    const answerFile = (officialAnswers.files || [])[0];
    if (answerFile) {
      payload.answers = { name: answerFile.name, contentBase64: await readFileBase64(answerFile) };
    }
    const response = await fetch("/api/official/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error + (result.stderr ? " — " + result.stderr : ""));
    officialImportMsg.textContent = `Imported ${result.inserted} questions from ${result.pages} pages; ${result.answers_matched} answer keys matched.`;
    officialImportReport.textContent = JSON.stringify(result, null, 2);
    officialImportReport.style.display = "";
    await loadOfficialState();
    await loadOfficialQuestions();
  } catch (error) {
    officialImportMsg.textContent = error.message;
  } finally {
    officialImportBtn.disabled = false;
  }
});

officialFilterBtn.addEventListener("click", (event) => {
  event.preventDefault();
  officialFilter = {
    paperId: officialPaperFilter.value,
    type: officialTypeFilter.value,
    status: officialStatusFilter.value,
    explanationStatus: officialExplanationFilter.value,
    search: officialSearch.value.trim()
  };
  officialShown = 50;
  loadOfficialQuestions();
});

officialMoreBtn.addEventListener("click", (event) => {
  event.preventDefault();
  officialShown += 50;
  loadOfficialQuestions();
});

saveOfficialBtn.addEventListener("click", async (event) => {
  event.preventDefault();
  const id = editQuestionId.value;
  if (!id) return;
  officialEditMsg.textContent = "Saving…";
  const payload = {
    topic: editTopic.value.trim(),
    subtopic: editSubtopic.value.trim(),
    difficulty: editDifficulty.value.trim(),
    answerKey: editAnswer.value.trim(),
    status: editStatus.value,
    explanation: editExplanation.value,
    explanationStatus: editExplanationStatus.value,
    explanationSource: "manual-review",
    referenceUrl: editReference.value.trim()
  };
  try {
    const response = await fetch("/api/official/questions/" + encodeURIComponent(id), {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await response.json();
    if (result.error) throw new Error(result.error);
    officialEditMsg.textContent = "Saved.";
    await loadOfficialState();
    await loadOfficialQuestions();
  } catch (error) {
    officialEditMsg.textContent = error.message;
  }
});

cancelOfficialBtn.addEventListener("click", (event) => {
  event.preventDefault();
  officialEditor.style.display = "none";
  officialEditMsg.textContent = "";
});

loadState();
