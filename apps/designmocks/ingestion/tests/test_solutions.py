"""Stage 5 solution tests. Every question and solution here is fictional."""

import contextlib
import copy
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest

from PIL import Image

HERE = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("solutions", HERE / "solutions.py")
solutions = importlib.util.module_from_spec(spec)
spec.loader.exec_module(solutions)

PAPER = "uceed-2031"


def build_work(root):
    base = root / PAPER
    for stage in ("02-segments", "03-figures/q1", "04-key", "05-solutions"):
        (base / stage).mkdir(parents=True)
    Image.new("RGB", (400, 200), "white").save(base / "03-figures/q1/fig-1.png")
    questions = [
        {"key": "q1", "part": "A", "type": "NAT", "prompt": "How many fictional squares are shown?", "options": [], "flags": []},
        {"key": "q2", "part": "A", "type": "MSQ", "prompt": "Which fictional fruits are yellow?", "flags": [],
         "options": [{"key": k, "text": t} for k, t in zip("ABCD", ["Banana", "Lemon", "Plum", "Grape"])]},
        {"key": "q3", "part": "A", "type": "MCQ", "prompt": "Which fictional city is the capital?", "flags": [],
         "options": [{"key": k, "text": t} for k, t in zip("ABCD", ["Alpha", "Beta", "Gamma", "Delta"])]},
    ]
    segments = base / "02-segments/questions.json"
    segments.write_text(json.dumps({"questions": questions}))
    segment_hash = solutions.sha256(segments.read_bytes())
    figure_hash = solutions.sha256((base / "03-figures/q1/fig-1.png").read_bytes())
    figures = {"questions": [
        {"key": "q1", "block": None, "figures": [{"id": "q1-fig-1", "role": "figure",
                                                  "canonical": {"file": "q1/fig-1.png", "width": 400, "height": 200,
                                                                "sha256": figure_hash}}]},
        {"key": "q2", "block": None, "figures": []}, {"key": "q3", "block": None, "figures": []}],
        "segmentsSha256": segment_hash}
    (base / "03-figures/figures.json").write_text(json.dumps(figures))
    original = base / "04-key/source/fictional-key.pdf"
    original.parent.mkdir()
    original.write_bytes(b"Fictional source bytes used to exercise provenance checks")
    keys = {"paperId": PAPER, "source": {"name": original.name, "sha256": solutions.sha256(original.read_bytes())},
            "segmentsSha256": segment_hash, "keys": {
                question["key"]: {"raw": value, "printed": value, "kind": question["type"],
                                  "status": "official-key", "page": 1, "readBy": "text", "checks": []}
                for question, value in zip(questions, ("12", "A,B", "C"))
            }}
    (base / "04-key/key.json").write_text(json.dumps(keys))
    return base


NAT = {
    "schema": 1,
    "answer": {"value": "12", "source": "official-key"},
    "keyIdea": "Count the squares row by row instead of all at once.",
    "steps": [{"text": "The grid has 3 rows of 4 squares.", "overlay": "rows"},
              {"text": "3 × 4 = 12 squares.", "overlay": "total"}],
    "overlay": {"figure": "q1-fig-1", "viewBox": "0 0 400 200",
                "steps": {"rows": '<rect x="10" y="10" width="380" height="60" fill="none" stroke="#d9772b" stroke-width="4"/>',
                          "total": '<text x="200" y="190" font-size="24" text-anchor="middle" fill="#2f5d46">12</text>'}},
    "meta": {"topic": "counting", "difficulty": "easy", "seconds": 40, "technique": "group-and-multiply"},
    "provenance": {"draftedBy": "claude-local-session", "reviewedBy": None, "status": "draft"},
}
MSQ = {
    "schema": 1, "answer": {"value": "A,B", "source": "official-key"},
    "keyIdea": "Picture each fruit when ripe.",
    "steps": [{"text": "Bananas and lemons ripen yellow; plums and grapes do not."}],
    "optionCheck": [{"option": "A", "verdict": "correct", "why": "Ripe bananas are yellow."},
                    {"option": "B", "verdict": "correct", "why": "Lemons are yellow."},
                    {"option": "C", "verdict": "wrong", "why": "Plums are purple or red."},
                    {"option": "D", "verdict": "wrong", "why": "Grapes are green or purple."}],
    "meta": {"topic": "general-awareness", "difficulty": "easy", "seconds": 20},
    "provenance": {"draftedBy": "claude-local-session", "status": "draft"},
}


class SolutionsTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.work = pathlib.Path(self.temp.name)
        self.base = build_work(self.work)

    def tearDown(self):
        self.temp.cleanup()

    def save(self, key, solution):
        (self.base / "05-solutions" / f"{key}.json").write_text(json.dumps(solution))

    def results(self):
        return solutions.check(self.work, PAPER)["results"]

    def change_key(self, key, **changes):
        path = self.base / "04-key/key.json"
        manifest = json.loads(path.read_text())
        manifest["keys"][key].update(changes)
        path.write_text(json.dumps(manifest))

    def test_brief_has_everything_a_drafter_needs(self):
        brief = solutions.brief(self.work, PAPER, "q1")
        self.assertEqual(("NAT", "12"), (brief["type"], brief["officialKey"]["raw"]))
        self.assertEqual(("12", 1, "text"), tuple(brief["officialKey"][k] for k in ("printed", "page", "readBy")))
        self.assertTrue(brief["officialKey"]["verifiedKey"])
        self.assertEqual({"source": "official-key", "value": None}, brief["draftTemplate"]["answer"])
        self.assertEqual(["q1-fig-1"], [f["id"] for f in brief["figures"]])
        self.assertTrue(pathlib.Path(brief["figures"][0]["file"]).exists())
        with self.assertRaisesRegex(solutions.SolutionError, "No question"):
            solutions.brief(self.work, PAPER, "q9")

    def test_valid_drafts_pass_and_stay_drafts(self):
        self.save("q1", NAT)
        self.save("q2", MSQ)
        report = solutions.check(self.work, PAPER)
        self.assertEqual({"draft": 2, "verified": 0, "held": 0}, report["byStatus"])
        self.assertTrue(report["results"]["q1"]["reachesKey"])
        self.assertEqual([], report["eligibleForExport"])
        self.assertEqual(["q3"], report["withoutSolution"])
        self.assertTrue((self.base / "05-solutions/check.json").exists())

    def test_a_solution_that_misses_the_official_key_is_held(self):
        wrong = copy.deepcopy(NAT)
        wrong["answer"]["value"] = "13"
        self.save("q1", wrong)
        result = self.results()["q1"]
        self.assertEqual(("held", False), (result["status"], result["reachesKey"]))
        self.assertIn("does-not-reach-official-key", result["errors"])
        notation = copy.deepcopy(MSQ)
        notation["answer"]["value"] = "B A"  # same answer, other notation
        self.save("q2", notation)
        self.assertEqual("draft", self.results()["q2"]["status"])

    def test_nat_ranges_and_missing_arithmetic(self):
        self.change_key("q1", raw="11.5 to 12.5", printed="11.5 - 12.5")
        self.save("q1", NAT)  # 12 lies inside the accepted range
        self.assertTrue(self.results()["q1"]["reachesKey"])
        outside = copy.deepcopy(NAT)
        outside["answer"]["value"] = "12.6"
        self.save("q1", outside)
        self.assertEqual("held", self.results()["q1"]["status"])
        plain = copy.deepcopy(NAT)
        plain["steps"][1] = {"text": "So there are twelve.", "overlay": "total"}
        self.save("q1", plain)
        result = self.results()["q1"]
        self.assertEqual(("draft", ["nat-shows-no-arithmetic"]), (result["status"], result["warnings"]))

    def test_choice_questions_must_judge_every_option_consistently(self):
        partial = copy.deepcopy(MSQ)
        partial["optionCheck"] = partial["optionCheck"][:3]
        self.save("q2", partial)
        self.assertIn("option-check-must-cover-every-option", self.results()["q2"]["errors"])
        flipped = copy.deepcopy(MSQ)
        flipped["optionCheck"][2]["verdict"] = "correct"
        self.save("q2", flipped)
        self.assertIn("option-verdicts-disagree-with-key", self.results()["q2"]["errors"])

    def test_format_rules(self):
        cases = {
            "step-1-too-long": lambda s: s["steps"][0].__setitem__("text", "word " * 50),
            "meta-difficulty": lambda s: s["meta"].__setitem__("difficulty", "tricky"),
            "provenance-drafter-required": lambda s: s["provenance"].__setitem__("draftedBy", ""),
            "step-overlay-missing": lambda s: s["steps"][0].__setitem__("overlay", "nowhere"),
            "overlay-viewbox-must-match-figure": lambda s: s["overlay"].__setitem__("viewBox", "0 0 800 400"),
        }
        for error, change in cases.items():
            solution = copy.deepcopy(NAT)
            change(solution)
            self.save("q1", solution)
            self.assertIn(error, self.results()["q1"]["errors"], error)

    def test_overlays_can_only_draw(self):
        for fragment, problem in [
            ('<script>alert(1)</script>', "overlay-element-script"),
            ('<image href="https://example.invalid/x.png"/>', "overlay-element-image"),
            ('<circle cx="5" cy="5" r="3" onclick="x()"/>', "overlay-attribute-onclick"),
            ('<rect width="5" height="5" fill="url(#a)"/>', "overlay-value-fill"),
            ('<circle cx="5"', "overlay-not-well-formed"),
        ]:
            self.assertIn(problem, solutions.overlay_problems(fragment), fragment)
        self.assertEqual([], solutions.overlay_problems(NAT["overlay"]["steps"]["rows"]))

    def test_review_page_draws_steps_over_the_figure(self):
        self.save("q1", NAT)
        self.save("q2", MSQ)
        summary = solutions.render(self.work, PAPER)
        page = pathlib.Path(summary["page"]).read_text()
        self.assertIn('src="../03-figures/q1/fig-1.png"', page)
        self.assertEqual(2, page.count('class="layer"'))
        self.assertIn("Step 1 of", page.split("<script>")[1].replace("${at+1}", "1"))
        self.assertIn("Plums are purple or red.", page)
        self.assertIn("fictional-key.pdf#page=1", page)
        self.assertIn(self.results()["q1"]["fingerprint"], page)
        self.assertNotIn("<script>alert", page)

    def test_inferred_key_number_is_clearly_marked_for_visual_review(self):
        self.save("q1", NAT)
        self.change_key("q1", notes=["question-number-inferred-from-grid",
                                     "consecutive-row-run-needs-visual-review"])
        page = pathlib.Path(solutions.render(self.work, PAPER)["page"]).read_text()
        self.assertIn("Source-linked OCR key; visually review its inferred question number", page)
        self.assertNotIn("Verified official key", page)

    def test_cropped_key_number_is_clearly_marked_for_visual_review(self):
        self.save("q1", NAT)
        self.change_key("q1", readBy="crop-ocr", notes=["two-crop-ocr-agreement-needs-visual-review"])
        page = pathlib.Path(solutions.render(self.work, PAPER)["page"]).read_text()
        self.assertIn("Source-linked cropped OCR key; visually review its printed number", page)

    def test_human_approval_is_separate_and_bound_to_reviewed_inputs(self):
        draft = copy.deepcopy(NAT)
        draft["provenance"].update(status="verified", reviewedBy="Model claimed a reviewer")
        self.save("q1", draft)
        review = self.results()["q1"]
        self.assertEqual("draft", review["status"])
        self.assertIn("inline-review-ignored", review["warnings"])
        self.assertFalse(review["eligibleForExport"])
        with self.assertRaisesRegex(solutions.SolutionError, "fingerprint changed"):
            solutions.approve(self.work, PAPER, "q1", "Human reviewer", "stale")
        solutions.approve(self.work, PAPER, "q1", "Human reviewer", review["fingerprint"])
        report = solutions.check(self.work, PAPER)
        self.assertEqual(["q1"], report["eligibleForExport"])
        self.assertEqual("Human reviewer", report["results"]["q1"]["reviewedBy"])
        draft["steps"][0]["text"] = "This change needs a separate review."
        self.save("q1", draft)
        self.assertFalse(self.results()["q1"]["eligibleForExport"])
        self.assertIn("review-no-longer-matches", self.results()["q1"]["warnings"])

    def test_changed_key_evidence_or_figure_clears_export_eligibility(self):
        self.save("q1", NAT)
        review = self.results()["q1"]
        solutions.approve(self.work, PAPER, "q1", "Human reviewer", review["fingerprint"])
        self.change_key("q1", printed="12.0")
        changed = self.results()["q1"]
        self.assertFalse(changed["eligibleForExport"])
        self.assertNotEqual(review["fingerprint"], changed["fingerprint"])
        solutions.approve(self.work, PAPER, "q1", "Human reviewer", changed["fingerprint"])
        Image.new("RGB", (400, 200), "black").save(self.base / "03-figures/q1/fig-1.png")
        self.assertIn("figure-evidence-needs-review", self.results()["q1"]["errors"])
        self.assertFalse(self.results()["q1"]["eligibleForExport"])

    def test_missing_key_supports_proposed_draft_without_promoting_it(self):
        (self.base / "04-key/key.json").unlink()
        brief = solutions.brief(self.work, PAPER, "q2")
        self.assertEqual({"source": "model-proposed", "value": None}, brief["draftTemplate"]["answer"])
        proposed = copy.deepcopy(MSQ)
        self.save("q2", proposed)
        self.assertIn("answer-source-must-be-model-proposed", self.results()["q2"]["errors"])
        proposed["answer"]["source"] = "model-proposed"
        self.save("q2", proposed)
        draft = self.results()["q2"]
        self.assertEqual(("draft", None, False), (draft["status"], draft["reachesKey"], draft["eligibleForExport"]))
        with self.assertRaisesRegex(solutions.SolutionError, "verified official key"):
            solutions.approve(self.work, PAPER, "q2", "Human reviewer", draft["fingerprint"])
        page = pathlib.Path(solutions.render(self.work, PAPER)["page"]).read_text()
        self.assertIn("Proposed answer", page)
        proposed["optionCheck"][0]["verdict"] = "wrong"
        self.save("q2", proposed)
        self.assertIn("option-verdicts-disagree-with-answer", self.results()["q2"]["errors"])

    def test_untrusted_official_key_and_dropped_question_are_held(self):
        self.save("q1", NAT)
        self.change_key("q1", printed="13")
        self.assertIn("official-key-evidence-needs-review", self.results()["q1"]["errors"])
        self.change_key("q1", printed="12")
        self.change_key("q1", checks=["key-section-MCQ-but-question-NAT"])
        self.assertIn("official-key-evidence-needs-review", self.results()["q1"]["errors"])
        self.change_key("q1", checks=[])
        (self.base / "04-key/source/fictional-key.pdf").write_bytes(b"Changed source")
        self.assertIn("official-key-evidence-needs-review", self.results()["q1"]["errors"])
        self.change_key("q1", status="dropped")
        self.assertIn("official-key-dropped", self.results()["q1"]["errors"])

    def test_ambiguous_key_or_changed_segmentation_requires_new_evidence(self):
        self.save("q1", NAT)
        path = self.base / "04-key/key.json"
        manifest = json.loads(path.read_text())
        manifest["report"] = {"issues": [{"key": "q1", "issue": "printed-twice"}]}
        path.write_text(json.dumps(manifest))
        self.assertIn("official-key-evidence-needs-review", self.results()["q1"]["errors"])
        manifest.pop("report")
        manifest["segmentsSha256"] = "old-content"
        path.write_text(json.dumps(manifest))
        self.assertIn("official-key-evidence-needs-review", self.results()["q1"]["errors"])

    def test_one_alternative_is_accepted_for_verified_choice_key(self):
        self.change_key("q2", raw="A,B or A,C", printed="AB or AC")
        self.save("q2", MSQ)
        self.assertTrue(self.results()["q2"]["reachesKey"])
        self.assertTrue(self.results()["q2"]["reviewable"])

    def test_review_reports_malformed_draft_without_losing_valid_cards(self):
        self.save("q1", {"steps": [None]})
        self.save("q2", MSQ)
        page = pathlib.Path(solutions.render(self.work, PAPER)["page"]).read_text()
        self.assertIn("invalid-steps", page)
        self.assertIn("Plums are purple or red.", page)

    def test_command_line(self):
        self.save("q1", NAT)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(0, solutions.main(["--work", str(self.work), "check", PAPER]))
        self.assertEqual({"draft": 1, "verified": 0, "held": 0}, json.loads(out.getvalue())["byStatus"])


if __name__ == "__main__":
    unittest.main()
