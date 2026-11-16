# 1. Experience standard

What every Learn lesson must feel like. The reference is the step-by-step
tutorial style of Brilliant: the student does something on almost every
screen, never reads for long, and always learns why an answer was wrong.

The owner's verdicts so far, which this standard exists to honour:

- First build (long lesson pages, rows of big buttons): "good, not great",
  "very chunky".
- Second build (one screen at a time, sliders and icon controls): "these
  look good, these are good interactive sessions", but "very easy". The
  lessons must go on to "much more complex problems that actually are asked
  in exam".

## 1.1 The player

Already built in `src/learn/LessonPlayer.jsx`. Do not redesign it; extend it.

- Full-screen view above the portal. Close button top-left, segmented
  progress bar (one segment per screen), screen count top-right.
- One content column, 640 px wide at most, centred.
- A pinned action bar at the bottom: Back, and one primary pill that reads
  Continue, Check or Finish lesson.
- Enter triggers the primary action. Escape leaves the lesson.
- The new screen fades up over 0.28 s; no motion under reduced-motion.

## 1.2 Screen kinds

| Kind | Purpose | Rules |
|---|---|---|
| `hook` | Open a lesson with a real exam-style problem the student cannot yet solve quickly. | Ungraded. One line: "Try it. We will come back to this." The same problem returns as the last check. Required from Exam standard upward. |
| `slide` | Teach one idea. | Title of at most six words. One or two sentences, 45 words at most. A live tool or figure unless the idea is purely verbal. One hint line that starts with a verb ("Drag the slider…"). |
| `worked` | Show the solving routine on one full problem. | The problem, then the solution revealed one step at a time with a "Next step" control. Each step is one sentence and may highlight part of the figure. Three to six steps. |
| `check` | Test the idea. | The student answers, presses Check, and reads feedback with the reason. First answer is recorded. Hints are available from Exam standard upward and are recorded as used. |
| `practice` | Build fluency. | Endless generated questions of one kind and level. The screen is passed after three correct in a row. Shows the streak. |
| `takeaway` | Fix the rule in memory. | One sentence, the rule itself, in the words a student would repeat to a friend. |

A lesson has 8 to 14 screens and takes 6 to 12 minutes. If it is longer,
split it.

## 1.3 Writing

- Second person, present tense, British spelling (colour, practise, centre).
- One idea per screen. If a slide needs a third sentence, it is two slides.
- Say the rule, then let the tool prove it. Do not describe what the student
  can see for themselves.
- No term before it is introduced. Introduce a term by using it once in bold
  with its meaning in the same sentence.
- Feedback never says only "Wrong". It names what the chosen option got
  wrong, then states the rule. Correct feedback restates the rule in one
  line so a lucky guess still teaches.
- Numbers in questions are small and clean unless arithmetic is the point.
- Never mention a past paper, year or institute in student-facing text.

## 1.4 Visual language

Use only what is in `src/styles.css` under "Learn: interactive programmes".

- Colours come from the theme tokens (`--paper`, `--surface`, `--ink`,
  `--muted`, `--line`, `--orange`, `--green`, `--action`) and the six face
  fills `fill-c1` to `fill-c6`. Add no new colour without a reason recorded
  in the topic spec. Colour topics are the exception.
- Controls: `.pill` (text actions), `.icon-button` (34 px round, for turn,
  flip, reset), `.slider` (continuous or stepped values), tappable figure
  parts. A tool has at most two pills. Anything repeated becomes a slider or
  an icon cluster.
- Figures sit on a `.tool-stage` or `.question-figure` card: surface
  background, 1 px line border, 14 px radius.
- Type: Zilla Slab for titles and take-aways, Figtree for everything else.
  Slide text 1.1 rem, prompt 1.15 rem semi-bold.
- Every figure must read in dark theme. Paper, sheets and cube faces stay
  light with dark ink in both themes.
- Minimum tap target 34 px; the primary pill is at least 44 px tall on
  phones and full width under 480 px.

## 1.5 Tools

A tool is a live figure the student manipulates. It is not scored.

- It responds to every input within one frame. No "Apply" buttons.
- It has a status line (`role="status"`) that states the current state in
  words, so the tool is usable without sight and gives the student language
  for what they see.
- Every control has an accessible name. Tappable SVG parts have
  `role="button"`, `tabIndex`, and Enter and Space handling.
- It works by tap and by keyboard. Dragging may be added on top, never as
  the only way.
- It opens in a state that already shows the idea of the slide it sits on.
  The slide's `props` set that state.
- The same tool is reused across levels with harder props, so students meet
  one instrument per topic and get good at it.

## 1.6 Questions

- Exactly the forms the exams use: single choice, multiple select, and
  numerical answer. See the ladder for which level uses which.
- Four options for single choice. Four to five for multiple select, with one
  to three correct.
- Distractors are the mistakes students actually make: the mirror image, the
  off-by-one layer, the forgotten fold, the opposite pair shown together.
  Each distractor carries its own reason.
- Options must be visually distinct. Two options that differ only in a
  detail smaller than 4 px are a defect.
- From Exam standard upward every question carries `solution` steps and one
  or two `hints`.

## 1.7 Accessibility and performance

- WCAG 2.1 AA. The dev audit (`?audit` on any dev page) reports no
  violations in both themes on every new screen kind and tool.
- Works at 320 px width with no horizontal scroll inside the player.
- No new runtime dependency. Figures are inline SVG or HTML grids. No
  canvas, no WebGL. Photographs are allowed only in the knowledge
  programmes (crafts, art and design history), only from openly licensed
  sources, each credited on screen and in the programme's credits list
  (owner decision, 16 November 2026; see `topics/images.md`). Posters,
  product design and storyboards use drawings made in code.
- Engines are pure and fast: generating one question takes under 20 ms on a
  laptop; the 60-seed sweep in tests takes under two seconds per kind.

## 1.8 Anti-patterns

Reject any of these in review.

- A row of three or more text buttons that step a figure. Use a slider.
- A page that scrolls through explanation, tool and questions together.
- A slide with a paragraph and no figure, twice in a row.
- A question whose wrong options are random rather than typical mistakes.
- A programme that stops at "easy". The hardest questions must match the
  hardest in the exam, with no tool to lean on.
- A tool that needs instructions longer than its hint line.
- Feedback that does not name the mechanism.
