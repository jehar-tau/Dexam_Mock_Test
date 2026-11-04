import importlib.util
import pathlib
import unittest

spec = importlib.util.spec_from_file_location("readiness", pathlib.Path(__file__).parents[1] / "scripts/bank_readiness.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class BankReadiness(unittest.TestCase):
    def question(self, **changes):
        return dict(type="MCQ", exam="UCEED", question_text="Original fixture", answer_key="A", answer_status="verified", explanation="Fixture explanation", options=[{"position": "A", "text": "One"}, {"position": "B", "text": "Two"}], **changes)

    def test_requires_actual_review_and_rejects_flag(self):
        self.assertIn("human-review-not-recorded", module.question_holds(self.question(), {}))
        self.assertIn("human-review-flagged", module.question_holds(self.question(), {"marked": True, "flagged": True}))
        self.assertEqual([], module.question_holds(self.question(), {"marked": True}))

    def test_never_guesses_key_or_options(self):
        q = self.question()
        q["answer_key"] = "1"
        self.assertIn("key-option-mapping-needs-review", module.question_holds(q, {"marked": True}))
        q["options"] = []
        self.assertIn("structured-options-missing-or-duplicate", module.question_holds(q, {"marked": True}))

    def test_nan_infinity_and_ranges_require_review(self):
        for value in ["NaN", "Infinity", "1-3", ""]:
            q = self.question()
            q.update(type="NAT", answer_key=value)
            self.assertIn("numeric-key-needs-explicit-range-or-value", module.question_holds(q, {"marked": True}))

    def test_drawing_is_not_objective_score(self):
        q = self.question()
        q["type"] = "DESCRIPTIVE"
        self.assertIn("drawing-needs-separate-self-review-contract", module.question_holds(q, {"marked": True}))


if __name__ == "__main__":
    unittest.main()
