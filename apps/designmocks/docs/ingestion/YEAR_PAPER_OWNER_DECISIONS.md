# Year-paper owner decisions (24 November 2026)

The owner approved these changes to the canonical bank for the free year-wise Papers release. Each one is applied in `server/data/exports/dexam-bank-export.json`.

## Full marks for every candidate

`answer.raw` is `FULL MARKS`. `question-runtime.mjs` turns this into the key `{kind:'full_marks'}`, and `score_response` grades that key as correct for everyone. Each worked explanation tells students that the question earns full marks.

| Question | Reason |
|---|---|
| UCEED 2015 Q67, CEED 2024 Q14, CEED 2025 Q41 | Dropped in the official answer key. |
| CEED 2026 Q16, UCEED 2022 Q39, UCEED 2023 Q56, UCEED 2024 Q31 | The question depends on an animated GIF, but the printed paper can show only a still frame. |
| UCEED 2016 Q62, Q74, Q75 | No printed option is correct (see `KNOWN_CONFLICTS.md`). The hold is cleared so that the whole 2016 paper is released. |

UCEED 2020 Q36, Q64 and Q65 already carried `FULL MARKS` from the official key.

## Facts over the official key

| Question | Official key | Released key | Why |
|---|---|---|---|
| UCEED 2017 Q35 | ACD | AD | Option C says ozone is not a greenhouse gas, but ozone is a greenhouse gas. |
| UCEED 2021 Q29 | BCD | BD | Shape C is a rep-tile only if a copy is flipped, and the question forbids flipping. |

Each explanation states that DMocks follows the facts here and differs from the official key.

## Holds cleared

The owner asked for the whole UCEED 2016 paper to be released. The hold on Q20 is cleared, because its key of 0.82 checks out. The hold on Q40 is cleared too. Q62, Q74 and Q75 are listed under full marks above.

## Part B text removed from Part A records

Part B (sketching) instructions had leaked into seven Part A records, and the trailing text was cut:

- Prompts: CEED 2021 Q41, CEED 2022 Q41, CEED 2023 Q41, CEED 2024 Q44 and CEED 2025 Q44.
- Option D: CEED 2026 Q44 and UCEED 2022 Q68.

No other record in these papers contains Part B text.
