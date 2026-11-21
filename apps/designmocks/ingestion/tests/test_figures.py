"""Stage 3 figure tests. Every paper and figure here is generated and fictional."""

import importlib.util
import io
import json
import pathlib
import random
import shutil
import tempfile
import unittest

import fitz
import numpy as np
from PIL import Image, ImageDraw

HERE = pathlib.Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


intake, segment, figures = load("intake"), load("segment"), load("figures")
W, H = 595, 842
HAS_POTRACE = shutil.which("potrace") is not None


def encoded(image, kind="PNG", **options):
    buffer = io.BytesIO()
    image.save(buffer, format=kind, **options)
    return buffer.getvalue()


def flat_shapes(width=480, height=240):
    """Bold flat-colour shapes: the kind of figure a vector recreation should reproduce."""
    image = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(image)
    draw.ellipse([30, 30, 200, 200], fill=(20, 20, 20))
    draw.polygon([(260, 200), (360, 30), (450, 200)], fill=(200, 40, 40))
    draw.rectangle([240, 90, 300, 150], fill=(20, 20, 20))
    return image


def noisy_photo(width=300, height=200):
    rng = random.Random(7)
    image = Image.new("RGB", (width, height))
    image.putdata([(rng.randrange(256), rng.randrange(256), rng.randrange(256)) for _ in range(width * height)])
    return image


def option_tile(letter_shift):
    image = Image.new("RGB", (160, 120), "white")
    ImageDraw.Draw(image).rectangle([20 + letter_shift, 20, 120 + letter_shift, 100], fill=(0, 0, 0))
    return image


def text(page, y, value, x=60, bold=False, size=11):
    page.insert_text((x, y), value, fontsize=size, fontname="hebo" if bold else "helv")


def paper(path, jpeg):
    doc = fitz.open()
    p1 = doc.new_page(width=W, height=H)
    text(p1, 60, "Section 3: Multiple Choice Questions (MCQ)", bold=True, size=16)
    text(p1, 100, "Q.1 Which fictional shape is shown below?", bold=True)
    p1.insert_image(fitz.Rect(80, 115, 380, 265), stream=jpeg)  # embedded as-is
    text(p1, 300, "Q.2 Which fictional label is printed over the picture?", bold=True)
    p1.insert_image(fitz.Rect(80, 315, 380, 465), stream=encoded(flat_shapes()))
    p1.insert_text((150, 400), "OVERLAID", fontsize=28, color=(0, 0, 0))  # drawn over the image
    text(p1, 500, "Q.3 Which part of the fictional picture is visible?", bold=True)
    p1.insert_image(fitz.Rect(80, 515, 380, 665), stream=encoded(flat_shapes()))
    p1.draw_rect(fitz.Rect(230, 515, 380, 665), color=None, fill=(1, 1, 1))  # half hidden, like a Word crop
    p2 = doc.new_page(width=W, height=H)
    text(p2, 60, "Q.4 Which fictional tile is the odd one out?", bold=True)
    for index in range(4):
        x = 80 + index * 120
        p2.insert_image(fitz.Rect(x, 80, x + 100, 155), stream=encoded(option_tile(index * 5)))
    text(p2, 200, "Q.5 Which fictional texture is shown, and continues below?", bold=True)
    p2.insert_image(fitz.Rect(80, 215, 380, 415), stream=encoded(noisy_photo()))
    text(p2, 470, "Q.6 Which fictional sentence is shortest?", bold=True)
    for index, option in enumerate(["A. One two", "B. Three", "C. Four five six", "D. Seven"]):
        text(p2, 490 + index * 15, option, x=80)
    text(p2, 600, "Q.7 Which fictional shape is left after the crop?", bold=True)
    # Word-style crop: the whole image is embedded, a clip path shows only its left half.
    holder = fitz.open()
    holder.new_page(width=300, height=150).insert_image(fitz.Rect(0, 0, 300, 150), stream=encoded(flat_shapes(400, 200)))
    p2.show_pdf_page(fitz.Rect(80, 615, 230, 765), holder, 0, clip=fitz.Rect(0, 0, 150, 150))
    doc.save(path)
    doc.close()


class FiguresTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.work = self.root / "work"
        self.jpeg = encoded(flat_shapes(), "JPEG", quality=92)
        pdf = self.root / "paper.pdf"
        paper(pdf, self.jpeg)
        intake.run_intake(exam="uceed", year=2031, work=self.work, pdf=pdf, dpi=100)
        segment.run_segment(work=self.work, paper_id="uceed-2031", ocr=lambda path: [])
        self.ocr_words = {}

    def tearDown(self):
        self.temp.cleanup()

    def fake_ocr(self, path):
        return [{"text": word, "x": 0.1, "y": 0.1, "w": 0.2, "h": 0.1} for word in self.ocr_words.get(path.parent.name, [])]

    def run_stage(self, **options):
        summary = figures.run_figures(work=self.work, paper_id="uceed-2031", ocr=self.fake_ocr, **options)
        data = json.loads((self.work / "uceed-2031" / "03-figures" / "figures.json").read_text())
        return summary, {q["key"]: q for q in data["questions"]}

    def path(self, relative):
        return self.work / "uceed-2031" / "03-figures" / relative

    def test_canonical_png_holds_the_embedded_pixels_exactly(self):
        _, q = self.run_stage()
        figure = q["q1"]["figures"][0]
        self.assertEqual("embedded", figure["canonical"]["source"])
        with Image.open(io.BytesIO(self.jpeg)) as decoded, Image.open(self.path(figure["canonical"]["file"])) as stored:
            self.assertEqual("PNG", stored.format)
            self.assertTrue(np.array_equal(np.asarray(decoded.convert("RGB")), np.asarray(stored.convert("RGB"))))
        self.assertEqual((480, 240), (figure["canonical"]["width"], figure["canonical"]["height"]))

    def test_falls_back_to_a_page_render_when_the_page_shows_something_else(self):
        _, q = self.run_stage()
        for key in ("q2", "q3"):  # text drawn over the picture; picture cropped on the page
            canonical = q[key]["figures"][0]["canonical"]
            self.assertEqual("page-render", canonical["source"], key)
            self.assertIn("page-shows-something-else", canonical["notes"])
            self.assertGreaterEqual(canonical["renderDpi"], figures.MIN_RENDER_DPI)

    @unittest.skipUnless(HAS_POTRACE, "potrace is not installed")
    def test_flat_figure_gets_a_verified_safe_svg_and_a_board(self):
        _, q = self.run_stage()
        vector = q["q1"]["figures"][0]["vector"]
        self.assertEqual("verified", vector["status"], vector)
        self.assertEqual("pending", vector["approval"])
        svg = self.path(vector["file"]).read_text()
        self.assertTrue(figures.SAFE_SVG.match(svg))
        self.assertNotIn("<image", svg)
        self.assertNotIn("script", svg)
        rendered = figures.rasterise_svg(svg, 480, 240)
        self.assertEqual((480, 240), rendered.size)
        self.assertTrue(self.path(vector["board"]).exists())
        for name, limit in figures.PASS.items():
            value = vector["metrics"][name]
            self.assertTrue(value >= limit if name in ("inkIou", "ssim") else value <= limit, name)

    @unittest.skipUnless(HAS_POTRACE, "potrace is not installed")
    def test_photos_and_textures_stay_png_only(self):
        _, q = self.run_stage()
        vector = q["q5"]["figures"][0]["vector"]
        self.assertEqual(("not-eligible", ["not-flat-colour"]), (vector["status"], vector["reasons"]))
        self.assertNotIn("file", vector)

    def test_verification_rejects_a_recreation_that_moved(self):
        source = flat_shapes()
        colours = figures.palette_of(source)
        labels = figures.nearest_labels(source, colours)
        background = int(np.argmax([sum(c) for c in colours]))
        shifted = Image.new("RGB", source.size, "white")
        shifted.paste(source.crop((0, 0, 474, 240)), (6, 0))
        metrics, failures = figures.verify(source, shifted, colours, labels, background)
        self.assertIn("inkIou", failures)
        self.assertIn("edgeP99", failures)
        metrics, failures = figures.verify(source, source.copy(), colours, labels, background)
        self.assertEqual([], failures)
        self.assertEqual(1.0, metrics["inkIou"])

    def test_svg_safety_check_refuses_anything_but_shapes(self):
        layers = [("000000", "translate(0,10)", ['M0 0 L5 5 z" onload="alert(1)'])]
        with self.assertRaisesRegex(figures.FigureError, "safety"):
            figures.svg_document(10, 10, "ffffff", layers)
        ok = figures.svg_document(10, 10, "ffffff", [("000000", "translate(0,10) scale(0.1,-0.1)", ["M0 0 L5 5 z"])])
        self.assertTrue(figures.SAFE_SVG.match(ok))

    def test_four_similar_images_become_options_and_text_options_stay_text(self):
        _, q = self.run_stage()
        self.assertEqual(["option-A", "option-B", "option-C", "option-D"], [f["role"] for f in q["q4"]["figures"]])
        self.assertEqual([], q["q6"]["figures"])
        self.assertEqual("figure", q["q1"]["figures"][0]["role"])

    def test_a_word_style_crop_keeps_the_embedded_pixels_of_the_visible_part(self):
        _, q = self.run_stage()
        canonical = q["q7"]["figures"][0]["canonical"]
        self.assertEqual("embedded", canonical["source"])
        self.assertIn("cropped-to-visible-area", canonical["notes"])
        self.assertEqual([0, 0, 200, 200], canonical["cropPx"])
        with Image.open(self.path(canonical["file"])) as stored:
            expected = np.asarray(flat_shapes(400, 200).crop((0, 0, 200, 200)))
            self.assertTrue(np.array_equal(expected, np.asarray(stored.convert("RGB"))))

    def test_every_question_gets_a_block_crop(self):
        _, q = self.run_stage()
        for key, record in q.items():
            block = record["block"]
            self.assertEqual(figures.BLOCK_DPI, block["dpi"], key)
            with Image.open(self.path(block["file"])) as image:
                self.assertEqual((block["width"], block["height"]), image.size)

    @unittest.skipUnless(HAS_POTRACE, "potrace is not installed")
    def test_text_inside_a_figure_is_recorded_and_flagged(self):
        self.ocr_words = {"q1": ["A", "B"]}
        _, q = self.run_stage()
        figure = q["q1"]["figures"][0]
        self.assertEqual(["A", "B"], figure["textInside"])
        self.assertTrue(figure["vector"]["textAsOutlines"])
        self.assertEqual([], q["q4"]["figures"][0]["textInside"])

    def test_refusals_and_deterministic_rerun(self):
        summary, _ = self.run_stage()
        self.assertEqual({"questions": 7, "figures": 9}, {k: summary[k] for k in ("questions", "figures")})
        first = self.path("figures.json").read_bytes()
        with self.assertRaisesRegex(figures.FigureError, "already exists"):
            self.run_stage()
        self.run_stage(replace=True)
        self.assertEqual(first, self.path("figures.json").read_bytes())
        # A changed intake makes stage 2 stale.
        manifest = self.work / "uceed-2031" / "01-intake" / "paper.json"
        manifest.write_text(manifest.read_text().replace('"schema": 1', '"schema": 1 '))
        with self.assertRaisesRegex(figures.FigureError, "older than the intake"):
            self.run_stage(replace=True)
        with self.assertRaisesRegex(figures.FigureError, "Run stages 1 and 2 first"):
            figures.run_figures(work=self.work, paper_id="ceed-2031", ocr=self.fake_ocr)


if __name__ == "__main__":
    unittest.main()
