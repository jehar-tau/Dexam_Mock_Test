"""Private answer-key source-review tests with fictional PDF evidence."""

import json
import pathlib
import sys
import tempfile
import unittest

import fitz

HERE = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(HERE))
import key_review


class KeyReviewTest(unittest.TestCase):
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
        segment = self.paper / "02-segments/questions.json"
        segment.parent.mkdir(parents=True)
        segment.write_text(json.dumps({"questions": [
            {"key": "q1", "number": 1, "part": "A", "type": "NAT"},
            {"key": "q2", "number": 2, "part": "A", "type": "MCQ"},
        ]}))
        self.manifest = {"paperId": "uceed-2031", "segmentsSha256": key_review.ak.sha256(segment.read_bytes()),
                         "source": {"name": source.name, "sha256": key_review.ak.sha256(source.read_bytes())},
                         "keys": {
                             "q1": {"status": "official-key", "raw": "12", "printed": "12", "page": 1,
                                    "cell": [90, 95, 180, 120], "span": [90, 95, 180, 120],
                                    "notes": ["two-crop-ocr-agreement-needs-visual-review"]},
                             "q2": {"status": "missing", "raw": None, "printed": "<script>x</script>", "page": 1,
                                    "cell": [90, 145, 180, 170], "span": [90, 145, 180, 170],
                                    "notes": ["empty-cell"]},
                         }}
        self.key_path = self.paper / "04-key/key.json"
        self.key_path.write_text(json.dumps(self.manifest))

    def tearDown(self):
        self.temp.cleanup()

    def test_renders_only_unresolved_and_review_marked_cells_with_source_crops(self):
        result = key_review.render(self.work, "uceed-2031")
        self.assertEqual((2, 1), (result["needsReview"], result["unresolved"]))
        output = pathlib.Path(result["page"])
        page = output.read_text()
        self.assertIn("Q1", page)
        self.assertIn("Q2", page)
        self.assertIn("&lt;script&gt;x&lt;/script&gt;", page)
        self.assertNotIn("<script>x</script>", page)
        self.assertTrue((output.parent / "q1.png").is_file())
        self.assertTrue((output.parent / "q2.png").is_file())

    def test_refuses_changed_source_or_segments(self):
        source = self.paper / "04-key/source/fictional-key.pdf"
        source.write_bytes(source.read_bytes() + b"changed")
        with self.assertRaisesRegex(key_review.ReviewError, "PDF changed"):
            key_review.render(self.work, "uceed-2031")
        self.manifest["source"]["sha256"] = key_review.ak.sha256(source.read_bytes())
        self.key_path.write_text(json.dumps(self.manifest))
        segment = self.paper / "02-segments/questions.json"
        segment.write_text(segment.read_text() + " ")
        with self.assertRaisesRegex(key_review.ReviewError, "does not match"):
            key_review.render(self.work, "uceed-2031")

    def test_invalid_cell_box_stays_listed_without_a_crop(self):
        self.manifest["keys"]["q2"]["cell"] = [0, 0, 500, 300]
        self.manifest["keys"]["q2"]["span"] = [0, 0, 500, 300]
        self.key_path.write_text(json.dumps(self.manifest))
        result = key_review.render(self.work, "uceed-2031")
        page = pathlib.Path(result["page"])
        self.assertIn("Q2", page.read_text())
        self.assertFalse((page.parent / "q2.png").exists())


if __name__ == "__main__":
    unittest.main()
