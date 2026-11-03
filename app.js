/* Dexam Mock Test — exam catalogue, timed paper player, topic practice,
   local autosave, review, and progress. All starter questions are original.
   Production note: timing, scoring, submission, auth, and persistence must
   move to a server before this is used for high-stakes exams. */

(function () {
  "use strict";

  const THEME_KEY = "dexam:theme";
  const PROGRESS_PREFIX = "dexam:progress:";
  const RESULT_PREFIX = "dexam:result:";
  const PRACTICE_KEY = "dexam:practice";
  const BOOKMARK_KEY = "dexam:bookmarks";
  const CUSTOM_KEY = "dexam:custom";

  const state = {
    paper: null,
    questions: [],
    answers: {},
    marked: new Set(),
    currentIndex: 0,
    startedAt: null,
    remaining: 0,
    submitted: false,
    timerId: null,
    result: null,
    practice: null,
    customData: null,
    officialPapers: [],
    importMessage: "",
    importErrors: [],
    saveFlashTimer: null
  };

  const $ = (selector, root) => (root || document).querySelector(selector);
  const $$ = (selector, root) => Array.from((root || document).querySelectorAll(selector));

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => {
      switch (char) {
        case "&": return "&amp;";
        case "<": return "&lt;";
        case ">": return "&gt;";
        case '"': return "&quot;";
        case "'": return "&#39;";
        default: return char;
      }
    });
  }

  function nl2br(value) {
    return esc(value).replace(/\n/g, "<br>");
  }

  function renderQuestionFigures(question) {
    if (question.figure) return '<div class="q-figure">' + question.figure + "</div>";
    const paths = Array.isArray(question.figurePaths) && question.figurePaths.length
      ? question.figurePaths
      : [];
    if (!paths.length) return "";
    return (
      '<div class="q-figure q-figure-gallery" aria-label="Question figures">' +
      paths.map((path, index) =>
        '<button class="q-figure-button" type="button" data-figure-src="' + esc(path) +
        '" aria-label="Open question figure ' + (index + 1) + '">' +
        '<img src="' + esc(path) + '" alt="Question figure ' + (index + 1) + '" loading="eager"></button>'
      ).join("") +
      '<p class="q-figure-hint">Select the image to inspect it at full size.</p></div>'
    );
  }

  function bindQuestionFigureViewer() {
    $$('[data-figure-src]').forEach((button) => {
      button.addEventListener("click", () => {
        let dialog = $("#figureViewer");
        if (!dialog) {
          dialog = document.createElement("dialog");
          dialog.id = "figureViewer";
          dialog.className = "figure-viewer";
          dialog.innerHTML = '<button class="figure-viewer-close" type="button" aria-label="Close figure">×</button><img alt="Expanded question figure">';
          document.body.appendChild(dialog);
          $(".figure-viewer-close", dialog).addEventListener("click", () => dialog.close());
          dialog.addEventListener("click", (event) => {
            if (event.target === dialog) dialog.close();
          });
        }
        $("img", dialog).src = button.dataset.figureSrc;
        dialog.showModal();
      });
    });
  }

  function round(value) {
    return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
  }

  function formatTime(seconds) {
    const total = Math.max(0, Math.floor(Number(seconds) || 0));
    const minutes = Math.floor(total / 60);
    const secs = total % 60;
    return String(minutes).padStart(2, "0") + ":" + String(secs).padStart(2, "0");
  }

  function formatScore(value) {
    const n = round(value);
    if (n > 0) return "+" + n;
    if (n < 0) return "−" + Math.abs(n);
    return "0";
  }

  function formatDate(timestamp) {
    if (!timestamp) return "—";
    try {
      return new Date(timestamp).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric"
      });
    } catch (error) {
      return "—";
    }
  }

  function plural(number, singular, pluralForm) {
    return number === 1 ? singular : pluralForm || singular + "s";
  }

  function readJSON(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function removeKey(key) {
    try {
      localStorage.removeItem(key);
    } catch (error) {
      /* localStorage can be unavailable on a strict file:// origin. */
    }
  }

  function progressKey(paperId) {
    return PROGRESS_PREFIX + paperId;
  }

  function resultKey(paperId) {
    return RESULT_PREFIX + paperId;
  }

  function getCustomData() {
    if (!state.customData) {
      const raw = readJSON(CUSTOM_KEY);
      state.customData =
        raw && typeof raw === "object"
          ? {
              papers: Array.isArray(raw.papers) ? raw.papers : [],
              drills: Array.isArray(raw.drills) ? raw.drills : []
            }
          : { papers: [], drills: [] };
    }
    return state.customData;
  }

  function getExam(examId) {
    return (window.EXAM_CATALOG || []).find((exam) => exam.id === examId) || null;
  }

  function getPaper(paperId) {
    return allPapers().find((paper) => paper.id === paperId) || null;
  }

  function allPapers() {
    return (window.MOCK_PAPERS || []).concat(getCustomData().papers || [], state.officialPapers || []);
  }

  function genericMarks(type) {
    if (type === "NAT") return { marks: 4, negative: 0 };
    if (type === "MSQ") return { marks: 4, negative: 1 };
    return { marks: 3, negative: 0 };
  }

  function genericCorrectAnswer(question) {
    const key = String(question.answer || "").trim();
    if (!key) return undefined;
    if (question.type === "MSQ") return key.split(/[,;&/]+/).map((value) => value.trim()).filter(Boolean);
    return key;
  }

  async function loadOfficialPapers() {
    try {
      const response = await fetch("/api/generic-bank");
      if (!response.ok) return;
      const bank = await response.json();
      const papers = [];
      (bank.topics || []).forEach((topic) => {
        const questions = topic.questions || [];
        for (let offset = 0; offset < questions.length; offset += 50) {
          const slice = questions.slice(offset, offset + 50);
          const grouped = new Map();
          slice.forEach((question) => {
            const type = question.type || "MCQ";
            if (!grouped.has(type)) grouped.set(type, []);
            const marking = genericMarks(type);
            grouped.get(type).push({
              id: question.id,
              type,
              topic: question.topic || topic.name,
              difficulty: question.difficulty || "Unassessed",
              prompt: question.prompt,
              options: question.options,
              correctAnswer: genericCorrectAnswer(question),
              solution: question.explanation || "Explanation pending review.",
              marks: marking.marks,
              negative: marking.negative
            });
          });
          const sections = Array.from(grouped.entries()).map(([type, items], index) => ({
            id: "topic-section-" + (index + 1),
            title: type === "NAT" ? "Numerical Answer" : type === "MSQ" ? "Multiple Select" : "Multiple Choice",
            label: type,
            type,
            marks: items[0] ? items[0].marks : 1,
            negative: items[0] ? items[0].negative : 0,
            questions: items
          }));
          papers.push({
            id: "topic-" + topic.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") + "-" + (Math.floor(offset / 50) + 1),
            examId: "generic",
            examName: "Question Bank",
            year: "",
            mode: "topic-bank",
            title: topic.name + (questions.length > 50 ? " · Set " + (Math.floor(offset / 50) + 1) : ""),
            subtitle: "Topic practice · reusable question bank",
            description: "A reusable topic-based practice set.",
            durationMinutes: Math.max(20, Math.ceil(slice.length * 1.5)),
            totalMarks: sections.reduce((sum, section) => sum + section.questions.reduce((part, question) => part + Number(question.marks || 0), 0), 0),
            sections
          });
        }
      });
      state.officialPapers = papers;
    } catch (error) {
      state.officialPapers = [];
    }
  }

  function flattenPaper(paper) {
    const questions = [];
    paper.sections.forEach((section) => {
      section.questions.forEach((question) => {
        questions.push({
          ...question,
          key: paper.id + ":" + question.id,
          paperId: paper.id,
          paperTitle: paper.title,
          examId: paper.examId,
          examName: paper.examName || (getExam(paper.examId) || {}).name || "",
          year: paper.year,
          sectionId: section.id,
          sectionTitle: section.title,
          sectionLabel: section.label,
          sectionType: section.type,
          marks: question.marks == null ? section.marks : question.marks,
          negative: question.negative == null ? section.negative : question.negative,
          partial: section.partial === true
        });
      });
    });
    return questions;
  }

  function allQuestions() {
    const fromPapers = allPapers().reduce((list, paper) => list.concat(flattenPaper(paper)), []);
    const drills = (window.PRACTICE_BANK || []).concat(getCustomData().drills || []).map((question) => ({
      ...question,
      key: "drill:" + question.id,
      paperId: "drill-" + question.examId,
      paperTitle: "Topic drills",
      examName: (getExam(question.examId) || {}).name || question.examId,
      year: "—",
      sectionId: "drill",
      sectionTitle: "Topic drill",
      sectionLabel: "Practice",
      sectionType: question.type,
      marks: question.marks,
      negative: question.negative,
      partial: question.type === "MSQ"
    }));
    return fromPapers.concat(drills);
  }

  function getQuestionByKey(key) {
    return allQuestions().find((question) => question.key === key) || null;
  }

  function paperStats(paper) {
    const questions = paper.sections.reduce((sum, section) => sum + section.questions.length, 0);
    const calculatedMarks = paper.sections.reduce(
      (sum, section) => sum + section.questions.length * section.marks,
      0
    );
    return {
      questions,
      marks: paper.totalMarks == null ? calculatedMarks : paper.totalMarks,
      sections: paper.sections.length
    };
  }

  function examStats(examId) {
    const papers = allPapers().filter((paper) => paper.examId === examId);
    const questions = allQuestions().filter((question) => question.examId === examId);
    return {
      papers: papers.length,
      questions: questions.length,
      topics: new Set(questions.map((question) => question.topic)).size
    };
  }

  function papersForExam(examId) {
    return allPapers().filter((paper) => paper.examId === examId);
  }

  function topicPool(examId, topic, difficulty) {
    return allQuestions().filter((question) => {
      if (examId && question.examId !== examId) return false;
      if (topic && question.topic !== topic) return false;
      if (difficulty && difficulty !== "all" && question.difficulty !== difficulty) return false;
      return true;
    });
  }

  function isAnswered(question, answers) {
    const source = answers || state.answers;
    const answer = source[question.id] == null && question.key ? source[question.key] : source[question.id];
    if (question.type === "MSQ") return Array.isArray(answer) && answer.length > 0;
    return answer !== undefined && answer !== null && String(answer).trim() !== "";
  }

  function optionText(question, optionId) {
    const option = (question.options || []).find((item) => item.id === optionId);
    return option ? option.text : optionId;
  }

  function correctAnswerText(question) {
    if (question.type === "NAT") return String(question.correctAnswer);
    if (question.type === "MSQ") {
      return (question.correctAnswer || []).map((id) => optionText(question, id)).join(" · ");
    }
    return optionText(question, question.correctAnswer);
  }

  function userAnswerText(question, answer) {
    if (question.type === "NAT") {
      return answer === undefined || answer === null || String(answer).trim() === ""
        ? "—"
        : String(answer);
    }
    if (question.type === "MCQ") {
      return answer ? optionText(question, answer) : "—";
    }
    if (question.type === "MSQ") {
      return Array.isArray(answer) && answer.length
        ? answer.map((id) => optionText(question, id)).join(" · ")
        : "—";
    }
    return "—";
  }

  function scoreQuestion(question, answer) {
    const answered =
      question.type === "MSQ"
        ? Array.isArray(answer) && answer.length > 0
        : answer !== undefined && answer !== null && String(answer).trim() !== "";

    if (!answered) return { score: 0, status: "unattempted" };

    if (question.type === "NAT") {
      const numeric = Number(answer);
      if (!Number.isFinite(numeric)) return { score: 0, status: "wrong" };
      const tolerance = Number(question.tolerance == null ? 0.01 : question.tolerance);
      const correct = Math.abs(numeric - Number(question.correctAnswer)) <= tolerance;
      return { score: correct ? question.marks : 0, status: correct ? "correct" : "wrong" };
    }

    if (question.type === "MCQ") {
      const correct = answer === question.correctAnswer;
      return {
        score: correct ? question.marks : -Number(question.negative || 0),
        status: correct ? "correct" : "wrong"
      };
    }

    if (question.type === "MSQ") {
      const correctSet = new Set(question.correctAnswer || []);
      const selectedSet = new Set(answer || []);
      const hasWrong = Array.from(selectedSet).some((id) => !correctSet.has(id));
      if (hasWrong) {
        return { score: -Number(question.negative || 0), status: "wrong" };
      }
      const correctSelected = Array.from(selectedSet).filter((id) => correctSet.has(id)).length;
      const allCorrect =
        correctSelected === correctSet.size && selectedSet.size === correctSet.size;
      if (allCorrect) return { score: question.marks, status: "correct" };
      if (correctSelected > 0) return { score: correctSelected, status: "partial" };
      return { score: 0, status: "unattempted" };
    }

    return { score: 0, status: "unattempted" };
  }

  function computeResult(paper, questions, answers, timeUsedSeconds, autoSubmitted) {
    const sections = paper.sections.map((section) => {
      const sectionQuestions = questions.filter((question) => question.sectionId === section.id);
      let score = 0;
      let correct = 0;
      let wrong = 0;
      let partial = 0;
      let unattempted = 0;

      sectionQuestions.forEach((question) => {
        const outcome = scoreQuestion(question, answers[question.id]);
        score += outcome.score;
        if (outcome.status === "correct") correct += 1;
        else if (outcome.status === "wrong") wrong += 1;
        else if (outcome.status === "partial") partial += 1;
        else unattempted += 1;
      });

      return {
        id: section.id,
        title: section.title,
        label: section.label,
        count: sectionQuestions.length,
        max: sectionQuestions.reduce((sum, question) => sum + question.marks, 0),
        score: round(score),
        correct,
        wrong,
        partial,
        unattempted
      };
    });

    const totals = sections.reduce(
      (acc, section) => {
        acc.score += section.score;
        acc.max += section.max;
        acc.correct += section.correct;
        acc.wrong += section.wrong;
        acc.partial += section.partial;
        acc.unattempted += section.unattempted;
        return acc;
      },
      { score: 0, max: 0, correct: 0, wrong: 0, partial: 0, unattempted: 0 }
    );

    return {
      paperId: paper.id,
      paperTitle: paper.title,
      examId: paper.examId,
      total: round(totals.score),
      max: round(totals.max),
      percentage: totals.max ? round((totals.score / totals.max) * 100) : 0,
      correct: totals.correct,
      wrong: totals.wrong,
      partial: totals.partial,
      unattempted: totals.unattempted,
      sections,
      answers: JSON.parse(JSON.stringify(answers)),
      timeUsedSeconds: Math.max(0, Math.floor(timeUsedSeconds || 0)),
      submittedAt: Date.now(),
      autoSubmitted: !!autoSubmitted
    };
  }

  function flashSaved() {
    const element = $("#saveStatus");
    if (!element) return;
    element.textContent = "Saved locally";
    element.classList.add("saved");
    if (state.saveFlashTimer) window.clearTimeout(state.saveFlashTimer);
    state.saveFlashTimer = window.setTimeout(() => {
      element.textContent = "";
      element.classList.remove("saved");
    }, 1600);
  }

  function saveProgress() {
    if (!state.paper || state.submitted) return;
    const saved = writeJSON(progressKey(state.paper.id), {
      paperId: state.paper.id,
      answers: state.answers,
      marked: Array.from(state.marked),
      startedAt: state.startedAt,
      currentIndex: state.currentIndex
    });
    if (saved) flashSaved();
  }

  function loadProgress(paperId) {
    const saved = readJSON(progressKey(paperId));
    if (!saved || !saved.startedAt) return null;
    return saved;
  }

  function clearProgress(paperId) {
    removeKey(progressKey(paperId));
  }

  function savePractice() {
    if (!state.practice) return;
    if (writeJSON(PRACTICE_KEY, state.practice)) flashSaved();
  }

  function getBookmarks() {
    const bookmarks = readJSON(BOOKMARK_KEY);
    return Array.isArray(bookmarks) ? bookmarks : [];
  }

  function isBookmarked(key) {
    return getBookmarks().indexOf(key) >= 0;
  }

  function toggleBookmark(key) {
    const bookmarks = getBookmarks();
    const index = bookmarks.indexOf(key);
    if (index >= 0) bookmarks.splice(index, 1);
    else bookmarks.push(key);
    writeJSON(BOOKMARK_KEY, bookmarks);
    flashSaved();
  }

  function updateThemeIcon(theme) {
    const icon = $("#themeIcon");
    if (icon) icon.textContent = theme === "light" ? "☀" : "◐";
  }

  function setTheme(theme) {
    const next = theme === "light" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    updateThemeIcon(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch (error) {
      /* Ignore storage restrictions. */
    }
  }

  function stopTimer() {
    if (state.timerId) {
      window.clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function updateTimerDisplay() {
    const timer = $("#timer");
    if (!timer) return;
    timer.textContent = formatTime(state.remaining);
    timer.classList.toggle("warning", state.remaining <= 300 && state.remaining > 60);
    timer.classList.toggle("danger", state.remaining <= 60);
  }

  function startTimer() {
    stopTimer();
    updateTimerDisplay();
    state.timerId = window.setInterval(() => {
      if (!state.paper || state.submitted || !state.startedAt) return;
      const elapsed = Math.floor((Date.now() - state.startedAt) / 1000);
      state.remaining = Math.max(0, state.paper.durationMinutes * 60 - elapsed);
      updateTimerDisplay();
      if (state.remaining <= 0) {
        stopTimer();
        submitPaper(true);
      }
    }, 1000);
  }

  function updatePalette() {
    if (!state.paper) return;
    const total = state.questions.length;
    const answered = state.questions.filter((question) => isAnswered(question, state.answers)).length;
    const bar = $("#progressBar");
    const copy = $("#progressText");
    if (bar) bar.style.width = (total ? (answered / total) * 100 : 0) + "%";
    if (copy) copy.textContent = answered + "/" + total + " answered";

    $$("[data-palette-index]").forEach((button) => {
      const index = Number(button.dataset.paletteIndex);
      const question = state.questions[index];
      if (!question) return;
      button.classList.toggle("answered", isAnswered(question, state.answers));
      button.classList.toggle("marked", state.marked.has(question.id));
      button.classList.toggle("current", index === state.currentIndex);
    });

    $$("[data-section-count]").forEach((element) => {
      const sectionId = element.dataset.sectionCount;
      const questions = state.questions.filter((question) => question.sectionId === sectionId);
      const done = questions.filter((question) => isAnswered(question, state.answers)).length;
      element.textContent = done + "/" + questions.length;
    });
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(path, replace) {
    const hash = "#" + path;
    if (window.location.hash === hash) {
      renderRoute();
      return;
    }
    if (replace) {
      window.history.replaceState(null, "", hash);
      renderRoute();
    } else {
      window.location.hash = hash;
    }
  }

  function getRoute() {
    return window.location.hash.replace(/^#/, "") || "/";
  }

  function parseRoute() {
    const parts = getRoute().split("/").filter(Boolean);
    if (!parts.length) return { name: "home" };
    if (parts[0] === "exams") return { name: "exams" };
    if (parts[0] === "exam") return { name: "exam", examId: parts[1] || "" };
    if (parts[0] === "mocks") return { name: "mocks" };
    if (parts[0] === "practice-session") return { name: "practice-session" };
    if (parts[0] === "practice") {
      return {
        name: "practice",
        examId: parts[1] || "",
        topic: parts[2] ? decodeURIComponent(parts[2]) : ""
      };
    }
    if (parts[0] === "paper") return { name: "paper", paperId: parts[1] || "" };
    if (parts[0] === "result") return { name: "result", paperId: parts[1] || "" };
    if (parts[0] === "prompts") return { name: "prompts" };
    if (parts[0] === "progress") return { name: "progress" };
    if (parts[0] === "import") return { name: "import" };
    return { name: "home" };
  }

  function setActiveNav(route) {
    const map = {
      home: "home",
      exams: "exams",
      exam: "exams",
      paper: "exams",
      mocks: "mocks",
      result: "mocks",
      practice: "practice",
      "practice-session": "practice",
      prompts: "prompts",
      progress: "progress",
      import: "import"
    };
    $$("[data-nav]").forEach((link) => {
      link.classList.toggle("active", link.dataset.nav === map[route.name]);
    });
  }

  function preparePaper(paperId, resume) {
    const paper = getPaper(paperId);
    if (!paper) return false;

    stopTimer();
    state.paper = paper;
    state.questions = flattenPaper(paper);
    state.answers = {};
    state.marked = new Set();
    state.currentIndex = 0;
    state.startedAt = Date.now();
    state.submitted = false;
    state.result = null;

    const saved = resume ? loadProgress(paper.id) : null;
    if (saved) {
      state.answers = saved.answers || {};
      state.marked = new Set(saved.marked || []);
      state.currentIndex = Math.min(
        Math.max(0, Number(saved.currentIndex) || 0),
        state.questions.length - 1
      );
      state.startedAt = Number(saved.startedAt) || Date.now();
    } else {
      clearProgress(paper.id);
    }

    const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
    state.remaining = Math.max(0, paper.durationMinutes * 60 - elapsed);

    if (state.remaining <= 0) {
      submitPaper(true);
      return false;
    }

    if (!saved) saveProgress();
    startTimer();
    return true;
  }

  function startPaper(paperId, resume) {
    if (!preparePaper(paperId, resume)) return;
    const target = "/paper/" + paperId;
    if (getRoute() === target) {
      renderExam();
      scrollTop();
    } else {
      navigate(target);
    }
  }

  function retakePaper(paperId) {
    removeKey(resultKey(paperId));
    clearProgress(paperId);
    startPaper(paperId, false);
  }

  function confirmSubmit() {
    if (!state.paper || state.submitted) return;
    const unanswered = state.questions.filter((question) => !isAnswered(question, state.answers)).length;
    const message =
      "Submit “" +
      state.paper.title +
      "” now?\n\n" +
      unanswered +
      " question" +
      (unanswered === 1 ? "" : "s") +
      " unanswered.\n" +
      state.marked.size +
      " marked for review.\n\nYou cannot change answers after submitting.";
    if (window.confirm(message)) submitPaper(false);
  }

  function submitPaper(autoSubmitted) {
    if (!state.paper || state.submitted) return;
    const paper = state.paper;
    const elapsed = Math.max(0, Math.floor((Date.now() - state.startedAt) / 1000));
    const cappedElapsed = Math.min(paper.durationMinutes * 60, elapsed);

    stopTimer();
    state.remaining = autoSubmitted ? 0 : Math.max(0, paper.durationMinutes * 60 - cappedElapsed);
    state.submitted = true;

    const result = computeResult(
      paper,
      state.questions,
      state.answers,
      autoSubmitted ? paper.durationMinutes * 60 : cappedElapsed,
      autoSubmitted
    );

    writeJSON(resultKey(paper.id), result);
    clearProgress(paper.id);
    state.result = result;

    const target = "/result/" + paper.id;
    if (getRoute() === target) {
      renderResult(result);
      scrollTop();
    } else {
      navigate(target);
    }
  }

  function navigateToQuestion(index) {
    if (!state.paper || index < 0 || index >= state.questions.length) return;
    state.currentIndex = index;
    saveProgress();
    renderExam();
    scrollTop();
  }

  function applyKey(key, question) {
    const input = $("#natAnswer");
    if (!input) return;
    let value = input.value;
    if (key === "back") value = value.slice(0, -1);
    else if (key === "clear") value = "";
    else if (key === ".") {
      if (!value.includes(".")) value = value === "" ? "0." : value + ".";
    } else {
      value += key;
    }
    input.value = value;
    if (value === "") delete state.answers[question.id];
    else state.answers[question.id] = value;
    saveProgress();
    updatePalette();
    input.focus();
  }

  function renderQuestionBody(question) {
    if (question.type === "NAT") {
      const value = state.answers[question.id] == null ? "" : String(state.answers[question.id]);
      const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "back"];
      const keypad = keys
        .map((key) => {
          const label = key === "back" ? "⌫" : key;
          return '<button class="key-btn" type="button" data-key="' + key + '" aria-label="' + (key === "back" ? "Backspace" : "Enter " + key) + '">' + label + "</button>";
        })
        .join("") +
        '<button class="key-btn wide" type="button" data-key="clear">Clear</button>';

      return (
        '<div class="nat-wrap">' +
        '<div class="nat-field"><label for="natAnswer">Your answer</label>' +
        '<input id="natAnswer" class="nat-input" type="number" inputmode="decimal" step="any" value="' +
        esc(value) + '" placeholder="—" autocomplete="off">' +
        '<p class="nat-hint">Type a number or use the keypad. Tolerance: ±' +
        esc(question.tolerance == null ? 0.01 : question.tolerance) + ".</p></div>" +
        '<div class="keypad" aria-label="Numeric keypad">' + keypad + "</div>" +
        "</div>"
      );
    }

    const selected = state.answers[question.id];
    return (
      '<div class="options" role="group" aria-label="Answer options">' +
      (question.options || [])
        .map((option) => {
          const checked =
            question.type === "MSQ"
              ? Array.isArray(selected) && selected.includes(option.id)
              : selected === option.id;
          const inputType = question.type === "MSQ" ? "checkbox" : "radio";
          return (
            '<label class="option"><input type="' + inputType + '" name="q-' + esc(question.id) +
            '" value="' + esc(option.id) + '" data-option="' + esc(option.id) +
            '" data-question-id="' + esc(question.id) + '"' + (checked ? " checked" : "") + ">" +
            '<span class="option-body"><span class="option-letter">' + esc(option.id) +
            "</span><span>" + esc(option.text) + "</span></span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function renderPalette() {
    return state.paper.sections
      .map((section) => {
        const indices = state.questions
          .map((question, index) => (question.sectionId === section.id ? index : -1))
          .filter((index) => index >= 0);
        const buttons = indices
          .map((index) => {
            const question = state.questions[index];
            const classes = ["palette-btn"];
            if (isAnswered(question, state.answers)) classes.push("answered");
            if (state.marked.has(question.id)) classes.push("marked");
            if (index === state.currentIndex) classes.push("current");
            return (
              '<button class="' + classes.join(" ") + '" type="button" data-palette-index="' +
              index + '" aria-label="Go to question ' + (index + 1) + '">' + (index + 1) + "</button>"
            );
          })
          .join("");
        return (
          '<div class="palette-group">' +
          '<div class="palette-title"><strong>' + esc(section.title) + " · " + esc(section.label) +
          '</strong><span data-section-count="' + esc(section.id) + '">0/' + indices.length + "</span></div>" +
          '<div class="palette-grid">' + buttons + "</div>" +
          "</div>"
        );
      })
      .join("");
  }

  function renderExam() {
    if (!state.paper || !state.questions.length) {
      navigate("/", true);
      return;
    }
    const paper = state.paper;
    const question = state.questions[state.currentIndex];
    const index = state.currentIndex;
    const total = state.questions.length;
    const isLast = index === total - 1;
    const negative = Number(question.negative || 0);
    const marking =
      question.type === "NAT"
        ? "+" + question.marks + " correct · 0 wrong"
        : question.type === "MSQ"
          ? "+" + question.marks + " all correct · +1 per correct option" +
            (negative ? " · −" + negative + " any wrong" : " · 0 wrong")
          : "+" + question.marks + " correct" + (negative ? " · −" + negative + " wrong" : " · 0 wrong");

    const note =
      question.type === "MSQ"
        ? "Multiple answers may be correct. Partial credit: +1 per correct option if no wrong option is selected."
        : question.type === "NAT"
          ? "Answers are hidden until submission. Use the keypad or type a number."
          : "Answers are hidden until submission. Choose one option.";

    const exam = getExam(paper.examId);

    $("#view").innerHTML =
      '<div class="exam-top">' +
      '<div><button class="btn btn-quiet" id="backHome" type="button">← ' + esc(exam ? exam.name : "All") + ' papers</button></div>' +
      '<div class="exam-title"><h1>' + esc(paper.title) + "</h1><span>" + esc(paper.subtitle) + "</span></div>" +
      '<div class="badge">' + esc(paper.examName || (exam ? exam.name : "")) + " · " + total + " questions · " + paperStats(paper).marks + " marks</div>" +
      "</div>" +
      '<div class="exam-layout">' +
      '<aside class="sidebar">' +
      '<div class="panel timer-panel">' +
      '<div class="timer-label"><span>Time remaining</span><span>' + esc(paper.durationMinutes) + " min</span></div>" +
      '<div class="timer" id="timer" role="timer" aria-live="off">' + formatTime(state.remaining) + "</div>" +
      '<div class="progress-track"><div class="progress-bar" id="progressBar"></div></div>' +
      '<div class="progress-copy"><span id="progressText">0/' + total + " answered</span><span>Autosaved</span></div>" +
      "</div>" +
      '<div class="panel palette-panel">' + renderPalette() +
      '<div class="palette-legend"><span><span class="legend-dot answered"></span>Answered</span><span><span class="legend-dot marked"></span>Marked</span></div>' +
      "</div>" +
      '<div class="panel submit-box"><button class="btn btn-primary btn-wide" id="submitBtn" type="button">Submit paper</button><p>Submission is final. Review marked questions first.</p></div>' +
      "</aside>" +
      '<section class="question-card">' +
      '<div class="q-kicker"><div class="q-kicker-left"><span class="q-counter">Question ' + (index + 1) + " of " + total + "</span><span>" + esc(question.topic) + "</span><span>·</span><span>" + esc(question.difficulty) + '</span></div><span>' + esc(marking) + "</span></div>" +
      '<div class="q-prompt">' + nl2br(question.prompt) + "</div>" +
      renderQuestionFigures(question) +
      renderQuestionBody(question) +
      '<div class="q-note">' + esc(note) + "</div>" +
      '<div class="exam-actions">' +
      '<button class="btn btn-quiet" id="markBtn" type="button">' + (state.marked.has(question.id) ? "Unmark review" : "Mark for review") + "</button>" +
      '<button class="btn btn-quiet" id="bookmarkBtn" type="button">' + (isBookmarked(question.key) ? "★ Bookmarked" : "☆ Bookmark") + "</button>" +
      '<button class="btn btn-quiet" id="clearBtn" type="button">Clear response</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost" id="prevBtn" type="button"' + (index === 0 ? " disabled" : "") + ">Previous</button>" +
      '<button class="btn btn-primary" id="nextBtn" type="button">' + (isLast ? "Submit paper" : "Next →") + "</button>" +
      "</div>" +
      "</section>" +
      "</div>";

    $("#backHome").addEventListener("click", () => {
      saveProgress();
      navigate("/exam/" + paper.examId);
    });
    $("#prevBtn").addEventListener("click", () => navigateToQuestion(index - 1));
    $("#nextBtn").addEventListener("click", () => {
      if (isLast) confirmSubmit();
      else navigateToQuestion(index + 1);
    });
    $("#markBtn").addEventListener("click", () => {
      if (state.marked.has(question.id)) state.marked.delete(question.id);
      else state.marked.add(question.id);
      saveProgress();
      renderExam();
    });
    $("#bookmarkBtn").addEventListener("click", () => {
      toggleBookmark(question.key);
      renderExam();
    });
    $("#clearBtn").addEventListener("click", () => {
      delete state.answers[question.id];
      saveProgress();
      renderExam();
    });
    $("#submitBtn").addEventListener("click", confirmSubmit);

    $$("[data-palette-index]").forEach((button) => {
      button.addEventListener("click", () => navigateToQuestion(Number(button.dataset.paletteIndex)));
    });

    const natInput = $("#natAnswer");
    if (natInput) {
      natInput.addEventListener("input", () => {
        const value = natInput.value;
        if (String(value).trim() === "") delete state.answers[question.id];
        else state.answers[question.id] = value;
        saveProgress();
        updatePalette();
      });
    }

    $$("[data-key]").forEach((button) => {
      button.addEventListener("click", () => applyKey(button.dataset.key, question));
    });

    $$("[data-option]").forEach((input) => {
      input.addEventListener("change", () => {
        if (question.type === "MSQ") {
          let answer = Array.isArray(state.answers[question.id])
            ? state.answers[question.id].slice()
            : [];
          if (input.checked) {
            if (!answer.includes(input.value)) answer.push(input.value);
          } else {
            answer = answer.filter((value) => value !== input.value);
          }
          answer.sort();
          if (answer.length) state.answers[question.id] = answer;
          else delete state.answers[question.id];
        } else {
          state.answers[question.id] = input.value;
        }
        saveProgress();
        updatePalette();
      });
    });

    updatePalette();
    updateTimerDisplay();
    bindQuestionFigureViewer();
  }

  function statusLabel(status) {
    if (status === "correct") return "Correct";
    if (status === "wrong") return "Wrong";
    if (status === "partial") return "Partial";
    return "Unattempted";
  }

  function renderReviewQuestion(question, index, answers) {
    const outcome = scoreQuestion(question, answers[question.id]);
    const answerText = userAnswerText(question, answers[question.id]);
    let options = "";
    if (question.options && question.options.length) {
      options =
        '<div class="review-options">' +
        question.options
          .map((option) => {
            const isCorrect = question.type === "MSQ"
              ? (question.correctAnswer || []).includes(option.id)
              : question.correctAnswer === option.id;
            const isSelected = question.type === "MSQ"
              ? Array.isArray(answers[question.id]) && answers[question.id].includes(option.id)
              : answers[question.id] === option.id;
            const classes = ["review-option"];
            if (isCorrect) classes.push("correct");
            if (isSelected) classes.push(isCorrect ? "selected" : "selected-wrong");
            return '<div class="' + classes.join(" ") + '">' + esc(option.id) + ". " + esc(option.text) + "</div>";
          })
          .join("") +
        "</div>";
    }

    return (
      '<details class="review-item">' +
      '<summary><div class="review-summary-left"><span class="review-qnum">Q' + (index + 1) +
      '</span><span class="status-pill ' + outcome.status + '">' + statusLabel(outcome.status) +
      '</span><span class="review-title">' + esc(question.prompt).slice(0, 120) +
      '</span></div><span class="badge">' + formatScore(outcome.score) + " marks</span></summary>" +
      '<div class="review-body"><div class="review-prompt">' + nl2br(question.prompt) + "</div>" +
      renderQuestionFigures(question) +
      options +
      '<div class="answer-line"><span>Your answer: <strong>' + esc(answerText) +
      "</strong></span><span>Correct answer: <strong>" + esc(correctAnswerText(question)) + "</strong></span></div>" +
      '<div class="solution"><strong>Why:</strong> ' + nl2br(question.solution) + "</div>" +
      "</div></details>"
    );
  }

  function renderResult(result) {
    stopTimer();
    const paper = getPaper(result.paperId);
    if (!paper) {
      navigate("/", true);
      return;
    }
    state.result = result;
    const questions = flattenPaper(paper);
    const answers = result.answers || {};
    const totalQuestions = questions.length;
    const timeUsed = formatTime(result.timeUsedSeconds);
    const pct = Math.max(0, Math.min(100, Number(result.percentage) || 0));
    const exam = getExam(paper.examId);

    const sectionRows = result.sections
      .map(
        (section) =>
          "<tr><td>" + esc(section.title) + " · " + esc(section.label) +
          '</td><td class="num">' + formatScore(section.score) + " / " + section.max +
          '</td><td class="num">' + section.correct + "</td><td class=\"num\">" + section.wrong +
          '</td><td class="num">' + section.partial + '</td><td class="num">' + section.unattempted + "</td></tr>"
      )
      .join("");

    const topicStats = {};
    questions.forEach((question) => {
      if (!topicStats[question.topic]) topicStats[question.topic] = { total: 0, attempted: 0, correct: 0, score: 0 };
      const outcome = scoreQuestion(question, answers[question.id]);
      topicStats[question.topic].total += 1;
      if (outcome.status !== "unattempted") topicStats[question.topic].attempted += 1;
      if (outcome.status === "correct" || outcome.status === "partial") topicStats[question.topic].correct += 1;
      topicStats[question.topic].score += outcome.score;
    });

    const topicRows = Object.keys(topicStats)
      .sort((a, b) => topicStats[b].total - topicStats[a].total)
      .map((topic) => {
        const item = topicStats[topic];
        const accuracy = item.attempted ? Math.round((item.correct / item.attempted) * 100) : 0;
        return (
          '<div class="topic-result-row"><span><strong>' + esc(topic) + "</strong><small>" +
          item.correct + "/" + item.attempted + " credited</small></span>" +
          '<div class="topic-result-bar"><span style="width:' + accuracy + '%"></span></div>' +
          '<span class="topic-result-score">' + formatScore(item.score) + "</span></div>"
        );
      })
      .join("");

    const review = questions.map((question, index) => renderReviewQuestion(question, index, answers)).join("");

    $("#view").innerHTML =
      '<div class="result-hero">' +
      '<div class="score-card">' +
      '<p class="eyebrow">' + (result.autoSubmitted ? "Time expired · auto-submitted" : "Paper submitted") + "</p>" +
      "<h1>" + esc(paper.title) + "</h1>" +
      '<p class="score-sub">' + esc(exam ? exam.name : "") + " · " + totalQuestions + " questions · " + paper.durationMinutes + " minutes · " + timeUsed + " used</p>" +
      '<div class="score-big"><strong>' + result.total + "</strong><span>/ " + result.max + " marks</span></div>" +
      '<div class="progress-track"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
      '<p class="score-sub" style="margin-top:10px">' + result.percentage + "% of the available marks. Negative marking is included.</p>" +
      '<div class="result-actions"><button class="btn btn-primary" id="retakeBtn" type="button">Retake paper</button><button class="btn btn-ghost" id="resultExamBtn" type="button">' + esc(exam ? exam.name : "Exam") + ' hub</button><button class="btn btn-quiet" id="openAllBtn" type="button">Open all reviews</button></div>' +
      "</div>" +
      '<aside class="result-side">' +
      '<div class="result-stat-grid">' +
      '<div class="result-stat correct"><strong>' + result.correct + "</strong><span>Correct</span></div>" +
      '<div class="result-stat wrong"><strong>' + result.wrong + "</strong><span>Wrong</span></div>" +
      '<div class="result-stat partial"><strong>' + result.partial + "</strong><span>Partial</span></div>" +
      '<div class="result-stat skipped"><strong>' + result.unattempted + "</strong><span>Skipped</span></div>" +
      "</div>" +
      '<div class="panel" style="padding:16px"><div class="timer-label"><span>Time used</span><span>' + timeUsed + "</span></div>" +
      '<p class="score-sub" style="margin:10px 0 0">Scores are provisional and calculated locally. A production exam must score on the server.</p></div>' +
      "</aside>" +
      "</div>" +
      '<div class="section-table-wrap"><table><thead><tr><th>Section</th><th>Score</th><th>Correct</th><th>Wrong</th><th>Partial</th><th>Skipped</th></tr></thead><tbody>' + sectionRows + "</tbody></table></div>" +
      '<div class="section-head"><div><p class="eyebrow">Topic breakdown</p><h2>Where the marks came from.</h2><p>Use this to choose the next practice set.</p></div></div>' +
      '<div class="panel topic-breakdown">' + (topicRows || '<p class="empty-state">No topic data.</p>') + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Answer review</p><h2>See what happened.</h2><p>Open any question to compare your response with the correct answer and the explanation.</p></div></div>' +
      '<div class="review-list">' + review + "</div>";

    $("#retakeBtn").addEventListener("click", () => retakePaper(paper.id));
    $("#resultExamBtn").addEventListener("click", () => navigate("/exam/" + paper.examId));
    $("#openAllBtn").addEventListener("click", (event) => {
      const open = event.currentTarget.dataset.open !== "true";
      $$(".review-item").forEach((item) => {
        item.open = open;
      });
      event.currentTarget.dataset.open = String(open);
      event.currentTarget.textContent = open ? "Collapse all reviews" : "Open all reviews";
    });
  }

  function paperActionMarkup(paper) {
    const saved = loadProgress(paper.id);
    const result = readJSON(resultKey(paper.id));
    if (saved) {
      return (
        '<button class="btn btn-primary" data-resume="' + esc(paper.id) + '">Resume</button>' +
        '<button class="btn btn-ghost" data-restart="' + esc(paper.id) + '">Restart</button>'
      );
    }
    if (result) {
      return (
        '<button class="btn btn-primary" data-start="' + esc(paper.id) + '">Retake</button>' +
        '<button class="btn btn-ghost" data-review="' + esc(paper.id) + '">Review attempt</button>'
      );
    }
    return '<button class="btn btn-primary" data-start="' + esc(paper.id) + '">Start paper</button>';
  }

  function paperCard(paper) {
    const stats = paperStats(paper);
    const saved = loadProgress(paper.id);
    const result = readJSON(resultKey(paper.id));
    const exam = getExam(paper.examId);
    let status = "Not started";
    let statusClass = "";
    if (saved) {
      status = "In progress";
      statusClass = "progress";
    } else if (result) {
      status = "Last score: " + result.total + "/" + result.max;
      statusClass = "done";
    }

    return (
      '<article class="paper-card">' +
      '<div class="paper-card-top">' +
      '<span class="badge badge-accent">' + esc(exam ? exam.name : paper.examName || "Paper") + " · " + esc(paper.year || "") + "</span>" +
      '<span class="paper-status ' + statusClass + '">' + esc(status) + "</span>" +
      "</div>" +
      "<h3>" + esc(paper.title) + "</h3>" +
      "<p>" + esc(paper.description) + "</p>" +
      '<div class="paper-meta">' +
      '<span class="badge">' + stats.questions + " questions</span>" +
      '<span class="badge">' + paper.durationMinutes + " min</span>" +
      '<span class="badge">' + stats.marks + " marks</span>" +
      '<span class="badge">' + stats.sections + " sections</span>" +
      "</div>" +
      '<div class="paper-actions">' + paperActionMarkup(paper) + "</div>" +
      "</article>"
    );
  }

  function examCard(exam) {
    const stats = examStats(exam.id);
    const firstPaper = papersForExam(exam.id)[0];
    return (
      '<article class="exam-card exam-card-' + esc(exam.id) + '">' +
      '<div class="exam-card-top"><span class="exam-code">' + esc(exam.name) + "</span><span class=\"badge\">" + esc(exam.level) + "</span></div>" +
      "<h3>" + esc(exam.tagline) + "</h3>" +
      "<p>" + esc(exam.description) + "</p>" +
      '<div class="exam-card-meta">' +
      '<span><strong>' + stats.papers + "</strong> papers</span>" +
      '<span><strong>' + stats.questions + "</strong> questions</span>" +
      '<span><strong>' + exam.topics.length + "</strong> topics</span>" +
      "</div>" +
      '<div class="exam-card-actions">' +
      '<a class="btn btn-ghost" href="#/exam/' + esc(exam.id) + '">Explore exam</a>' +
      (firstPaper ? '<button class="btn btn-primary" data-start-exam="' + esc(exam.id) + '">Start mock</button>' : "") +
      "</div>" +
      "</article>"
    );
  }

  function topicPracticeButton(examId, topic, label, share) {
    const available = topicPool(examId, topic, "all").length;
    return (
      '<button class="topic-chip" type="button" data-practice-topic="' + esc(examId) + '" data-topic="' + esc(topic) + '">' +
      "<span>" + esc(label || topic) + "</span>" +
      '<small>' + (share == null ? available + " Q" : share + "% · " + available + " Q") + "</small>" +
      "</button>"
    );
  }

  function renderHome() {
    stopTimer();
    state.paper = null;
    state.submitted = false;
    state.result = null;
    const papers = allPapers();
    const questions = allQuestions();
    const totals = papers.reduce(
      (acc, paper) => {
        const stats = paperStats(paper);
        acc.paperQuestions += stats.questions;
        acc.marks += stats.marks;
        return acc;
      },
      { paperQuestions: 0, marks: 0 }
    );
    const exams = window.EXAM_CATALOG || [];
    const activeCards = papers
      .filter((paper) => loadProgress(paper.id) || readJSON(resultKey(paper.id)))
      .map(paperCard)
      .join("");
    const uceed = getExam("uceed");
    const spotlightTopics = (uceed ? uceed.topics.slice(0, 6) : [])
      .map((topic) => topicPracticeButton("uceed", topic.name, topic.name, topic.share))
      .join("");
    const examCards = exams.map(examCard).join("");
    const mockCards = papers.map(paperCard).join("");

    $("#view").innerHTML =
      '<section class="hero home-hero">' +
      '<div class="hero-copy">' +
      '<p class="eyebrow">Original practice · four design exams</p>' +
      "<h1>One studio. <span>Four exams.</span> Real exam rhythm.</h1>" +
      '<p class="hero-lead">Start a timed UCEED, CEED, NIFT, or NID paper from the main page. The player keeps the clock, autosaves every response, and opens a full answer review when you submit. Topic practice is built in.</p>' +
      '<div class="hero-actions">' +
      '<button class="btn btn-primary" data-start-exam="uceed" type="button">Start a UCEED mock</button>' +
      '<a class="btn btn-ghost" href="#/practice">Build a topic set</a>' +
      "</div>" +
      '<div class="hero-stat-row">' +
      '<div><strong>' + exams.length + "</strong><span>Exams</span></div>" +
      '<div><strong>' + papers.length + "</strong><span>Mocks</span></div>" +
      '<div><strong>' + questions.length + "</strong><span>Original Qs</span></div>" +
      '<div><strong>' + totals.marks + "</strong><span>Marks</span></div>" +
      "</div>" +
      "</div>" +
      '<aside class="hero-card">' +
      '<div class="hero-card-top"><span>Studio snapshot</span><span class="badge badge-accent">Local prototype</span></div>' +
      "<div>" +
      "<h2>Paper, palette, clock, review.</h2>" +
      '<p>Every mock uses the same engine: section palette, answer state, mark-for-review, autosave, timer, and a scored review.</p>' +
      "</div>" +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><strong>' + (uceed ? uceed.referenceQuestions : "—") + "</strong><span>Reference Qs</span></div>" +
      '<div class="hero-stat"><strong>' + (window.DRAWING_PROMPTS || []).length + "</strong><span>Part B briefs</span></div>" +
      '<div class="hero-stat"><strong>4</strong><span>Exam tracks</span></div>' +
      "</div>" +
      "</aside>" +
      "</section>" +
      (activeCards
        ? '<div class="section-head"><div><p class="eyebrow">Jump back in</p><h2>Your saved work.</h2><p>Resume a paper or reopen the last review. Everything is stored in this browser.</p></div></div>' +
          '<div class="paper-grid">' + activeCards + "</div>"
        : "") +
      '<div class="section-head"><div><p class="eyebrow">Choose your exam</p><h2>Start where you are aiming.</h2><p>Each exam has its own official pattern, marking model, topic map, and mini mocks. The starter bank is original; import your licensed bank to grow it.</p></div><a class="btn btn-quiet" href="#/exams">Compare all exams</a></div>' +
      '<div class="exam-grid">' + examCards + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Topic practice</p><h2>Drill one weakness at a time.</h2><p>Filter by exam, topic, and difficulty. Practice gives instant feedback instead of hiding the answer until the end.</p></div><a class="btn btn-quiet" href="#/practice">Open practice</a></div>' +
      '<div class="topic-chip-grid">' + spotlightTopics + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Mock library</p><h2>Pick a paper. Start the clock.</h2><p>Mini mocks use the official section and marking model. They are deliberately short enough to finish in one sitting.</p></div><a class="btn btn-quiet" href="#/mocks">All mocks</a></div>' +
      '<div class="paper-grid">' + mockCards + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">How the engine works</p><h2>Not just a quiz.</h2><p>The point is to rehearse the exam interface, not only the content.</p></div></div>' +
      '<div class="info-grid">' +
      '<article class="info-card"><span class="num">01</span><h3>Sectioned palette</h3><p>Jump between sections. Answered, marked, and current questions stay visually distinct.</p></article>' +
      '<article class="info-card"><span class="num">02</span><h3>Real marking logic</h3><p>Numerical tolerance, MCQ negative marking, and MSQ partial credit are calculated per section.</p></article>' +
      '<article class="info-card"><span class="num">03</span><h3>Review after submit</h3><p>See your answer, the correct answer, the explanation, and a topic-wise score breakdown.</p></article>' +
      "</div>" +
      '<section class="studio-banner">' +
      "<div><h2>Part B is a different muscle.</h2><p>Use the original drawing briefs with a 30-minute timer, then score yourself against the criteria. The prompts are in the app and in <code>docs/drawing-prompts.md</code>.</p></div>" +
      '<a class="btn btn-ghost" href="#/prompts">Open drawing studio</a>' +
      "</section>";
  }

  function renderExams() {
    const exams = window.EXAM_CATALOG || [];
    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Exam tracks</h1><span>Four papers, one practice engine</span></div><div class="badge">' + exams.length + " exams</div></div>" +
      '<div class="section-head"><div><p class="eyebrow">Compare</p><h2>Pick the exam, not just the question bank.</h2><p>Patterns, marking, topics, and mock entry points are kept separate so a UCEED paper never behaves like a NIFT paper.</p></div></div>' +
      '<div class="exam-grid exam-grid-large">' + exams.map(examCard).join("") + "</div>";
  }

  function renderExamHub(examId) {
    const exam = getExam(examId);
    if (!exam) {
      navigate("/exams", true);
      return;
    }
    const papers = papersForExam(exam.id);
    const stats = examStats(exam.id);
    const firstPaper = papers[0];
    const patternRows = exam.officialSections
      .map(
        (section) =>
          "<tr><td><strong>" + esc(section.label) + "</strong><br><span class=\"table-sub\">" + esc(section.type) + "</span></td><td class=\"num\">" +
          section.questions + '</td><td class="num">' + section.marks + '</td><td class="num">' +
          (section.negative ? "−" + section.negative : "0") + "</td><td>" + esc(section.note) + "</td></tr>"
      )
      .join("");
    const topicCards = exam.topics
      .map((topic) => {
        const available = topicPool(exam.id, topic.name, "all").length;
        return (
          '<article class="topic-card"><div class="topic-card-top"><strong>' + esc(topic.name) + "</strong><span>" + topic.share + "%</span></div>" +
          '<div class="topic-meter"><span style="width:' + Math.min(100, topic.share * 3) + '%"></span></div>' +
          '<div class="topic-card-bottom"><span class="badge">' + available + " in bank</span>" +
          '<button class="btn btn-quiet" type="button" data-practice-topic="' + esc(exam.id) + '" data-topic="' + esc(topic.name) + '">Practice</button></div></article>'
        );
      })
      .join("");

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/exams">← Exams</a></div><div class="exam-title"><h1>' + esc(exam.name) + "</h1><span>" + esc(exam.fullName) + "</span></div><div class=\"badge\">" + esc(exam.level) + "</div></div>" +
      '<section class="exam-hero panel">' +
      '<div class="exam-hero-copy"><p class="eyebrow">' + esc(exam.officialPattern) + '</p><h2>' + esc(exam.tagline) + "</h2><p>" + esc(exam.description) + "</p>" +
      '<div class="hero-actions">' +
      (firstPaper ? '<button class="btn btn-primary" data-start-exam="' + esc(exam.id) + '" type="button">Start ' + esc(firstPaper.title) + "</button>" : "") +
      '<a class="btn btn-ghost" href="#/practice/' + esc(exam.id) + '">Practice by topic</a>' +
      "</div></div>" +
      '<div class="exam-hero-stats">' +
      '<div><strong>' + stats.papers + "</strong><span>Mini mocks</span></div>" +
      '<div><strong>' + stats.questions + "</strong><span>Starter Qs</span></div>" +
      '<div><strong>' + exam.topics.length + "</strong><span>Topics</span></div>" +
      '<div><strong>' + exam.referenceQuestions + "</strong><span>PYQ reference</span></div>" +
      "</div></section>" +
      '<div class="section-head"><div><p class="eyebrow">Official pattern</p><h2>How the paper is built.</h2><p>Marking is stored per section. Older papers may differ; the player uses the rules on each paper.</p></div></div>' +
      '<div class="section-table-wrap"><table class="pattern-table"><thead><tr><th>Section</th><th>Questions</th><th>Marks</th><th>Negative</th><th>Rule</th></tr></thead><tbody>' + patternRows + "</tbody></table></div>" +
      '<div class="section-head"><div><p class="eyebrow">Mocks</p><h2>Start with the clock running.</h2><p>Mini mocks use the same section and marking model as the official paper, with a shorter question count.</p></div></div>' +
      '<div class="paper-grid">' + (papers.length ? papers.map(paperCard).join("") : '<p class="empty-state">No mock papers yet.</p>') + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Topic map</p><h2>Where the questions come from.</h2><p>Percentages are reference weights from the past-paper analysis. “In bank” is the number of original questions currently available in this local build.</p></div><a class="btn btn-quiet" href="#/practice/' + esc(exam.id) + '">Build a set</a></div>' +
      '<div class="topic-grid">' + topicCards + "</div>" +
      '<div class="studio-banner"><div><h2>Want the full bank?</h2><p>This build ships with an original starter bank. The import template is ready for a licensed or owned export; do not paste third-party questions without permission.</p></div><a class="btn btn-ghost" href="content/import-template.csv" download>Download template</a></div>';
  }

  function renderMocks() {
    const papers = papersForExam("generic");
    const groups = papers.length
      ? '<div class="section-head"><div><p class="eyebrow">Reusable bank</p><h2>Practice by topic.</h2><p>Objective, machine-readable questions with source-paper branding and written tasks removed.</p></div></div>' +
        '<div class="paper-grid">' + papers.map(paperCard).join("") + "</div>"
      : '<p class="empty-state">The generic bank has not been generated yet.</p>';

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Question bank</h1><span>Topic-wise reusable practice sets</span></div><div class="badge">' + papers.length + " sets</div></div>" +
      groups +
      '<div class="studio-banner"><div><h2>One bank, many future papers.</h2><p>New source papers are normalized into topic-based objective questions before they enter this library.</p></div><a class="btn btn-ghost" href="#/progress">Open progress</a></div>';
  }

  function renderPracticeSetup(examId, topic) {
    const exams = window.EXAM_CATALOG || [];
    const exam = getExam(examId) || exams[0];
    if (!exam) {
      navigate("/", true);
      return;
    }
    const topics = Array.from(
      new Set(
        exam.topics
          .map((item) => item.name)
          .concat(topicPool(exam.id, "", "all").map((question) => question.topic))
      )
    ).sort();
    const selectedTopic = topics.indexOf(topic) >= 0 ? topic : "";
    const available = topicPool(exam.id, selectedTopic, "all").length;
    const examOptions = exams
      .map((item) => '<option value="' + esc(item.id) + '"' + (item.id === exam.id ? " selected" : "") + ">" + esc(item.name) + "</option>")
      .join("");
    const topicOptions = '<option value="">All topics</option>' + topics
      .map((item) => {
        const count = topicPool(exam.id, item, "all").length;
        return '<option value="' + esc(item) + '"' + (item === selectedTopic ? " selected" : "") + ">" + esc(item) + " (" + count + ")</option>";
      })
      .join("");
    const topicCards = exam.topics
      .map((item) => {
        const count = topicPool(exam.id, item.name, "all").length;
        return '<button class="topic-chip" type="button" data-practice-topic="' + esc(exam.id) + '" data-topic="' + esc(item.name) + '"><span>' + esc(item.name) + "</span><small>" + item.share + "% · " + count + " Q</small></button>";
      })
      .join("");

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Topic practice</h1><span>Instant feedback · no clock</span></div><div class="badge">' + exam.name + "</div></div>" +
      '<div class="practice-setup panel">' +
      '<div class="practice-setup-copy"><p class="eyebrow">Build a set</p><h2>Choose the weakness, not the whole paper.</h2><p>Practice pulls original questions from the current bank. It shows the answer and explanation after each check, then gives you a topic summary.</p></div>' +
      '<form id="practiceForm" class="practice-form">' +
      '<label>Exam<select id="practiceExam">' + examOptions + "</select></label>" +
      '<label>Topic<select id="practiceTopic">' + topicOptions + "</select></label>" +
      '<label>Difficulty<select id="practiceDifficulty"><option value="all">All levels</option><option value="Easy">Easy</option><option value="Medium">Medium</option><option value="Hard">Hard</option></select></label>' +
      '<label>Set size<select id="practiceCount"><option value="10">10 questions</option><option value="20">20 questions</option><option value="30">30 questions</option><option value="all">All available</option></select></label>' +
      '<button class="btn btn-primary" type="submit">Start practice →</button>' +
      "</form>" +
      '<div class="practice-available"><strong id="practiceAvailable">' + available + "</strong><span>questions match the current topic filter</span></div>" +
      "</div>" +
      '<div class="section-head"><div><p class="eyebrow">' + esc(exam.name) + ' topic map</p><h2>Pick a topic.</h2><p>Reference share is shown beside the number of original questions in this build.</p></div><button class="btn btn-quiet" type="button" data-practice-topic="' + esc(exam.id) + '" data-topic="">All topics</button></div>' +
      '<div class="topic-chip-grid">' + topicCards + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">How practice differs</p><h2>Learn, then test.</h2></div></div>' +
      '<div class="info-grid">' +
      '<article class="info-card"><span class="num">01</span><h3>Immediate feedback</h3><p>Check one question at a time. You see the correct answer and the explanation before moving on.</p></article>' +
      '<article class="info-card"><span class="num">02</span><h3>No negative pressure</h3><p>Marks are shown for feedback, but practice is for diagnosis. The timed paper is where the clock matters.</p></article>' +
      '<article class="info-card"><span class="num">03</span><h3>Saved locally</h3><p>Your practice position and answers are saved in this browser. Close the tab and come back.</p></article>' +
      "</div>";

    const examSelect = $("#practiceExam");
    const topicSelect = $("#practiceTopic");
    if (examSelect) {
      examSelect.addEventListener("change", () => {
        navigate("/practice/" + examSelect.value);
      });
    }
    if (topicSelect) {
      topicSelect.addEventListener("change", () => {
        const nextTopic = topicSelect.value;
        navigate("/practice/" + exam.id + (nextTopic ? "/" + encodeURIComponent(nextTopic) : ""));
        const availableElement = $("#practiceAvailable");
        if (availableElement) {
          availableElement.textContent = String(topicPool(exam.id, nextTopic, "all").length);
        }
      });
    }
    const form = $("#practiceForm");
    if (form) {
      form.addEventListener("submit", (event) => {
        event.preventDefault();
        startPractice(
          exam.id,
          $("#practiceTopic").value,
          $("#practiceDifficulty").value,
          $("#practiceCount").value
        );
      });
    }
  }

  function startPractice(examId, topic, difficulty, count) {
    const pool = topicPool(examId, topic, difficulty);
    if (!pool.length) {
      window.alert("No questions match that filter yet. Try another topic or difficulty.");
      return;
    }
    const shuffled = pool.slice();
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      const temp = shuffled[i];
      shuffled[i] = shuffled[j];
      shuffled[j] = temp;
    }
    const limit = count === "all" ? shuffled.length : Math.min(Number(count) || 10, shuffled.length);
    const selected = shuffled.slice(0, limit);
    state.practice = {
      id: "p-" + Date.now().toString(36),
      examId,
      label: (getExam(examId) || {}).name || examId,
      topic: topic || "",
      difficulty: difficulty || "all",
      questionKeys: selected.map((question) => question.key),
      currentIndex: 0,
      answers: {},
      checked: {},
      startedAt: Date.now(),
      completed: false
    };
    savePractice();
    navigate("/practice-session");
  }

  function startPracticeFromKeys(keys, label) {
    const questions = keys.map(getQuestionByKey).filter(Boolean);
    if (!questions.length) {
      window.alert("No questions available for that selection.");
      return;
    }
    state.practice = {
      id: "p-" + Date.now().toString(36),
      examId: "mixed",
      label: label || "Custom practice",
      topic: "",
      difficulty: "mixed",
      questionKeys: questions.map((question) => question.key),
      currentIndex: 0,
      answers: {},
      checked: {},
      startedAt: Date.now(),
      completed: false
    };
    savePractice();
    navigate("/practice-session");
  }

  function renderPracticeAnswerBody(question, answers, locked) {
    if (question.type === "NAT") {
      const value = answers[question.key] == null ? "" : String(answers[question.key]);
      return (
        '<div class="nat-wrap"><div class="nat-field"><label for="practiceNat">Your answer</label>' +
        '<input id="practiceNat" class="nat-input" type="number" inputmode="decimal" step="any" value="' +
        esc(value) + '" placeholder="—" autocomplete="off"' + (locked ? " disabled" : "") + ">" +
        '<p class="nat-hint">Tolerance: ±' + esc(question.tolerance == null ? 0.01 : question.tolerance) + ".</p></div>" +
        '<div class="keypad" aria-label="Numeric keypad">' +
        ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0", ".", "back"]
          .map((key) => '<button class="key-btn" type="button" data-practice-key="' + key + '"' + (locked ? " disabled" : "") + ">" + (key === "back" ? "⌫" : key) + "</button>")
          .join("") +
        '<button class="key-btn wide" type="button" data-practice-key="clear"' + (locked ? " disabled" : "") + ">Clear</button>" +
        "</div></div>"
      );
    }
    const selected = answers[question.key];
    return (
      '<div class="options" role="group" aria-label="Answer options">' +
      (question.options || [])
        .map((option) => {
          const checked = question.type === "MSQ"
            ? Array.isArray(selected) && selected.includes(option.id)
            : selected === option.id;
          const inputType = question.type === "MSQ" ? "checkbox" : "radio";
          return (
            '<label class="option"><input type="' + inputType + '" name="pq-' + esc(question.key) +
            '" value="' + esc(option.id) + '" data-practice-option="' + esc(option.id) + '"' +
            (checked ? " checked" : "") + (locked ? " disabled" : "") + ">" +
            '<span class="option-body"><span class="option-letter">' + esc(option.id) + "</span><span>" +
            esc(option.text) + "</span></span></label>"
          );
        })
        .join("") +
      "</div>"
    );
  }

  function practiceOutcome(question, answers) {
    return scoreQuestion(question, answers[question.key]);
  }

  function renderPracticePalette(practice, questions) {
    return questions
      .map((question, index) => {
        const classes = ["palette-btn"];
        if (practice.answers[question.key] != null) classes.push("answered");
        if (practice.checked[question.key]) classes.push("marked");
        if (index === practice.currentIndex) classes.push("current");
        return '<button class="' + classes.join(" ") + '" type="button" data-practice-index="' + index + '" aria-label="Go to practice question ' + (index + 1) + '">' + (index + 1) + "</button>";
      })
      .join("");
  }

  function renderPracticeSession() {
    if (!state.practice) state.practice = readJSON(PRACTICE_KEY);
    const practice = state.practice;
    if (!practice || !practice.questionKeys || !practice.questionKeys.length) {
      navigate("/practice", true);
      return;
    }
    const questions = practice.questionKeys.map(getQuestionByKey).filter(Boolean);
    if (!questions.length) {
      navigate("/practice", true);
      return;
    }
    if (practice.completed || practice.currentIndex >= questions.length) {
      practice.completed = true;
      savePractice();
      renderPracticeSummary();
      return;
    }
    const question = questions[practice.currentIndex];
    const index = practice.currentIndex;
    const checked = practice.checked[question.key] === true;
    const outcome = checked ? practiceOutcome(question, practice.answers) : null;
    const answeredCount = questions.filter((item) => practice.answers[item.key] != null && (Array.isArray(practice.answers[item.key]) ? practice.answers[item.key].length : String(practice.answers[item.key]).trim() !== "")).length;
    const progress = Math.round((answeredCount / questions.length) * 100);
    const paper = getPaper(question.paperId);

    $("#view").innerHTML =
      '<div class="exam-top"><div><button class="btn btn-quiet" id="practiceBack" type="button">← Practice setup</button></div><div class="exam-title"><h1>' + esc(practice.topic || practice.label || "Topic practice") + "</h1><span>" + esc(practice.label || "Practice") + "</span></div><div class=\"badge\">Question " + (index + 1) + " of " + questions.length + "</div></div>" +
      '<div class="exam-layout practice-layout">' +
      '<aside class="sidebar">' +
      '<div class="panel timer-panel"><div class="timer-label"><span>Session progress</span><span>' + answeredCount + "/" + questions.length + '</span></div><div class="progress-track"><div class="progress-bar" style="width:' + progress + '%"></div></div><div class="progress-copy"><span>Practice mode</span><span>Instant feedback</span></div></div>' +
      '<div class="panel palette-panel"><div class="palette-title"><strong>Questions</strong><span>Saved locally</span></div><div class="palette-grid">' + renderPracticePalette(practice, questions) + "</div><div class=\"palette-legend\"><span><span class=\"legend-dot answered\"></span>Answered</span><span><span class=\"legend-dot marked\"></span>Checked</span></div></div>" +
      '<div class="panel submit-box"><button class="btn btn-ghost btn-wide" id="practiceNew" type="button">New practice set</button><p>Return to the filters to change exam, topic, or difficulty.</p></div>' +
      "</aside>" +
      '<section class="question-card">' +
      '<div class="q-kicker"><div class="q-kicker-left"><span class="q-counter">Question ' + (index + 1) + " of " + questions.length + "</span><span>" + esc(question.topic) + "</span><span>·</span><span>" + esc(question.difficulty) + '</span></div><span>' + esc(question.type) + " · " + formatScore(question.marks) + " marks</span></div>" +
      '<div class="q-prompt">' + nl2br(question.prompt) + "</div>" +
      (question.figure ? '<div class="q-figure">' + question.figure + "</div>" : "") +
      renderPracticeAnswerBody(question, practice.answers, checked) +
      '<div class="q-note">Source: ' + esc(paper ? paper.title : "Practice bank") + " · " + esc(question.topic) + "</div>" +
      (checked
        ? '<div class="practice-feedback ' + outcome.status + '"><div class="feedback-top"><span class="status-pill ' + outcome.status + '">' + statusLabel(outcome.status) + "</span><strong>" + formatScore(outcome.score) + " marks</strong></div>" +
          '<div class="answer-line"><span>Your answer: <strong>' + esc(userAnswerText(question, practice.answers[question.key])) + "</strong></span><span>Correct answer: <strong>" + esc(correctAnswerText(question)) + "</strong></span></div>" +
          '<div class="solution"><strong>Why:</strong> ' + nl2br(question.solution) + "</div></div>"
        : '<div class="q-note">Check the answer when you are ready. Practice is not timed.</div>') +
      '<div class="exam-actions">' +
      '<button class="btn btn-quiet" id="practicePrev" type="button"' + (index === 0 ? " disabled" : "") + ">Previous</button>" +
      '<span class="spacer"></span>' +
      (!checked
        ? '<button class="btn btn-ghost" id="practiceSkip" type="button">Skip</button><button class="btn btn-primary" id="practiceCheck" type="button">Check answer</button>'
        : '<button class="btn btn-primary" id="practiceNext" type="button">' + (index === questions.length - 1 ? "Finish practice" : "Next question →") + "</button>") +
      "</div>" +
      "</section></div>";

    const practiceBackPath = practice.examId === "mixed" ? "/practice" : "/practice/" + practice.examId;
    $("#practiceBack").addEventListener("click", () => navigate(practiceBackPath));
    $("#practiceNew").addEventListener("click", () => navigate("/practice"));
    $("#practicePrev").addEventListener("click", () => {
      practice.currentIndex = Math.max(0, practice.currentIndex - 1);
      savePractice();
      renderPracticeSession();
      scrollTop();
    });

    $$("[data-practice-index]").forEach((button) => {
      button.addEventListener("click", () => {
        practice.currentIndex = Number(button.dataset.practiceIndex);
        savePractice();
        renderPracticeSession();
        scrollTop();
      });
    });

    const natInput = $("#practiceNat");
    if (natInput) {
      natInput.addEventListener("input", () => {
        const value = natInput.value;
        if (String(value).trim() === "") delete practice.answers[question.key];
        else practice.answers[question.key] = value;
        savePractice();
        const available = $("#practiceAvailable");
        if (available) available.textContent = String(answeredCount);
      });
    }

    $$("[data-practice-key]").forEach((button) => {
      button.addEventListener("click", () => {
        const input = $("#practiceNat");
        if (!input) return;
        const key = button.dataset.practiceKey;
        let value = input.value;
        if (key === "back") value = value.slice(0, -1);
        else if (key === "clear") value = "";
        else if (key === ".") {
          if (!value.includes(".")) value = value === "" ? "0." : value + ".";
        } else value += key;
        input.value = value;
        if (value === "") delete practice.answers[question.key];
        else practice.answers[question.key] = value;
        savePractice();
        input.focus();
      });
    });

    $$("[data-practice-option]").forEach((input) => {
      input.addEventListener("change", () => {
        if (question.type === "MSQ") {
          let answer = Array.isArray(practice.answers[question.key])
            ? practice.answers[question.key].slice()
            : [];
          if (input.checked) {
            if (!answer.includes(input.value)) answer.push(input.value);
          } else {
            answer = answer.filter((value) => value !== input.value);
          }
          answer.sort();
          if (answer.length) practice.answers[question.key] = answer;
          else delete practice.answers[question.key];
        } else {
          practice.answers[question.key] = input.value;
        }
        savePractice();
      });
    });

    const checkButton = $("#practiceCheck");
    if (checkButton) {
      checkButton.addEventListener("click", () => {
        practice.checked[question.key] = true;
        savePractice();
        renderPracticeSession();
      });
    }
    const skipButton = $("#practiceSkip");
    if (skipButton) {
      skipButton.addEventListener("click", () => {
        delete practice.answers[question.key];
        practice.checked[question.key] = true;
        savePractice();
        renderPracticeSession();
      });
    }
    const nextButton = $("#practiceNext");
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (practice.currentIndex >= questions.length - 1) {
          practice.completed = true;
          savePractice();
          renderPracticeSummary();
          scrollTop();
        } else {
          practice.currentIndex += 1;
          savePractice();
          renderPracticeSession();
          scrollTop();
        }
      });
    }
  }

  function renderPracticeSummary() {
    const practice = state.practice;
    if (!practice) {
      navigate("/practice", true);
      return;
    }
    const questions = practice.questionKeys.map(getQuestionByKey).filter(Boolean);
    const outcomes = questions.map((question) => ({
      question,
      outcome: scoreQuestion(question, practice.answers[question.key])
    }));
    const totals = outcomes.reduce(
      (acc, item) => {
        acc.score += item.outcome.score;
        acc.max += item.question.marks;
        if (item.outcome.status === "correct") acc.correct += 1;
        else if (item.outcome.status === "wrong") acc.wrong += 1;
        else if (item.outcome.status === "partial") acc.partial += 1;
        else acc.skipped += 1;
        return acc;
      },
      { score: 0, max: 0, correct: 0, wrong: 0, partial: 0, skipped: 0 }
    );
    const attempted = totals.correct + totals.wrong + totals.partial;
    const accuracy = attempted ? Math.round((totals.correct / attempted) * 100) : 0;
    const topicStats = {};
    outcomes.forEach((item) => {
      const topic = item.question.topic;
      if (!topicStats[topic]) topicStats[topic] = { total: 0, correct: 0, attempted: 0 };
      topicStats[topic].total += 1;
      if (item.outcome.status !== "unattempted") topicStats[topic].attempted += 1;
      if (item.outcome.status === "correct") topicStats[topic].correct += 1;
    });
    const topicRows = Object.keys(topicStats)
      .sort((a, b) => topicStats[b].total - topicStats[a].total)
      .map((topic) => {
        const item = topicStats[topic];
        const pct = item.attempted ? Math.round((item.correct / item.attempted) * 100) : 0;
        return '<div class="topic-result-row"><span><strong>' + esc(topic) + "</strong><small>" + item.correct + "/" + item.attempted + " correct</small></span><div class=\"topic-result-bar\"><span style=\"width:" + pct + '%"></span></div><span class="topic-result-score">' + pct + "%</span></div>";
      })
      .join("");
    const questionRows = outcomes
      .map(
        (item, index) =>
          "<tr><td>Q" + (index + 1) + "</td><td>" + esc(item.question.topic) + "</td><td>" +
          esc(item.question.prompt).slice(0, 92) + '</td><td><span class="status-pill ' + item.outcome.status + '">' +
          statusLabel(item.outcome.status) + '</span></td><td class="num">' + formatScore(item.outcome.score) + "</td></tr>"
      )
      .join("");

    $("#view").innerHTML =
      '<div class="exam-top"><div><button class="btn btn-quiet" id="summaryPractice" type="button">← Practice</button></div><div class="exam-title"><h1>Practice summary</h1><span>' + esc(practice.label || "Topic practice") + "</span></div><div class=\"badge\">" + questions.length + " questions</div></div>" +
      '<div class="result-hero"><div class="score-card"><p class="eyebrow">Practice complete</p><h1>' + accuracy + "% accuracy</h1><p class=\"score-sub\">" + attempted + " attempted · " + totals.skipped + " skipped · " + esc(practice.topic || "All topics") + "</p><div class=\"score-big\"><strong>" + round(totals.score) + "</strong><span>/ " + totals.max + " marks</span></div><div class=\"result-actions\"><button class=\"btn btn-primary\" id=\"practiceAgain\" type=\"button\">Practice again</button><button class=\"btn btn-ghost\" id=\"practiceNewSet\" type=\"button\">New set</button></div></div><aside class=\"result-side\"><div class=\"result-stat-grid\"><div class=\"result-stat correct\"><strong>" + totals.correct + "</strong><span>Correct</span></div><div class=\"result-stat wrong\"><strong>" + totals.wrong + "</strong><span>Wrong</span></div><div class=\"result-stat partial\"><strong>" + totals.partial + "</strong><span>Partial</span></div><div class=\"result-stat skipped\"><strong>" + totals.skipped + "</strong><span>Skipped</span></div></div></aside></div>" +
      '<div class="section-head"><div><p class="eyebrow">Topic diagnosis</p><h2>What to practise next.</h2></div></div><div class="panel topic-breakdown">' + topicRows + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Question log</p><h2>Every response.</h2></div></div><div class="section-table-wrap"><table><thead><tr><th>#</th><th>Topic</th><th>Question</th><th>Status</th><th>Score</th></tr></thead><tbody>' + questionRows + "</tbody></table></div>";

    const summaryBackPath = practice.examId === "mixed" ? "/practice" : "/practice/" + practice.examId;
    $("#summaryPractice").addEventListener("click", () => navigate(summaryBackPath));
    $("#practiceAgain").addEventListener("click", () => startPractice(practice.examId, practice.topic, practice.difficulty, practice.questionKeys.length));
    $("#practiceNewSet").addEventListener("click", () => navigate("/practice"));
  }

  function renderPrompts() {
    stopTimer();
    const prompts = window.DRAWING_PROMPTS || [];
    const cards = prompts
      .map(
        (prompt) =>
          '<article class="prompt-card">' +
          '<span class="badge">' + esc(prompt.duration) + "</span>" +
          "<h3>" + esc(prompt.title) + "</h3>" +
          "<p>" + esc(prompt.brief) + "</p>" +
          "<ul>" + prompt.criteria.map((criterion) => "<li>" + esc(criterion) + "</li>").join("") + "</ul>" +
          "</article>"
      )
      .join("");

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Part B Studio</h1><span>Original drawing briefs</span></div><div class="badge">' + prompts.length + " prompts</div></div>" +
      '<div class="section-head"><div><p class="eyebrow">30 minutes each</p><h2>Draw first. Judge later.</h2><p>Pick one brief, set a 30-minute timer, and work on paper. Use the criteria to review your own sheet or a peer\'s. These are original prompts, not copied exam questions.</p></div></div>' +
      '<div class="prompt-grid">' + cards + "</div>" +
      '<div class="studio-banner"><div><h2>Rubric reminder</h2><p>Strong sheets usually show a clear idea, a readable composition, evidence of structure or use, and deliberate drawing choices. A beautiful render cannot rescue an unclear response.</p></div></div>';
  }

  function normalizeOptions(options) {
    if (Array.isArray(options)) {
      return options
        .map((option, index) => {
          if (typeof option === "string") {
            return { id: String.fromCharCode(65 + index), text: option.trim() };
          }
          if (!option || typeof option !== "object") return null;
          const id = asText(option.id) || String.fromCharCode(65 + index);
          const text = asText(option.text);
          return text ? { id, text } : null;
        })
        .filter(Boolean);
    }
    if (options && typeof options === "object") {
      return Object.keys(options)
        .map((id) => ({ id: asText(id), text: asText(options[id]) }))
        .filter((option) => option.id && option.text);
    }
    return [];
  }

  function asText(value) {
    return value == null ? "" : String(value).trim();
  }

  function normalizeCorrectAnswer(raw, type, optionIds) {
    let answer = raw.correctAnswer != null ? raw.correctAnswer : raw.correct_answer;
    if (type === "NAT") {
      const numeric = Number(answer);
      return Number.isFinite(numeric) ? numeric : null;
    }
    if (type === "MCQ") {
      if (Array.isArray(answer)) answer = answer[0];
      const id = asText(answer);
      return optionIds.indexOf(id) >= 0 ? id : null;
    }
    if (type === "MSQ") {
      if (typeof answer === "string") {
        answer = answer.split(/[|,]/).map((item) => item.trim()).filter(Boolean);
      }
      if (!Array.isArray(answer)) return null;
      const ids = answer.map((item) => asText(item)).filter(Boolean);
      return ids.length && ids.every((id) => optionIds.indexOf(id) >= 0) ? ids : null;
    }
    return null;
  }

  function validateImportedQuestion(raw, section, paperId, index, errors, seen) {
    if (!raw || typeof raw !== "object") {
      errors.push(paperId + " · section " + section.id + " · question " + (index + 1) + ": not an object.");
      return null;
    }
    const type = asText(raw.type || section.type).toUpperCase();
    if (["NAT", "MCQ", "MSQ"].indexOf(type) < 0) {
      errors.push(paperId + " · question " + (index + 1) + ": type must be NAT, MCQ, or MSQ.");
      return null;
    }
    if (type !== section.type) {
      errors.push(paperId + " · question " + (index + 1) + ": type " + type + " does not match section type " + section.type + ".");
    }
    const id = asText(raw.id) || paperId + "-" + section.id + "-" + (index + 1);
    if (seen.has(id)) errors.push(paperId + " · question " + (index + 1) + ": duplicate question id " + id + ".");
    seen.add(id);

    const prompt = asText(raw.prompt);
    if (!prompt) errors.push(paperId + " · " + id + ": prompt is required.");
    const solution = asText(raw.solution) || "No explanation supplied.";
    const topic = asText(raw.topic) || "General";
    const difficulty = asText(raw.difficulty) || "Medium";
    const marks = Number(raw.marks == null ? section.marks : raw.marks);
    const negative = Number(raw.negative == null ? section.negative : raw.negative);
    if (!Number.isFinite(marks) || marks <= 0) errors.push(paperId + " · " + id + ": marks must be a positive number.");
    if (!Number.isFinite(negative) || negative < 0) errors.push(paperId + " · " + id + ": negative must be zero or greater.");

    const options = normalizeOptions(raw.options);
    const optionIds = options.map((option) => option.id);
    if ((type === "MCQ" || type === "MSQ") && options.length < 2) {
      errors.push(paperId + " · " + id + ": MCQ/MSQ questions need at least two options.");
    }
    const correctAnswer = normalizeCorrectAnswer(raw, type, optionIds);
    if (correctAnswer == null) {
      errors.push(paperId + " · " + id + ": correctAnswer is missing or does not match the options.");
    }

    return {
      id,
      type,
      topic,
      difficulty,
      prompt,
      solution,
      options: type === "NAT" ? undefined : options,
      correctAnswer,
      tolerance: Number(raw.tolerance == null ? 0.01 : raw.tolerance),
      marks,
      negative
    };
  }

  function validateImportedPaper(raw, errors, seen, paperIds) {
    if (!raw || typeof raw !== "object") {
      errors.push("Paper entry is not an object.");
      return null;
    }
    const id = asText(raw.id);
    if (!id) errors.push("Every paper needs an id.");
    else if (paperIds.has(id)) errors.push("Paper id already exists: " + id + ".");
    else paperIds.add(id);
    const exam = getExam(asText(raw.examId));
    if (!exam) errors.push((id || "Paper") + ": examId must match one of " + (window.EXAM_CATALOG || []).map((item) => item.id).join(", ") + ".");
    const title = asText(raw.title);
    if (!title) errors.push((id || "Paper") + ": title is required.");
    const durationMinutes = Number(raw.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) {
      errors.push((id || "Paper") + ": durationMinutes must be a positive number.");
    }
    if (!Array.isArray(raw.sections) || !raw.sections.length) {
      errors.push((id || "Paper") + ": at least one section is required.");
      return null;
    }

    const sectionIds = new Set();
    const sections = raw.sections.map((rawSection, sectionIndex) => {
      const section = rawSection || {};
      const sectionId = asText(section.id) || "section-" + (sectionIndex + 1);
      if (sectionIds.has(sectionId)) errors.push((id || "Paper") + ": duplicate section id " + sectionId + ".");
      sectionIds.add(sectionId);
      const type = asText(section.type).toUpperCase();
      if (["NAT", "MCQ", "MSQ"].indexOf(type) < 0) {
        errors.push((id || "Paper") + " · " + sectionId + ": type must be NAT, MCQ, or MSQ.");
      }
      const sectionMarks = Number(section.marks);
      const sectionNegative = Number(section.negative == null ? 0 : section.negative);
      if (!Number.isFinite(sectionMarks) || sectionMarks <= 0) {
        errors.push((id || "Paper") + " · " + sectionId + ": marks must be a positive number.");
      }
      if (!Number.isFinite(sectionNegative) || sectionNegative < 0) {
        errors.push((id || "Paper") + " · " + sectionId + ": negative must be zero or greater.");
      }
      if (!Array.isArray(section.questions) || !section.questions.length) {
        errors.push((id || "Paper") + " · " + sectionId + ": at least one question is required.");
      }
      const normalizedSection = {
        id: sectionId,
        title: asText(section.title) || "Section " + (sectionIndex + 1),
        label: asText(section.label) || type,
        type,
        marks: sectionMarks,
        negative: sectionNegative,
        partial: section.partial === true || type === "MSQ",
        instructions:
          asText(section.instructions) ||
          "Choose the best answer. Marking is shown on each question.",
        questions: (Array.isArray(section.questions) ? section.questions : [])
          .map((question, questionIndex) =>
            validateImportedQuestion(question, { id: sectionId, type, marks: sectionMarks, negative: sectionNegative }, id || "paper", questionIndex, errors, seen)
          )
          .filter(Boolean)
      };
      return normalizedSection;
    });

    const calculatedMarks = sections.reduce(
      (sum, section) =>
        sum +
        section.questions.reduce(
          (questionSum, question) => questionSum + Number(question.marks == null ? section.marks : question.marks),
          0
        ),
      0
    );
    return {
      id,
      examId: exam ? exam.id : asText(raw.examId),
      examName: exam ? exam.name : asText(raw.examName),
      year: raw.year == null ? "" : raw.year,
      mode: asText(raw.mode) || "imported",
      title,
      subtitle: asText(raw.subtitle) || "Imported paper",
      description: asText(raw.description) || "An imported practice paper.",
      durationMinutes,
      totalMarks: calculatedMarks,
      sections
    };
  }

  function validateImportedDrill(raw, errors, seen, index) {
    if (!raw || typeof raw !== "object") {
      errors.push("Practice question " + (index + 1) + " is not an object.");
      return null;
    }
    const id = asText(raw.id) || "imported-drill-" + (index + 1);
    if (seen.has(id)) errors.push("Duplicate practice question id: " + id + ".");
    seen.add(id);
    const exam = getExam(asText(raw.examId));
    if (!exam) errors.push(id + ": examId is required and must match the catalogue.");
    const type = asText(raw.type).toUpperCase();
    if (["NAT", "MCQ", "MSQ"].indexOf(type) < 0) errors.push(id + ": type must be NAT, MCQ, or MSQ.");
    const prompt = asText(raw.prompt);
    if (!prompt) errors.push(id + ": prompt is required.");
    const options = normalizeOptions(raw.options);
    const optionIds = options.map((option) => option.id);
    if ((type === "MCQ" || type === "MSQ") && options.length < 2) errors.push(id + ": MCQ/MSQ questions need at least two options.");
    const correctAnswer = normalizeCorrectAnswer(raw, type, optionIds);
    if (correctAnswer == null) errors.push(id + ": correctAnswer is missing or does not match the options.");
    const marks = Number(raw.marks);
    if (!Number.isFinite(marks) || marks <= 0) errors.push(id + ": marks must be a positive number.");
    const negative = Number(raw.negative == null ? 0 : raw.negative);
    if (!Number.isFinite(negative) || negative < 0) errors.push(id + ": negative must be zero or greater.");
    return {
      id,
      examId: exam ? exam.id : asText(raw.examId),
      type,
      topic: asText(raw.topic) || "General",
      difficulty: asText(raw.difficulty) || "Medium",
      marks,
      negative,
      prompt,
      options: type === "NAT" ? undefined : options,
      correctAnswer,
      tolerance: Number(raw.tolerance == null ? 0.01 : raw.tolerance),
      solution: asText(raw.solution) || "No explanation supplied.",
      source: asText(raw.source) || "imported",
      licence: asText(raw.licence) || "",
      status: asText(raw.status) || "published",
      version: asText(raw.version) || "1"
    };
  }

  function importParsed(payload) {
    state.importErrors = [];
    state.importMessage = "";
    let paperPayload = [];
    let drillPayload = [];
    if (Array.isArray(payload)) {
      if (payload.length && payload[0] && Array.isArray(payload[0].sections)) paperPayload = payload;
      else drillPayload = payload;
    } else if (payload && typeof payload === "object") {
      paperPayload = Array.isArray(payload.papers) ? payload.papers : [];
      drillPayload = Array.isArray(payload.drills) ? payload.drills : [];
    }
    if (!paperPayload.length && !drillPayload.length) {
      state.importErrors = ['No papers or drills found. Use {"papers": [...]} or {"drills": [...]}.'];
      return false;
    }

    const seen = new Set(allQuestions().map((question) => question.id));
    const paperIds = new Set(allPapers().map((paper) => paper.id));
    const papers = paperPayload
      .map((paper) => validateImportedPaper(paper, state.importErrors, seen, paperIds))
      .filter(Boolean);
    const drills = drillPayload
      .map((question, index) => validateImportedDrill(question, state.importErrors, seen, index))
      .filter(Boolean);

    if (state.importErrors.length) return false;

    const custom = getCustomData();
    const next = {
      papers: custom.papers.concat(papers),
      drills: custom.drills.concat(drills)
    };
    writeJSON(CUSTOM_KEY, next);
    state.customData = next;
    state.importMessage =
      "Imported " + papers.length + " paper" + (papers.length === 1 ? "" : "s") + " and " +
      drills.length + " practice question" + (drills.length === 1 ? "" : "s") + ".";
    return true;
  }

  function clearImportedData() {
    const empty = { papers: [], drills: [] };
    writeJSON(CUSTOM_KEY, empty);
    state.customData = empty;
    state.importMessage = "Imported data cleared. The original starter bank is unchanged.";
    state.importErrors = [];
  }

  function renderImport() {
    const custom = getCustomData();
    const customPapers = custom.papers || [];
    const customDrills = custom.drills || [];
    const errors = state.importErrors
      .map((error) => "<li>" + esc(error) + "</li>")
      .join("");
    const message = state.importMessage
      ? '<div class="import-message">' + esc(state.importMessage) + "</div>"
      : "";
    const paperRows = customPapers.length
      ? customPapers
          .map(
            (paper) =>
              '<div class="import-row"><span><strong>' + esc(paper.title) + "</strong><small>" +
              esc(paper.examName || paper.examId) + " · " + paper.sections.length + " sections</small></span>" +
              '<a class="btn btn-quiet" href="#/paper/' + esc(paper.id) + '">Open</a></div>'
          )
          .join("")
      : '<p class="empty-state">No imported papers yet.</p>';
    const drillRows = customDrills.length
      ? customDrills
          .slice(0, 8)
          .map(
            (question) =>
              '<div class="import-row"><span><strong>' + esc(question.topic) + "</strong><small>" +
              esc(question.examId) + " · " + esc(question.type) + " · " + esc(question.prompt).slice(0, 90) +
              "</small></span></div>"
          )
          .join("") + (customDrills.length > 8 ? '<p class="empty-state">+' + (customDrills.length - 8) + " more imported drills.</p>" : "")
      : '<p class="empty-state">No imported drills yet.</p>';

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Import questions</h1><span>Bring an owned or licensed bank into this local build</span></div><div class="badge">' + (customPapers.length + customDrills.length) + " imported</div></div>" +
      '<div class="import-layout">' +
      '<section class="panel import-panel">' +
      '<p class="eyebrow">JSON import</p><h2>Paste a paper or practice bank.</h2>' +
      '<p class="import-help">Only import content you own or have written permission to use. The importer does not download Roughworks content. Each paper needs an <code>examId</code>, <code>id</code>, <code>title</code>, <code>durationMinutes</code>, and a <code>sections</code> array. Practice drills can be a flat array or <code>{"drills": [...]}</code>.</p>' +
      message +
      (errors ? '<div class="import-errors"><strong>Fix these before importing:</strong><ul>' + errors + "</ul></div>" : "") +
      '<label class="import-file">Load a .json file<input id="importFile" type="file" accept="application/json,.json"></label>' +
      '<textarea id="importText" class="code-area" spellcheck="false" placeholder=\'{"papers": [...], "drills": [...]}\'></textarea>' +
      '<div class="import-actions"><button class="btn btn-primary" id="importRun" type="button">Validate and import</button><button class="btn btn-ghost" id="importSample" type="button">Load sample JSON</button><button class="btn btn-quiet" id="importClear" type="button">Clear imported data</button><button class="btn btn-quiet" id="importExport" type="button">Export imported JSON</button></div>' +
      "</section>" +
      '<aside class="import-side">' +
      '<div class="panel import-panel"><p class="eyebrow">Current custom bank</p><h3>' + customPapers.length + " papers · " + customDrills.length + " drills</h3><p class=\"import-help\">Imported items are stored in this browser only. They are merged into the exam hubs, mock library, and topic practice without changing the starter files.</p>" + paperRows + "</div>" +
      '<div class="panel import-panel"><p class="eyebrow">Imported drills</p>' + drillRows + "</div>" +
      '<div class="panel import-panel import-warning"><p class="eyebrow">Content boundary</p><p>Roughworks’ terms prohibit copying its question text, explanations, code, and branding. Use this importer for original questions, official papers you have permission to reuse, or a bank you own. Keep the <code>source</code> and <code>licence</code> fields on every imported item.</p><p class="import-help">A production platform also needs server-side timing, scoring, audit logs, and role-based admin access.</p></div>' +
      "</aside></div>";

    const fileInput = $("#importFile");
    if (fileInput) {
      fileInput.addEventListener("change", () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const textarea = $("#importText");
          if (textarea) textarea.value = String(reader.result || "");
        };
        reader.readAsText(file);
      });
    }
    const runButton = $("#importRun");
    if (runButton) {
      runButton.addEventListener("click", () => {
        const textarea = $("#importText");
        let payload;
        try {
          payload = JSON.parse(textarea ? textarea.value : "");
        } catch (error) {
          state.importErrors = ["JSON parse error: " + error.message];
          state.importMessage = "";
          renderImport();
          return;
        }
        importParsed(payload);
        renderImport();
      });
    }
    const sampleButton = $("#importSample");
    if (sampleButton) {
      sampleButton.addEventListener("click", () => {
        fetch("content/import-template.json")
          .then((response) => response.text())
          .then((text) => {
            const textarea = $("#importText");
            if (textarea) textarea.value = text;
          })
          .catch(() => {
            state.importErrors = ["Could not load content/import-template.json. Open the file directly instead."];
            renderImport();
          });
      });
    }
    const clearButton = $("#importClear");
    if (clearButton) {
      clearButton.addEventListener("click", () => {
        if (window.confirm("Remove all imported papers and drills from this browser? The starter bank stays.")) {
          clearImportedData();
          renderImport();
        }
      });
    }
    const exportButton = $("#importExport");
    if (exportButton) {
      exportButton.addEventListener("click", () => {
        const blob = new Blob([JSON.stringify(custom, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "dexam-imported-bank.json";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
      });
    }
  }

  function renderProgress() {
    const attempts = [];
    try {
      for (let i = 0; i < localStorage.length; i += 1) {
        const key = localStorage.key(i);
        if (key && key.indexOf(RESULT_PREFIX) === 0) {
          const result = readJSON(key);
          if (result) attempts.push(result);
        }
      }
    } catch (error) {
      /* Ignore storage restrictions. */
    }
    attempts.sort((a, b) => (b.submittedAt || 0) - (a.submittedAt || 0));

    const attemptCards = attempts.length
      ? attempts
          .map((result) => {
            const paper = getPaper(result.paperId);
            const exam = paper ? getExam(paper.examId) : null;
            return (
              '<article class="attempt-card panel"><div class="attempt-top"><div><span class="badge badge-accent">' +
              esc(exam ? exam.name : "Paper") + '</span><span class="attempt-date">' + formatDate(result.submittedAt) +
              '</span></div><span class="badge">' + result.percentage + "%</span></div><h3>" +
              esc(result.paperTitle) + '</h3><div class="attempt-score"><strong>' + result.total + "</strong><span>/ " +
              result.max + " marks</span></div><div class=\"paper-actions\"><button class=\"btn btn-ghost\" data-review=\"" +
              esc(result.paperId) + '" type="button">Review</button>' +
              (paper ? '<button class="btn btn-quiet" data-start="' + esc(paper.id) + '" type="button">Retake</button>' : "") +
              "</div></article>"
            );
          })
          .join("")
      : '<p class="empty-state">No submitted papers yet. Start one from the <a href="#/mocks">mock library</a>.</p>';

    const topicStats = {};
    attempts.forEach((result) => {
      const paper = getPaper(result.paperId);
      if (!paper) return;
      flattenPaper(paper).forEach((question) => {
        const outcome = scoreQuestion(question, (result.answers || {})[question.id]);
        if (!topicStats[question.topic]) topicStats[question.topic] = { total: 0, correct: 0, attempted: 0, score: 0 };
        topicStats[question.topic].total += 1;
        if (outcome.status !== "unattempted") topicStats[question.topic].attempted += 1;
        if (outcome.status === "correct" || outcome.status === "partial") topicStats[question.topic].correct += 1;
        topicStats[question.topic].score += outcome.score;
      });
    });
    const topicRows = Object.keys(topicStats)
      .sort((a, b) => topicStats[b].total - topicStats[a].total)
      .slice(0, 10)
      .map((topic) => {
        const item = topicStats[topic];
        const pct = item.attempted ? Math.round((item.correct / item.attempted) * 100) : 0;
        return '<div class="topic-result-row"><span><strong>' + esc(topic) + "</strong><small>" + item.correct + "/" + item.attempted + " correct</small></span><div class=\"topic-result-bar\"><span style=\"width:" + pct + '%"></span></div><span class="topic-result-score">' + pct + "%</span></div>";
      })
      .join("");

    const bookmarks = getBookmarks();
    const bookmarkRows = bookmarks.length
      ? bookmarks
          .map((key) => {
            const question = getQuestionByKey(key);
            if (!question) return "";
            return (
              '<div class="bookmark-row"><div><span class="badge">' + esc(question.examName) + "</span><strong>" +
              esc(question.topic) + "</strong><p>" + esc(question.prompt).slice(0, 160) + "</p></div>" +
              '<a class="btn btn-quiet" href="#/paper/' + esc(question.paperId) + '">Open paper</a></div>'
            );
          })
          .join("")
      : '<p class="empty-state">No bookmarks yet. Open a paper and tap ☆ Bookmark.</p>';

    $("#view").innerHTML =
      '<div class="exam-top"><div><a class="btn btn-quiet" href="#/">← Home</a></div><div class="exam-title"><h1>Progress</h1><span>Attempts, topic accuracy, bookmarks</span></div><div class="badge">' + attempts.length + " attempts</div></div>" +
      '<div class="section-head"><div><p class="eyebrow">Attempt history</p><h2>What you have finished.</h2><p>Scores are local to this browser. Submit a paper to add it here.</p></div></div>' +
      '<div class="attempt-grid">' + attemptCards + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Topic accuracy</p><h2>Where to go next.</h2><p>Aggregated across all submitted papers in this browser.</p></div></div>' +
      '<div class="panel topic-breakdown">' + (topicRows || '<p class="empty-state">Complete a paper to build topic accuracy.</p>') + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">Bookmarks</p><h2>Saved questions.</h2><p>Bookmarks are stored locally and can be turned into a practice set.</p></div>' +
      (bookmarks.length ? '<button class="btn btn-primary" id="practiceBookmarks" type="button">Practice bookmarks</button>' : "") + "</div>" +
      '<div class="panel bookmark-list">' + bookmarkRows + "</div>";

    const practiceBookmarks = $("#practiceBookmarks");
    if (practiceBookmarks) {
      practiceBookmarks.addEventListener("click", () => startPracticeFromKeys(bookmarks, "Bookmarked questions"));
    }
  }

  function renderRoute() {
    const route = parseRoute();
    setActiveNav(route);

    if (route.name === "paper") {
      const paper = getPaper(route.paperId);
      if (!paper) {
        navigate("/mocks", true);
        return;
      }
      if (!state.paper || state.paper.id !== paper.id || state.submitted) {
        if (!preparePaper(paper.id, true)) return;
      }
      renderExam();
      return;
    }

    stopTimer();
    if (state.paper && !state.submitted) saveProgress();
    state.paper = null;

    if (route.name === "home") renderHome();
    else if (route.name === "exams") renderExams();
    else if (route.name === "exam") renderExamHub(route.examId);
    else if (route.name === "mocks") renderMocks();
    else if (route.name === "practice") renderPracticeSetup(route.examId, route.topic);
    else if (route.name === "practice-session") {
      state.practice = readJSON(PRACTICE_KEY);
      renderPracticeSession();
    } else if (route.name === "result") {
      const result = readJSON(resultKey(route.paperId));
      if (result) renderResult(result);
      else navigate("/progress", true);
    } else if (route.name === "prompts") renderPrompts();
    else if (route.name === "progress") renderProgress();
    else if (route.name === "import") renderImport();
    else renderHome();
  }

  function handleViewClick(event) {
    const start = event.target.closest("[data-start]");
    if (start) {
      startPaper(start.dataset.start, false);
      return;
    }
    const resume = event.target.closest("[data-resume]");
    if (resume) {
      startPaper(resume.dataset.resume, true);
      return;
    }
    const restart = event.target.closest("[data-restart]");
    if (restart) {
      if (window.confirm("Restart this paper? Your saved answers will be cleared.")) {
        retakePaper(restart.dataset.restart);
      }
      return;
    }
    const review = event.target.closest("[data-review]");
    if (review) {
      navigate("/result/" + review.dataset.review);
      return;
    }
    const startExam = event.target.closest("[data-start-exam]");
    if (startExam) {
      const paper = papersForExam(startExam.dataset.startExam)[0];
      if (paper) startPaper(paper.id, false);
      return;
    }
    const practiceTopic = event.target.closest("[data-practice-topic]");
    if (practiceTopic) {
      const topic = practiceTopic.dataset.topic;
      navigate("/practice/" + practiceTopic.dataset.practiceTopic + (topic ? "/" + encodeURIComponent(topic) : ""));
      return;
    }
  }

  async function init() {
    let savedTheme = "dark";
    try {
      const stored = localStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") savedTheme = stored;
    } catch (error) {
      /* Ignore storage restrictions. */
    }
    setTheme(savedTheme);

    const themeToggle = $("#themeToggle");
    if (themeToggle) {
      themeToggle.addEventListener("click", () => {
        setTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light");
      });
    }

    const skipLink = $(".skip-link");
    if (skipLink) {
      skipLink.addEventListener("click", (event) => {
        event.preventDefault();
        const main = $("#main");
        if (main) main.focus();
      });
    }

    const view = $("#view");
    if (view) view.addEventListener("click", handleViewClick);

    window.addEventListener("hashchange", () => {
      renderRoute();
      scrollTop();
    });

    window.addEventListener("beforeunload", () => {
      if (state.paper && !state.submitted) saveProgress();
      if (state.practice) savePractice();
    });

    await loadOfficialPapers();
    renderRoute();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
