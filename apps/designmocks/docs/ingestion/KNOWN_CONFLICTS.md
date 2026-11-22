# Question-bank conflicts awaiting review

## UCEED 2025, Part A, question 3

The source paper asks for the common sum in a 4 × 4 magic square using 1 through 16. The tracked bank prompt has an unrelated trailing “2025.” footer. The private Stage 2 segmentation also contains an extra, merged fragment about numbers 2 through 26, absent from the source question block. The keyed answer 34 is consistent with the source's 1-through-16 question, but the student prompt must be repaired from the original page and reviewed before scoring. The export carries `holds: ["prompt-contamination"]` pending an exact-version correction.

## UCEED 2025, Part A, question 18

The original paper's option C says a car-wheel nut is loosened by turning a spanner **“counter-clockwise clockwise”**. The tracked question repeats this contradictory phrase, while the preserved key includes C (A,C). The direction cannot be both clockwise and counter-clockwise from the same stated viewpoint. The source needs a wording decision before C can be taught or scored. The export carries `holds: ["source-question-conflict"]`; leave the source and answer unchanged until the owner reviews the intended text and key.

## UCEED 2016, Part A, question 62

The source asks for video formats in evolutionary order and the preserved answer key marks **A**. The printed A begins with VHS before U-matic low band. [Sony records U-matic's launch in 1971](https://www.sony.com/en/SonyInfo/CorporateInfo/History/SonyHistory/1-05.html), while [JVC records VHS in 1976](https://eu.jvc.com/about/). The only choice beginning with U-matic low band, B, puts VHS after Digibeta; [Sony records Digital Betacam in 1993](https://www.sony.com/en/SonyInfo/CorporateInfo/History/SonyHistory/2-06.html). Thus neither A nor B is a chronological sequence, and C and D also begin with later formats. The wording does not define another ordering criterion.

The export carries `holds: ["source-question-conflict"]`. Keep the preserved key unchanged while the owner reviews the intended ordering and whether a corrected option can be justified. Do not draft a student-facing solution from the keyed A or score this question while the conflict is open.

## UCEED 2016, Part A, question 74

The source asks for O to lie north-northeast of J. In all four printed diagrams O lies to the left of J; the keyed option B places it west-northwest. B fits the other relations, but no option satisfies the complete printed question. The export now carries `holds: ["source-question-conflict"]` until the source diagram or clue is corrected and reviewed.

## UCEED 2016, Part A, question 75

The keyed option D pairs the Vienna Convention with ozone protection, but pairs the Montreal Protocol with a generic sustainable-development objective. [UNEP's treaty descriptions](https://ozone.unep.org/ozone-treaties) identify both as ozone-layer agreements. The printed dates also require review against the [Kyoto Protocol](https://unfccc.int/process-and-meetings/the-kyoto-protocol) and [Convention on Wetlands](https://www.ramsar.org/about-convention-wetlands) sources. No option is fully correct as printed, so the export carries `holds: ["source-question-conflict"]`.

## UCEED 2017, Part A, question 60

The tracked export `server/data/exports/dexam-bank-export.json` labels this visual MCQ's answer **B**. [IIT Bombay's published UCEED 2017 answer-key PDF](https://www.uceed.iitb.ac.in/2027/assets/downloads/qps/UCEED2017_Answer_Key.pdf) prints **D** for Q60. The paper number and prompt match the bank entry. The PDF heading says “Final Answer Keys,” although its footer says “Draft Answer Keys”; confirm which revision is authoritative during review.

Until the original figure and authoritative key have been reviewed together, the export carries `holds: ["answer-key-conflict"]`. DMocks imports only records with an empty `holds` list. These source holds take effect on the next bank import; any already imported active question also needs a hosted local hold or a completed reimport. They change neither the stored answer nor any previously recorded attempt.

Review action: inspect the source paper figure, the key revision, and any existing attempt use; then correct the canonical answer or document why B is valid before clearing the hold. Record the owner's decision and exact source evidence.
