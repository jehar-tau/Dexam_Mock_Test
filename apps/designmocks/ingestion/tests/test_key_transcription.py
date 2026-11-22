"""Manual key proposal and approval tests with fictional source material."""

import json
import pathlib
import sys
import tempfile
import unittest

import fitz

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import key_transcription as kt
import solutions


class KeyTranscriptionTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.work = pathlib.Path(self.temp.name)
        self.paper = self.work / "uceed-2031"
        source_dir = self.paper / "04-key/source"
        source_dir.mkdir(parents=True)
        source = source_dir / "fictional-key.pdf"
        with fitz.open() as doc:
            page = doc.new_page(width=400, height=300)
            page.insert_text((100, 112), "Q1 12", fontsize=12)
            page.insert_text((100, 162), "Q2 C", fontsize=12)
            doc.save(source)
        segment_path = self.paper / "02-segments/questions.json"
        segment_path.parent.mkdir(parents=True)
        self.questions = [
            {"key": "q1", "number": 1, "part": "A", "type": "NAT"},
            {"key": "q2", "number": 2, "part": "A", "type": "MCQ"},
        ]
        segment_path.write_text(json.dumps({"questions": self.questions}))
        self.manifest = {"paperId": "uceed-2031", "segmentsSha256": kt.ak.sha256(segment_path.read_bytes()),
                         "source": {"name": source.name, "sha256": kt.ak.sha256(source.read_bytes())},
                         "report": {"keysRead": 2, "missing": [], "statuses": {"missing": 1, "unreadable": 1},
                                    "bank": {"different": 2}, "issues": []},
                         "keys": {
                             "q1": {"status": "missing", "raw": None, "printed": "", "kind": "NAT", "page": 1,
                                    "cell": [90, 95, 180, 120], "span": [90, 95, 180, 120], "checks": [], "bank": "different"},
                             "q2": {"status": "unreadable", "raw": None, "printed": "?", "kind": "MCQ", "page": 1,
                                    "cell": [90, 145, 180, 170], "span": [90, 145, 180, 170], "checks": [], "bank": "different"},
                         }}
        self.key_path = self.paper / "04-key/key.json"
        self.key_path.write_text(json.dumps(self.manifest))
        self.decisions_path = self.work / "decisions.json"
        self.decisions_path.write_text(json.dumps({"schema": 1, "paperId": "uceed-2031",
                                                   "sourceSha256": self.manifest["source"]["sha256"],
                                                   "entries": [{"key": "q1", "printed": "12"},
                                                               {"key": "q2", "printed": "C"}]}))

    def tearDown(self):
        self.temp.cleanup()

    def prepare(self):
        return kt.prepare(self.work, "uceed-2031", self.decisions_path)

    def test_prepare_is_read_only_and_approval_binds_exact_evidence(self):
        original = self.key_path.read_bytes()
        proposal = self.prepare()
        self.assertEqual(original, self.key_path.read_bytes())
        self.assertIn("Proposed printed value", pathlib.Path(proposal["page"]).read_text())
        self.assertTrue((pathlib.Path(proposal["page"]).parent / "q1.png").is_file())
        with self.assertRaisesRegex(kt.ReviewError, "reviewed private proposal"):
            kt.approve(self.work, "uceed-2031", proposal["packet"], "0" * 64, "Owner")
        result = kt.approve(self.work, "uceed-2031", proposal["packet"], proposal["fingerprint"], "Owner",
                            bank_questions={"q1": {"answer": {"raw": "12", "status": "official-key"}},
                                            "q2": {"answer": {"raw": "C", "status": "official-key"}}})
        self.assertEqual(2, result["approved"])
        current = json.loads(self.key_path.read_text())
        self.assertEqual({"official-key": 2}, current["report"]["statuses"])
        self.assertEqual({"same": 2}, current["report"]["bank"])
        for key, answer in (("q1", "12"), ("q2", "C")):
            record = current["keys"][key]
            self.assertEqual((answer, "human-transcription"), (record["raw"], record["readBy"]))
            self.assertTrue(kt.valid_review(self.paper, current, key, record))
            self.assertTrue(solutions.official_record(current, key, self.questions[int(key[1:]) - 1], True, self.paper)["verifiedKey"])
        receipt = pathlib.Path(result["receipt"])
        receipt.write_text(receipt.read_text().replace("Owner", "Someone else"))
        self.assertFalse(kt.valid_review(self.paper, current, "q1", current["keys"]["q1"]))
        self.assertFalse(solutions.official_record(current, "q1", self.questions[0], True, self.paper)["verifiedKey"])

    def test_stale_proposal_cannot_approve_changed_key_or_pdf(self):
        proposal = self.prepare()
        self.manifest["keys"]["q1"]["printed"] = "changed"
        self.key_path.write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(kt.ReviewError, "changed"):
            kt.approve(self.work, "uceed-2031", proposal["packet"], proposal["fingerprint"], "Owner")

    def test_prepare_refuses_an_existing_official_key_and_duplicate_question(self):
        self.manifest["keys"]["q1"]["status"] = "official-key"
        self.key_path.write_text(json.dumps(self.manifest))
        with self.assertRaisesRegex(kt.ReviewError, "not an unresolved"):
            self.prepare()
        self.manifest["keys"]["q1"]["status"] = "missing"
        self.key_path.write_text(json.dumps(self.manifest))
        decisions = json.loads(self.decisions_path.read_text())
        decisions["entries"].append({"key": "q1", "printed": "12"})
        self.decisions_path.write_text(json.dumps(decisions))
        with self.assertRaisesRegex(kt.ReviewError, "unique"):
            self.prepare()


if __name__ == "__main__":
    unittest.main()
