# Student journey plan (Claude-owned, started 26 November 2026)

Claude owns the student website and content work described in the 26 November
handoff. Codex takes small backend, release and deployment tasks listed below.
Update this file in the same PR as each slice. Status: `[ ]` not started,
`[~]` built and awaiting owner review, `[x]` approved and live on dmocks.com.

## Ground truth on 26 November 2026

- Main `1c99621` (PR #353) passed CI run 45784093655. The public Site is still
  version 20, built from `1f1dad0`. Merged changes after that are not live.
- dmocks.com/papers lists 17 free papers: UCEED 2015 and 2017–2026 (11) and
  CEED 2021–2026 (6). UCEED 2016 is held for answer-key and media corrections.
  NID has 9 private plans waiting on runtime PR #348. NIFT has none.
- The curated bank holds only questions from Claude's solved-paper plans.
  Never refill Papers, practice or mocks from the retired legacy export.
- Registration is limited to testers and sales are off. No UI slice changes that.

## Slices

| # | Slice | Owner | Status |
|---|-------|-------|--------|
| 1 | Papers catalogue: exam summary, compact year list, saved-progress states, start dialog; `/papers-preview` review route | Claude | `[~]` approved, merging |
| 2 | Attempt room for year papers: real figure sizing, section tabs by historical part, timer and autosave states, submit confirmation | Claude | `[ ]` |
| 3 | Answer-by-answer analysis: section and topic breakdown, time per question, worked explanation on every question, attempt history per paper | Claude | `[ ]` |
| 4 | Overview: continue-paper card, latest result, next suggested paper or topic, built only from released papers | Claude | `[ ]` |
| 5 | Topic practice built only from released year-paper questions (10/20/30 questions, 15/30/45 min); check the selector against the curated lifecycle first | Claude UI, Codex server check | `[ ]` |
| 6 | All India: fixed event per exam from reviewed parallel questions; one attempt, fixed window, reconnect-safe timer, result and rank release | Claude content and UI, Codex event binding | `[ ]` |
| 7 | Exam-wise mocks from the same parallel questions after each All India event closes | Claude UI, Codex release | `[ ]` |
| 8 | Learn released free to read; Community kept closed until its journey passes hosted checks | Claude | `[ ]` |

Content queue (Claude): UCEED 2016 source fixes (keys Q6/Q36/Q66, media
Q20/Q40) for a new exact-plan review; NID papers after #348 is live; parallel
questions for the first All India event.

## Codex tasks

Each task names the exact source, the expected behaviour, the checks and the
live result to report back.

1. **Publish current main to the public Site.** Source: main `1c99621`
   (CI 45784093655 passed). Expected: the curated metadata from #351/#353 and
   the open-tab refresh from #349 are live. Checks: `npm run production:package`
   and `production:verify` on that tree; Sites version saved. Live result:
   dmocks.com/papers shows UCEED 11 and CEED 6; a tab left open picks up a new
   release within about 10 seconds of refocus; `/checkout` and `/papers-preview`
   are not served; Student sign in still admits testers only.
2. **Land NID runtime PR #348.** Rebase `codex/nid-year-paper-runtime` on
   `1c99621`. #353 swapped `nid-bdes-recalled-2024` for
   `nid-bdes-sample-2024`, so check that the runtime materialises the current
   nine NID plans and nothing from the retired export. Checks: exact-head CI,
   `npm run test:database`, merged-main CI, then apply migration
   `202611250177_nid_historical_year_runtime` to the DMocks Test project.
   Live result: dmocks.com/papers still shows NID 0, because a migration
   releases no paper. Report the hosted migration version list.
3. **Publish Papers slice 1 after the owner approves it.** Source: this branch's
   PR once merged. Checks: merged-main CI, production package/verify,
   preview-isolation check (the build must not contain `/papers-preview`).
   Live result: dmocks.com/papers shows the new exam summary and year list on
   desktop and mobile with the same 17 papers, and the start dialog shows
   questions and minutes; signed-in testers see their In progress / Latest
   result / Result under review states.

## Decisions log

- 26 Nov 2026: The Papers catalogue follows Roughworks' interaction pattern
  (exam summary beside a compact year list) using DMocks' own palette and
  copy. No Roughworks content is used.
- 26 Nov 2026: Owner approved the visible Papers slice 1 (desktop, dark mode,
  phone and start dialog) from the /papers-preview screenshots. Next: PR,
  exact-head CI, merge, merged-main CI, then Codex task 3 publishes it.
- 26 Nov 2026: Card headings keep the full paper name for screen readers and
  tests ("UCEED 2026 paper"). The visible title is the year, plus a subtitle
  only when it tells papers apart (Paper 1/2, sample, B.Des./M.Des.).
