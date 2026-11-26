# Verified exam contexts

Checked 6 November 2026 against the official IIT Bombay 2027 brochures and the NIFTEE 2027 Information Bulletin dated 16 October 2026. These facts drive the operator-only question compiler; they are not a claim that the current flat mock generator enforces the complete exam structure. Program-level sections, transitions and drawing review remain release gates.

| Context | Part A duration | NAT | MSQ | MCQ | Part B |
| --- | ---: | --- | --- | --- | --- |
| UCEED 2027 | 120 minutes | 14 × 4; wrong 0 | 15 × 4; partial credit; wrong −1 | 28 × 3; wrong −0.71 | 60 minutes; two tasks, 50 marks each |
| CEED 2027 | 60 minutes | 8 × 4; wrong 0 | 10 × 4; partial credit; wrong −1 | 26 × 3; wrong −0.5 | 120 minutes; five tasks, 20 marks each |

| Context | Paper | Duration | Questions | Marking |
| --- | --- | ---: | --- | --- |
| NIFT 2027 B.Des. | GAT Section A (CBT) | 120 minutes | 100 MCQ, one correct option | +1; wrong −0.25; unanswered 0 |

MSQ: exact correct set earns four. A proper nonempty subset earns its selected count (one, two or three), provided every selected option is correct. An empty response earns zero; any incorrect selection earns −1. The database suite exhausts all 15 nonempty correct sets against all 16 response sets.

Sources: [UCEED 2027 brochure, printed pages 29–31](https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf) and [CEED 2027 brochure, printed pages 2–3](https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf) and [NIFTEE 2027 Information Bulletin, printed pages 18–20](https://nift.ac.in/sites/default/files/2026-10/Information%20Bulletin%20-NIFTEE%202027%20-16.10.2026.pdf) (sections 3.4 and 3.7). Verify official addenda and the target cycle before changing this version.

The compiler applies `iitb-2027-v1` only to UCEED/CEED and `niftee-2027-bdes-v1` only to NIFT B.Des. GAT; it never applies either context to NID. It preserves original source payloads and records the target context separately. Raw numeric exact/range notation is parsed strictly and preserved as decimal text. Unsupported notation is held for explicit review; no numerical tolerance or answer is inferred. Figures must match the registered private SHA-256, dimensions and object path. Eligible UCEED/CEED descriptive tasks now compile separately as `drawing`: UCEED carries 50 marks and a 60-minute Part B context; CEED carries 20 marks and a 120-minute Part B context. Their marking contract requires human review and cannot contribute to objective readiness or topic-practice pools.

The exam-wise generator now freezes the verified objective part exactly: UCEED Part A contains 14 NAT, 15 MSQ and 28 MCQ in that order with a 120-minute server clock; CEED Part A contains 8 NAT, 10 MSQ and 26 MCQ with a 60-minute server clock. Administrators may release or close these blueprints and set the free allowance, but cannot edit their counts or clocks. NIFT B.Des. GAT freezes exactly 100 four-option MCQs (+1, −0.25) with a 120-minute server clock through a separate service-only writer that rejects figures without verified private media. It is a standalone objective paper: the paper-based CAT, B.F.Tech. Section B and other NIFT programmes are not modelled, and the blueprint stays unreleased until an administrator releases it. NID remains unstructured and unreleased until its programme-specific rules are verified.

The local sequential-session implementation binds one UCEED or CEED Part A attempt to one Part B attempt. Part B cannot open before the fixed Part A deadline, cannot be restarted, keeps its official one-hour/two-task UCEED or two-hour/five-task CEED window even after a disconnect, and retains the separate 15-minute upload grace. The server owns the transition, returns the same Part B attempt on retries and rejects cross-student access. Part A marks and keys remain private until Part B is submitted, its upload window closes and every uploaded drawing has an explicitly released human review; the combined report then shows the objective, drawing and total marks. Before publishing a complete exam, accept provider-backed review behavior and content rights. A converted question or locally verified generator is not a released complete paper or approved question.

NID source check — 8 November: the [official 2027–28 Integrated Pathway/B.Des. handbook](https://admissions.nid.edu/NIDA2027/download/BDES_IntegratedPathway_AdmissionsHandbook2027_28.pdf), printed pages 27 and 35, confirms English text/visual pen-and-paper Prelims, leaves duration to the admit card and does not share assessment criteria/mark breakdown. No fixed NID clock, question count, marking or official rubric is established by that source. Keep NID out of the verified runtime contexts until an adequate context is authored/reviewed or verified; label any authored practice scheme as practice. See [conversion evidence](BANK_CONVERSION.md).

For a historic NID year paper only, the reviewed private paper plan may carry that
paper's printed clock and per-question marks. Its runtime is labelled
`historical-year-paper` and is never treated as a general NID 2027 rule. The
stored key alone scores an objective MCQ; second-best-option partial marks are
not modelled. Descriptive items stay outside the objective paper.
