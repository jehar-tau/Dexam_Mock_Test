# Dexam Mock Test

A dependency-free design-entrance exam studio for **UCEED, CEED, NIFT, and NID UG**.

It ships with:

- **4 exam tracks** with separate patterns, marking models, and topic maps.
- **5 timed mini mocks** with **75 paper questions**, plus **275 topic drills** — **350 original questions** across NAT, MSQ, and MCQ. Batch 2 is UCEED-heavy.
- **Topic practice** with instant feedback, explanations, and a topic summary.
- **Part B Studio** with 4 original drawing prompts and criteria.
- **Local progress**: autosave, resume, result review, attempt history, topic accuracy, and bookmarks.
- **A JSON importer** for an owned or licensed question bank.

This is an independent prototype. It is **not** a copy of Roughworks, and it does **not** include Roughworks' question bank. See [Legal boundary](#legal-boundary).

## Run it

From this repository root:

```bash
python3 -m http.server 4173
```

Open:

```text
http://127.0.0.1:4173
```

A local server is recommended. Some browsers restrict `localStorage` on `file://` origins, and the importer's sample fetch needs an HTTP origin.

Validate the question data:

```bash
node tools/validate-data.js
```

## What is in the app

| Surface | What it does |
|---|---|
| **Home** | Four exam cards, saved work, topic shortcuts, mock library, engine explainer, Part B entry. |
| **Exam hub** | Official pattern, marking table, exam-specific mocks, topic map with reference weightings, and starter-bank counts. |
| **Mock library** | All timed papers grouped by exam. Start, resume, restart, or review. |
| **Paper player** | Countdown, section palette, answer states, mark-for-review, clear response, bookmark, autosave, submit, auto-submit. |
| **Result** | Total, section scores, correct/wrong/partial/skipped, topic breakdown, per-question review with explanations. |
| **Practice** | Filter by exam, topic, and difficulty; check one question at a time; see the answer and explanation immediately. |
| **Progress** | Submitted attempts, aggregate topic accuracy, bookmarks, and bookmark practice sets. |
| **Part B** | Original drawing briefs with criteria for self or peer review. |
| **Import** | Paste or load JSON for owned/licensed papers and drills; validate, append, export, or clear. |

## Current starter bank

| Exam | Papers | Bank questions | Topics covered | Paper marks |
|---|---:|---:|---:|---:|
| UCEED | 2 | 205 | 15 | 72 + 42 |
| CEED | 1 | 55 | 14 | 53 |
| NIFT | 1 | 57 | 16 | 20 |
| NID UG | 1 | 33 | 8 | 10 |
| **Total** | **5** | **350** | — | **197 paper marks** |

These are **mini mocks**, not full-length official papers. They use the same section and marking model as the exam target, with a shorter or focused question count so a student can finish in one sitting. The NID UG mini mock matches the 8-question, 10-mark pattern; the other three are shortened versions of much longer papers.

The topic weightings shown on exam hubs are reference weightings from the public past-paper analysis in `docs/ROUGHWORKS_ANALYSIS.md`. They are not copied question content.

## Marking rules

Marking is stored per section, then overridden per question if needed.

| Exam | Section model |
|---|---|
| UCEED | NAT +4 / 0; MSQ +4 all-correct, +1 per correct option if no wrong option, −1 wrong; MCQ +3 / −0.71. |
| CEED | NAT +4 / 0; MSQ +4 all-correct, +1 per correct option if no wrong option, −1 wrong; MCQ +3 / −0.5. |
| NIFT | MCQ +1 / −0.25 across English, quantitative, logical, and GK sections. |
| NID UG | MCQ +1 or +2 / 0. |

Exam patterns change by year. A production product should version the blueprint and store the rules that applied to each paper, not just the current exam name.

## Files

| File | Purpose |
|---|---|
| `index.html` | App shell, navigation, metadata. |
| `styles.css` | Responsive dark/light design system. |
| `exams.js` | Exam catalogue, official section patterns, topic reference weights. |
| `data.js` | Five timed papers and four Part B prompts. |
| `practice-data.js` | 29 additional original topic-drill questions. |
| `practice-batch-1.js` | 124 more original topic-drill questions across all four exams. |
| `practice-batch-2.js` | 122 UCEED-focused topic-drill questions. |
| `app.js` | Router, timer, palette, scoring, practice, progress, import, bookmarks, localStorage. |
| `content/import-template.json` | Working sample for the in-app JSON importer. |
| `content/import-template.csv` | Flat authoring/export schema for a spreadsheet-to-JSON pipeline. |
| `tools/validate-data.js` | Node validation for IDs, answers, totals, and topic coverage. |
| `docs/answer-key.md` | Answer key and blueprint for the original papers. |
| `docs/drawing-prompts.md` | Part B briefs, rubric, and self-review sheet. |
| `docs/ROUGHWORKS_ANALYSIS.md` | Full public-site product, content, technical, and business analysis. |

## Add a paper in code

Add an object to `window.MOCK_PAPERS` in `data.js`:

```js
{
  id: "my-paper-1",
  examId: "uceed",
  examName: "UCEED",
  year: 2026,
  mode: "mini",
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

For MCQ and MSQ, add an `options` array and a `correctAnswer`:

```js
options: [
  { id: "A", text: "First option" },
  { id: "B", text: "Second option" },
  { id: "C", text: "Third option" },
  { id: "D", text: "Fourth option" }
],
correctAnswer: ["A", "B", "C"] // MSQ; use "B" for MCQ
```

Question IDs must be unique across the whole bank. Run `node tools/validate-data.js` after editing.

## Import a question bank

Open **Import** in the app. The importer accepts:

- `{ "papers": [...], "drills": [...] }`
- an array of paper objects
- an array of practice-drill questions

A working example is in `content/import-template.json`. It uses the same paper/section/question shape as `data.js`.

### What the importer checks

- Unique paper, section, and question IDs.
- A valid `examId`: `uceed`, `ceed`, `nift`, or `nid`.
- Positive paper duration and section marks.
- At least one section per paper and one question per section.
- MCQ/MSQ options and a matching `correctAnswer`.
- Numeric `correctAnswer` for NAT.
- Non-negative negative marking.

Imported data is stored in this browser under `dexam:custom`. It is merged into exam hubs, the mock library, and topic practice. **Clear imported data** removes it without touching the starter bank. **Export imported JSON** lets you take it to another browser or into a backend seed.

The flat CSV template is for an authoring/export pipeline. It includes identity, placement, classification, content, answer/scoring, explanation, and governance fields:

```text
id,exam,paper,section,type,topic,difficulty,prompt,options,correct_answer,tolerance,marks,negative,partial_credit,solution,source,licence,status,version,media_url
```

CSV conventions:

- `options`: separate options with `;;`, write each as `id|text`.
- `correct_answer`: one letter for MCQ, pipe-separated letters for MSQ, or a number for NAT.
- `partial_credit`: `true` or `false`.
- `source` / `licence`: record where the item came from and what rights you have. Never leave these blank for third-party content.

## Production checklist

This is a front-end prototype. Before using it for a paid or high-stakes exam:

- **Server-authoritative timing.** Never trust a browser clock.
- **Server-side scoring and submission.** Client scores are provisional.
- **Authentication and accounts.** Google or email sign-in; account-linked attempts.
- **Database.** Users, papers, questions, versions, attempts, answers, bookmarks, mock events, payments, evaluations.
- **Autosave with idempotency keys.** Avoid duplicate submissions and lost answers.
- **Attempt tokens and access control.** Tie an attempt to a user, paper version, and event.
- **Payments.** Razorpay/Stripe with webhook reconciliation.
- **Part B uploads.** Signed upload URLs, file validation, preview, deadline enforcement.
- **Evaluation workflow.** Rubric, anonymised evaluation, moderation, audit trail.
- **Analytics.** Topic accuracy, time per question, percentile, cohort comparison.
- **Accessibility.** WCAG 2.2 AA, keyboard support, screen-reader labels, reduced motion.
- **Privacy.** Data minimisation, retention, deletion, consent, DPDP Act 2023 compliance.
- **Monitoring.** Error tracking, uptime checks, audit logs, support process.

## Legal boundary

Roughworks' terms prohibit scraping, copying, or redistributing its code, content, or branding, and state that the original question IP belongs to IIT Bombay, NID, and NIFT. Public availability of a past paper is not a licence to republish it.

This repository therefore ships **original questions** and an importer, not a copy of Roughworks' question bank. If you own a bank or have written permission, import it and keep `source`, `licence`, `status`, and `version` metadata on every item. If you want to use official past papers, obtain permission from the relevant institution or publisher first.

The app is not affiliated with UCEED, CEED, NID, NIFT, or Roughworks.

## Next steps

1. Decide the first paid exam target. UCEED is the strongest starting audience.
2. Import or commission a licensed full-length bank and version each paper.
3. Move timing, scoring, attempts, and autosave to a server.
4. Add authentication, a database, and a teacher/admin review workflow.
5. Add Part B uploads and rubric evaluation.
6. Add a paid All-India mock event with ranks and analytics.
7. Run a small beta before charging.
