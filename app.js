/* Dexam Mock Test — a small, dependency-free exam player.
   All papers and questions come from data.js. Scores are provisional and
   computed in the browser; a production exam needs server-side timing,
   scoring, and submission. */

(function () {
  "use strict";

  const THEME_KEY = "rd:theme";
  const PROGRESS_PREFIX = "rd:progress:";
  const RESULT_PREFIX = "rd:result:";

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

  function progressKey(paperId) {
    return PROGRESS_PREFIX + paperId;
  }

  function resultKey(paperId) {
    return RESULT_PREFIX + paperId;
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

  function getPaper(paperId) {
    return (window.MOCK_PAPERS || []).find((paper) => paper.id === paperId) || null;
  }

  function flattenPaper(paper) {
    const questions = [];
    paper.sections.forEach((section) => {
      section.questions.forEach((question) => {
        questions.push({
          ...question,
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

  function paperStats(paper) {
    const questions = paper.sections.reduce((sum, section) => sum + section.questions.length, 0);
    const marks = paper.sections.reduce(
      (sum, section) => sum + section.questions.length * section.marks,
      0
    );
    return {
      questions,
      marks: paper.totalMarks == null ? marks : paper.totalMarks,
      sections: paper.sections.length
    };
  }

  function isAnswered(question) {
    const answer = state.answers[question.id];
    if (question.type === "MSQ") return Array.isArray(answer) && answer.length > 0;
    return answer !== undefined && answer !== null && String(answer).trim() !== "";
  }

  function optionText(question, optionId) {
    const option = (question.options || []).find((item) => item.id === optionId);
    return option ? option.text : optionId;
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
    const answered = state.questions.filter(isAnswered).length;
    const bar = $("#progressBar");
    const copy = $("#progressText");
    if (bar) bar.style.width = (total ? (answered / total) * 100 : 0) + "%";
    if (copy) copy.textContent = answered + "/" + total + " answered";

    $$("[data-palette-index]").forEach((button) => {
      const index = Number(button.dataset.paletteIndex);
      const question = state.questions[index];
      if (!question) return;
      button.classList.toggle("answered", isAnswered(question));
      button.classList.toggle("marked", state.marked.has(question.id));
      button.classList.toggle("current", index === state.currentIndex);
    });

    $$("[data-section-count]").forEach((element) => {
      const sectionId = element.dataset.sectionCount;
      const questions = state.questions.filter((question) => question.sectionId === sectionId);
      const done = questions.filter(isAnswered).length;
      element.textContent = done + "/" + questions.length;
    });
  }

  function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function navigate(delta) {
    if (!state.paper) return;
    const next = state.currentIndex + delta;
    if (next < 0 || next >= state.questions.length) return;
    state.currentIndex = next;
    saveProgress();
    renderExam();
    scrollTop();
  }

  function goToQuestion(index) {
    if (!state.paper || index < 0 || index >= state.questions.length) return;
    state.currentIndex = index;
    saveProgress();
    renderExam();
    scrollTop();
  }

  function startPaper(paperId, resume) {
    const paper = getPaper(paperId);
    if (!paper) return;

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
      return;
    }

    saveProgress();
    renderExam();
    startTimer();
    scrollTop();
  }

  function retakePaper(paperId) {
    removeKey(resultKey(paperId));
    startPaper(paperId, false);
  }

  function confirmSubmit() {
    if (!state.paper || state.submitted) return;
    const unanswered = state.questions.filter((question) => !isAnswered(question)).length;
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
    renderResult(result);
    scrollTop();
  }

  function renderHome() {
    stopTimer();
    state.paper = null;
    state.submitted = false;
    state.result = null;
    if (state.saveFlashTimer) {
      window.clearTimeout(state.saveFlashTimer);
      state.saveFlashTimer = null;
    }
    const saveStatus = $("#saveStatus");
    if (saveStatus) {
      saveStatus.textContent = "";
      saveStatus.classList.remove("saved");
    }
    const papers = window.MOCK_PAPERS || [];
    const totals = papers.reduce(
      (acc, paper) => {
        const stats = paperStats(paper);
        acc.questions += stats.questions;
        acc.marks += stats.marks;
        acc.minutes += paper.durationMinutes;
        return acc;
      },
      { questions: 0, marks: 0, minutes: 0 }
    );

    const cards = papers
      .map((paper) => {
        const stats = paperStats(paper);
        const saved = loadProgress(paper.id);
        const result = readJSON(resultKey(paper.id));
        let status = "Not started";
        let statusClass = "";
        let actions = "";

        if (saved) {
          status = "In progress";
          statusClass = "progress";
          actions =
            '<button class="btn btn-primary" data-resume="' + esc(paper.id) + '">Resume</button>' +
            '<button class="btn btn-ghost" data-restart="' + esc(paper.id) + '">Restart</button>';
        } else if (result) {
          status = "Last score: " + result.total + "/" + result.max;
          statusClass = "done";
          actions =
            '<button class="btn btn-primary" data-start="' + esc(paper.id) + '">Retake</button>' +
            '<button class="btn btn-ghost" data-review="' + esc(paper.id) + '">Review last attempt</button>';
        } else {
          actions = '<button class="btn btn-primary" data-start="' + esc(paper.id) + '">Start paper</button>';
        }

        return (
          '<article class="paper-card">' +
          '<div class="paper-card-top">' +
          '<span class="badge badge-accent">' + esc(paper.subtitle) + "</span>" +
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
          '<div class="paper-actions">' + actions + "</div>" +
          "</article>"
        );
      })
      .join("");

    $("#view").innerHTML =
      '<section class="hero">' +
      '<div class="hero-copy">' +
      '<p class="eyebrow">Original practice · exam-style engine</p>' +
      "<h1>Practice the <span>real</span> shape of a design exam.</h1>" +
      '<p class="hero-lead">A timed, sectioned paper with a question palette, numerical keypad, multiple-select partial credit, autosave, and a full answer review. The questions here are original—not copied from another question bank.</p>' +
      '<div class="hero-actions">' +
      '<button class="btn btn-primary" data-start="' + esc(papers[0] ? papers[0].id : "") + '">Start Foundation Mock</button>' +
      '<button class="btn btn-ghost" id="openPrompts" type="button">Part B drawing prompts</button>' +
      "</div>" +
      "</div>" +
      '<aside class="hero-card">' +
      '<div class="hero-card-top"><span>Studio snapshot</span><span class="badge badge-accent">Local prototype</span></div>' +
      "<div>" +
      "<h2>Paper, palette, clock, review.</h2>" +
      '<p>Two short papers and four drawing briefs. Everything runs in your browser; progress is saved locally.</p>' +
      "</div>" +
      '<div class="hero-stats">' +
      '<div class="hero-stat"><strong>' + papers.length + "</strong><span>Papers</span></div>" +
      '<div class="hero-stat"><strong>' + totals.questions + "</strong><span>Questions</span></div>" +
      '<div class="hero-stat"><strong>' + totals.marks + "</strong><span>Marks</span></div>" +
      "</div>" +
      "</aside>" +
      "</section>" +
      '<div class="section-head">' +
      "<div><p class=\"eyebrow\">Choose a paper</p><h2>Start with the clock running.</h2>" +
      "<p>Each paper uses configurable section marking. Answers stay hidden until you submit, so the timer actually means something.</p></div>" +
      "</div>" +
      '<div class="paper-grid">' + cards + "</div>" +
      '<div class="section-head"><div><p class="eyebrow">How the engine works</p><h2>Not just a quiz.</h2><p>The point is to rehearse the exam interface, not only the content.</p></div></div>' +
      '<div class="info-grid">' +
      '<article class="info-card"><span class="num">01</span><h3>Sectioned palette</h3><p>Jump between NAT, MSQ, and MCQ sections. Answered, marked, and current questions stay visually distinct.</p></article>' +
      '<article class="info-card"><span class="num">02</span><h3>Real marking logic</h3><p>Numerical tolerance, MCQ negative marking, and MSQ partial credit are calculated per section.</p></article>' +
      '<article class="info-card"><span class="num">03</span><h3>Review after submit</h3><p>See your answer, the correct answer, the explanation, and a section-wise score breakdown.</p></article>' +
      "</div>" +
      '<section class="studio-banner">' +
      "<div><h2>Part B is a different muscle.</h2><p>Use the four original drawing briefs with a 30-minute timer, then score yourself against the criteria. The prompts are in the app and in <code>docs/drawing-prompts.md</code>.</p></div>" +
      '<button class="btn btn-ghost" id="openPromptsBottom" type="button">Open drawing studio</button>' +
      "</section>";

    $$("[data-start]").forEach((button) => {
      button.addEventListener("click", () => startPaper(button.dataset.start, false));
    });
    $$("[data-resume]").forEach((button) => {
      button.addEventListener("click", () => startPaper(button.dataset.resume, true));
    });
    $$("[data-restart]").forEach((button) => {
      button.addEventListener("click", () => {
        if (window.confirm("Restart this paper? Your saved answers will be cleared.")) {
          retakePaper(button.dataset.restart);
        }
      });
    });
    $$("[data-review]").forEach((button) => {
      button.addEventListener("click", () => {
        const result = readJSON(resultKey(button.dataset.review));
        if (result) {
          state.result = result;
          renderResult(result);
          scrollTop();
        }
      });
    });
    const openPrompts = $("#openPrompts");
    const openPromptsBottom = $("#openPromptsBottom");
    if (openPrompts) openPrompts.addEventListener("click", renderPrompts);
    if (openPromptsBottom) openPromptsBottom.addEventListener("click", renderPrompts);
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
            if (isAnswered(question)) classes.push("answered");
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

  function renderExam() {
    if (!state.paper || !state.questions.length) {
      renderHome();
      return;
    }
    const paper = state.paper;
    const question = state.questions[state.currentIndex];
    const index = state.currentIndex;
    const total = state.questions.length;
    const isLast = index === total - 1;
    const section = paper.sections.find((item) => item.id === question.sectionId);
    const marking =
      question.type === "NAT"
        ? "+" + question.marks + " correct · 0 wrong"
        : question.type === "MSQ"
          ? "+" + question.marks + " all correct · +1 per correct option · −" + question.negative + " any wrong"
          : "+" + question.marks + " correct · −" + question.negative + " wrong";

    const note =
      question.type === "MSQ"
        ? "Multiple answers may be correct. Partial credit: +1 per correct option if no wrong option is selected."
        : question.type === "NAT"
          ? "Answers are hidden until submission. Use the keypad or type a number."
          : "Answers are hidden until submission. Choose one option.";

    $("#view").innerHTML =
      '<div class="exam-top">' +
      '<div><button class="btn btn-quiet" id="backHome" type="button">← Papers</button></div>' +
      '<div class="exam-title"><h1>' + esc(paper.title) + "</h1><span>" + esc(paper.subtitle) + "</span></div>" +
      '<div class="badge">' + total + " questions · " + paperStats(paper).marks + " marks</div>" +
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
      '<div class="q-kicker"><div class="q-kicker-left"><span class="q-counter">Question ' + (index + 1) + " of " + total + "</span><span>" + esc(question.topic) + "</span><span>·</span><span>" + esc(question.difficulty) + "</span></div><span>" + esc(marking) + "</span></div>" +
      '<div class="q-prompt">' + nl2br(question.prompt) + "</div>" +
      (question.figure ? '<div class="q-figure">' + question.figure + "</div>" : "") +
      renderQuestionBody(question) +
      '<div class="q-note">' + esc(note) + "</div>" +
      '<div class="exam-actions">' +
      '<button class="btn btn-quiet" id="markBtn" type="button">' + (state.marked.has(question.id) ? "Unmark review" : "Mark for review") + "</button>" +
      '<button class="btn btn-quiet" id="clearBtn" type="button">Clear response</button>' +
      '<span class="spacer"></span>' +
      '<button class="btn btn-ghost" id="prevBtn" type="button"' + (index === 0 ? " disabled" : "") + ">Previous</button>" +
      '<button class="btn btn-primary" id="nextBtn" type="button">' + (isLast ? "Submit paper" : "Next →") + "</button>" +
      "</div>" +
      "</section>" +
      "</div>";

    $("#backHome").addEventListener("click", () => {
      if (window.confirm("Leave this paper? Your progress is saved locally.")) renderHome();
    });
    $("#prevBtn").addEventListener("click", () => navigate(-1));
    $("#nextBtn").addEventListener("click", () => {
      if (isLast) confirmSubmit();
      else navigate(1);
    });
    $("#markBtn").addEventListener("click", () => {
      if (state.marked.has(question.id)) state.marked.delete(question.id);
      else state.marked.add(question.id);
      saveProgress();
      renderExam();
    });
    $("#clearBtn").addEventListener("click", () => {
      delete state.answers[question.id];
      saveProgress();
      renderExam();
    });
    $("#submitBtn").addEventListener("click", confirmSubmit);

    $$("[data-palette-index]").forEach((button) => {
      button.addEventListener("click", () => goToQuestion(Number(button.dataset.paletteIndex)));
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

    const correctText =
      question.type === "NAT"
        ? String(question.correctAnswer)
        : question.type === "MSQ"
          ? (question.correctAnswer || []).map((id) => optionText(question, id)).join(" · ")
          : optionText(question, question.correctAnswer);

    return (
      '<details class="review-item">' +
      '<summary><div class="review-summary-left"><span class="review-qnum">Q' + (index + 1) +
      '</span><span class="status-pill ' + outcome.status + '">' + statusLabel(outcome.status) +
      '</span><span class="review-title">' + esc(question.prompt).slice(0, 120) +
      '</span></div><span class="badge">' + formatScore(outcome.score) + " marks</span></summary>" +
      '<div class="review-body"><div class="review-prompt">' + nl2br(question.prompt) + "</div>" +
      options +
      '<div class="answer-line"><span>Your answer: <strong>' + esc(answerText) +
      "</strong></span><span>Correct answer: <strong>" + esc(correctText) + "</strong></span></div>" +
      '<div class="solution"><strong>Why:</strong> ' + nl2br(question.solution) + "</div>" +
      "</div></details>"
    );
  }

  function renderResult(result) {
    stopTimer();
    const paper = getPaper(result.paperId);
    if (!paper) {
      renderHome();
      return;
    }
    state.result = result;
    const questions = flattenPaper(paper);
    const answers = result.answers || {};
    const totalQuestions = questions.length;
    const timeUsed = formatTime(result.timeUsedSeconds);
    const pct = Math.max(0, Math.min(100, Number(result.percentage) || 0));

    const sectionRows = result.sections
      .map(
        (section) =>
          "<tr><td>" + esc(section.title) + " · " + esc(section.label) +
          '</td><td class="num">' + formatScore(section.score) + " / " + section.max +
          '</td><td class="num">' + section.correct + "</td><td class=\"num\">" + section.wrong +
          '</td><td class="num">' + section.partial + '</td><td class="num">' + section.unattempted + "</td></tr>"
      )
      .join("");

    const review = questions.map((question, index) => renderReviewQuestion(question, index, answers)).join("");

    $("#view").innerHTML =
      '<div class="result-hero">' +
      '<div class="score-card">' +
      '<p class="eyebrow">' + (result.autoSubmitted ? "Time expired · auto-submitted" : "Paper submitted") + "</p>" +
      "<h1>" + esc(paper.title) + "</h1>" +
      '<p class="score-sub">' + totalQuestions + " questions · " + paper.durationMinutes + " minutes · " + timeUsed + " used</p>" +
      '<div class="score-big"><strong>' + result.total + "</strong><span>/ " + result.max + " marks</span></div>" +
      '<div class="progress-track"><div class="progress-bar" style="width:' + pct + '%"></div></div>' +
      '<p class="score-sub" style="margin-top:10px">' + result.percentage + "% of the available marks. Negative marking is included.</p>" +
      '<div class="result-actions"><button class="btn btn-primary" id="retakeBtn" type="button">Retake paper</button><button class="btn btn-ghost" id="resultHomeBtn" type="button">Back to papers</button><button class="btn btn-quiet" id="openAllBtn" type="button">Open all reviews</button></div>' +
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
      '<div class="section-head"><div><p class="eyebrow">Answer review</p><h2>See what happened.</h2><p>Open any question to compare your response with the correct answer and the explanation.</p></div></div>' +
      '<div class="review-list">' + review + "</div>";

    $("#retakeBtn").addEventListener("click", () => retakePaper(paper.id));
    $("#resultHomeBtn").addEventListener("click", renderHome);
    $("#openAllBtn").addEventListener("click", (event) => {
      const open = event.currentTarget.dataset.open !== "true";
      $$(".review-item").forEach((item) => {
        item.open = open;
      });
      event.currentTarget.dataset.open = String(open);
      event.currentTarget.textContent = open ? "Collapse all reviews" : "Open all reviews";
    });
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
      '<div class="exam-top"><button class="btn btn-quiet" id="promptsHome" type="button">← Papers</button><div class="exam-title"><h1>Part B Studio</h1><span>Four original drawing briefs</span></div></div>' +
      '<div class="section-head"><div><p class="eyebrow">30 minutes each</p><h2>Draw first. Judge later.</h2><p>Pick one brief, set a 30-minute timer, and work on paper. Use the criteria to review your own sheet or a peer\'s. These are original prompts, not copied exam questions.</p></div></div>' +
      '<div class="prompt-grid">' + cards + "</div>" +
      '<div class="studio-banner"><div><h2>Rubric reminder</h2><p>Strong sheets usually show a clear idea, a readable composition, evidence of structure or use, and deliberate drawing choices. A beautiful render cannot rescue an unclear response.</p></div></div>';

    $("#promptsHome").addEventListener("click", renderHome);
  }

  function init() {
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

    const brandHome = $("#brandHome");
    if (brandHome) {
      brandHome.addEventListener("click", (event) => {
        event.preventDefault();
        if (state.paper && !state.submitted && !window.confirm("Leave this paper? Your progress is saved locally.")) {
          return;
        }
        renderHome();
        scrollTop();
      });
    }

    window.addEventListener("beforeunload", () => {
      if (state.paper && !state.submitted) saveProgress();
    });

    renderHome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
