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
| 1 | Papers catalogue: exam summary, compact year list, saved-progress states, start dialog; `/papers-preview` review route | Claude | merged #354; awaiting Site publish (Codex task 3) |
| 2 | Focused exam room: no site chrome during an attempt, one sticky bar (paper, question number, timer with under-5-min and last-minute states, theme, Questions jump), pinned phone actions | Claude | merged #355; awaiting Site publish |
| 3 | Answer-by-answer review: outcome badge with exact marks, green/red option states, previous/next stepping, prominent Open answer review. Still to do: time per question, marks by section, attempt history per paper | Claude | first part merged #355 |
| 4 | Overview: "Your past-year papers" (attempted count, in progress, latest results, up next), next-session card points at a real paper, paths and sidebar lead with Papers and mark unreleased modules "Opens later" | Claude | `[~]` |
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
3. **Publish the merged student slices.** Source: main at or after `6e4286d`
   (#354 Papers catalogue, #355 exam room and answer review). Checks: merged-main CI, production package/verify,
   preview-isolation check (the build must not contain `/papers-preview`).
   Live result: dmocks.com/papers shows the new exam summary and year list on
   desktop and mobile with the same 17 papers, and the start dialog shows
   questions and minutes; signed-in testers see their In progress / Latest
   result / Result under review states. Open a paper as a tester: the site
   header and footer disappear, the timer bar stays pinned, and after
   submitting, Open answer review shows marks per question with Previous /
   Next stepping.

## Decisions log

- 26 Nov 2026: The Papers catalogue follows Roughworks' interaction pattern
  (exam summary beside a compact year list) using DMocks' own palette and
  copy. No Roughworks content is used.
- 26 Nov 2026: Owner approved the visible Papers slice 1 (desktop, dark mode,
  phone and start dialog) from the /papers-preview screenshots. Next: PR,
  exact-head CI, merge, merged-main CI, then Codex task 3 publishes it.
- 26 Nov 2026: Owner approved slices 2 and 3 ("Approve, keep going"); #355
  merged as 6e4286d after exact-head CI passed.
- 26 Nov 2026: Overview loads year-paper progress only after its main read,
  because that read finalizes expired attempts first. A failed progress read
  shows a retry and never hides the rest of the desk.
- 26 Nov 2026: Review marks are shown only where the released outcome fixes
  them (correct, wrong, unanswered, full marks). Partial credit shows no number
  because historical MSQ partial rules differ by year.
- 26 Nov 2026: The review and solution panels stay closed until opened, as
  existing tests require; the Open answer review control is now a button.
- 26 Nov 2026: Card headings keep the full paper name for screen readers and
  tests ("UCEED 2026 paper"). The visible title is the year, plus a subtitle
  only when it tells papers apart (Paper 1/2, sample, B.Des./M.Des.).
