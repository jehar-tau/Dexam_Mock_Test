# Answer engine worker instructions

You answer design-entrance exam questions (CEED, NID DAT, NIFT GAT) for Dexam's question bank.

## Input

A batch file is a JSON list of questions:

- `id`
- `paper`, for example `ceed-2014` or `nift-2013-written-set3`
- `questionNo`
- `type`: `MCQ` (one answer), `MSQ` (one or more answers) or `NAT` (a number)
- `image`: an absolute path to the PNG of the printed question. When it is set, open it with the Read tool. It is the source of truth and shows the options exactly as printed.
- `prompt`: OCR text, which may be noisy.
- `options`: given by position.

## Output

Write one JSON object to the results path you were given:

```json
{"<id>": {"answer": "B", "confidence": "high", "method": "solved", "source": ""}}
```

- **`answer`:**
  - **MCQ:** the position letter of the correct option. A is the first printed option, B the second, and so on, even when the paper numbers its options 1–4. So printed option (3) is `C`.
  - **MSQ:** every correct position letter, for example `"AC"`.
  - **NAT:** a number such as `"12"` or `"4.5"`, or a range such as `"12 to 13"` when the answer is a measured or estimated value.
  - If you cannot work out an answer, use `null`.
- **`confidence`:**
  - `high`: you would bet on it.
  - `medium`: you are reasonably sure.
  - `low`: a guess. Low answers are discarded, so be honest.
- **`method`:**
  - `web`: you took the answer from a published key or solution and it is consistent with the question.
  - `solved`: you worked it out yourself.
- **`source`:** the URL for a `web` answer, otherwise `""`.

Include every id from the batch, using `null` for the ones you could not answer.

## Rules

- **Solve each question yourself.** For visual puzzles, count, rotate and fold carefully and check each option. For general knowledge, answer as of the paper's year.
- **When a web-key file is given, check each answer against the question.** Keep the key's answer only when it fits (`method: "web"`). If it is clearly wrong or does not match the question, solve the question yourself instead.
- **Never open the bank database** (`dexam.sqlite`), `server/data/sources/solved/`, or any other result files. The check stage must be blind.
- **Do not use Roughworks content**, whether their website, PDFs or solutions.
- **Write only the results file you were given.** Do not edit anything else.
- **Questions without an image:** answer by position in the batch's `options` list. If that list is visibly broken (an option merged into the prompt or into another option, or an option missing), answer `null` instead of guessing where the option was printed. The question then goes back for option repair.
- **Helper scripts:** keep them in your own scratch subfolder named after your batches. Other workers run at the same time.
- **Questions that depend on missing context:** if a question cannot be understood from its own image or text, add `"needsContext": true` to its result. This covers a reading passage, a puzzle setup or seating arrangement, a symbol key, or shared directions that are not shown. The question is then held from mocks until its context is added. Still give an answer if you can work one out.
- **Fresh NIFT crops (lane `img`):** every question here has an `image`, which is the exact printed question, and the stored text is unreliable. Answer from the image only, by printed position (A = first printed option, whatever numbering the paper uses). Add `"badCrop": true` when the image is cut off, is missing the question or any option, or contains a different question's text. Add `"needsContext": true` when the question cannot be answered without a passage, setup or figure that the image does not show; a passage fragment appended below a question also counts. Give your best answer in both cases when you can.
- **Context blocks (lane `ctx`):** each image now shows the question's shared context ABOVE a thin grey rule: the printed directions ("Directions (Questions 22 - 25) : ..."), or a passage or situation, then the question itself below the rule. Use the directions to know what is asked (synonym vs antonym, which error to find, how to mark data-sufficiency answers). Answer from the whole image by printed position. `needsContext` now means the image STILL lacks something it needs (for example a passage that continues on another page, or a figure missing from the crop); do not set it just because a passage is present. Use `badCrop` for a cut-off line, a missing option, wrong text above or below, or a passage that does not match the question.
