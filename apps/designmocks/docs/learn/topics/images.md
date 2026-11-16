# Images in the knowledge programmes

Owner decision, 16 November 2026: real artworks, monuments, crafts and
design classics are shown with openly licensed photographs; posters,
product design and storyboards use drawings made in code.

## Photographs

- 57 photographs in `public/learn-images/` (480 px, about 2.3 MB), listed
  with author, licence and source in `src/learn/decks/images.js`.
- Source: Wikimedia Commons, starting from each Wikipedia article's lead
  image, with replacements found by search. Only public domain, CC0, CC BY
  and CC BY-SA files are used.
- Every photograph was looked at before use. Left out: images whose printed
  text names the answer (a Chikankari poster, an Armenian Manipuri stamp),
  images of the wrong thing (Iranian Meenakari, a portrait for Pochampally,
  an aerial city view for Meenakshi), and cave exteriors for the Ajanta
  murals. No suitable free image was found for Manipuri, Meenakari,
  Kashida, Patola, Ikat, Ajrakh or NID; those stay text-only.
- Each photograph carries a short credit (author, licence link, Wikimedia
  Commons); each programme page lists full credits with source links.

Where they appear: photo strips on the fact slides of Crafts and Art and
design history; the subject's photo on name-it questions; and a new recall
kind, `identify` ("This picture shows a … Which one?"), for every deck with
at least four photographs. Its alt text describes the kind of thing without
naming the answer.

## AI illustrations and diagrams

Owner decision, 16 November 2026, after reviewing the first drawings made
in code: illustrative pictures are AI-generated; pictures whose numbers
decide the answer stay as exact diagrams, redrawn more carefully.

- **AI-generated** (Figma image generation, model gpt-image-2.5-flare,
  made for DMocks in the Figma file "DMocks Learn illustrations"): four
  chairs for the stability question, four poster layouts, four storyboard
  shots (wide, close-up, reaction, empty sky). Prompts asked for no
  letters or words, so no garbled text appears; each image was checked
  before use. Files: `public/learn-images/illustrations/` (12 images,
  about 220 KB).
- **Exact diagrams** (`src/learn/method-figures.jsx`): ramps drawn to scale
  (heights six times taller) with a wheelchair, shading and dimension
  arrows; pendulum frames on a mounted bracket with a dashed swing guide
  and numbered bobs. AI images cannot keep these numbers exact.

## Checks

`tests/recall.test.mjs` checks that every image file exists and carries an
allowed licence, author and Commons source, and that in identify questions
only the right answer matches the picture and the alt text never names it.
`tests/method.test.mjs` checks that every drawn option belongs to a real
option.
