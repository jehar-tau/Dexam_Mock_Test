export const brand = {
  name: "DMocks",
  domain: "dmocks.com",
  description: "Design entrance mock tests.",
  price: 1284,
  currency: "INR",
  months: 12,
};
// Prices in rupees and paise (owner's plan, 28 November 2026). The server's
// plan rows are authoritative; these values only label the page.
export const passPlans = Object.freeze({
  annual: Object.freeze({ id: "annual", name: "Annual pass", price: 1284, amountMinor: 128400, seats: 1 }),
  duo: Object.freeze({ id: "duo", name: "Duo pass", price: 2142, amountMinor: 214200, seats: 2 }),
});
// What a free account gets. The server enforces each limit.
export const freeAllowance = Object.freeze({ workedSolutionsPerPaper: 5, topicSessionsPerDay: 1, topicSessionQuestions: 10, drawingMarkingPerMonth: 4 });
export const exams = [
  {
    id: "uceed",
    name: "UCEED",
    level: "B.Des",
    category: "undergraduate",
    art: "space",
    tag: "SEE IT FROM ANOTHER SIDE",
    title: "UCEED Part A practice",
    description: "Find Part A practice, compare question types and work through IIT Bombay’s previous UCEED papers.",
    source: "https://www.uceed.iitb.ac.in/2027/question-paper.html",
    sourceLabel: "UCEED 2027 paper format and sample interface",
    resourceTitle: "Practise with a past UCEED paper",
    resource: "Use one Part A section at a time. For a numerical answer, work out the number before checking the key. For a multiple-select question, test each option separately. For a multiple-choice question, commit to one option and write down why.",
    practiceSource: "https://www.uceed.iitb.ac.in/2027/downloads.html",
    practiceLabel: "Find previous UCEED papers and keys at IIT Bombay",
  },
  {
    id: "nid",
    name: "NID DAT",
    level: "Design",
    category: "undergraduate",
    art: "ideas",
    tag: "THINK BEYOND THE OBVIOUS",
    title: "NID DAT preparation",
    description: "Find the NID admissions handbook for the design programme you are applying to.",
    source: "https://admissions.nid.edu/",
    sourceLabel: "NID admissions and programme handbooks",
    resourceTitle: "Choose the relevant NID handbook",
    resource: "On NID’s admissions site, choose the handbook for your programme. Read its Design Aptitude Tests section before choosing a practice task. For a drawing task, sketch two possible responses to the brief and compare how clearly each one communicates your idea.",
  },
  {
    id: "nift",
    name: "NIFT",
    level: "Design",
    category: "undergraduate",
    art: "pattern",
    tag: "FIND YOUR OWN PATTERN",
    title: "NIFT entrance practice resources",
    description: "Find NIFT’s published sample question papers and choose a paper for your programme.",
    source: "https://nift.ac.in/admissions",
    sourceLabel: "NIFT admissions",
    resourceTitle: "Choose a NIFT sample paper",
    resource: "NIFT groups its sample papers by year. Check the programme named inside the document before you begin. After solving a question, note the instruction that determined your answer. Compare that instruction across two papers.",
    practiceSource: "https://nift.ac.in/sample-question-paper",
    practiceLabel: "Browse NIFT’s sample question papers",
  },
  {
    id: "ceed",
    name: "CEED",
    level: "M.Des",
    category: "postgraduate",
    art: "object",
    tag: "MAKE YOUR THINKING VISIBLE",
    title: "CEED preparation and past papers",
    description: "Use IIT Bombay’s CEED papers to practise objective questions and written design responses.",
    source: "https://www.ceed.iitb.ac.in/2027/",
    sourceLabel: "CEED 2027 examination details and previous papers",
    resourceTitle: "Work through both parts of a CEED paper",
    resource: "IIT Bombay’s CEED page includes past papers and Part A answer keys. Check your objective responses with the matching key. For Part B, pick a brief and list what your drawing or written response needs to communicate. Revisit your response against that list.",
  },
];
export const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
