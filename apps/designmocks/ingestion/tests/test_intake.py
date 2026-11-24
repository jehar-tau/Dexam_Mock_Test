"""Stage 1 intake tests. Every paper here is generated and fictional."""

import contextlib
import hashlib
import importlib.util
import io
import json
import math
import pathlib
import tempfile
import unittest

import fitz
from PIL import Image, ImageDraw

spec = importlib.util.spec_from_file_location("intake", pathlib.Path(__file__).parents[1] / "intake.py")
intake = importlib.util.module_from_spec(spec)
spec.loader.exec_module(intake)


def jpeg_figure(width=400, height=200):
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    for column in range(5):
        draw.rectangle([20 + column * 70, 40, 70 + column * 70, 160], outline="black", width=4)
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=90)
    return buffer.getvalue()


def png_bytes(width, height, colour="black"):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), colour).save(buffer, format="PNG")
    return buffer.getvalue()


def fictional_paper(path):
    """Three pages: text with a JPEG figure placed twice and a bullet icon; vector art; text typeset as an image."""
    figure = jpeg_figure()
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((60, 80), "Q.1 How many fictional boxes are drawn below?", fontsize=11, fontname="hebo")
    page.insert_text((60, 100), "Answer as a whole number.", fontsize=11)
    page.insert_image(fitz.Rect(60, 120, 360, 270), stream=figure)  # 400 px across 300 pt = 96 dpi
    page.insert_image(fitz.Rect(60, 300, 210, 375), stream=figure)  # same bytes placed again, smaller
    page.insert_image(fitz.Rect(60, 400, 66, 406), stream=png_bytes(12, 12))  # decorative bullet
    page.insert_text((60, 430), "Q.2 Which fictional option is longest?", fontsize=11)
    page.insert_text((80, 450), "(A) one (B) three (C) eleven (D) seven", fontsize=11)

    vector = doc.new_page(width=595, height=842)
    vector.insert_text((60, 80), "Q.3 Study the fictional grid of lines below and answer.", fontsize=11)
    vector.draw_rect(fitz.Rect(100, 120, 300, 320), color=(0, 0, 0), width=1.5)
    vector.draw_line(fitz.Point(100, 220), fitz.Point(300, 220), color=(0, 0, 0))

    scanned = doc.new_page(width=595, height=842)
    scanned.insert_image(fitz.Rect(30, 30, 565, 812), stream=png_bytes(535, 782, "white"))
    doc.save(path)
    doc.close()
    return figure


class IntakeTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.pdf = self.root / "fictional-paper.pdf"
        self.figure = fictional_paper(self.pdf)
        self.work = self.root / "work"

    def tearDown(self):
        self.temp.cleanup()

    def run_pdf(self, **changes):
        options = dict(exam="uceed", year=2031, work=self.work, pdf=self.pdf, dpi=100)
        options.update(changes)
        return intake.run_intake(**options)

    def manifest(self, paper="uceed-2031"):
        return json.loads((self.work / paper / "01-intake" / "paper.json").read_text())

    def test_extracts_embedded_figures_byte_for_byte_without_resampling(self):
        summary = self.run_pdf()
        manifest = self.manifest()
        digest = hashlib.sha256(self.figure).hexdigest()
        stored = {image["sha256"]: image for image in manifest["images"]}
        self.assertIn(digest, stored)
        self.assertEqual("jpeg", stored[digest]["ext"])
        self.assertEqual((400, 200), (stored[digest]["width"], stored[digest]["height"]))
        on_disk = (self.work / "uceed-2031" / "01-intake" / stored[digest]["file"]).read_bytes()
        self.assertEqual(self.figure, on_disk)
        self.assertEqual(3, summary["uniqueImages"])  # the figure (placed twice), the bullet, the page-3 scan

    def test_records_each_placement_with_its_box_and_effective_resolution(self):
        self.run_pdf()
        first = self.manifest()["pages"][0]["images"]
        figures = [p for p in first if not p["decorative"]]
        self.assertEqual(2, len(figures))
        self.assertEqual([60.0, 120.0, 360.0, 270.0], figures[0]["box"])
        self.assertEqual(96, figures[0]["effectiveDpi"])
        self.assertEqual(192, figures[1]["effectiveDpi"])
        self.assertEqual(figures[0]["sha256"], figures[1]["sha256"])
        self.assertTrue([p for p in first if p["decorative"]][0]["extractable"])

    def test_keeps_text_lines_and_words_with_boxes_and_weight(self):
        self.run_pdf()
        page = self.manifest()["pages"][0]
        text = json.loads((self.work / "uceed-2031" / "01-intake" / page["text"]).read_text())
        lines = [line["text"] for line in text["lines"]]
        self.assertEqual("Q.1 How many fictional boxes are drawn below?", lines[0])
        self.assertTrue(text["lines"][0]["bold"])
        self.assertFalse(text["lines"][1]["bold"])
        self.assertLess(lines.index("Answer as a whole number."), lines.index("Q.2 Which fictional option is longest?"))
        self.assertIn("(A)", [word["text"] for word in text["words"]])
        self.assertEqual(4, len(text["words"][0]["box"]))

    def test_flags_vector_drawings_and_image_only_pages(self):
        summary = self.run_pdf()
        pages = self.manifest()["pages"]
        self.assertEqual([2], summary["vectorPages"])
        self.assertGreaterEqual(len(pages[1]["drawings"]), 2)
        self.assertEqual("text", pages[0]["kind"])
        self.assertFalse(pages[0]["needsOcr"])
        self.assertEqual("image-text", pages[2]["kind"])
        self.assertEqual(["text-as-image"], pages[2]["ocrReasons"])
        self.assertLess(pages[0]["unexplainedInk"], intake.OCR_UNEXPLAINED_INK / 10)
        self.assertEqual(0, pages[1]["unexplainedInk"])  # the vector figure is not mistaken for text
        self.assertEqual([3], summary["needsOcr"])

    def test_flags_text_drawn_without_a_text_layer_but_not_ruled_tables(self):
        doc = fitz.open()
        page = doc.new_page(width=595, height=842)
        page.insert_text((60, 60), "Q.4 Fictional instructions follow.", fontsize=11)
        for row in range(12):  # glyph-like outlines: real ink, no extractable text
            for column in range(40):
                x, y = 60 + column * 11, 100 + row * 16
                page.draw_rect(fitz.Rect(x, y, x + 6, y + 9), color=None, fill=(0, 0, 0))
        table = doc.new_page(width=595, height=842)
        table.insert_text((60, 60), "Fictional marking table", fontsize=11)
        for row in range(6):
            table.draw_line(fitz.Point(60, 80 + row * 20), fitz.Point(500, 80 + row * 20), color=(0, 0, 0), width=1)
        for column in range(4):
            table.draw_line(fitz.Point(60 + column * 146, 80), fitz.Point(60 + column * 146, 180), color=(0, 0, 0), width=1)
        outlined = self.root / "outlined.pdf"
        doc.save(outlined)
        doc.close()
        summary = self.run_pdf(pdf=outlined)
        pages = self.manifest()["pages"]
        self.assertEqual(["ink-without-text"], pages[0]["ocrReasons"])
        self.assertGreater(pages[0]["unexplainedInk"], 0.002)
        self.assertEqual([], pages[1]["ocrReasons"])
        self.assertEqual(0, pages[1]["unexplainedInk"])
        self.assertEqual([1], summary["needsOcr"])

    def test_renders_every_page_and_hashes_the_source_copy(self):
        self.run_pdf()
        manifest = self.manifest()
        out = self.work / "uceed-2031" / "01-intake"
        self.assertEqual(3, manifest["document"]["pageCount"])
        for page in manifest["pages"]:
            with Image.open(out / page["render"]) as render:
                self.assertEqual((page["renderWidth"], page["renderHeight"]), render.size)
            self.assertEqual(math.ceil(595 * 100 / 72), page["renderWidth"])
        source = manifest["source"]["files"][0]
        self.assertEqual(hashlib.sha256(self.pdf.read_bytes()).hexdigest(), source["sha256"])
        self.assertEqual(self.pdf.read_bytes(), (out / "source" / source["name"]).read_bytes())

    def test_rerun_with_replace_is_deterministic(self):
        self.run_pdf()
        first = (self.work / "uceed-2031" / "01-intake" / "paper.json").read_bytes()
        with self.assertRaisesRegex(intake.IntakeError, "already exists"):
            self.run_pdf()
        self.run_pdf(replace=True)
        self.assertEqual(first, (self.work / "uceed-2031" / "01-intake" / "paper.json").read_bytes())
        leftovers = [p.name for p in (self.work / "uceed-2031").iterdir() if p.name != "01-intake"]
        self.assertEqual([], leftovers)

    def test_refuses_a_work_folder_inside_a_git_repository(self):
        repo_dir = pathlib.Path(__file__).resolve().parent
        with self.assertRaisesRegex(intake.IntakeError, "outside every Git repository"):
            self.run_pdf(work=repo_dir / "never-created")
        self.assertFalse((repo_dir / "never-created").exists())

    def test_refuses_bad_inputs_without_leaving_files(self):
        fake = self.root / "notes.pdf"
        fake.write_text("not a pdf")
        with self.assertRaisesRegex(intake.IntakeError, "not a PDF"):
            self.run_pdf(pdf=fake)
        locked = self.root / "locked.pdf"
        doc = fitz.open(self.pdf)
        doc.save(locked, encryption=fitz.PDF_ENCRYPT_AES_256, user_pw="fictional", owner_pw="fictional")
        doc.close()
        with self.assertRaisesRegex(intake.IntakeError, "password"):
            self.run_pdf(pdf=locked)
        for exam, year, paper_id in [("notanexam", 2031, None), ("uceed", 31, None), ("uceed", 2031, "../escape")]:
            with self.assertRaises(intake.IntakeError):
                self.run_pdf(exam=exam, year=year, paper_id=paper_id)
        with self.assertRaises(intake.IntakeError):
            self.run_pdf(photos=[self.pdf])
        leftovers = list((self.work / "uceed-2031").iterdir()) if (self.work / "uceed-2031").exists() else []
        self.assertEqual([], leftovers)

    def test_photos_are_turned_upright_stripped_and_marked_for_ocr(self):
        photo = self.root / "page-photo.jpg"
        sideways = Image.new("RGB", (300, 200), "white")
        exif = sideways.getexif()
        exif[0x0112] = 6  # camera says: rotate 90 degrees clockwise to view
        exif[0x010F] = "Fictional Camera"
        sideways.save(photo, format="JPEG", exif=exif.tobytes())
        summary = intake.run_intake(exam="ceed", year=2031, work=self.work, photos=[photo])
        manifest = self.manifest("ceed-2031")
        page = manifest["pages"][0]
        self.assertEqual((200, 300), (page["renderWidth"], page["renderHeight"]))
        self.assertTrue(page["needsOcr"])
        self.assertEqual(["photo"], page["ocrReasons"])
        self.assertEqual([1], summary["needsOcr"])
        with Image.open(self.work / "ceed-2031" / "01-intake" / page["render"]) as render:
            self.assertNotIn(0x010F, render.getexif())

    def test_command_line_prints_one_json_summary(self):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = intake.main(["--paper", str(self.pdf), "--exam", "uceed", "--year", "2031", "--work", str(self.work), "--dpi", "80"])
        self.assertEqual(0, code)
        summary = json.loads(out.getvalue())
        self.assertEqual({"paperId": "uceed-2031", "pages": 3, "figurePlacements": 3}, {k: summary[k] for k in ("paperId", "pages", "figurePlacements")})
        with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(err):
            self.assertEqual(1, intake.main(["--paper", str(self.pdf), "--exam", "uceed", "--year", "2031", "--work", str(self.work)]))
        self.assertIn("already exists", err.getvalue())


if __name__ == "__main__":
    unittest.main()
