"""Batch handoff tests use only fictional papers and keys."""

import copy
import json
import pathlib
import sys
import tempfile
import unittest

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
from test_solutions import MSQ, PAPER, build_work  # noqa: E402
import solution_batch  # noqa: E402


class SolutionBatchTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.work = pathlib.Path(self.temp.name)
        self.base = build_work(self.work)

    def tearDown(self):
        self.temp.cleanup()

    def response_file(self, packet, answer="A,B"):
        response = {"paperId": PAPER, "batchId": packet["batchId"], "answers": [{
            "key": "q2", "answer": answer, "keyIdea": MSQ["keyIdea"],
            "steps": MSQ["steps"], "optionCheck": MSQ["optionCheck"], "meta": MSQ["meta"],
        }]}
        path = self.work / "model-responses.json"
        path.write_text(json.dumps(response))
        return path

    def make_packet(self):
        result = solution_batch.queue(self.work, PAPER, limit=1, text_only=True)
        return pathlib.Path(result["packet"]), json.loads(pathlib.Path(result["packet"]).read_text())

    def test_queue_is_key_blind_and_skips_visual_question(self):
        path, packet = self.make_packet()
        self.assertEqual(["q2"], [q["key"] for q in packet["questions"]])
        self.assertEqual([], packet["questions"][0]["figures"])
        self.assertNotIn("officialKey", path.read_text())
        self.assertNotIn("printed", path.read_text())
        self.assertEqual(str(path), solution_batch.queue(self.work, PAPER, 1, True)["packet"])
        visual = solution_batch.queue(self.work, PAPER, limit=1)
        self.assertEqual("q1", json.loads(pathlib.Path(visual["packet"]).read_text())["questions"][0]["key"])

    def test_import_creates_private_draft_without_approval(self):
        path, packet = self.make_packet()
        result = solution_batch.ingest(self.work, PAPER, path, self.response_file(packet), "local-test-model")
        self.assertEqual((1, 1, 0), (result["imported"], result["draft"], result["held"]))
        draft = json.loads((self.base / "05-solutions/q2.json").read_text())
        self.assertEqual("official-key", draft["answer"]["source"])
        self.assertEqual("draft", draft["provenance"]["status"])
        self.assertFalse(solution_batch.solutions.check(self.work, PAPER)["results"]["q2"]["eligibleForExport"])
        with self.assertRaisesRegex(solution_batch.BatchError, "Draft or review already exists"):
            solution_batch.ingest(self.work, PAPER, path, self.response_file(packet), "local-test-model")
        (self.base / "05-solutions/q2.json").unlink()
        review = self.base / "06-review/q2.json"
        review.parent.mkdir()
        review.write_text('{"decision":"approve"}')
        with self.assertRaisesRegex(solution_batch.BatchError, "Draft or review already exists"):
            solution_batch.ingest(self.work, PAPER, path, self.response_file(packet), "local-test-model")

    def test_wrong_answer_is_held_with_a_visible_reason(self):
        path, packet = self.make_packet()
        result = solution_batch.ingest(self.work, PAPER, path, self.response_file(packet, "C"), "local-test-model")
        self.assertEqual((0, 1), (result["draft"], result["held"]))
        draft = json.loads((self.base / "05-solutions/q2.json").read_text())
        self.assertEqual("held", draft["provenance"]["status"])
        self.assertIn("does-not-reach-official-key", draft["reviewNote"])
        self.assertFalse(solution_batch.solutions.check(self.work, PAPER)["results"]["q2"]["eligibleForExport"])

    def test_changed_key_or_tampered_packet_is_rejected_without_writing(self):
        path, packet = self.make_packet()
        response = self.response_file(packet)
        key_path = self.base / "04-key/key.json"
        key = json.loads(key_path.read_text())
        key["keys"]["q2"]["printed"] = "A,C"
        key_path.write_text(json.dumps(key))
        with self.assertRaisesRegex(solution_batch.BatchError, "evidence changed"):
            solution_batch.ingest(self.work, PAPER, path, response, "local-test-model")
        self.assertFalse((self.base / "05-solutions/q2.json").exists())
        key["keys"]["q2"]["printed"] = "A,B"
        key_path.write_text(json.dumps(key))
        changed = copy.deepcopy(packet)
        changed["questions"][0]["prompt"] = "Different prompt"
        path.write_text(json.dumps(changed))
        with self.assertRaisesRegex(solution_batch.BatchError, "packet changed"):
            solution_batch.ingest(self.work, PAPER, path, response, "local-test-model")

    def test_malformed_response_refuses_to_write_a_draft(self):
        path, packet = self.make_packet()
        response = self.response_file(packet)
        payload = json.loads(response.read_text())
        payload["answers"][0]["key"] = {"unexpected": "object"}
        response.write_text(json.dumps(payload))
        with self.assertRaisesRegex(solution_batch.BatchError, "question key"):
            solution_batch.ingest(self.work, PAPER, path, response, "local-test-model")
        self.assertFalse((self.base / "05-solutions/q2.json").exists())


if __name__ == "__main__":
    unittest.main()
