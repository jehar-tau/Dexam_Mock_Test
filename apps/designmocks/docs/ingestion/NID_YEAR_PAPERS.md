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

## Official NID papers online (found 24 Nov 2026)

NID removes old sample papers from admissions.nid.edu each cycle; only NIDA2027 is live now. The Internet Archive keeps earlier copies. File sizes are from the archive index; a "same size as local" means we likely have it already.

| Cycle | B.Des | M.Des |
|---|---|---|
| 2013 | `images/Sample-Test-Paper.pdf` (2.88 MB) | |
| 2015 | `downloads/Sample-Test-Paper-For-B.Des.pdf` (2.90 MB) | `downloads/Sample-Test-Paper-For-M.Des.pdf` (2.13 MB) |
| 2016–17 | `NID_SampleTestPaper.pdf` (5.19 MB; local copy is 7.58 MB, compare) | `MDesTestPaper.pdf` (local) |
| 2018 | `nida2018/NID_SampleTestPaperBDes.pdf` (local) | `nida2018/NID_SampleTestPaperMDes.pdf` (local), `NID_SampleTestPaperMDes.pdf` (local) |
| 2019 | `NIDA2019/download/NID_DATPrelimsTestPaper2018_BDes.pdf` (local) | same, MDes (local) |
| 2020 | `NIDA2020/download/NID_DATPrelimsTestPaper2019_BDes.pdf` (local) | same, MDes (local) |
| 2021 | `NIDA2021/download/SamplePaper_DATPrelims_BDes.pdf` (0.78 MB) | MDes (0.77 MB) |
| 2022 | NIDA2022 BDes (1.61 MB) | MDes (1.03 MB) |
| 2023 | NIDA2023 BDes (0.72 MB) | MDes (0.42 MB) |
| 2024 | NIDA2024 BDes (0.77 MB) | MDes (0.50 MB) |
| 2025 | NIDA2025 BDes (0.77 MB, maybe same as 2024) | MDes (0.50 MB, maybe same as 2024) |
| 2026 | NIDA2026 BDes (0.72 MB) | MDes (0.41 MB) |
| 2027 | live, 2.45 MB (same size as local `SamplePaper_DATPrelims_BDes.pdf`) | live, 0.41 MB (same size as local) |

Downloaded 24 Nov 2026 with owner approval into the private work folder (`nid-sources/`, see its README). The 15 files are **7 distinct papers**: NID reused one sample across several cycles (NIDA2021 = NIDA2022; NIDA2023 = 2024 = 2025 = 2026 apart from metadata).

New papers to ingest:
- [ ] B.Des (GDPD) DAT 2012-13 (scan, mostly subjective)
- [ ] B.Des (GDPD) DAT 2014-15 (scan)
- [ ] M.Des DAT 2014-15 (scan, subjective)
- [ ] B.Des Prelims sample, NIDA2021–22 (scan, 26 pp)
- [ ] M.Des Prelims sample, NIDA2021–22 (scan, 10 pp)
- [x] B.Des Prelims sample, NIDA2023–26 (text, 22 pp): draft PR #342 as `nid-bdes-sample-2023`, 27 MCQ + 4 drawing tasks; Q15 held (no correct option)
- [x] M.Des Prelims sample, NIDA2023–26 (text, 12 pp): draft PR #342 as `nid-mdes-sample-2023`, 37 MCQ; Q37 held (exact ratio 1:3 is not an option)

Also to check: the bank's nid-bdes-sample-2024 and -2025 both come from one PDF (the NIDA2027 sample), and so do the two M.Des samples; the year labels are probably wrong. Third-party "previous year papers" (Careers360, Silica, Toprankers, Shiksha, AglaSem, Getmyuni) are memory-based reconstructions by coaching institutes, not NID's; keep to NID's own papers.

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

- [ ] nid-bdes-2019 (pilot). Stage 1–2 done 24 Nov 2026: all 26 questions found (22 objective, 4 subjective). The source is NID's "B.Des./GDPD DAT Prelims Sample Test Paper". Printed marks: Q1–14 1 mark, Q15–22 2 marks; Part II 70 marks; no duration or negative marking printed. All 22 objective questions solved: 13 agree with the bank, 1 disagrees (Q8), 6 bank records were broken or missing, and 2 look flawed (Q16: no option fits the rule exactly; Q18: the exact count is 22, which is not an option). Owner decision needed on Q16 and Q18. Bank rebuilt from NID's PDF in draft PR #340 (26 records; Q8 corrected to the Pole star).
- [x] nid-bdes-2018: rebuilt from NID's booklet D with NID's final answer key in draft PR #344 (64 MCQ + 3 drawing tasks)
- [x] nid-mdes-2018 (new): NID's booklet A with NID's final answer key in draft PR #344 (59 MCQ + 3 tasks)
- [x] nid-bdes-2016: NID's booklet series P (88 MCQ + 3 tasks) with NID's final key, draft PR #347
- [x] nid-bdes-2017: NID's booklet B/DB/81/XVI/I (75 MCQ + 4 tasks) with NID's final key, draft PR #347
- [x] nid-bdes-2020: NID's booklet XIX-XX (21 MCQ + 6 tasks), solved by us, draft PR #347
- [ ] samples 2024/2025 B.Des and M.Des
- [ ] Unscored drawing tasks in year papers (product spec for Codex)

## Second archive sweep (24 Nov 2026)

Found and downloaded NID's real January 2018 exams with official keys (B.Des series D, X + keys D, L, T, X; M.Des series A, H, P, W + keys), NID's final keys after objections, M.Des 2017 with its answer key, a 75-question B.Des sample, and GDPD test papers from 2002-03, 2005-06, 2007, 2009, 2010 and 2011. See `nid-sources/README.md` in the private work folder.

Still to ingest:
- [ ] M.Des 2017 with answer key (scan)
- [ ] B.Des sample, 75 MCQ (B/DB/81/XVI/I)
- [ ] GDPD tests 2002–2011 (scans, mostly subjective)

## Other websites (24 Nov 2026)

85 PDFs from Toprankers/Creative Edge, Careers360, EduCharcha, CollegeDekho and Silica (private work folder `nid-sources/web/`). Most are re-uploads of NID papers we hold; the useful new material is candidates' recollections of the years NID did not publish.

- [x] DMocks reconstructions from recollections (draft PR #346): `nid-bdes-recalled-2023` (Part B, 4 tasks), `nid-bdes-recalled-2024` (11 MCQ + 3 tasks), `nid-bdes-recalled-2026` (6 tasks; that paper had no objective part). Our wording, labelled as reconstructions.
- [ ] Reconstructions still possible: B.Des 2020–2022 Part B and 2025 Part A; M.Des 2021–2023 discipline papers.
- [ ] Check the Silica 2016/2017 B.Des and M.Des scans against NID's originals.
- Finding: the "NIDA2023–26" samples are NID's real January 2022 papers. The `-sample-2023` ids may be relabelled to 2022.
- Finding: M.Des Prelims is CDAT plus a discipline paper (19 disciplines), so the generic Part B added to the M.Des sample in PR #342 does not match the real format. The owner should decide whether to keep it or replace it with discipline tasks.

Product gaps for NID year papers (Codex):
- Allow "X or Y" answers for NID (the runtime allows them only under the UCEED and CEED rules).
- NID final keys give partial credit for second-best options (B.Des 2018 Q32–39; M.Des 2018 Q19, 52, 54, 56, 58, 59). The bank keeps only the full-mark answer.

The VDDS reprints the bank first used are watermarked scans of NID's own booklets. The 2016 and 2017 reprints include photos of NID's final answer keys (with NID's seal), which are now the source of those answers. NID_SampleTestPaper2016.pdf holds the 2016 B.Des paper twice (series P, then series A with the questions shuffled).

## Notes

- 24 Nov 2026: the disk was full (60+ worktrees of about 800 MB each). Claude removed only its own two merged worktrees. Others should prune theirs.

## Decisions log

- 24 Nov 2026: owner decisions 1–4 above. Pilot paper: B.Des 2019, the smallest paper that has NID's own PDF.
