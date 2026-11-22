"""Stage 4 answer-key tests. Every key and question here is generated and fictional."""

import importlib.util
import json
import pathlib
import tempfile
import unittest

import fitz

HERE = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("answer_key", HERE / "answer_key.py")
ak = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ak)

TYPES = {**{n: "NAT" for n in range(1, 5)}, **{n: "MSQ" for n in range(5, 9)}, **{n: "MCQ" for n in range(9, 15)}}


def segments(work, paper="uceed-2031"):
    folder = work / paper / "02-segments"
    folder.mkdir(parents=True)
    questions = []
    for number, kind in TYPES.items():
        options = [{"key": k, "text": f"Fictional {k}", "box": [0, 0, 1, 1]} for k in "ABCD"] if kind != "NAT" else []
        questions.append({"key": f"q{number}", "part": "A", "number": number, "type": kind, "options": options})
    questions.append({"key": "qb1", "part": "B", "number": 1, "type": "DESCRIPTIVE", "options": []})
    (folder / "questions.json").write_text(json.dumps({"schema": 1, "questions": questions}))
    return paper


# Keys as an official table would print them, in a deliberate mix of notations.
KEYS = {1: "08", 2: "470 - 480", 3: "94.2 (92.9 - 94.6)", 4: "6 to 6.5",
        5: "A B D", 6: "B. D", 7: "B,C or B,C,D", 8: "A, C",
        9: "A", 10: "C", 11: "B", 12: "D", 13: "DROPPED", 14: "A or B"}
EXPECTED = {"q1": "08", "q2": "470 to 480", "q3": "92.9 to 94.6", "q4": "6 to 6.5",
            "q5": "A,B,D", "q6": "B,D", "q7": "B,C or B,C,D", "q8": "A,C",
            "q9": "A", "q10": "C", "q11": "B", "q12": "D", "q13": None, "q14": "A or B"}


def header_key(path, two_line_header=False):
    """Three sections; each a table of two "Q. No." / "Key" column pairs."""
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((200, 40), "FICTIONAL 2031 ANSWER KEY", fontsize=12)
    y = 70
    for title, numbers in [("SECTION - A (NAT)", range(1, 5)), ("SECTION - B (MSQ)", range(5, 9)), ("SECTION - C (MCQ)", range(9, 15))]:
        page.insert_text((240, y), title, fontsize=11)
        y += 22
        for left in (80, 320):
            if two_line_header:
                page.insert_text((left, y - 6), "Q.", fontsize=10)
                page.insert_text((left, y + 6), "No.", fontsize=10)
                page.insert_text((left + 40, y), "Type", fontsize=10)
                page.insert_text((left + 90, y), "KEY RANGE", fontsize=10)
            else:
                page.insert_text((left, y), "Q. No.", fontsize=10)
                page.insert_text((left + 60, y), "Key", fontsize=10)
        y += 20
        numbers = list(numbers)
        half = (len(numbers) + 1) // 2
        for row in range(half):
            for column, left in enumerate((80, 320)):
                index = row + column * half
                if index >= len(numbers):
                    continue
                number = numbers[index]
                key_x = left + (90 if two_line_header else 60)
                page.insert_text((left, y), f"{number:02d}", fontsize=10)
                if two_line_header:
                    page.insert_text((left + 40, y), "MCQ", fontsize=10)  # a Type column is not part of the key
                if number == 13:  # a two-line cell, centred on its row
                    page.insert_text((key_x, y - 6), "DROPPED", fontsize=10)
                    page.insert_text((key_x, y + 6), "(+3 marks to all)", fontsize=8)
                elif number == 7:  # a key that wraps
                    page.insert_text((key_x, y - 6), "B,C or", fontsize=10)
                    page.insert_text((key_x, y + 6), "B,C,D", fontsize=10)
                else:
                    page.insert_text((key_x, y), KEYS[number], fontsize=10)
            y += 24
        y += 12
    page.insert_text((260, 820), "Page 1 of 1", fontsize=9)  # a footer below the last row
    doc.save(path)
    doc.close()


def headerless_key(path):
    doc = fitz.open()
    page = doc.new_page(width=595, height=842)
    page.insert_text((200, 40), "FICTIONAL 2031 Final Answer Keys", fontsize=12)
    for row in range(7):
        for column, left in enumerate((80, 300)):
            number = row + 1 + column * 7
            page.insert_text((left, 90 + row * 20), f"Q{number:02d}", fontsize=10)
            page.insert_text((left + 50, 90 + row * 20), KEYS[number] if number != 13 else "DROPPED", fontsize=10)
    doc.save(path)
    doc.close()


def scanned(text_pdf, image_pdf, dpi=200):
    """The same key as an image only: what a scanned official key looks like."""
    with fitz.open(text_pdf) as source:
        pix = source[0].get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
        rect = source[0].rect
    doc = fitz.open()
    page = doc.new_page(width=rect.width, height=rect.height)
    page.insert_image(rect, stream=pix.tobytes("png"))
    doc.save(image_pdf)
    doc.close()


def adjacent_column_key(path):
    doc = fitz.open()
    page = doc.new_page(width=400, height=400)
    page.insert_text((80, 40), "FICTIONAL ANSWER KEY", fontsize=12)
    page.insert_text((80, 65), "Q. No.", fontsize=10)
    page.insert_text((150, 65), "Answer", fontsize=10)
    page.insert_text((245, 65), "Q. No.", fontsize=10)
    page.insert_text((315, 65), "Answer", fontsize=10)
    for number in range(1, 5):
        page.insert_text((80, 70 + number * 30), f"{number:02d}", fontsize=10)
        page.insert_text((150, 70 + number * 30), KEYS[number], fontsize=10)
        page.insert_text((245, 70 + number * 30), f"{number + 4:02d}", fontsize=10)
        page.insert_text((315, 70 + number * 30), KEYS[number + 4], fontsize=10)
    doc.save(path)
    doc.close()


def ocr_from(text_pdf, drop=()):
    """A stand-in for OCR: the text layer's lines as Vision-style rows, minus some lines."""
    rows = []
    with fitz.open(text_pdf) as doc:
        page = doc[0]
        width, height = page.rect.width, page.rect.height
        for line in ak.text_lines(page):
            if line["text"] in drop:
                continue
            x0, y0, x1, y1 = line["box"]
            rows.append({"text": line["text"], "x": x0 / width, "y": 1 - y1 / height, "w": (x1 - x0) / width, "h": (y1 - y0) / height})
    return lambda path: list(rows)


class AnswerKeyTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.temp.name)
        self.work = self.root / "work"
        self.paper = segments(self.work)

    def tearDown(self):
        self.temp.cleanup()

    def run_key(self, pdf, **options):
        summary = ak.run_key(work=self.work, paper_id=self.paper, key_pdf=pdf, replace=True, ocr=options.pop("ocr", None), **options)
        return summary, json.loads((self.work / self.paper / "04-key" / "key.json").read_text())

    def test_notations_become_the_bank_notation(self):
        cases = {("A B D", "MSQ"): "A,B,D", ("B. D", "MSQ"): "B,D", ("ACD", "MSQ"): "A,C,D",
                 ("B,C or B,C,D", "MSQ"): "B,C or B,C,D", ("Cor BC D", "MSQ"): "C or B,C,D",
                 ("470 - 480", "NAT"): "470 to 480", ("24.0 to 25.5", "NAT"): "24.0 to 25.5",
                 ("94.2 (92.9 – 94.6)", "NAT"): "92.9 to 94.6", ("22 OR 23", "NAT"): "22 or 23",
                 ("0.26—0.27 or, 26—27", "NAT"): "0.26 to 0.27 or 26 to 27", ("08", "NAT"): "08", ("A or B", "MCQ"): "A or B"}
        for (printed, kind), raw in cases.items():
            self.assertEqual((raw, "official-key"), ak.normalise(printed, kind)[:2], printed)
        for printed in ("DROPPED", "FULL MARKS", "Dropped (+3 marks is awarded to all)"):
            self.assertEqual((None, "dropped"), ak.normalise(printed, "MCQ")[:2])
        for printed, kind in [("AB", "MCQ"), ("A E", "MSQ"), ("A A", "MSQ"), ("12 to 8", "NAT"), ("seven", "NAT"), ("", "MCQ")]:
            self.assertIsNone(ak.normalise(printed, kind)[0], printed)

    def test_comparison_ignores_notation_but_not_meaning(self):
        self.assertEqual(ak.canonical("AC", "MSQ"), ak.canonical("A, C", "MSQ"))
        self.assertEqual(ak.canonical("15-16", "NAT"), ak.canonical("15 to 16", "NAT"))
        self.assertEqual(ak.canonical("08", "NAT"), ak.canonical("8.0", "NAT"))
        self.assertNotEqual(ak.canonical("ABC or BC", "MSQ"), ak.canonical("A B C or B", "MSQ"))
        bank = {"answer": {"raw": "ACD or AC", "status": "official-key"}}
        self.assertEqual("same", ak.compare_bank(bank, "A,C,D or A,C", "MSQ", "official-key"))
        self.assertEqual("different", ak.compare_bank(bank, "A,C,D", "MSQ", "official-key"))
        self.assertEqual("bank-missing", ak.compare_bank({"answer": {"raw": None}}, "A", "MCQ", "official-key"))
        self.assertEqual("bank-unreadable", ak.compare_bank({"answer": {"raw": "Q36"}}, "A", "MCQ", "official-key"))
        self.assertEqual("not-in-bank", ak.compare_bank(None, "A", "MCQ", "official-key"))

    def test_reads_a_table_with_sections_wrapped_cells_and_a_footer(self):
        pdf = self.root / "key.pdf"
        header_key(pdf)
        summary, data = self.run_key(pdf)
        self.assertEqual({name: record["raw"] for name, record in data["keys"].items()}, EXPECTED)
        self.assertEqual("dropped", data["keys"]["q13"]["status"])
        self.assertIn("(+3 marks to all)", data["keys"]["q13"]["printed"])
        self.assertNotIn("Page", data["keys"]["q12"]["printed"] + data["keys"]["q14"]["printed"])
        self.assertEqual(([], {}), (summary["missing"], data["report"]["checks"]))
        self.assertTrue(all(r["readBy"] == "text" for r in data["keys"].values()))

    def test_two_line_headers_and_a_type_column(self):
        pdf = self.root / "key.pdf"
        header_key(pdf, two_line_header=True)
        _, data = self.run_key(pdf)
        self.assertEqual({name: record["raw"] for name, record in data["keys"].items()}, EXPECTED)

    def test_headerless_q_labelled_rows(self):
        pdf = self.root / "key.pdf"
        headerless_key(pdf)
        _, data = self.run_key(pdf)
        self.assertEqual({name: record["raw"] for name, record in data["keys"].items()}, EXPECTED)

    def test_section_type_disagreeing_with_the_question_is_flagged(self):
        work_segments = self.work / self.paper / "02-segments" / "questions.json"
        data = json.loads(work_segments.read_text())
        data["questions"][0]["type"] = "MCQ"  # q1 printed under NAT in the key
        data["questions"][0]["options"] = [{"key": k} for k in "ABCD"]
        work_segments.write_text(json.dumps(data))
        pdf = self.root / "key.pdf"
        header_key(pdf)
        _, key = self.run_key(pdf)
        self.assertIn("key-section-NAT-but-question-MCQ", key["keys"]["q1"]["checks"])

    def test_a_scanned_key_is_read_by_ocr_and_gaps_are_handled_safely(self):
        text_pdf, image_pdf = self.root / "key-text.pdf", self.root / "key-scan.pdf"
        header_key(text_pdf)
        scanned(text_pdf, image_pdf)
        # OCR skips a lone letter (q11 "B"), a question label ("06") and part of a wrapped cell.
        ocr = ocr_from(text_pdf, drop={"B", "10", "B,C or"})
        summary, data = self.run_key(image_pdf, ocr=ocr)
        keys = data["keys"]
        self.assertEqual([1], summary["pagesReadByOcr"])
        # The lone letter is matched against letters read elsewhere on the same scan.
        self.assertEqual(("B", "letter-match"), (keys["q11"]["raw"], keys["q11"]["readBy"]))
        # The label is recovered from the grid (09 above it, 11 below it).
        self.assertEqual("C", keys["q10"]["raw"])
        self.assertIn("question-number-inferred-from-grid", keys["q10"]["notes"])
        # Ink OCR did not read makes the key untrusted, never half right ("B,C,D" alone is wrong).
        self.assertEqual((None, "unreadable"), (keys["q7"]["raw"], keys["q7"]["status"]))
        self.assertIn("ocr-missed-part-of-cell", keys["q7"]["notes"])
        self.assertEqual("dropped", keys["q13"]["status"])
        trusted = {n: r["raw"] for n, r in keys.items() if r["status"] == "official-key"}
        self.assertEqual({n: EXPECTED[n] for n in trusted}, trusted)

    def test_scanned_key_recovers_a_consecutive_run_of_missing_question_labels(self):
        text_pdf, image_pdf = self.root / "key-text.pdf", self.root / "key-scan.pdf"
        adjacent_column_key(text_pdf)
        scanned(text_pdf, image_pdf)
        _, data = self.run_key(image_pdf, ocr=ocr_from(text_pdf, drop={"02", "03"}))
        for number in (2, 3):
            key = data["keys"][f"q{number}"]
            self.assertEqual(EXPECTED[f"q{number}"], key["raw"])
            self.assertIn("consecutive-row-run-needs-visual-review", key["notes"])

    def test_consecutive_run_is_not_guessed_when_count_disagrees(self):
        rows = [
            {"column": 0, "number": 1, "y": 10, "lines": [1], "inferred": False},
            {"column": 0, "number": None, "y": 20, "lines": [2], "inferred": False},
            {"column": 0, "number": None, "y": 30, "lines": [3], "inferred": False},
            {"column": 0, "number": 5, "y": 40, "lines": [4], "inferred": False},
        ]
        ak.infer_numbers(rows, 10)
        self.assertEqual([1, None, None, 5], [row["number"] for row in rows])

    def test_refusals(self):
        pdf = self.root / "key.pdf"
        header_key(pdf)
        with self.assertRaisesRegex(ak.KeyError_, "Run stages 1 and 2 first"):
            ak.run_key(work=self.work, paper_id="ceed-2031", key_pdf=pdf)
        fake = self.root / "key.txt"
        fake.write_text("Q1 A")
        with self.assertRaisesRegex(ak.KeyError_, "not a PDF"):
            ak.run_key(work=self.work, paper_id=self.paper, key_pdf=fake)
        ak.run_key(work=self.work, paper_id=self.paper, key_pdf=pdf)
        with self.assertRaisesRegex(ak.KeyError_, "already exists"):
            ak.run_key(work=self.work, paper_id=self.paper, key_pdf=pdf)
        self.assertEqual(["04-key"], [p.name for p in (self.work / self.paper).iterdir() if p.name.startswith("04")])


if __name__ == "__main__":
    unittest.main()
