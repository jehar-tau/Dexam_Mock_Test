"""Stage 2 segmentation tests. Every paper here is generated and fictional."""

import contextlib
import importlib.util
import io
import json
import pathlib
import tempfile
import unittest

import fitz
from PIL import Image

HERE = pathlib.Path(__file__).resolve().parents[1]


def load(name):
    spec = importlib.util.spec_from_file_location(name, HERE / f"{name}.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


intake = load("intake")
segment = load("segment")

W, H = 595, 842


def png(width=300, height=150):
    buffer = io.BytesIO()
    Image.new("RGB", (width, height), (40, 40, 40)).save(buffer, format="PNG")
    return buffer.getvalue()


class Paper:
    """Writes fictional pages with a running footer, like the official papers."""

    def __init__(self):
        self.doc = fitz.open()
        self.pages = []

    def page(self):
        page = self.doc.new_page(width=W, height=H)
        self.pages.append(page)
        return page

    def save(self, path):
        total = self.doc.page_count
        for number, page in enumerate(self.doc, 1):
            page.insert_text((60, 815), "FICTIONAL EXAM 2031", fontsize=9)
            page.insert_text((470, 815), f"Page {number} of {total}", fontsize=9)
        self.doc.save(path)
        self.doc.close()


def text(page, y, value, x=60, size=11, bold=False):
    page.insert_text((x, y), value, fontsize=size, fontname="hebo" if bold else "helv")


def ucee_style_paper(path):
    """Q.n markers, numbered instructions, three sections, a figure that spills to the next page, Part B continuing."""
    paper = Paper()
    p1 = paper.page()
    text(p1, 60, "Instructions", bold=True, size=16)
    for i, line in enumerate(["1. This fictional paper has three sections.", "2. Calculators are not allowed.",
                              "3. Section 1: Numerical Answer Type (NAT): 2 questions."]):
        text(p1, 90 + i * 18, line, x=80)
    p2 = paper.page()
    text(p2, 60, "Section 1: Numerical Answer Type (NAT)", bold=True, size=16)
    text(p2, 85, "Section 1 contains 2 questions. Questions from 1 to 2 belong to this section.", x=80)
    text(p2, 120, "Q.01", bold=True)
    text(p2, 120, "How many fictional squares are in the grid shown below?", x=96)
    p2.insert_image(fitz.Rect(96, 135, 396, 285), stream=png())
    text(p2, 320, "Q.02", bold=True)
    text(p2, 320, "A fictional tank holds 12 litres. How many litres are in", x=96)
    text(p2, 334, "half of it?", x=96)
    text(p2, 380, "Section 2: Multiple Select Questions (MSQ)", bold=True, size=16)
    text(p2, 405, "Marking scheme: partial marks apply. Questions from 3 to 3 belong to this section.", x=80)
    text(p2, 440, "Q.03", bold=True)
    text(p2, 440, "Which of these fictional fruits are yellow?", x=96)
    for i, option in enumerate(["A.", "B.", "C.", "D."]):
        text(p2, 462 + i * 15, option, x=80)
        text(p2, 462 + i * 15, ["Banana", "Lemon", "Plum", "Grape that is very long and"][i], x=96)
    text(p2, 522, "wraps onto a second line", x=96)
    text(p2, 580, "Section 3: Multiple Choice Questions (MCQ)", bold=True, size=16)
    text(p2, 640, "Q.04", bold=True)
    text(p2, 640, "Which fictional shape continues the pattern shown on the next page?", x=96)
    p3 = paper.page()
    p3.insert_image(fitz.Rect(96, 60, 396, 210), stream=png(310, 155))  # Q.04's figure, above Q.05
    text(p3, 250, "Q.05", bold=True)
    text(p3, 250, "Which fictional city is the capital?", x=96)
    for i, option in enumerate(["A. Alpha", "B. Beta", "C. Gamma", "D. Delta"]):
        text(p3, 270 + i * 15, option, x=80)
    text(p3, 380, "PART B (fictional drawing)", bold=True, size=16)
    text(p3, 420, "Q.06 [50 Marks]", bold=True)
    text(p3, 440, "Draw a fictional bicycle from the side.", x=60)
    text(p3, 460, "A. Show the frame.", x=80)
    text(p3, 475, "B. Show the wheels.", x=80)
    paper.save(path)


def bare_number_paper(path):
    """Questions numbered "1." like UCEED 2015; numbered instructions flow into the numbering."""
    paper = Paper()
    p1 = paper.page()
    text(p1, 60, "General instructions", bold=True)
    text(p1, 90, "1. Read every fictional question carefully.", x=80)
    text(p1, 108, "2. There is negative marking.", x=80)
    p2 = paper.page()
    text(p2, 60, "Section A: Numerical Answer Type Questions", bold=True, size=16)
    for i in range(1, 6):
        text(p2, 80 + i * 60, f"{i}. Fictional numerical question number {i}?")
    paper.save(path)


def ceed_style_paper(path):
    """Part B restarts at Q.1 and has numbered evaluation criteria that must not become questions."""
    paper = Paper()
    p1 = paper.page()
    text(p1, 60, "Part A - Section I: Numerical Answer Type Questions", bold=True)
    text(p1, 100, "Q.1 Fictional count question one?", bold=True)
    text(p1, 160, "Q.2 Fictional count question two?", bold=True)
    p2 = paper.page()
    text(p2, 60, "Part B", bold=True, size=16)
    text(p2, 100, "Q.1 Sketching (20 marks)", bold=True)
    text(p2, 120, "Sketch a fictional teapot.", x=60)
    text(p2, 150, "Evaluation criteria:", x=60)
    for i in range(1, 5):
        text(p2, 150 + i * 16, f"{i}. Fictional criterion {i}", x=60)
    text(p2, 300, "Q.2 Form sensitivity (20 marks)", bold=True)
    text(p2, 320, "Redraw a fictional kettle.", x=60)
    text(p2, 350, "Evaluation criteria:", x=60)
    for i in range(1, 4):
        text(p2, 350 + i * 16, f"{i}. Fictional criterion {i}", x=60)
    paper.save(path)


class SegmentTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.work = self.root / "work"
        self.ocr_calls = []

    def tearDown(self):
        self.temp.cleanup()

    def no_ocr(self, path):
        self.ocr_calls.append(path)
        return []

    def ingest(self, build, exam="uceed", year=2031):
        pdf = self.root / f"{build.__name__}.pdf"
        build(pdf)
        intake.run_intake(exam=exam, year=year, work=self.work, pdf=pdf, dpi=100)
        return f"{exam}-{year}"

    def segments(self, paper_id, ocr=None):
        summary = segment.run_segment(work=self.work, paper_id=paper_id, ocr=ocr or self.no_ocr)
        data = json.loads((self.work / paper_id / "02-segments" / "questions.json").read_text())
        return summary, {q["key"]: q for q in data["questions"]}

    def test_questions_sections_options_and_part_b_in_a_q_style_paper(self):
        summary, q = self.segments(self.ingest(ucee_style_paper))
        self.assertEqual(["q1", "q2", "q3", "q4", "q5", "qb1"], list(q))
        self.assertEqual((5, 1, []), (summary["partA"], summary["partB"], summary["missingNumbers"]))
        self.assertEqual(["NAT", "NAT", "MSQ", "MCQ", "MCQ", "DESCRIPTIVE"], [x["type"] for x in q.values()])
        self.assertEqual("A fictional tank holds 12 litres. How many litres are in half of it?", q["q2"]["prompt"])
        # A section's intro belongs to no question.
        self.assertNotIn("Marking scheme", q["q2"]["prompt"])
        self.assertNotIn("Section", q["q3"]["prompt"] + q["q2"]["prompt"])
        # Lone "A." labels are joined to their text; wrapped options are joined.
        self.assertEqual(["A", "B", "C", "D"], [o["key"] for o in q["q3"]["options"]])
        self.assertEqual("Grape that is very long and wraps onto a second line", q["q3"]["options"][3]["text"])
        self.assertEqual("Gamma", q["q5"]["options"][2]["text"])
        # Footers never leak into text.
        self.assertTrue(all("Page" not in x["prompt"] and "FICTIONAL EXAM" not in x["prompt"] for x in q.values()))
        self.assertEqual({}, json.loads((self.work / "uceed-2031" / "02-segments" / "questions.json").read_text())["report"]["flagged"])
        self.assertEqual([], self.ocr_calls)  # a clean text layer needs no OCR

    def test_figures_follow_their_question_across_a_page_break(self):
        _, q = self.segments(self.ingest(ucee_style_paper))
        self.assertEqual([2], [f["page"] for f in q["q1"]["figures"]])
        self.assertEqual([], q["q2"]["figures"])
        self.assertEqual([3], [f["page"] for f in q["q4"]["figures"]])  # sits above Q.05 on the next page
        self.assertEqual([2, 3], [r["page"] for r in q["q4"]["regions"]])
        self.assertEqual([], q["q5"]["figures"])
        self.assertEqual((310, 155), (q["q4"]["figures"][0]["nativeWidth"], q["q4"]["figures"][0]["nativeHeight"]))

    def test_part_b_keeps_lettered_subtasks_in_the_prompt(self):
        _, q = self.segments(self.ingest(ucee_style_paper))
        self.assertEqual(6, q["qb1"]["printedNumber"])
        self.assertEqual([], q["qb1"]["options"])
        self.assertIn("A. Show the frame. B. Show the wheels.", q["qb1"]["prompt"])

    def test_numbered_instructions_do_not_become_questions(self):
        summary, q = self.segments(self.ingest(bare_number_paper))
        self.assertEqual(5, summary["partA"])
        self.assertEqual("Fictional numerical question number 1?", q["q1"]["prompt"])
        self.assertTrue(all(x["type"] == "NAT" for x in q.values()))

    def test_part_b_restart_ignores_numbered_criteria(self):
        summary, q = self.segments(self.ingest(ceed_style_paper, exam="ceed"), )
        self.assertEqual(["q1", "q2", "qb1", "qb2"], list(q))
        self.assertEqual((2, 2), (summary["partA"], summary["partB"]))
        self.assertIn("Fictional criterion 4", q["qb1"]["prompt"])
        self.assertTrue(q["qb2"]["prompt"].startswith("Form sensitivity"))

    def test_ocr_recovers_a_marker_missing_from_the_text_layer(self):
        def paper(path):
            doc = fitz.open()
            page = doc.new_page(width=W, height=H)
            text(page, 60, "Section 1: Numerical Answer Type (NAT)", bold=True, size=16)
            text(page, 100, "Q.1", bold=True)
            text(page, 100, "Fictional prompt one?", x=96)
            # Q.2's label is drawn as outlines: ink on the page, nothing in the text layer.
            page.draw_rect(fitz.Rect(60, 191, 86, 201), color=None, fill=(0, 0, 0))
            text(page, 200, "Fictional prompt two?", x=96)
            page.insert_image(fitz.Rect(96, 220, 396, 370), stream=png())
            text(page, 420, "Q.3", bold=True)
            text(page, 420, "Fictional prompt three?", x=96)
            doc.save(path)
            doc.close()

        def norm(x0, y0, x1, y1):
            return {"x": x0 / W, "y": 1 - y1 / H, "w": (x1 - x0) / W, "h": (y1 - y0) / H}

        def fake_ocr(path):
            self.ocr_calls.append(path)
            return [dict(norm(60, 190, 230, 202), text="Q.2 Fictional prompt two?"),
                    dict(norm(150, 280, 200, 292), text="LABEL INSIDE FIGURE"),
                    dict(norm(96, 90, 210, 102), text="Fictional prompt one?")]

        pdf = self.root / "ocr.pdf"
        paper(pdf)
        intake.run_intake(exam="uceed", year=2032, work=self.work, pdf=pdf, dpi=100)
        manifest = json.loads((self.work / "uceed-2032" / "01-intake" / "paper.json").read_text())
        self.assertGreater(manifest["pages"][0]["unexplainedInk"], 0)
        summary, q = self.segments("uceed-2032", ocr=fake_ocr)
        self.assertEqual(["q1", "q2", "q3"], list(q))
        self.assertEqual("Fictional prompt two?", q["q2"]["prompt"])
        self.assertTrue(q["q2"]["ocr"])
        self.assertEqual(1, len(q["q2"]["figures"]))
        self.assertNotIn("LABEL", q["q2"]["prompt"])
        self.assertTrue((self.work / "uceed-2032" / "02-segments" / "ocr" / "page-001.json").exists())
        # OCR results are cached by render digest: a rerun does not read the page again.
        segment.run_segment(work=self.work, paper_id="uceed-2032", ocr=fake_ocr, replace=True)
        self.assertEqual(1, len(self.ocr_calls))

    def test_flags_animated_figures_and_missing_choices(self):
        def paper(path):
            doc = fitz.open()
            page = doc.new_page(width=W, height=H)
            text(page, 60, "Section 3: Multiple Choice Questions (MCQ)", bold=True, size=16)
            text(page, 100, "Q.1 An animation of two fictional moons is shown below. Which is faster?", bold=True)
            page.insert_image(fitz.Rect(96, 120, 396, 270), stream=png())
            text(page, 320, "Q.2 Which fictional option is right?", bold=True)
            text(page, 380, "Q.3 Which fictional film used animation movie frames? A choice in text follows.", bold=True)
            for i, option in enumerate(["A. One", "B. Two", "C. Three", "D. Four"]):
                text(page, 400 + i * 15, option, x=80)
            doc.save(path)
            doc.close()

        _, q = self.segments(self.ingest(paper))
        self.assertEqual(["animated-figure"], q["q1"]["flags"])
        self.assertTrue(q["q1"]["optionsInFigure"])
        self.assertEqual(["choices-not-found"], q["q2"]["flags"])
        self.assertEqual([], q["q3"]["flags"])

    def test_refusals(self):
        with self.assertRaisesRegex(segment.SegmentError, "Run stage 1 first"):
            segment.run_segment(work=self.work, paper_id="uceed-2031", ocr=self.no_ocr)
        paper_id = self.ingest(ucee_style_paper)
        self.segments(paper_id)
        with self.assertRaisesRegex(segment.SegmentError, "already exists"):
            segment.run_segment(work=self.work, paper_id=paper_id, ocr=self.no_ocr)

        def blank(path):
            doc = fitz.open()
            text(doc.new_page(width=W, height=H), 100, "A fictional page with no questions at all.")
            doc.save(path)
            doc.close()

        other = self.ingest(blank, year=2033)
        with self.assertRaisesRegex(segment.SegmentError, "No question numbering"):
            segment.run_segment(work=self.work, paper_id=other, ocr=self.no_ocr)
        self.assertEqual(["01-intake"], sorted(p.name for p in (self.work / other).iterdir()))

    def test_rerun_is_deterministic_and_command_line_prints_summary(self):
        paper_id = self.ingest(ucee_style_paper)
        self.segments(paper_id)
        first = (self.work / paper_id / "02-segments" / "questions.json").read_bytes()
        out = io.StringIO()
        original = segment.vision_ocr
        segment.vision_ocr = lambda root: self.no_ocr
        try:
            with contextlib.redirect_stdout(out):
                code = segment.main(["--paper-id", paper_id, "--work", str(self.work), "--replace"])
        finally:
            segment.vision_ocr = original
        self.assertEqual(0, code)
        self.assertEqual({"partA": 5, "partB": 1}, {k: json.loads(out.getvalue())[k] for k in ("partA", "partB")})
        self.assertEqual(first, (self.work / paper_id / "02-segments" / "questions.json").read_bytes())


if __name__ == "__main__":
    unittest.main()
