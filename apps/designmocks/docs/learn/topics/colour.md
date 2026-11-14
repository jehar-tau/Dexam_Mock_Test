# Colour

Slug `colour-basics` (keep the slug; title becomes "Colour") · topic
`design-sensitivity` · exams uceed, ceed, nid, nift · engine
`src/learn/colour.js` · tool `colour-wheel`

Status: Foundations **Built** · Exam standard Planned · Exam hard Planned ·
Mastery Planned

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

## 4. Ladder

### Foundations (L1–L2) — built

`wheel` (mix ×3), `complements` (complement ×4), `value` (value ×2, warm-cool
×2). Quiz as built.

### Exam standard (L3)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `schemes` | Naming a scheme | hook (`scheme-name`) · slide: split-complement, tool with scheme chips · slide: tetrad and monochrome · worked | `scheme-name` ×3, `scheme-complete` ×2 (multiple select), practice |
| `light-and-ink` | Light adds, ink subtracts | hook (`mix-light`) · slide: red, green and blue light, tool in light mode with three sliders · slide: cyan, magenta and yellow ink · worked | `mix-light` ×2, `mix-ink` ×2, practice |
| `tint-shade-tone` | Tint, shade and tone | hook (`value-order`) · slide: add white, black or grey, tool sliders · worked | `value-order` ×2, `tint-shade-tone` ×2, practice |

Quiz (8, pass 6): `scheme-name` 2, `scheme-complete` 1, `mix-light` 2,
`mix-ink` 1, `value-order` 1, `tint-shade-tone` 1.

### Exam hard (L4)

| Lesson | Title | Screens | Checks |
|---|---|---|---|
| `filters` | Filters and coloured light | hook (`filter-overlap`) · slide: a filter passes its own light, tool with two draggable filter discs (tap to move between three positions) · slide: an object under coloured light · worked | `filter-overlap` ×3, `object-under-light` ×2, practice |
| `legibility` | Contrast you can read | hook (`contrast-rank`) · slide: value difference decides, tool showing text on a background with the contrast figure · worked | `contrast-rank` ×3, `contrast-pick` ×2 (multiple select), practice |
| `surroundings` | The same colour, different neighbours | hook (`same-patch`) · slide: a grey patch on light and dark · slide: a colour on its complement · worked | `same-patch` ×4, practice |

Quiz (8, pass 5): `filter-overlap` 2, `object-under-light` 1, `contrast-rank`
2, `contrast-pick` 1, `same-patch` 2.

### Mastery (L5)

Review lesson, then 15 questions, 15 minutes, `ceed` marking, three of each
family: wheel and schemes, mixing, filters and light, value and contrast,
surroundings.

## 5. Question kinds

| Kind | Levels | Mode | State |
|---|---|---|---|
| `mix`, `complement`, `warm-cool`, `value` | 1–2 | single | exist |
| `scheme-name` | 3 | single | new |
| `scheme-complete` | 3 | multi | new |
| `mix-light`, `mix-ink` | 3 | single | new |
| `value-order` | 3 | single | new |
| `tint-shade-tone` | 3 | single | new |
| `filter-overlap` | 4 | single | new |
| `object-under-light` | 4 | single | new |
| `contrast-rank` | 4 | single | new |
| `contrast-pick` | 4 | multi | new |
| `same-patch` | 4 | single | new |

### `scheme-name` and `scheme-complete`

- Palettes of 2–4 wheel hues. Name: complementary, analogous, triadic,
  split-complementary, tetradic, monochromatic (one hue at three values).
- `scheme-complete`: "Which colours complete a split-complementary scheme
  with orange?" Select the two correct hues among five.
- Reasons state the step distances on the wheel.

### `mix-light` and `mix-ink`

- Light: R+G = yellow, G+B = cyan, R+B = magenta, R+G+B = white.
- Ink: C+M = blue, M+Y = red, C+Y = green, C+M+Y = near black.
- Distractors: the answer under the other model; the third primary.
- Swatches use fixed display colours (section 6).

### `value-order`

Four swatches of different hues with clearly different lightness (steps of
at least 12% in L). Ask for the order light to dark as one of four orderings.
Answer by relative luminance, not by HSL lightness.

### `tint-shade-tone`

A base hue and a changed swatch: more white (tint), more black (shade),
more grey (tone), or a hue shift. Ask which was done.

### `filter-overlap`

- **Scenario.** Two or three overlapping discs chosen from cyan, magenta,
  yellow filters over white light (or red, green, blue lights on a dark
  wall; the prompt says which). One overlap region is marked.
- **Answer.** Filters: multiply channel by channel. Lights: add.
- **Distractors.** The other model's answer; one disc's own colour.

### `object-under-light`

Object colour from {red, green, blue, yellow, white, black}, light from
{white, red, green, blue, yellow}. Appearance = channel-wise product; name
the result (red object under green light: black). Options are swatches with
names.

### `contrast-rank` and `contrast-pick`

- Four text-on-background pairs. Rank by WCAG contrast ratio; ask for the
  most legible, or select all with ratio at least 4.5.
- Pairs are chosen so hue difference is large where value difference is
  small (red on green) to target the misconception.
- Reasons quote the two values in words ("both are mid-dark").

### `same-patch`

- **Scenario.** Two backgrounds side by side with a small patch on each.
  Either the patches are identical and look different, or differ and look
  alike. Ask "Are the two small patches the same colour?" with options same
  / left is lighter / right is lighter, or four panels where one pair is
  truly identical.
- **Answer.** From the patch colours.
- The feedback screen offers a "remove the backgrounds" toggle so the
  student sees the truth.

## 6. Engine

- Channel model: colours as `[r, g, b]` in 0–1. `addLight(a, b)` = channel
  sum clipped; `multiply(a, b)` = channel product.
- Named display colours: red `#e53935`, green `#43a047`, blue `#1e63d0`,
  cyan `#19b5c8`, magenta `#d81b8c`, yellow `#f5d400`, white, near-black
  `#1a1a1a`. Classification of a computed colour back to a name uses the
  ideal channel triples (1,0,0) and so on, not the display hex.
- `relativeLuminance(hex)` with the sRGB transfer (c ≤ 0.03928 → c ÷ 12.92,
  else ((c + 0.055) ÷ 1.055)^2.4) and weights 0.2126, 0.7152, 0.0722.
  `contrastRatio(a, b)` = (L₁ + 0.05) ÷ (L₂ + 0.05), lighter first.
- Scheme helpers: `splitComplement(id)`, `tetrad(id)`,
  `schemeOf(ids)` → name or null.

## 7. Figures and tool

- New figures: `palette` (row of swatches), `discs` (overlapping circles
  with a marked region, blend mode computed, not CSS `mix-blend-mode`, so
  it is exact in both themes), `text-pair` (sample word on a background),
  `patch-pair`.
- Tool `colour-wheel` gains scheme chips (complement, split, triad, tetrad,
  analogous) that draw the scheme on the wheel; a **light mode** with three
  sliders and a mixed spot; a **contrast mode** with foreground and
  background pickers from the wheel plus value, showing the ratio.

## 8. Hand-checked cases

- `contrastRatio('#000000', '#ffffff')` = 21; `('#777777', '#ffffff')` ≈
  4.48 (below 4.5); `('#767676', '#ffffff')` ≈ 4.54.
- `multiply(cyan, yellow)` → green; `multiply(cyan, magenta)` → blue;
  `multiply(magenta, yellow)` → red; all three → black.
- `addLight(red, green)` → yellow; all three → white.
- Red object under green light → black. White object under blue light →
  blue. Yellow object under red light → red.
- `splitComplement('orange')` = blue-green and blue-violet.
- `schemeOf(['red', 'yellow', 'blue'])` = triadic.

## 9. Archetype coverage

| Archetype | Kind and level | Verified on seeds | Notes |
|---|---|---|---|
| C1 | `mix`, `complement` L1–L2 | | |
| C2 | `mix-light`, `mix-ink` L3 | | |
| C3 | `filter-overlap` L4 | | |
| C4 | `object-under-light` L4 | | |
| C5 | `scheme-name`, `scheme-complete` L3 | | |
| C6 | `value`, `value-order`, `tint-shade-tone` | | |
| C7 | `contrast-rank`, `contrast-pick` L4 | | |
| C8 | `same-patch` L4 | | |
| C9 | `warm-cool` L2 | | Colour meaning and codes belong to a deck |

## 10. Out of scope

Colour psychology, cultural meanings, named colour systems and colour
codes: facts for a reviewed deck (wave 5). Colour-vision deficiency
simulation.
