# Fresh parallel questions for All India mocks

Claude's ingestion and generation process supplies new questions to the same private canonical import, with an empty `holds` list and stable `externalKey`. A generated question must name its reviewed source question in its canonical payload:

```json
{"provenance":{"kind":"parallel","generatedFrom":"uceed-2023-q1"}}
```

The generated row needs a reviewed objective runtime (`mcq`, `msq` or `nat`), a worked explanation, and its own `key.sourceExternalKey` equal to its new `externalKey`. Figure bytes must be registered in the private `paper-media` bucket. Import and runtime materialization alone do not make it available to students.

After a human checks the new question, its answer, explanation, rights and source relationship, the server operator uses the service-only `register_parallel_question(external_key, content_sha256, source_external_key, source_year_paper_id, review_note)` RPC. The `content_sha256` is the exact reviewed canonical version. The source question must belong to a complete released year paper. Registration is idempotent only for the same exact receipt.

The All India scheduler draws only unallocated, currently ready registered parallel questions. It freezes one objective paper for the cohort and permanently assigns its selected source IDs to that event. A later event cannot reuse them. If a generated question is held, its media disappears, its reviewed content changes, or its source year paper is withdrawn, new cohort starts pause while existing student attempt snapshots stay readable. Year-paper originals never enter this All India pool. Exam-wise reuse is a separate post-results step.
