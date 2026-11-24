# NID year papers: plan

Owner request, 24 Nov 2026: "next can we work on the nid papers that we have". This file is the standing plan. Update its boxes and the decisions log in the same change as the work.

## Owner decisions (24 Nov 2026)

1. **Scope.** All NID papers in the bank: B.Des 2016–2020 first, then the B.Des and M.Des official samples. Do one paper end to end and show it to the owner before the rest.
2. **Answers.** NID publishes no answer keys. Solve every question independently and compare with the answer already in the bank. The bank's answers came from the coaching-institute PDFs the papers were scanned from. Only the disagreements go to the owner. Students see these answers as DMocks solutions, never as an official key.
3. **Drawing tasks.** The subjective Part II tasks appear in the same paper, unscored, with guidance on what a strong answer shows.
4. **Source.** Where NID's own PDF exists, it replaces the coaching-institute scan. Wording, options and figures follow NID's original, and the NID PDF is recorded as the source.

## What we have (checked 24 Nov 2026)

| Bank paper | Records now | Bank source | NID's own PDF | Notes |
|---|---|---|---|---|
| nid-bdes-2016 | 87 | VDDS scan | `NID_SampleTestPaper2016.pdf` (48 pp, to confirm it is the same paper) | 18 owner-flagged |
| nid-bdes-2017 | 71 | VDDS scan | none found (only `MDesTestPaper2017.pdf`) | 11 owner-flagged |
| nid-bdes-2018 | 62 | VDDS scan | `NID_DATPrelimsTestPaper2018_BDes.pdf` (24 pp); printed: 3 h, 64 Part I + 3 Part II, no negative marking | 13 owner-flagged |
| nid-bdes-2019 | 24 | VDDS scan | `NID_DATPrelimsTestPaper2019_BDes.pdf` (18 pp) | bank misses Q16 and Q20; Q5 and Q9 are scraps of the VDDS key page; Q1, Q7 and Q22 have the wrong type |
| nid-bdes-2020 | 26 | VDDS scan | none found | 3 owner-flagged, 1 not-a-question |
| nid-bdes-sample-2024 | 23 | `SamplePaper_DATPrelims_BDes.pdf` | same | the PDF's cover says 2025: check the year |
| nid-bdes-sample-2025 | 25 | to locate | | |
| nid-mdes-sample-2024 / 2025 | 15 / 18 | `SamplePaper_DATPrelims_MDes.pdf` / to locate | | |

All of these papers are kept privately, outside the repository. The DAT mocks and the task collection are authored content and are not covered here.

## Gates the product already has

- `prepare-free-year-paper.mjs` accepts `nid`, but it takes only hold-free objective records, and DESCRIPTIVE items are left out.
- `docs/EXAM_RULES.md`: NID stays out of the verified runtime contexts until a context has been authored and reviewed, because NID publishes no clock, marking or rubric. For past papers, the clock and marks printed on each paper are the historical facts to use, labelled as that paper's rules.
- `nid-practice-runtime.mjs` already compiles NID drawing tasks with `key: {kind: 'drawing'}`. Unscored drawing tasks in a year paper need product work: the year-paper plan format must allow unscored DESCRIPTIVE items, and the student paper must show them after the objective part. This is Codex's area, so it needs a spec and a handover.

## Steps per paper

- [ ] Intake and segmentation from NID's own PDF (pipeline stages 1–2; `--exam nid` added 24 Nov 2026).
- [ ] Types and marks from the printed instructions (Part I objective, Part II subjective).
- [ ] Figures and option images (stage 3).
- [ ] Independent solutions with explanations, then a comparison with the bank's answer. Disagreements go to the owner.
- [ ] Drawing-task guidance: what is asked, what a strong answer shows, common misses.
- [ ] Bank PR: correct records, add the missing ones, remove scraps, set the source and holds. Draft PR, approved by the owner.
- [ ] Private release plan, digest on main, Codex handover.

## Progress

- [ ] nid-bdes-2019 (pilot). Stage 1–2 done 24 Nov 2026: all 26 questions found (22 objective, 4 subjective).
- [ ] nid-bdes-2018
- [ ] nid-bdes-2016
- [ ] nid-bdes-2017 (scan only)
- [ ] nid-bdes-2020 (scan only)
- [ ] samples 2024/2025 B.Des and M.Des
- [ ] Unscored drawing tasks in year papers (product spec for Codex)

## Decisions log

- 24 Nov 2026: owner decisions 1–4 above. Pilot paper: B.Des 2019, the smallest paper that has NID's own PDF.
