/* Dependency-free data validation for the Dexam Mock Test starter bank.
   Usage: node tools/validate-data.js */

const path = require("path");

global.window = {};
const root = path.join(__dirname, "..");
require(path.join(root, "exams.js"));
require(path.join(root, "data.js"));
require(path.join(root, "practice-data.js"));
require(path.join(root, "practice-batch-1.js"));

const errors = [];
const warnings = [];

const exams = window.EXAM_CATALOG || [];
const papers = window.MOCK_PAPERS || [];
const drills = window.PRACTICE_BANK || [];

if (!exams.length) errors.push("No exams in EXAM_CATALOG.");
if (!papers.length) errors.push("No papers in MOCK_PAPERS.");

const examIds = new Set(exams.map((exam) => exam.id));
const paperIds = new Set();
const questionIds = new Set();

function checkExam(exam) {
  if (!exam.id || !exam.name) errors.push("Exam is missing id or name.");
  if (!Array.isArray(exam.topics) || !exam.topics.length) errors.push(exam.name + ": no topic map.");
  if (!Array.isArray(exam.officialSections) || !exam.officialSections.length) {
    errors.push(exam.name + ": no official sections.");
  }
}

function checkQuestion(question, section, paper) {
  const where = paper.id + " / " + section.id + " / " + (question.id || "unknown");
  if (!question.id) errors.push(where + ": missing id.");
  if (question.id && questionIds.has(question.id)) errors.push(where + ": duplicate question id.");
  if (question.id) questionIds.add(question.id);
  if (!question.prompt) errors.push(where + ": missing prompt.");
  if (!question.topic) errors.push(where + ": missing topic.");
  if (!question.difficulty) errors.push(where + ": missing difficulty.");
  if (!question.solution) warnings.push(where + ": missing solution.");
  if (question.type !== section.type) errors.push(where + ": type does not match section.");
  if (question.type === "MCQ") {
    const options = question.options || [];
    if (options.length < 2) errors.push(where + ": MCQ needs at least two options.");
    if (!options.some((option) => option.id === question.correctAnswer)) {
      errors.push(where + ": correctAnswer is not an option.");
    }
  }
  if (question.type === "MSQ") {
    const options = question.options || [];
    if (!Array.isArray(question.correctAnswer) || !question.correctAnswer.length) {
      errors.push(where + ": MSQ correctAnswer must be a non-empty array.");
    } else if (!question.correctAnswer.every((id) => options.some((option) => option.id === id))) {
      errors.push(where + ": MSQ correctAnswer contains an unknown option.");
    }
  }
  if (question.type === "NAT" && typeof question.correctAnswer !== "number") {
    errors.push(where + ": NAT correctAnswer must be a number.");
  }
}

function checkPaper(paper) {
  if (!paper.id) errors.push("Paper is missing id.");
  if (paper.id && paperIds.has(paper.id)) errors.push("Duplicate paper id: " + paper.id);
  if (paper.id) paperIds.add(paper.id);
  if (!examIds.has(paper.examId)) errors.push(paper.id + ": unknown examId " + paper.examId);
  if (!paper.title) errors.push(paper.id + ": missing title.");
  if (!Number.isFinite(Number(paper.durationMinutes)) || Number(paper.durationMinutes) <= 0) {
    errors.push(paper.id + ": durationMinutes must be positive.");
  }
  if (!Array.isArray(paper.sections) || !paper.sections.length) {
    errors.push(paper.id + ": no sections.");
    return;
  }
  let marks = 0;
  paper.sections.forEach((section) => {
    if (!section.id) errors.push(paper.id + ": section missing id.");
    if (["NAT", "MCQ", "MSQ"].indexOf(section.type) < 0) {
      errors.push(paper.id + " / " + section.id + ": invalid type.");
    }
    if (!Array.isArray(section.questions) || !section.questions.length) {
      errors.push(paper.id + " / " + section.id + ": no questions.");
      return;
    }
    section.questions.forEach((question) => {
      checkQuestion(question, section, paper);
      marks += Number(question.marks == null ? section.marks : question.marks);
    });
  });
  if (Number(paper.totalMarks) !== marks) {
    errors.push(paper.id + ": totalMarks is " + paper.totalMarks + " but sections add to " + marks + ".");
  }
}

function checkDrill(question) {
  const where = "drill / " + (question.id || "unknown");
  if (!question.id) errors.push(where + ": missing id.");
  if (question.id && questionIds.has(question.id)) errors.push(where + ": duplicate question id.");
  if (question.id) questionIds.add(question.id);
  if (!examIds.has(question.examId)) errors.push(where + ": unknown examId.");
  if (!question.prompt) errors.push(where + ": missing prompt.");
  if (!question.topic) errors.push(where + ": missing topic.");
  if (["NAT", "MCQ", "MSQ"].indexOf(question.type) < 0) errors.push(where + ": invalid type.");
  if (!Number.isFinite(Number(question.marks)) || Number(question.marks) <= 0) {
    errors.push(where + ": marks must be positive.");
  }
  if (question.type === "MCQ") {
    const options = question.options || [];
    if (options.length < 2) errors.push(where + ": MCQ needs at least two options.");
    if (!options.some((option) => option.id === question.correctAnswer)) {
      errors.push(where + ": correctAnswer is not an option.");
    }
  }
  if (question.type === "MSQ") {
    const options = question.options || [];
    if (!Array.isArray(question.correctAnswer) || !question.correctAnswer.length) {
      errors.push(where + ": MSQ correctAnswer must be a non-empty array.");
    } else if (!question.correctAnswer.every((id) => options.some((option) => option.id === id))) {
      errors.push(where + ": MSQ correctAnswer contains an unknown option.");
    }
  }
  if (question.type === "NAT" && typeof question.correctAnswer !== "number") {
    errors.push(where + ": NAT correctAnswer must be a number.");
  }
}

exams.forEach(checkExam);
papers.forEach(checkPaper);
drills.forEach(checkDrill);

exams.forEach((exam) => {
  const examPapers = papers.filter((paper) => paper.examId === exam.id);
  const bank = papers
    .filter((paper) => paper.examId === exam.id)
    .reduce((list, paper) => list.concat(paper.sections.reduce((all, section) => all.concat(section.questions), [])), [])
    .concat(drills.filter((question) => question.examId === exam.id));
  const topics = new Set(bank.map((question) => question.topic));
  const missing = exam.topics.map((topic) => topic.name).filter((topic) => !topics.has(topic));
  console.log(
    exam.name + ": " + examPapers.length + " papers, " + bank.length + " questions, " +
    topics.size + " bank topics" + (missing.length ? ", unrepresented: " + missing.join(", ") : "")
  );
});

console.log("");
console.log("Papers: " + papers.length + " · Paper questions: " + papers.reduce((sum, paper) => sum + paper.sections.reduce((count, section) => count + section.questions.length, 0), 0));
console.log("Practice drills: " + drills.length + " · Unique question ids: " + questionIds.size);

if (warnings.length) {
  console.log("");
  console.log("Warnings:");
  warnings.forEach((warning) => console.log("  - " + warning));
}

if (errors.length) {
  console.log("");
  console.log("Errors:");
  errors.forEach((error) => console.log("  - " + error));
  process.exit(1);
}

console.log("");
console.log("Data validation passed.");
