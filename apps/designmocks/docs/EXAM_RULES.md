# Verified exam contexts

Checked 6 November 2026 against official IIT Bombay 2027 brochures. These facts drive the operator-only question compiler; they are not a claim that the current flat mock generator enforces the complete exam structure. Program-level sections, transitions and drawing review remain release gates.

| Context | Part A duration | NAT | MSQ | MCQ | Part B |
| --- | ---: | --- | --- | --- | --- |
| UCEED 2027 | 120 minutes | 14 × 4; wrong 0 | 15 × 4; partial credit; wrong −1 | 28 × 3; wrong −0.71 | 60 minutes; two tasks, 50 marks each |
| CEED 2027 | 60 minutes | 8 × 4; wrong 0 | 10 × 4; partial credit; wrong −1 | 26 × 3; wrong −0.5 | 120 minutes; five tasks, 20 marks each |

MSQ: exact correct set earns four. A proper nonempty subset earns its selected count (one, two or three), provided every selected option is correct. An empty response earns zero; any incorrect selection earns −1. The database suite exhausts all 15 nonempty correct sets against all 16 response sets.

Sources: [UCEED 2027 brochure, printed pages 29–31](https://www.uceed.iitb.ac.in/2027/assets/downloads/docs/UCEED2027_Information_Brochure.pdf) and [CEED 2027 brochure, printed pages 2–3](https://www.ceed.iitb.ac.in/2027/downloads/CEED2027_Brochure.pdf). Verify official addenda and the target cycle before changing this version.

The compiler uses only `iitb-2027-v1`; it never applies this context to NID/NIFT. It preserves original source payloads and records the target context separately. Raw numeric exact/range notation is parsed strictly and preserved as decimal text. Unsupported notation is held for explicit review; no numerical tolerance or answer is inferred. Figures must match the registered private SHA-256, dimensions and object path. Eligible UCEED/CEED descriptive tasks now compile separately as `drawing`: UCEED carries 50 marks and a 60-minute Part B context; CEED carries 20 marks and a 120-minute Part B context. Their marking contract requires human review and cannot contribute to objective readiness or topic-practice pools.

The exam-wise generator now freezes the verified objective part exactly: UCEED Part A contains 14 NAT, 15 MSQ and 28 MCQ in that order with a 120-minute server clock; CEED Part A contains 8 NAT, 10 MSQ and 26 MCQ with a 60-minute server clock. Administrators may release or close these blueprints and set the free allowance, but cannot edit their counts or clocks. NID/NIFT remain unstructured and unreleased until programme-specific rules are verified.

Before publishing a complete exam, accept the separate Part B clock and transition, drawing/upload/review behavior, full attempt/report flow and content rights. A converted question or verified Part A generator is not a released complete paper or approved question.
