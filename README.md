# Dexam Mock Test

A dependency-free mock-test player for design-aptitude practice. It ships with two original papers and a four-prompt Part B studio.

It is **not** a copy of Roughworks. The two papers in `data.js` are original practice content. The app demonstrates the exam-engine mechanics: timed sections, a question palette, numerical answers, multiple-select partial credit, negative marking, autosave, submission, and answer review.

## Run it

From the repository root:

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173
```

Opening `index.html` directly with `file://` usually works in Chrome, but a local server is more reliable because some browsers restrict `localStorage` on file origins.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell and metadata. |
| `styles.css` | Responsive dark/light design system. |
| `data.js` | Two original papers and four drawing prompts. |
| `app.js` | Timer, palette, answer state, scoring, review, localStorage. |
| `docs/drawing-prompts.md` | Part B briefs, rubric, and self-review sheet. |
| `docs/answer-key.md` | Answer key and section-wise blueprint for both papers. |
| `docs/ROUGHWORKS_ANALYSIS.md` | Full product, content, technical, and business analysis. |
| `content/import-template.csv` | Schema for importing questions you own or have licensed. |

## What the app does

- **Two papers**
  - Foundation Mock 1: 20 questions, 72 marks, 60 minutes.
  - Speed Mock 1: 12 questions, 42 marks, 30 minutes.
- **Three question types**
  - NAT: numerical answer, tolerance, no negative marking.
  - MSQ: multiple select, +4 for all correct, +1 per correct option if no wrong option is selected, −1 for any wrong option.
  - MCQ: one correct option, +3 correct, −0.71 wrong.
- **Exam behaviour**
  - Countdown timer with auto-submit.
  - Question palette grouped by section.
  - Answered / marked / current states.
  - Mark for review and clear response.
  - Autosave to `localStorage`; resume after reload.
  - Answers hidden until submission.
- **Results**
  - Total and section scores.
  - Correct / wrong / partial / skipped counts.
  - Full review with your answer, the correct answer, and an explanation.
- **Part B**
  - Four original drawing prompts with criteria; see `docs/drawing-prompts.md`.

## Scoring rules in the prototype

The prototype uses the rules stored on each section in `data.js`:

```text
NAT: correct +4, wrong 0
MSQ: all correct +4; partial +1 per correct option if no wrong option; any wrong −1
MCQ: correct +3, wrong −0.71
```

These mirror the format of a UCEED-style paper but are **not** official UCEED rules for every year. A production product should store marking rules per paper and per section, because exam patterns change.

## Add a paper

Add an object to `window.MOCK_PAPERS` in `data.js`:

```js
{
  id: "my-paper-1",
  title: "My Paper 1",
  subtitle: "Original practice paper",
  description: "What this paper covers.",
  durationMinutes: 60,
  totalMarks: 72,
  sections: [
    {
      id: "nat",
      title: "Section 1",
      label: "Numerical Answer",
      type: "NAT",
      marks: 4,
      negative: 0,
      instructions: "Correct +4, wrong 0.",
      questions: [
        {
          id: "my-nat-1",
          type: "NAT",
          topic: "Spatial Reasoning",
          difficulty: "Medium",
          prompt: "Question text...",
          correctAnswer: 24,
          tolerance: 0.01,
          solution: "Why the answer is 24."
        }
      ]
    }
  ]
}
```

For MSQ:

```js
{
  id: "my-msq-1",
  type: "MSQ",
  topic: "Design Awareness",
  difficulty: "Easy",
  prompt: "Which options are correct?",
  options: [
    { id: "A", text: "First option" },
    { id: "B", text: "Second option" },
    { id: "C", text: "Third option" },
    { id: "D", text: "Fourth option" }
  ],
  correctAnswer: ["A", "B", "C"],
  solution: "A, B, and C are correct because..."
}
```

For MCQ:

```js
{
  id: "my-mcq-1",
  type: "MCQ",
  topic: "Colour Theory",
  difficulty: "Easy",
  prompt: "Which option is correct?",
  options: [
    { id: "A", text: "First option" },
    { id: "B", text: "Second option" },
    { id: "C", text: "Third option" },
    { id: "D", text: "Fourth option" }
  ],
  correctAnswer: "B",
  solution: "B is correct because..."
}
```

Question IDs must be unique within a paper. The app uses them as keys for saved answers.

## Import questions

`content/import-template.csv` is a starting point for a spreadsheet-to-JSON pipeline. It includes:

- identity and placement (`id`, `exam`, `paper`, `section`),
- classification (`type`, `topic`, `difficulty`),
- content (`prompt`, `options`, `media_url`),
- answer and scoring (`correct_answer`, `tolerance`, `marks`, `negative`, `partial_credit`),
- explanation (`solution`),
- governance (`source`, `licence`, `status`, `version`).

CSV conventions used by the template:

- `options`: separate options with `;;`, and write each as `id|text` (for example `A|Proximity;;B|Similarity`).
- `correct_answer`: a single letter for MCQ, pipe-separated letters for MSQ (for example `A|B|C`), or a number for NAT.
- `partial_credit`: `true` or `false`.
- `status`: `draft`, `review`, `published`, or `retired`.
- `source` / `licence`: record where the item came from and what rights you have. Never leave these blank for third-party content.

Recommended import pipeline:

1. Authors write questions in the CSV/Markdown template.
2. A reviewer checks the answer, distractor quality, and explanation.
3. A script validates the schema and converts rows to JSON.
4. The JSON is versioned and published.
5. Attempts reference the question version, so old attempts remain reproducible.

Do not import content you do not own or have a licence to use.

## Production checklist

This is a front-end prototype. A real exam product needs:

- **Server-authoritative timing.** Never trust a browser clock for a high-stakes exam.
- **Server-side scoring and submission.** The client score is provisional.
- **Authentication.** Google or email sign-in; account-linked attempts.
- **Database.** Users, papers, questions, attempts, answers, bookmarks, mock events, payments, evaluations.
- **Autosave with idempotency.** Avoid duplicate submissions and lost answers.
- **Attempt tokens and access control.** Tie an attempt to a user and an event.
- **Payments.** Razorpay/Stripe with webhooks and reconciliation.
- **Part B uploads.** Signed upload URLs, file-type/size validation, preview, deadline enforcement.
- **Human/AI evaluation.** Rubric, anonymised evaluation, moderation, audit trail.
- **Analytics.** Topic accuracy, time per question, attempt history, percentile.
- **Accessibility.** WCAG 2.2 AA, keyboard support, screen-reader labels, reduced motion.
- **Privacy.** Data minimisation, retention, deletion, consent, DPDP Act 2023 compliance.
- **Monitoring.** Error tracking, uptime checks, audit logs, support process.

## Legal boundary

Roughworks' terms prohibit scraping, copying, or redistributing its code, content, or branding, and state that the original question IP belongs to IIT Bombay, NID, and NIFT. Public availability of a past paper is not the same as a licence to republish it.

This prototype therefore uses **original questions**. If you own a question bank or have written permission, use the import template and keep `source`, `licence`, and `version` metadata on every item. If you want to use official past papers, obtain permission from the relevant institution or publisher first.

The app is not affiliated with UCEED, CEED, NID, NIFT, or Roughworks.

## Next steps

1. Replace the two demo papers with your licensed/original bank.
2. Add a backend and server-side scoring.
3. Add a timed mock event with registration and access control.
4. Add a Part B upload + rubric workflow.
5. Add analytics and a study plan.
6. Run a small beta before charging for a mock.
