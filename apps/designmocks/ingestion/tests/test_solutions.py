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
    (base / "02-segments/questions.json").write_text(json.dumps({"questions": questions}))
    figures = {"questions": [
        {"key": "q1", "block": None, "figures": [{"id": "q1-fig-1", "role": "figure",
                                                  "canonical": {"file": "q1/fig-1.png", "width": 400, "height": 200}}]},
        {"key": "q2", "block": None, "figures": []}, {"key": "q3", "block": None, "figures": []}]}
    (base / "03-figures/figures.json").write_text(json.dumps(figures))
    keys = {"keys": {"q1": {"raw": "12", "status": "official-key"}, "q2": {"raw": "A,B", "status": "official-key"},
                     "q3": {"raw": "C", "status": "official-key"}}}
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

    def test_brief_has_everything_a_drafter_needs(self):
        brief = solutions.brief(self.work, PAPER, "q1")
        self.assertEqual(("NAT", "12"), (brief["type"], brief["officialKey"]["raw"]))
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

    def test_original_questions_are_checked_against_their_constructed_key(self):
        keys = json.loads((self.base / "04-key/key.json").read_text())
        keys["keys"]["q1"] = {"raw": "12", "status": "constructed"}
        (self.base / "04-key/key.json").write_text(json.dumps(keys))
        self.save("q1", NAT)  # still says official-key
        self.assertIn("answer-source-must-be-constructed", self.results()["q1"]["errors"])
        made = copy.deepcopy(NAT)
        made["answer"]["source"] = "constructed"
        self.save("q1", made)
        self.assertEqual("draft", self.results()["q1"]["status"])
        made["answer"]["value"] = "13"
        self.save("q1", made)
        self.assertIn("does-not-reach-official-key", self.results()["q1"]["errors"])

    def test_nat_ranges_and_missing_arithmetic(self):
        keys = json.loads((self.base / "04-key/key.json").read_text())
        keys["keys"]["q1"]["raw"] = "11.5 to 12.5"
        (self.base / "04-key/key.json").write_text(json.dumps(keys))
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
            "verified-needs-a-reviewer": lambda s: s["provenance"].__setitem__("status", "verified"),
            "step-overlay-missing": lambda s: s["steps"][0].__setitem__("overlay", "nowhere"),
            "overlay-viewbox-must-match-figure": lambda s: s["overlay"].__setitem__("viewBox", "0 0 800 400"),
        }
        for error, change in cases.items():
            solution = copy.deepcopy(NAT)
            change(solution)
            self.save("q1", solution)
            self.assertIn(error, self.results()["q1"]["errors"], error)

    def test_visual_solution_fields(self):
        visual = copy.deepcopy(NAT)
        visual["overlay"]["steps"]["rows"] = '<g id="row-box"><rect x="10" y="10" width="380" height="60" fill="none" stroke="#d9772b"/></g>'
        visual["steps"][0].update({"focus": [0, 0, 200, 100], "ask": "How many rows do you see?",
                                   "motion": [{"target": "row-box", "type": "draw", "duration": 800}]})
        visual["steps"][1]["motion"] = [{"target": "row-box", "type": "fold", "axis": "y", "at": 40, "duration": 1200},
                                        {"target": "row-box", "type": "move", "path": [[10, 0], [20, 5]], "duration": 900},
                                        {"target": "row-box", "type": "rotate", "angle": -90, "cx": 200, "cy": 100}]
        visual["steps"][1]["hide"] = ["rows"]
        (self.base / "05-solutions" / "q1.visual.json").write_text(json.dumps(visual))
        self.save("q1", NAT)
        report = solutions.check(self.work, PAPER)
        self.assertEqual("draft", report["results"]["q1.visual"]["status"], report["results"]["q1.visual"])
        self.assertEqual(["q1.visual"], report["visualVersions"])
        self.assertNotIn("q1.visual", report["withoutSolution"])
        broken = copy.deepcopy(visual)
        broken["steps"][0]["focus"] = [0, 0, 900, 100]                       # outside the figure
        broken["steps"][0]["motion"][0] = {"target": "nowhere", "type": "draw"}
        broken["steps"][1]["motion"][0]["axis"] = "z"
        broken["steps"][1]["motion"][1]["duration"] = 12000  # over the 10 s limit
        broken["steps"][1]["motion"][2]["type"] = "explode"
        broken["steps"][1]["hide"] = ["missing-layer"]
        broken["overlay"]["steps"]["total"] = '<text id="moving" transform="rotate(5)" x="1" y="1">12</text>'
        broken["steps"][1]["motion"].append({"target": "moving", "type": "pulse"})
        (self.base / "05-solutions" / "q1.visual.json").write_text(json.dumps(broken))
        errors = solutions.check(self.work, PAPER)["results"]["q1.visual"]["errors"]
        for error in ["step-1-focus", "step-1-motion-target", "step-2-motion-axis", "step-2-motion-duration",
                      "step-2-motion-type", "step-2-hide", "step-2-motion-target-has-transform"]:
            self.assertIn(error, errors)
        self.assertIn("overlay-value-id", solutions.overlay_problems('<g id="Bad Id"></g>'))

    def test_figure_questions_without_a_visual_are_flagged(self):
        plain = copy.deepcopy(NAT)
        del plain["overlay"]
        for step in plain["steps"]:
            step.pop("overlay")
        self.save("q1", plain)
        self.assertIn("no-visual-solution", self.results()["q1"]["warnings"])

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
        self.assertNotIn("<script>alert", page)

    def test_command_line(self):
        self.save("q1", NAT)
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            self.assertEqual(0, solutions.main(["--work", str(self.work), "check", PAPER]))
        self.assertEqual({"draft": 1, "verified": 0, "held": 0}, json.loads(out.getvalue())["byStatus"])


if __name__ == "__main__":
    unittest.main()
