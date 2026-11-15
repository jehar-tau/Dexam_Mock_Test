# The recall pattern

Engine `src/learn/recall.js` · decks in `src/learn/decks/` · tests
`tests/recall.test.mjs`. Built 16 November 2026 for the knowledge
programmes (crafts, art and design history).

## Decks

A deck is `{ prefix, topic, facts, types, fields, fieldWords, near,
sequences, twoFields? }`. Each fact has a `name`, a `type` and some fields
(for example `place` and `how`). `near` says which groups are confusable,
for odd-one-out questions. Sequences are ordered steps or dates.

## Kinds (registered as `<prefix>-<kind>`)

| Kind | Level | Exam form |
|---|---|---|
| `name` | 1 | Which region / description / designer belongs to this item? |
| `which` | 2 | Which of these is a … ? |
| `match` | 3 (three pairs), 4 (four pairs) | Match the following, answered as “1–B, 2–A, 3–C” |
| `odd` | 3 | Which one does not belong? (three of a group, one from a near group) |
| `order` | 4 | Put the steps or dates in order |
| `two` | 4 | Which is a … whose region is …? (only for decks with `twoFields`) |

No new answer mode was needed: matching and ordering are single choice,
as in the exams.

## Facts

Facts are taken from the owner's theory documents and rewritten in our own
words; nothing is copied. Dated material (awards, news, current affairs)
is left out. The programmes stay in the preview until the owner has read
the decks, as `06-curriculum.md` requires.

## Verification

`tests/recall.test.mjs` checks every deck for duplicates and unknown
groups, and every generated question against the deck by plain lookups:
the right option is what the deck says and no wrong option is also true.
