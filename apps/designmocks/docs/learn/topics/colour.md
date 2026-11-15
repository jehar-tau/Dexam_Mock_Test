# Colour

Slug `colour-basics` (keep the slug; title becomes "Colour") · topic
`design-sensitivity` · exams uceed, ceed, nid, nift · engines
`src/learn/colour.js` (foundations) and `src/learn/colour-exam.js` · figures
`src/learn/colour-figures.jsx` · tools `colour-wheel`, `colour-mixer`

Status: all four tiers **Built** (16 November 2026). Sections 4 onward
describe what was built; the original plan for these tiers was replaced by
the archetypes in the owner's colour question bank (section 2a).

## 1. Outcome

The student can name and build colour schemes, predict the result of mixing
paint, light and overlapping filters, judge value and contrast for
legibility, and explain why the same colour looks different in different
surroundings.

## 2. Exam evidence

| Id | Archetype | Form | Frequency |
|---|---|---|---|
| C1 | Primary, secondary, tertiary; complementary and analogous colours | Single choice | Common |
| C2 | Mixing: paint (subtractive) and light (additive); printing inks | Single or multiple select | Common |
| C3 | Overlapping transparent coloured sheets or filters: colour of the overlap | Single choice | Regular |
| C4 | An object under coloured light: what colour it appears | Single choice | Occasional |
| C5 | Identify the scheme of a palette (monochromatic, triadic…) | Single choice | Regular |
| C6 | Value, tint, shade, tone; order swatches light to dark | Single or numerical | Regular |
| C7 | Contrast and legibility: which combination reads best | Single or multiple select | Regular |
| C8 | Same colour on different backgrounds looks different | Single choice | Occasional |
| C9 | Warm and cool, advancing and receding; colour meaning and codes | Single choice | Regular |

## 2a. What the owner's colour bank adds

Read for form and level only; nothing is copied. Its questions ask for: the
result of pots mixed in thirds and poured together; a colour named from RGB
values, a hex grey as a white and black mix, and CMYK values checked against
names; a colour filter on black and white film; naming a split-complementary
pair; continuing a walk round the wheel and matching neighbour triples;
judging which wheel diagram marks a true triad; high-contrast sign colours.

## 3. Techniques taught

- **The wheel.** Twelve steps; complement six steps across; analogous next
  door; triad every fourth; split-complement the two beside the complement;
  tetrad a rectangle.
- **Paint subtracts, light adds.** Paint and ink: cyan, magenta, yellow
  (and the artists' red, yellow, blue). Light: red, green, blue. Paint
  mixtures get darker; light mixtures get lighter.
- **Filters multiply.** A filter passes only its own parts of the light.
  Two filters pass only what both pass.
- **An object shows what it reflects.** Under light that lacks its colour it
  looks dark.
- **Value first.** Legibility depends on the difference in value, not hue.
- **Surroundings shift a colour** away from the background: lighter on
  dark, more saturated on its complement.

## 4. Ladder (as built)

### Foundations (L1–L2)

`wheel` (mix ×3) · `light-ink` (tool in light and ink modes; `light-ink` ×3) ·
`complements` (complement ×2, `harmony-name` L2, `analogous-run` L2) ·
`value` (value, `tint-shade-tone` ×2, warm-cool). Quiz 10, pass 7.

### Exam standard (L3)

| Lesson | Teaches | Checks |
|---|---|---|
| `harmonies` | Name a scheme by its gaps: 6-6, 1-1, 4-4-4, 5-2-5, 3-3-3-3 | `harmony-name`, `scheme-check` ×2, practice |
| `walks` | Direction and step size round the wheel; neighbour triples in order | `analogous-run`, `neighbour-analogy` ×2, practice |
| `codes` | RGB channels off, half, full; a hex grey as a share of white | `code-read`, `hex-grey` ×2, practice |
| `filters` | Filters pass their own colour; sheets and coloured light; legibility is value | `filter-photo`, `filter-light` ×2, `contrast-pick` ×2, practice |

Quiz 10, pass 7.

### Exam hard (L4)

| Lesson | Teaches | Checks |
|---|---|---|
| `print` | Hex codes of near neighbours; CMYK to RGB, R = 255 (1 − C)(1 − K) | `code-read` L4, `cmyk-channel` ×2 (typed), practice |
| `proportions` | Equal pots: average the share in each pot | `paint-share` ×3, practice |
| `value-across` | The same grey from different hues; close contrasts; object, light and lens together | `same-value`, `contrast-pick` L4 ×2, `filter-light` L4, practice |

Quiz 9, pass 6.

### Mastery (L5)

Review lesson with mixed practice, then a timed set of 12 at UCEED marking.

## 5. Question kinds

| Kind | Levels | Mode | Model |
|---|---|---|---|
| `light-ink` | 2 | single | Lights add channels; inks multiply what each lets through |
| `harmony-name` | 2, 3 | single | Gaps between wheel positions; level 3 adds split and square |
| `scheme-check` | 3 | single | Four marked wheels, one with triad or split gaps |
| `analogous-run` | 2, 3 | single | Five colours in even steps (level 3: steps of two, either way), one missing |
| `neighbour-analogy` | 3 | single | Neighbour triple matched to a new centre, same order |
| `tint-shade-tone` | 2 | single | Lightness up, down, saturation down, or a new hue |
| `filter-photo` | 3 | single | Filter lightens its own colour, darkens its complement |
| `filter-light` | 3, 4 | single | Channel sets: two sheets, or an object under coloured light; level 4 adds coloured glasses |
| `code-read` | 3, 4 | single | Named RGB table; level 4 in hex with the three nearest names as options |
| `hex-grey` | 3 | single | Equal channels; value ÷ 255 is the share of white |
| `contrast-pick` | 3, 4 | single | WCAG contrast ratio; level 4 keeps the runner-up within 1.25–1.8× |
| `cmyk-channel` | 4 | typed | Whole-number results only |
| `paint-share` | 4 | single | Average of pot shares; the pooled-parts mistake is always an option |
| `same-value` | 4 | single | Relative luminance; colours built by searching HSL lightness |

The old foundations kinds (`mix`, `complement`, `value`, `warm-cool`) stay
in `colour.js`.

## 6. Verification

`tests/colour-exam.test.mjs` checks every answer a second way: light and ink
as sets of channels, harmonies from angle gaps, walks and analogies from
wheel positions, tints and tones from parsed HSL, codes from a hex table,
CMYK in whole-number arithmetic, paint shares as exact fractions, and value
and contrast from a separately written luminance table. Every option list has
four distinct options and exactly one answer.

## 7. Not built

Simultaneous contrast (the same patch on different surroundings) is
perceptual and has no reliable computed answer, so it is not asked.
