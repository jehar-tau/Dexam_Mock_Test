"""Synthetic ordered page photos for the local segmentation and figure stages."""

import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from PIL import Image

HERE = Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


intake, segment, figures = (load(name) for name in ("intake", "segment", "figures"))
PAPER_ID = "uceed-2031"


def line(text, x, top, width):
    return {"text": text, "x": x, "y": 0.98 - top, "w": width, "h": 0.02}


class PhotoPipelineTest(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.work = self.root / "work"
        self.base = self.work / PAPER_ID
        photos = []
        for size, colour, name in [
            ((1200, 1000), "white", "z-first.png"),
            ((600, 400), "purple", "a-continuation.png"),
            ((1800, 1000), "white", "m-last.png"),
        ]:
            photo = self.root / name
            Image.new("RGB", size, colour).save(photo)
            photos.append(photo)
        intake.run_intake(exam="uceed", year=2031, work=self.work, photos=photos)
        self.intake_dir = self.base / "01-intake"
        self.pages = json.loads((self.intake_dir / "paper.json").read_text())["pages"]
        self.layout_path = self.root / "layout.json"
        self.layout = {"pages": [
            {"page": page["page"], "renderSha256": page["renderSha256"],
             "figures": [[10, 40, 110, 120]] if page["page"] == 2 else []}
            for page in self.pages
        ]}
        self.write_layout()

    def write_layout(self):
        self.layout_path.write_text(json.dumps(self.layout))

    def ocr(self, image_path):
        return {
            "page-001": [
                line("Section 1: Numerical Answer (NAT)", 0.06, 0.10, 0.6),
                line("Q.1", 0.06, 0.20, 0.035),
                line("Count the marks on the next page.", 0.13, 0.20, 0.6),
            ],
            "page-002": [],
            "page-003": [line("Q.2 How many marks remain?", 0.15, 0.12, 0.5)],
        }[image_path.stem]

    def run_segment(self, *, reviewed=True):
        segment.run_segment(work=self.work, paper_id=PAPER_ID, ocr=self.ocr, replace=True,
                            photo_layout=self.layout_path if reviewed else None)
        return json.loads((self.base / "02-segments" / "questions.json").read_text())

    def run_figures(self):
        with patch.object(figures.shutil, "which", return_value=None):
            figures.run_figures(work=self.work, paper_id=PAPER_ID, replace=True, ocr=lambda path: [])
        return json.loads((self.base / "03-figures" / "figures.json").read_text())

    def test_ordered_photos_keep_a_figure_only_continuation_and_exact_pixels(self):
        segments = self.run_segment()
        first, second = segments["questions"]
        self.assertEqual(("q1", "q2"), (first["key"], second["key"]))
        self.assertEqual("Count the marks on the next page.", first["prompt"])
        self.assertEqual([], first["flags"])
        self.assertEqual([1, 2, 3], [region["page"] for region in first["regions"]])
        rendered = self.run_figures()["questions"][0]
        self.assertEqual("photo-render", rendered["block"]["source"])
        self.assertEqual([1, 2, 3], [region["page"] for region in rendered["block"]["regions"]])
        figure = rendered["figures"][0]["canonical"]
        self.assertEqual(self.pages[1]["renderSha256"], figure["crop"]["renderSha256"])
        self.assertEqual([10, 40, 110, 120], figure["crop"]["box"])
        with Image.open(self.base / "03-figures" / figure["file"]) as image:
            self.assertEqual((100, 80), image.size)
            self.assertEqual(Image.new("RGB", image.size, "purple").tobytes(), image.tobytes())

    def test_unreviewed_layout_retains_blocks_and_flags_every_affected_question(self):
        segments = self.run_segment(reviewed=False)
        self.assertFalse(segments["photoLayout"]["reviewed"])
        self.assertTrue(all("photo-layout-unreviewed" in question["flags"] for question in segments["questions"]))
        self.assertEqual([], self.run_figures()["questions"][0]["figures"])

    def test_layout_refuses_wrong_render_and_a_crop_crossing_a_question_boundary(self):
        self.layout["pages"][1]["renderSha256"] = "0" * 64
        self.write_layout()
        with self.assertRaisesRegex(segment.SegmentError, "does not match"):
            self.run_segment()
        self.layout["pages"][1]["renderSha256"] = self.pages[1]["renderSha256"]
        self.layout["pages"][2]["figures"] = [[1200, 40, 1300, 150]]
        self.write_layout()
        with self.assertRaisesRegex(segment.SegmentError, "crosses a question boundary"):
            self.run_segment()

    def test_visual_choices_require_complete_reviewed_option_roles_or_ocr_labels(self):
        original_ocr = self.ocr
        self.ocr = lambda path: [
            dict(row, text=row["text"].replace("Numerical Answer (NAT)", "Multiple Choice (MCQ)"))
            for row in original_ocr(path)
        ]
        question = self.run_segment()["questions"][0]
        self.assertIn("choices-not-found", question["flags"])
        self.assertFalse(question["optionsInFigure"])
        self.layout["pages"][1]["figures"] = [
            {"box": [index * 100, 40, (index + 1) * 100, 120], "role": f"option-{key}"}
            for index, key in enumerate("ABCD")
        ]
        self.write_layout()
        question = self.run_segment()["questions"][0]
        self.assertTrue(question["optionsInFigure"])
        self.assertEqual([], question["flags"])
        self.assertEqual([f"option-{key}" for key in "ABCD"],
                         [figure["role"] for figure in self.run_figures()["questions"][0]["figures"]])

    def test_tampered_render_refused_even_after_segmentation_and_ocr_cache(self):
        self.run_segment()
        (self.intake_dir / self.pages[1]["render"]).write_bytes(b"tampered")
        with self.assertRaisesRegex(segment.SegmentError, "does not match intake"):
            self.run_segment()
        with self.assertRaisesRegex(figures.FigureError, "does not match intake"):
            self.run_figures()
        self.assertFalse((self.base / "03-figures").exists())
