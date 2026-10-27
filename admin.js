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

let state = null;
let shown = 25;
let filter = { search: "" };

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
      renderStats(bank);
      shown = 25;
      renderQuestions();
      renderMocks();
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

loadState();
