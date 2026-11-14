# 9. Topic map from the owner's theory documents and question banks

Written 14 November 2026 after the owner supplied one folder holding a theory
document and, for most topics, a question bank of previous-year questions.
The folder stays on the owner's Mac. Nothing in it is copied into this
repository: no question text, no figure, no scan. We read it to learn the
**archetypes and the level**, then generate our own questions.

This file answers three things: which programme each document feeds, who
builds it (which model), and in what order.

## 9.1 What the folder holds

| Topic | Theory | Question bank | Readable as text | Notes |
|---|---|---|---|---|
| Spatial | yes | the earlier Spatial Question Bank (77 pages) | theory only | The file named "Spitial questions.pdf" in the new folder is a broken download (a web page, not a PDF). Use the earlier bank. |
| Mechanical reasoning | yes | 25 solved questions, UCEED 2015–2026 | both | Gears, belts, pulleys, levers, linkages, stability, rolling, object function, control mapping |
| Shape and area counting | yes | 30 questions (16 counting, 14 area) | scans | Triangles, squares, circles, lines, parallelograms; shaded areas |
| Logical reasoning | yes | 17 pages | scans | Coding, direction and path, constraint puzzles, number patterns, visual series and rotation |
| Quantitative aptitude | yes | 30 questions | scans | Percentage, ratio, average and age, time and work, speed and clocks, number system, mensuration |
| Colour theory | yes | yes | both | |
| Visual observation and perception | yes | the earlier Visual Observation bank | scans | |
| Product design | yes | 29 pages | scans | Mostly open drawing and writing tasks (NID), a few objective |
| Poster, mascot, campaign | yes | 11 questions | scans | Almost all open drawing tasks |
| Storyboarding | yes | none | scans | Open drawing tasks |
| Perspective and viewpoint | yes | none | scans | |
| Art history | yes | none | scans | Recall |
| Indian craft | yes | none | scans | Recall |

## 9.2 Three kinds of topic

The interactive pattern built so far (tool, generated questions, verified
answers) fits only the first kind. The other two need their own pattern,
defined once and then repeated.

1. **Computable.** The answer can be worked out by a program, so questions
   are generated without limit. Spatial, mechanical, counting, logical,
   quantitative, colour mixing.
2. **Recall.** Facts to know: art history, Indian craft, colour terms,
   perspective terms. Needs an authored fact bank and recall questions
   (pick the name, match the pair, order in time). Pattern not yet built:
   work package F9 below.
3. **Open response.** Draw a poster, a mascot, a storyboard, a product
   idea. Cannot be marked by a program. Teach the method with step-by-step
   lessons and objective checks on the principles (hierarchy, mapping,
   sequence), then hand over to the drawing practice elsewhere in the
   portal. Pattern not yet built: work package F10 below.

## 9.3 Programmes, order and who builds

"Fable" is the top model, in short supply. It is used where a mistake in
the geometry or the pattern would be copied into everything after it.
"Opus" is the next model down and follows the specs and the playbook.

| # | Programme (slug) | Source | Kind | Builder | State |
|---|---|---|---|---|---|
| 1 | Cube nets (`cube-nets`) | Spatial | computable | Fable built Foundations; Opus adds tiers 2–4 from `topics/cube-nets.md` | Foundations done |
| 2 | Nets of solids (`nets-of-solids`) | Spatial | computable | Fable | All four tiers done |
| 3 | Counting cubes (`counting-cubes`) | Spatial | computable | Fable | All four tiers done |
| 4 | Gears, belts and levers (`mechanisms`) | Mechanical | computable | **Fable: engine, tool, all tiers for gears, belts, levers.** Opus adds linkages, stability, rolling from `topics/mechanisms.md` | All four tiers done for gears, belts, ropes, levers |
| 5 | Counting figures (`counting-figures`) | Shape and area counting | computable | Fable built the counting engine and all four tiers. Opus adds area questions, overlaid sheets and irregular figures from `topics/counting-figures.md` section 0 | Counting done; area not started |
| 6 | Paper folding (`paper-folding`), Mirror images (`mirror-images`) | Spatial | computable | Opus, tiers 2–4 from their specs | Foundations done |
| 7 | Views and rotation, Dice, Solid surfaces | Spatial | computable | Opus from specs; ask Fable only if the 3D conventions fight back | Specs exist |
| 8 | Number and quantity (`quant`) | Quantitative aptitude | computable | Opus. Word problems with drawn numbers; no figure engine needed | Spec to write (short) |
| 9 | Patterns and codes (`logic`) | Logical reasoning | computable | Opus for number patterns, coding, series. Fable for visual-series rotation figures if they prove hard | Spec to write |
| 10 | Colour (`colour-basics`) | Colour theory | computable + recall | Opus, tiers 2–4 | Foundations done |
| 11 | Art history, Indian craft | theory only | recall | Fable defines the recall pattern on one topic (F9); Opus fills both | Not started |
| 12 | Visual observation | theory + earlier bank | computable (spot the difference, odd one out) | Opus after F9 | Not started |
| 13 | Perspective and viewpoint | theory only | computable + recall | Opus | Not started |
| 14 | Product design, Poster and campaign, Storyboarding | theory + banks | open response | Fable defines the method-lesson pattern on one (F10); Opus fills the others | Not started |

Order of work: 4, 5, then F9 and F10 (patterns), with Opus running 1, 6, 8,
9, 10 in parallel sessions from their specs.

## 9.4 New work packages

- **F9 — Recall pattern.** An authored fact bank per topic
  (`src/learn/bank/<topic>.js`: items with name, period or region, one-line
  description, tags), three generated question forms over it (name it,
  match pairs, put in order), spaced repetition of missed items inside a
  lesson. Figures are drawn or licensed images only; none taken from the
  owner's documents.
- **F10 — Method-lesson pattern.** For open-response topics: a worked
  brief shown step by step, objective checks on each principle (which
  layout reads first, which control maps to which burner, which frame comes
  next), and a closing checklist the student applies to their own drawing.

## 9.5 How work reaches GitHub

- One programme tier, or one engine, per pull request. Branch
  `feature/dmocks-learn-<topic>`.
- The owner has given standing permission (14 November 2026) for the Learn
  work to be pushed, opened as pull requests and merged once checks pass.
  This covers `apps/designmocks/src/learn/`, the Learn docs and tests, and
  the small wiring in `App.jsx`, `Learn.jsx`, `PortalShell.jsx` and
  `styles.css`. Anything outside that, and any change to sign-in, sales or
  release switches, still needs the owner's word.
- Before opening a pull request: `npm test`, the build and isolation check,
  and the Learn browser journeys. Say in the pull request what was not run.
- The rest of the application is built by another agent (Codex) in the same
  repository. Merge `origin/main` into the branch before pushing, and never
  touch its ports or its temporary folders.
