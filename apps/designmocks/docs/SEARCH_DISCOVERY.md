# Public discovery and measurement

## Baseline · 21 November 2026, India time

DMocks by Design Exam Academy serves an original, free design entrance sample at dmocks.com. It takes six minutes, contains five visual questions, saves progress on the device and offers explanations after submission. The approved annual pass is ₹1,193 for twelve months, paid once. Public registration and checkout were closed at inspection. The first planned paid paper is UCEED Part A Practice Mock 01. NID DAT, NIFT and CEED have information pages and no released paid paper in the public offer. Interactive Learn programmes exist in the account-enabled source. Public access to the signed-in product has a separate release path. Indian examinations and INR pricing establish an India-focused offer. Customer geography has no measured baseline. [Product plan](PRODUCT_EXECUTION_PLAN.md) · [Launch evidence](LAUNCH_CHECKLIST.md)

| Item checked | Evidence before this change |
| --- | --- |
| Site and code | React, React Router and Vite in `apps/designmocks` of `jehar-tau/Dexam_Mock_Test`. GitHub main was `5394b5d0ebb7f6e592f18ede50ca3952a40ca750`. Native Sites reported public version 6 on the apex, Sites source `5be41764de49f3f82fa4532d4bbdc5bdc333a8bf`. The accepted app source for that version was `e457196519a5d87cf1bc63b5e72e1793db6dde68`. Main had a more recent landing page. |
| Crawl and links | Fourteen signed-out URLs rendered the same homepage title and canonical. The raw response had an empty application root. Both crawler files and a nonexistent URL returned homepage HTML with HTTP 200. The old refund link displayed a missing page. The www homepage forwarded temporarily, while a direct www sample link returned 404. |
| Student journey | The live sample allowed keyboard start, refresh, submit and report reload without third-party requests. Two rotation choices depicted the same answer. The saved sample validator could discard a valid attempt when the two start-time reads crossed a millisecond boundary. |
| Mobile and performance | At 375 CSS pixels, live v6's menu extended seven pixels past the viewport. A cold signed-out Chromium run measured first contentful paint at 860 ms on the 375 px viewport and 624 ms on the 1280 px viewport. These were single unthrottled lab observations. Three original font files fetched on the home page totalled 348,424 bytes before compression. The closed build from main also contained the lazy-loaded signed-in Learn programme code. |
| Search, conversion and indexing data | The connected data sources provided no matching DMocks Search Console or GA4 property. Impressions, clicks, indexed-page totals, organic landing sessions and conversions are unavailable for this baseline. The owner selected technical measurement for now. |

## What students are looking for

English Google autocomplete suggestions sampled with country set to India included “uceed part a questions”, “uceed part a mock test”, “design aptitude test questions with answers” and “design aptitude test sample papers”. Exam-specific free/PDF suggestions also surfaced. These are examples of search wording. Demand size and DMocks query performance require property data. First-person questions about mock tests and previous papers support the distinction between taking a mock and locating an official past paper. [Google autocomplete](https://support.google.com/websearch/answer/7368877) · [Student looking for UCEED mocks](https://www.reddit.com/r/uceedtakers/comments/1xlqb3b/where_to_get_mocks_for_uceed/) · [Student looking for previous papers](https://www.reddit.com/r/Indian_Academia/comments/1nx2n6b/previous_year_question_papers_for_nid_ceed_exam/)

| Student task | Public destination | Evidence for the content |
| --- | --- | --- |
| Try practice immediately and review a mistake | Free sample | Existing original five-question experience, feedback and exercises. |
| Understand what to practise for UCEED Part A | UCEED guide | Distinguishes the planned DMocks paper from the official format and directs students to the original papers. [IIT Bombay exam format](https://www.uceed.iitb.ac.in/2027/question-paper.html) · [Official downloads](https://www.uceed.iitb.ac.in/2027/downloads.html) |
| Practise independently with an explanation | Visual hierarchy exercise | Original museum-sign comparison, worked reasoning and a second sketching brief. |
| Decide whether a purchase makes sense | Catalogue and annual pass | Reviewed price, scope and availability. Exam guides outside the first offer remain directly accessible with official references and stay out of the sitemap. |

## Task ledger

| Priority | Work | Status and evidence | Blocker or owner action | Next step |
| --- | --- | --- | --- | --- |
| P0 | Public HTML, titles, canonicals, sitemap and crawler directives | Implemented on the discovery branch with build-level allowlist and isolation tests | Release status is recorded separately | Run the host verifier after each release |
| P0 | Private routes and resources | Closed build omits signed-in Learn assets. Account and result pages have empty, noindex shells. Existing paid attempts use server-authorized reads. The free, offline sample can be scored from its public client code. | Before open registration, verify delivery of any restricted static Learn resource against the intended access policy | Serve restricted lessons and media through authenticated endpoints. Recheck public indexing before switching from the informational to an account-enabled host profile |
| P0 | Correct the sample | Two valid choices get credit on the earlier edition. The new edition supplies four distinct choices. Reload uses a single six-minute deadline | None | Repeat mobile keyboard start, reload, submit and result review |
| P1 | Match public copy to product availability | Catalogue, UCEED guide and next-step links identify current access. A worked exercise is accessible without an account | Additional paid offers require an approved, released catalogue entry | Update the relevant page when the release state changes |
| P1 | Mobile resource cost and layout | Font files for the three homepage faces total 102,928 bytes in WOFF2. Existing typefaces and glyph maps are preserved. The compact header fits the intermediate phone widths | Measure audience performance after field data becomes available | Recheck at 320, 375 and 390 px and a desktop width |
| P1 | Repair www deep links | Existing registrar forwarding breaks deep links and drops query information | Access to the registrar or an approved path-preserving redirect host | Test HTTPS certificate, path and query on representative links, then switch to a permanent redirect |
| P1 | Search and conversion baseline | Technical baseline complete. Qualified-enquiry definition approved on 21 November | For a future measured comparison, read-only DMocks property access or an aggregate export, plus approved analytics provider and consent settings | Compare the first complete 28-day period after release with the preceding period where available |
| P2 | Business Profile | Online offer verified. No eligible in-person DMocks service or matching connected profile verified | Only if applicable, owner confirms how customers meet DMocks in person and identifies its existing listing | Audit that listing against verified public business details. [Eligibility](https://support.google.com/business/answer/7039811) |

## Measurement plan

**Qualified enquiry.** Count one student or guardian asking about a specific DMocks offering and requesting a reply. Staff can classify it privately when it arrives. Record subsequent messages in that conversation as follow-up. Track existing-account support separately. The current email link gives no reliable signal that a message was sent.

| Measure | Count when | Allowed detail |
| --- | --- | --- |
| Public landing view | A canonical public page opens or the student navigates to a different allowlisted public page | Fixed page key and broad channel |
| Sample start | A new attempt starts after a deliberate action | Fixed sample edition |
| Sample completion | That attempt first reaches submitted state, including expiry | Fixed sample edition. A refresh or a reopened report contributes no second completion |
| Account created | Future registration service confirms the first successful creation | Aggregate count |
| Enquiry received / qualified | Staff receive an enquiry, then classify it using the approved definition | Weekly counts, fixed offering category, and separate support/follow-up counts |
| Checkout initiated / purchase confirmed | Future checkout accepts a new order, then the server verifies a successful payment | Aggregate step counts. Confirmation comes from the verified server event |

Keep the public site free of analytics requests until DMocks confirms a provider, purposes, consent settings, retention and access. Where consent is needed, collect only after an affirmative choice, stop on withdrawal, and keep the sample functional throughout. Limit future analytics parameters to fixed values. Exclude contact details, student IDs, answers, scores, free text, exact private paths, email links, query strings and URL fragments. Keep deduplication in first-party application state. Disable automatic full-URL/form capture and session replay. Test granted, declined and withdrawn states with synthetic sessions and inspect outgoing payloads before activation.

Report organic landing-to-start and start-to-completion rates from the same consented population and period. Use received enquiries as the denominator for the qualified share. Show small or unavailable counts as such and separate support demand. Never link Search Console queries to individual students. Record aggregate impressions, clicks and indexed canonical pages privately once the correct property is connected. [Search Console performance report](https://support.google.com/webmasters/answer/7576553)

## Release and maintenance

Use the closed informational build on the existing public Site. Set its static missing-page handling to `404-page`. Preserve the separate private and account-enabled deployment profiles. Run the repository checks, then `npm run search:verify-host` against the deployed origin. It checks the actual HTTP responses, canonical URLs, sitemap, raw headings, structured data and private-page directives with JavaScript disabled. Check the sample with JavaScript enabled and test a missing URL, a deep link, keyboard controls and mobile reflow. Keep release SHA, native Sites version and verification result together in the release record.

- **Weekly.** Run the host check, review newly broken links, and triage indexing errors and unexplained conversion changes when data is available.
- **Monthly.** Review a complete 28-day period by query intent and landing page. Check mobile loading, sample completion, and one area where students appear to get stuck.
- **Before each exam cycle.** Recheck the official exam links and formats. Update the checked date when somebody actually reviews the source. Publish newly approved offerings only after the catalogue and entitlement paths are verified.
- **Quarterly.** Recheck accessibility and consent behavior, test signed-out access and restricted resources, review outdated pages, and reconcile the ledger against live behavior and qualified enquiries.
