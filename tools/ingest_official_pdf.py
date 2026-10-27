#!/usr/bin/env python3
"""Ingest an official question paper PDF into the local Dexam SQLite bank.

The script extracts text, saves page images, keeps question-level provenance,
parses a separate answer-key PDF where possible, and can optionally ask a local
Ollama model for an independently drafted explanation.

This is a local research tool. Only use PDFs you have the right to store and
process. The script does not fetch or scrape third-party sites.
"""

import argparse
import hashlib
import json
import os
import re
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import urllib.error
import urllib.request
from datetime import datetime, timezone

try:
    import fitz  # PyMuPDF
except ImportError:
    fitz = None


TOOLS_DIR = os.path.dirname(os.path.abspath(__file__))
ROOT_DIR = os.path.dirname(TOOLS_DIR)
OCR_SOURCE = os.path.join(TOOLS_DIR, "ocr_vision.swift")
OCR_CACHE_DIR = os.path.join(ROOT_DIR, "server", "data", ".cache")


SCHEMA = """
CREATE TABLE IF NOT EXISTS papers (
  id TEXT PRIMARY KEY,
  exam_id TEXT NOT NULL,
  year INTEGER,
  title TEXT NOT NULL,
  source_note TEXT,
  question_pdf TEXT,
  answer_pdf TEXT,
  page_count INTEGER DEFAULT 0,
  imported_at TEXT,
  status TEXT DEFAULT 'imported'
);
CREATE TABLE IF NOT EXISTS questions (
  id TEXT PRIMARY KEY,
  paper_id TEXT NOT NULL,
  question_no TEXT,
  question_type TEXT DEFAULT 'MCQ',
  topic TEXT DEFAULT 'Unassigned',
  subtopic TEXT DEFAULT '',
  difficulty TEXT DEFAULT 'Unassessed',
  prompt TEXT NOT NULL,
  options_json TEXT,
  answer_key TEXT,
  answer_status TEXT DEFAULT 'pending',
  explanation TEXT,
  explanation_status TEXT DEFAULT 'pending',
  explanation_source TEXT,
  reference_url TEXT,
  page_no INTEGER,
  page_images_json TEXT,
  figure_paths_json TEXT,
  content_hash TEXT UNIQUE,
  status TEXT DEFAULT 'review',
  created_at TEXT,
  updated_at TEXT,
  FOREIGN KEY(paper_id) REFERENCES papers(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  paper_id TEXT,
  files_json TEXT,
  report_json TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_questions_paper ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_status ON questions(status);
"""

TOPIC_TERMS = {
    "Spatial Reasoning": [
        "cube", "cuboid", "volume", "surface area", "face", "edge", "vertex",
        "rotate", "rotation", "mirror", "fold", "grid", "polygon", "angle",
        "triangle", "circle", "cylinder", "cone", "sphere", "perspective",
        "isometric", "cross-section", "3d", "three-dimensional"
    ],
    "Visual Reasoning": [
        "figure", "gestalt", "closure", "similarity", "proximity", "continuity",
        "figure-ground", "optical", "illusion", "visual", "image", "shape",
        "colour contrast", "color contrast", "scan path", "composition"
    ],
    "Analytical Reasoning": [
        "sequence", "logic", "logical", "conclusion", "premise", "arrangement",
        "order", "ranking", "syllogism", "deduce", "inference", "if ", "then ",
        "odd one", "group", "classification", "probability"
    ],
    "Pattern Recognition": [
        "pattern", "series", "sequence", "next term", "next figure", "repeats",
        "rotation sequence", "completes", "missing number", "analogy"
    ],
    "Design Awareness": [
        "design", "usability", "interface", "visual hierarchy", "affordance",
        "accessibility", "inclusive", "ux", "user", "prototype", "design process",
        "research", "ideation", "sustainability", "sustainable"
    ],
    "Numerical Reasoning": [
        "average", "percent", "percentage", "ratio", "number", "sum", "product",
        "probability", "fraction", "decimal", "cost", "price", "speed", "time",
        "distance", "area", "perimeter", "lcm", "hcf", "profit", "loss"
    ],
    "General Knowledge": [
        "founded", "institute", "city", "country", "capital", "designer",
        "organisation", "organization", "history", "museum", "award", "company",
        "brand", "festival"
    ],
    "Observation": [
        "how many", "count", "spot", "hidden", "observe", "observation",
        "difference", "missing", "visible", "look carefully"
    ],
    "Language": [
        "synonym", "antonym", "opposite", "meaning", "word", "sentence",
        "grammar", "preposition", "verb", "adjective", "phrase", "idiom"
    ],
    "Indian Culture": [
        "tradition", "traditional", "craft", "saree", "textile", "madhubani",
        "pattachitra", "chikankari", "kalamkari", "warli", "folk", "handloom",
        "festival", "temple", "mural", "ikat", "kantha", "phulkari", "bandhani"
    ],
    "Typography": [
        "font", "typeface", "serif", "sans-serif", "kerning", "leading",
        "tracking", "x-height", "glyph", "letterform", "readability", "legibility"
    ],
    "Design History": [
        "bauhaus", "modernism", "de stijl", "art deco", "art nouveau",
        "arts and crafts", "postmodern", "movement", "movement", "gropius",
        "memphis", "brutalism"
    ],
    "Colour Theory": [
        "colour", "color", "complementary", "analogous", "triadic", "warm",
        "cool", "hue", "saturation", "value", "tint", "shade", "palette"
    ],
    "English": [
        "grammar", "sentence", "preposition", "verb", "adjective", "article",
        "punctuation", "spelling", "vocabulary", "idiom", "phrase"
    ],
    "Materials": [
        "material", "wood", "metal", "plastic", "fabric", "fibre", "fiber",
        "paper", "glass", "ceramic", "rubber", "foam", "alloy", "textile"
    ]
}


def utc_now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def ensure_schema(conn):
    conn.executescript(SCHEMA)
    conn.commit()


def normalize_text(value):
    value = str(value or "").lower()
    value = re.sub(r"[\s\-–—/]+", " ", value)
    value = re.sub(r"[^a-z0-9 ]+", "", value)
    return " ".join(value.split())


def content_hash(exam_id, prompt, options, paper_id=""):
    # Include the paper id so the same question can be preserved in multiple
    # papers. This keeps a paper complete while still deduplicating repeated
    # items inside one upload/paper.
    raw = "|".join([
        normalize_text(exam_id),
        normalize_text(paper_id),
        normalize_text(prompt),
        json.dumps(options, ensure_ascii=False, sort_keys=True)
    ])
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()


def infer_topic(text):
    text = str(text or "").lower()
    best = None
    best_score = 0
    for topic, terms in TOPIC_TERMS.items():
        score = sum(1 for term in terms if term in text)
        if score > best_score:
            best = topic
            best_score = score
    return best or "Unassigned"


def ensure_ocr_binary():
    if sys.platform != "darwin" or not os.path.exists(OCR_SOURCE):
        return None
    swiftc = shutil.which("swiftc")
    if not swiftc:
        return None
    os.makedirs(OCR_CACHE_DIR, exist_ok=True)
    binary = os.path.join(OCR_CACHE_DIR, "ocr_vision")
    if os.path.exists(binary) and os.path.getmtime(binary) >= os.path.getmtime(OCR_SOURCE):
        return binary
    try:
        subprocess.run(
            [swiftc, OCR_SOURCE, "-o", binary],
            check=True,
            capture_output=True,
            text=True,
            timeout=120
        )
        return binary
    except (subprocess.SubprocessError, OSError) as error:
        print("WARN: could not build Vision OCR helper: %s" % error, file=sys.stderr)
        return None


def repair_truncated_question_numbers(text, last_question_no=0):
    """Repair OCR numbers such as "05." for 105 after question 104.

    Scanned NIFT papers sometimes lose the leading hundreds digit, or read a
    leading 1 as I/l. This only rewrites a line when the candidate number is a
    plausible continuation of the previous question number.
    """
    lines = []
    for line in str(text or "").splitlines():
        match = re.match(r"^(\s*)([IlOo0-9]{1,3})\s*([.):])\s+(.*)$", line)
        if not match:
            lines.append(line)
            continue
        token = match.group(2)
        if not any(char.isdigit() for char in token):
            lines.append(line)
            continue
        normalized = (
            token.replace("I", "1")
            .replace("l", "1")
            .replace("O", "0")
            .replace("o", "0")
        )
        if not normalized.isdigit():
            lines.append(line)
            continue
        number = int(normalized)
        if last_question_no >= 10 and number <= last_question_no:
            if last_question_no >= 100 and number >= 10:
                base = (last_question_no // 100) * 100
            else:
                base = (last_question_no // 10) * 10
            candidate = base + number
            if candidate == last_question_no + 1:
                number = candidate
                line = "%s%d%s %s" % (match.group(1), number, match.group(3), match.group(4))
        lines.append(line)
        if number > last_question_no:
            last_question_no = number
    return "\n".join(lines), last_question_no


def reconstruct_ocr_reading_order(items):
    if not items:
        return ""
    # Vision uses a bottom-left origin; higher y is closer to the top.
    ordered = sorted(items, key=lambda item: (-float(item.get("y", 0)), float(item.get("x", 0))))

    def render(row):
        return " ".join(
            str(item.get("text", "")).strip()
            for item in sorted(row, key=lambda item: float(item.get("x", 0)))
            if str(item.get("text", "")).strip()
        )

    rows = []
    for item in ordered:
        text = str(item.get("text", "")).strip()
        if not text:
            continue
        y = float(item.get("y", 0))
        x = float(item.get("x", 0))
        starts_question = bool(re.match(r"^\d{1,3}\.\s*$", text)) or (
            bool(re.match(r"^\d{1,3}\.\s+", text)) and x < 0.28
        )
        if rows and abs(y - rows[-1]["y"]) <= 0.004 and not starts_question:
            rows[-1]["items"].append(item)
        else:
            rows.append({"y": y, "items": [item]})
    return "\n".join(line for line in (render(row["items"]) for row in rows) if line)


def ocr_image(binary, image_path):
    try:
        result = subprocess.run(
            [binary, image_path],
            check=False,
            capture_output=True,
            text=True,
            timeout=60
        )
    except (subprocess.SubprocessError, OSError) as error:
        print("WARN: OCR failed for %s: %s" % (image_path, error), file=sys.stderr)
        return ""
    if result.returncode != 0:
        print(
            "WARN: OCR helper exited %s for %s: %s"
            % (result.returncode, image_path, (result.stderr or "").strip()),
            file=sys.stderr
        )
        return ""
    items = []
    plain = []
    for line in (result.stdout or "").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            payload = json.loads(line)
            if isinstance(payload, dict) and payload.get("text"):
                items.append(payload)
                continue
        except json.JSONDecodeError:
            pass
        plain.append(line)
    if items:
        return reconstruct_ocr_reading_order(items)
    return "\n".join(plain).strip()


def extract_pdf_text_and_pages(
    pdf_path,
    media_dir,
    paper_id,
    use_ocr=False,
    image_format="png",
    page_start=1,
    page_end=None
):
    if fitz is None:
        raise RuntimeError("PyMuPDF is required. Install with: python3 -m pip install --user pymupdf")
    doc = fitz.open(pdf_path)
    pages = []
    image_dir = os.path.join(media_dir, paper_id)
    os.makedirs(image_dir, exist_ok=True)
    ocr_binary = ensure_ocr_binary() if use_ocr else None
    if use_ocr and not ocr_binary:
        print("WARN: OCR requested but Apple Vision/swiftc is unavailable; using embedded text only.", file=sys.stderr)
    ext = ".jpg" if str(image_format).lower() in ("jpg", "jpeg") else ".png"
    first_index = max(0, int(page_start or 1) - 1)
    last_index = min(len(doc), int(page_end)) if page_end else len(doc)
    if last_index <= first_index:
        raise SystemExit("Invalid page range: %s-%s" % (page_start, page_end))
    total = last_index - first_index
    last_question_no = 0
    for index in range(first_index, last_index):
        page = doc[index]
        page_no = index + 1
        current = index - first_index + 1
        text = page.get_text("text") or ""
        pix = page.get_pixmap(dpi=170 if use_ocr else 144, alpha=False)
        if use_ocr and ocr_binary and not text.strip():
            temp_path = os.path.join(
                tempfile.gettempdir(),
                "dexam-ocr-%s-%03d.png" % (re.sub(r"[^a-zA-Z0-9_-]+", "-", paper_id), page_no)
            )
            try:
                pix.save(temp_path)
                text = ocr_image(ocr_binary, temp_path)
            finally:
                try:
                    os.remove(temp_path)
                except OSError:
                    pass
            if current % 10 == 0 or current == total:
                print("OCR %s: page %d/%d" % (paper_id, current, total), file=sys.stderr)
        if use_ocr:
            if re.search(r"INSTRUCTIONS\s+TO\s+CANDIDATE|DO\s+NOT\s+OPEN\s+THIS\s+BOOKLET", text, re.I):
                # Instruction pages contain their own numbered list; do not let
                # it become the sequence anchor for the actual questions.
                last_question_no = 0
            else:
                text, last_question_no = repair_truncated_question_numbers(text, last_question_no)
        image_name = "page-%03d%s" % (page_no, ext)
        image_path = os.path.join(image_dir, image_name)
        if ext == ".jpg":
            pix.save(image_path, jpg_quality=82)
        else:
            pix.save(image_path)
        pages.append({
            "page_no": page_no,
            "text": text,
            "image_path": image_path,
            "image_rel": os.path.join("server", "data", "media", paper_id, image_name)
        })
    return pages


def extract_text_from_answer_file(path):
    if not path:
        return ""
    if fitz is None:
        raise RuntimeError("PyMuPDF is required. Install with: python3 -m pip install --user pymupdf")
    suffix = os.path.splitext(path)[1].lower()
    if suffix in (".txt", ".csv"):
        with open(path, "r", encoding="utf-8", errors="replace") as handle:
            return handle.read()
    doc = fitz.open(path)
    return "\n".join(page.get_text("text") or "" for page in doc)


def clean_answer(value):
    value = re.sub(r"\s+", " ", str(value or "")).strip()
    if not value:
        return ""
    # Keep official alternatives such as "B,C or B,C,D" intact, but remove
    # table noise and punctuation around single letters.
    value = value.replace("–", "-")
    if re.match(r"^[A-F](?:\s*,\s*[A-F])*$", value, re.I):
        return value.upper().replace(" ", "")
    return value


def parse_section_map(text):
    """Return {question_number: type} from the paper's instruction section.

    Explicit "Questions from 15 to 29..." ranges are the most reliable signal.
    When a paper omits the first section's range, the leading gap is treated as
    NAT. A count-based fallback covers papers that only state section sizes.
    """
    if not text:
        return {}
    type_terms = [
        ("NAT", ["numerical answer type"]),
        ("MSQ", ["multiple select"]),
        ("MCQ", ["multiple choice"])
    ]

    def nearest_type(prefix):
        lowered = prefix.lower()
        best = None
        best_position = -1
        for kind, terms in type_terms:
            for term in terms:
                position = lowered.rfind(term)
                if position > best_position:
                    best = kind
                    best_position = position
        return best if best_position >= 0 else None

    range_pattern = re.compile(
        r"Questions?\s+(?:from\s+)?(\d+)\s*(?:-|to|–)\s*(\d+)\s+belong\s+to\s+this\s+section",
        re.I
    )
    result = {}
    ranges = []
    for match in range_pattern.finditer(text):
        start = int(match.group(1))
        end = int(match.group(2))
        kind = nearest_type(text[max(0, match.start() - 2500):match.start()])
        if not kind or start > end:
            continue
        ranges.append((start, end, kind))
    if ranges:
        first_start = min(item[0] for item in ranges)
        if first_start > 1:
            for number in range(1, first_start):
                result[str(number)] = "NAT"
        for start, end, kind in ranges:
            for number in range(start, end + 1):
                result[str(number)] = kind
        # Fill any gap between declared ranges using the next section type.
        ordered = sorted(ranges)
        for index in range(len(ordered) - 1):
            current_end = ordered[index][1]
            next_start = ordered[index + 1][0]
            for number in range(current_end + 1, next_start):
                result[str(number)] = ordered[index + 1][2]
        return result

    section_pattern = re.compile(
        r"Section\s*(?:[A-C]|[1-3])\b[^.]{0,240}?contains\s+a\s+total\s+of\s+"
        r"(\d+)\s+(Numerical\s+Answer\s+Type|Multiple\s+Select|Multiple\s+Choice)",
        re.I | re.S
    )
    seen = set()
    sections = []
    for match in section_pattern.finditer(text):
        count = int(match.group(1))
        key = " ".join(match.group(2).lower().split())
        kind = "NAT" if "numerical" in key else "MSQ" if "select" in key else "MCQ"
        if kind not in seen and count > 0:
            sections.append((kind, count))
            seen.add(kind)
    start = 1
    for kind, count in sections:
        for number in range(start, start + count):
            result[str(number)] = kind
        start += count
    return result


def parse_answer_key(text):
    """Parse common official answer-key layouts.

    UCEED-style keys are column tables, so reading line pairs is more reliable
    than searching for "1. B" patterns.
    """
    answers = {}
    if not text:
        return answers
    sections = list(re.finditer(
        r"SECTION\s*[–\-]\s*[A-C]\s*\(\s*(NAT|MSQ|MCQ)\s*\)",
        text,
        re.I
    ))
    if sections:
        for index, section in enumerate(sections):
            kind = section.group(1).upper()
            start = section.end()
            end = sections[index + 1].start() if index + 1 < len(sections) else len(text)
            lines = [line.strip() for line in text[start:end].splitlines()]
            lines = [
                line for line in lines
                if line and not re.match(r"^q\.?\s*no\.?$", line, re.I)
                and not re.match(r"^(key|keys|key\s+range)$", line, re.I)
            ]
            expected = 1 if kind == "NAT" else (15 if kind == "MSQ" else 30)
            cursor = 0
            while cursor < len(lines) - 1:
                number_text = lines[cursor]
                if re.match(r"^0?%d$" % expected, number_text):
                    answer = clean_answer(lines[cursor + 1])
                    if answer:
                        answers[str(expected)] = answer
                        expected += 1
                    cursor += 2
                else:
                    cursor += 1

    if answers:
        return answers

    # Fallback for simple line-based keys such as "1. B" or "Q1 - 24".
    patterns = [
        re.compile(r"(?im)^\s*(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):\-]?\s*[\(\[]?([A-F](?:\s*[,&/]\s*[A-F])*|\d+(?:\s*-\s*\d+)?(?:\.\d+)?|true|false)[\)\]]?\s*$"),
        re.compile(r"(?i)\b(?:Q(?:uestion)?\.?\s*)?(\d{1,3})\s*[.):\-]?\s*[\(\[]?([A-F](?:\s*[,&/]\s*[A-F])*|\d+(?:\s*-\s*\d+)?(?:\.\d+)?)[\)\]]?\b")
    ]
    for pattern in patterns:
        for line in text.splitlines():
            match = pattern.search(line.strip())
            if not match:
                continue
            number = str(int(match.group(1)))
            answer = clean_answer(match.group(2))
            if number not in answers and answer:
                answers[number] = answer
        if answers:
            break
    return answers


def find_question_markers(text):
    # Official UCEED papers use headers such as "Q.01", "Q.30" and "Q.36.".
    # Prefer explicit Q markers so instructions like "1. The total duration..."
    # are never mistaken for questions.
    q_pattern = re.compile(r"(?m)^\s*Q(?:uestion)?\s*\.?\s*(\d{1,3})\s*[.)]?\s*")
    numbered_pattern = re.compile(r"(?m)^\s*(\d{1,3})\s*[.):]\s+")

    def collect(pattern):
        found = []
        for match in pattern.finditer(text):
            number = int(match.group(1))
            piece = text[match.start():match.start() + 400]
            if len(piece.strip()) < 20:
                continue
            found.append((number, match.start(), match.end()))
        seen = set()
        unique = []
        for number, start, end in found:
            if number in seen:
                continue
            seen.add(number)
            unique.append((number, start, end))
        return unique

    markers = collect(q_pattern)
    if len(markers) >= 5:
        # A few official papers drop the punctuation after a question number.
        # Recover only bare numbers that fill a gap in the Q-marker sequence.
        seen = {item[0] for item in markers}
        bare_pattern = re.compile(r"(?m)^\s*(\d{1,3})\s+(?=[A-Z])")
        bare = []
        for match in bare_pattern.finditer(text):
            number = int(match.group(1))
            if number in seen:
                continue
            if number < min(seen) or number > max(seen) + 1:
                continue
            if len(text[match.start():match.start() + 200].strip()) < 20:
                continue
            bare.append((number, match.start(), match.end()))
        if bare:
            combined = markers + bare
            combined.sort(key=lambda item: item[1])
            markers = combined
        return markers
    question_no_pattern = re.compile(
        r"(?im)^[ \t]*(?:[^\n]{0,20}?/[ \t]*)?Question[ \t]*(?:No\.?|Number)?[ \t]*[-:.]?[ \t]*(\d{1,3})\b"
    )
    question_no_markers = collect(question_no_pattern)
    if question_no_markers:
        return question_no_markers
    fallback = collect(numbered_pattern)
    if fallback:
        seen = {item[0] for item in fallback}
        bare_pattern = re.compile(r"(?m)^\s*(\d{1,3})\s+(?=[A-Z])")
        bare = []
        for match in bare_pattern.finditer(text):
            number = int(match.group(1))
            if number in seen:
                continue
            if number < min(seen) or number > max(seen) + 1:
                continue
            if len(text[match.start():match.start() + 200].strip()) < 20:
                continue
            bare.append((number, match.start(), match.end()))
        if bare:
            combined = fallback + bare
            combined.sort(key=lambda item: item[1])
            fallback = combined
    return fallback if len(fallback) >= len(markers) else markers


def page_for_offset(pages, offset):
    cursor = 0
    for page in pages:
        cursor += len(page["text"]) + 1
        if offset < cursor:
            return page
    return pages[-1] if pages else None


def clean_block_text(block):
    lines = []
    for line in str(block or "").splitlines():
        stripped = line.strip()
        if re.match(r"^(UCEED|CEED|NIFT|NID)\s+\d{4}$", stripped, re.I):
            continue
        if re.match(r"^Page\s+\d+\s+of\s+\d+$", stripped, re.I):
            continue
        if re.match(r"^[A-Z0-9]{1,8}[-/][A-Z0-9/-]{2,}$", stripped):
            continue
        if re.match(r"^\(\d{1,3}\)$", stripped):
            continue
        if re.match(r"^(for the given words|in bold in the sentence|the sentence\.)$", stripped, re.I):
            continue
        if re.match(r"^Directions\b", stripped, re.I):
            break
        if re.match(r"^(Section\s+\d+|Part\s+[AB])\b", stripped, re.I):
            break
        lines.append(line.rstrip())
    text = "\n".join(lines).strip()
    text = re.split(r"\s+Directions\s+\(Questions", text, maxsplit=1, flags=re.I)[0].strip()
    text = re.sub(r"\s+(for the given words|in bold in the sentence|the sentence)\.?\s*$", "", text, flags=re.I)
    text = re.sub(r"\s+[A-Z]{1,6}\s+\d{2,}[A-Z0-9/ ]*\(\s*\d+\s*\)\s*$", "", text)
    return text


def parse_options(block):
    block = clean_block_text(block)

    def split_markers(matches, min_distinct):
        if len({match.group(1) for match in matches}) < min_distinct:
            return None
        if len(matches) > 4:
            matches = matches[:4]
        options = []
        for index, match in enumerate(matches):
            start = match.end()
            end = matches[index + 1].start() if index + 1 < len(matches) else len(block)
            text = " ".join(block[start:end].split()).strip()
            if text:
                options.append({"id": match.group(1), "text": text})
        if not options:
            return None
        options.sort(key=lambda item: (0, int(item["id"])) if str(item["id"]).isdigit() else (1, str(item["id"])))
        return block[:matches[0].start()].strip(), options

    # Letter options, line-start then inline.
    letter_line = re.compile(r"(?m)^\s*[\(\[]?([A-D])[\)\].:]\s*")
    letter_inline = re.compile(r"(?<!\w)([A-D])[\.\)]\s+")
    # NIFT-style numeric options, normally written as (1), (2), (3), (4).
    numeric_line = re.compile(r"(?m)^\s*[\(\[]([1-4])[\)\]]\s*")
    numeric_inline = re.compile(r"(?<!\w)[\(\[]([1-4])[\)\]]\s*")

    for pattern, min_distinct in (
        (letter_line, 2),
        (letter_inline, 3),
        (numeric_inline, 3),
        (numeric_line, 3)
    ):
        result = split_markers(list(pattern.finditer(block)), min_distinct)
        if result:
            return result
    return block.strip(), []


def fix_ocr_question_prompts(blocks):
    """Move a short prompt line that OCR placed after its question number."""
    for index in range(1, len(blocks)):
        current = blocks[index]
        raw = str(current.get("raw") or "").strip()
        if not raw:
            continue
        first_line = raw.splitlines()[0].strip()
        if not re.match(r"^[\(\[]?[1-4A-D][\)\].:]\s*", first_line):
            continue
        previous_lines = str(blocks[index - 1].get("raw") or "").rstrip().splitlines()
        if not previous_lines:
            continue
        last_line = previous_lines[-1].strip()
        if not last_line or len(last_line) > 90:
            continue
        if re.match(r"^[\(\[]?[1-4A-D][\)\].:]\s*", last_line):
            continue
        if re.match(r"^(Directions|For the given|In bold)\b", last_line, re.I):
            continue
        previous_lines.pop()
        blocks[index - 1]["raw"] = "\n".join(previous_lines).rstrip()
        current["raw"] = last_line + "\n" + raw
    return blocks


def page_images_for_range(pages, start, end):
    images = []
    cursor = 0
    for page in pages:
        page_start_offset = cursor
        page_end_offset = cursor + len(page["text"])
        if page_start_offset < end and page_end_offset > start:
            local_start = max(start, page_start_offset) - page_start_offset
            local_end = min(end, page_end_offset) - page_start_offset
            overlap = page["text"][local_start:local_end]
            meaningful = [
                line for line in overlap.splitlines()
                if line.strip()
                and not re.match(r"^(UCEED|CEED|NIFT|NID)\s+\d{4}$", line.strip(), re.I)
                and not re.match(r"^Page\s+\d+\s+of\s+\d+$", line.strip(), re.I)
            ]
            if meaningful:
                images.append(page["image_rel"])
        cursor = page_end_offset + 1
    return images


def build_question_blocks(full, pages, markers, part_label=None):
    blocks = []
    for index, (number, start, end) in enumerate(markers):
        block_end = markers[index + 1][1] if index + 1 < len(markers) else len(full)
        raw = full[end:block_end].strip()
        page_start = page_for_offset(pages, start)
        start_no = page_start["page_no"] if page_start else 1
        question_no = str(number) if not part_label else "%s%d" % (part_label, index + 1)
        blocks.append({
            "question_no": question_no,
            "raw": raw,
            "page_no": start_no,
            "page_images": page_images_for_range(pages, start, block_end)
        })
    return blocks


def fill_image_only_gaps(blocks, pages):
    """Create image-only records for textless pages inside a numbering gap."""
    page_by_no = {page["page_no"]: page for page in pages}
    numeric = [
        (index, block) for index, block in enumerate(blocks)
        if str(block.get("question_no", "")).isdigit()
    ]
    additions = []
    for position, (index, block) in enumerate(numeric[:-1]):
        current_no = int(block["question_no"])
        next_index, next_block = numeric[position + 1]
        next_no = int(next_block["question_no"])
        if next_no - current_no <= 1:
            continue
        empty_pages = [
            page for page in pages
            if block["page_no"] < page["page_no"] < next_block["page_no"]
            and not page["text"].strip()
        ]
        for offset, page in enumerate(empty_pages):
            missing_no = current_no + 1 + offset
            if missing_no >= next_no:
                break
            additions.append((index + 1, {
                "question_no": str(missing_no),
                "raw": "",
                "page_no": page["page_no"],
                "page_images": [page["image_rel"]]
            }))
    if not additions:
        return blocks
    result = list(blocks)
    for index, block in sorted(additions, key=lambda item: item[0], reverse=True):
        result.insert(index, block)
    return result


def parse_questions(pages, fill_gaps=True):
    full = "\n".join(page["text"] for page in pages)
    part_b_match = re.search(
        r"(?im)^\s*PART\s*[-–]?\s*B\s*(?:\([^)\n]{0,80}\))?\s*$",
        full
    )
    part_b_start = part_b_match.start() if part_b_match else None
    part_a = full[:part_b_start] if part_b_start is not None else full
    markers = find_question_markers(part_a)
    if not markers:
        # Fallback: one block per page, useful for visual-only papers.
        blocks = []
        for page in pages:
            text = page["text"].strip()
            if not text:
                continue
            blocks.append({
                "question_no": str(page["page_no"]),
                "raw": text,
                "page_no": page["page_no"],
                "page_images": [page["image_rel"]]
            })
        return blocks

    blocks = build_question_blocks(full, pages, markers)
    if fill_gaps:
        blocks = fill_image_only_gaps(blocks, pages)
    blocks = fix_ocr_question_prompts(blocks)
    if part_b_start is None:
        return blocks

    part_b = full[part_b_start:]
    b_markers = find_question_markers(part_b)
    if b_markers:
        offset = part_b_start
        adjusted = [(number, start + offset, end + offset) for number, start, end in b_markers]
        blocks.extend(build_question_blocks(full, pages, adjusted, "B"))
    else:
        heading_end = part_b_match.end()
        raw = full[heading_end:].strip()
        if raw:
            page_start = page_for_offset(pages, heading_end)
            blocks.append({
                "question_no": "B1",
                "raw": raw,
                "page_no": page_start["page_no"] if page_start else 1,
                "page_images": page_images_for_range(pages, heading_end, len(full))
            })
    return blocks


def ollama_solve(model, base_url, prompt, options, answer_key):
    if not model:
        return None
    option_text = "\n".join("%s. %s" % (item["id"], item["text"]) for item in options)
    body = {
        "model": model,
        "stream": False,
        "prompt": (
            "You are helping build an independent study bank. Solve this question "
            "without copying any third-party explanation. Give a concise step-by-step "
            "reasoning and finish with a line exactly like 'FINAL: <answer>'.\n\n"
            "Question:\n%s\n\nOptions:\n%s\n\nOfficial answer key: %s\n"
            % (prompt, option_text or "(no options)", answer_key or "(not supplied)")
        )
    }
    request = urllib.request.Request(
        base_url.rstrip("/") + "/api/generate",
        data=json.dumps(body).encode("utf-8"),
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    try:
        with urllib.request.urlopen(request, timeout=90) as response:
            payload = json.loads(response.read().decode("utf-8"))
        return str(payload.get("response") or "").strip() or None
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError) as error:
        print("WARN: Ollama unavailable: %s" % error, file=sys.stderr)
        return None


def infer_type(options, answer, prompt="", section_type="", default_type=""):
    if section_type in ("NAT", "MSQ", "MCQ", "DESCRIPTIVE"):
        return section_type
    answer_letters = re.findall(r"[A-F]", str(answer or "").upper())
    if len(answer_letters) > 1:
        return "MSQ"
    if len(answer_letters) == 1:
        return "MCQ"
    if len(options) >= 3:
        return "MCQ"
    if default_type in ("NAT", "MSQ", "MCQ", "DESCRIPTIVE"):
        return default_type
    if re.search(r"\b(draw|sketch|design|illustrate|compose|create|make a)\b", prompt, re.I):
        return "DESCRIPTIVE"
    return "NAT"


def main():
    parser = argparse.ArgumentParser(description="Ingest an official exam PDF into SQLite.")
    parser.add_argument("--paper", required=True, help="Question-paper PDF")
    parser.add_argument("--answers", help="Answer-key PDF or text/CSV file")
    parser.add_argument("--exam", required=True, help="Exam id: uceed, ceed, nift, nid")
    parser.add_argument("--year", type=int, help="Exam year")
    parser.add_argument("--paper-id", help="Stable paper id, e.g. nift-bdes-written-sample")
    parser.add_argument("--title", help="Human-readable paper title")
    parser.add_argument("--db", default="server/data/dexam.sqlite")
    parser.add_argument("--media-root", default="server/data/media")
    parser.add_argument("--ocr", action="store_true", help="Apply Apple Vision OCR to image-only pages")
    parser.add_argument("--image-format", default="png", choices=["png", "jpg", "jpeg"])
    parser.add_argument("--page-start", type=int, default=1, help="First PDF page to ingest (1-based)")
    parser.add_argument("--page-end", type=int, help="Last PDF page to ingest (inclusive)")
    parser.add_argument("--no-gap-fill", action="store_true", help="Do not synthesize records for blank pages inside a numbering gap")
    parser.add_argument("--default-type", choices=["NAT", "MSQ", "MCQ", "DESCRIPTIVE"], help="Fallback type when the paper gives no section or answer signal")
    parser.add_argument("--ollama-model", help="Optional local Ollama model for independent solution drafts")
    parser.add_argument("--ollama-url", default="http://127.0.0.1:11434")
    parser.add_argument("--replace", action="store_true", help="Replace questions for this paper id")
    parser.add_argument("--json", action="store_true", help="Print a JSON report as the last line")
    args = parser.parse_args()

    if args.paper_id:
        paper_id = re.sub(r"[^a-z0-9_-]+", "-", args.paper_id.lower()).strip("-")
    else:
        paper_id = "%s-%s" % (args.exam.lower(), args.year or "paper")
    if not paper_id:
        raise SystemExit("A valid --paper-id is required.")
    pages = extract_pdf_text_and_pages(
        args.paper,
        args.media_root,
        paper_id,
        use_ocr=args.ocr,
        image_format=args.image_format,
        page_start=args.page_start,
        page_end=args.page_end
    )
    answer_text = extract_text_from_answer_file(args.answers)
    answer_key = parse_answer_key(answer_text)
    section_map = parse_section_map("\n".join(page["text"] for page in pages))
    blocks = parse_questions(pages, fill_gaps=not args.no_gap_fill)

    os.makedirs(os.path.dirname(args.db) or ".", exist_ok=True)
    conn = sqlite3.connect(args.db)
    ensure_schema(conn)
    now = utc_now()

    if args.replace:
        conn.execute("DELETE FROM questions WHERE paper_id = ?", (paper_id,))
        conn.execute("DELETE FROM papers WHERE id = ?", (paper_id,))

    conn.execute(
        "INSERT OR REPLACE INTO papers (id, exam_id, year, title, source_note, question_pdf, answer_pdf, page_count, imported_at, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (
            paper_id,
            args.exam.lower(),
            args.year,
            args.title or (
                "%s %s official paper" % (args.exam.upper(), args.year)
                if args.year else "%s official paper" % args.exam.upper()
            ),
            "User-supplied official paper. Explanations must be independently generated and verified.",
            os.path.abspath(args.paper),
            os.path.abspath(args.answers) if args.answers else None,
            len(pages),
            now,
            "imported"
        )
    )

    inserted = 0
    duplicates = 0
    matched_answers = 0
    pending_review = 0
    for block in blocks:
        prompt, options = parse_options(block["raw"])
        question_no = block["question_no"]
        if not prompt:
            prompt = "(Image-only question - see page image.)"
        answer = answer_key.get(question_no, "")
        if answer:
            matched_answers += 1
        question_type = infer_type(
            options,
            answer,
            prompt,
            section_map.get(question_no, ""),
            args.default_type or ""
        )
        if str(question_no).startswith("B"):
            question_type = "DESCRIPTIVE"
        topic = infer_topic(prompt + " " + " ".join(item["text"] for item in options))
        hash_prompt = prompt
        if prompt == "(Image-only question - see page image.)":
            hash_prompt = "%s:%s" % (paper_id, question_no)
        question_hash = content_hash(args.exam, hash_prompt, options, paper_id)
        explanation = None
        explanation_status = "pending"
        explanation_source = None
        if args.ollama_model:
            explanation = ollama_solve(args.ollama_model, args.ollama_url, prompt, options, answer)
            if explanation:
                explanation_status = "ai-draft"
                explanation_source = "ollama:" + args.ollama_model
        if not answer or not explanation:
            pending_review += 1

        question_id = "%s-q%s" % (paper_id, re.sub(r"[^a-zA-Z0-9_-]+", "-", question_no))
        try:
            conn.execute(
                """INSERT INTO questions
                (id, paper_id, question_no, question_type, topic, subtopic, difficulty, prompt,
                 options_json, answer_key, answer_status, explanation, explanation_status,
                 explanation_source, reference_url, page_no, page_images_json, figure_paths_json,
                 content_hash, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    question_id,
                    paper_id,
                    question_no,
                    question_type,
                    topic,
                    "",
                    "Unassessed",
                    prompt,
                    json.dumps(options, ensure_ascii=False),
                    answer,
                    "official-key" if answer else "pending",
                    explanation,
                    explanation_status,
                    explanation_source,
                    None,
                    block["page_no"],
                    json.dumps(block["page_images"], ensure_ascii=False),
                    "[]",
                    question_hash,
                    "review" if not answer or not explanation else "needs-verification",
                    now,
                    now
                )
            )
            inserted += 1
        except sqlite3.IntegrityError:
            duplicates += 1

    report = {
        "paper_id": paper_id,
        "exam": args.exam,
        "year": args.year,
        "title": args.title,
        "pages": len(pages),
        "page_start": args.page_start,
        "page_end": args.page_end,
        "ocr": bool(args.ocr),
        "image_format": args.image_format,
        "questions_found": len(blocks),
        "inserted": inserted,
        "duplicates": duplicates,
        "answer_key_entries": len(answer_key),
        "answers_matched": matched_answers,
        "pending_review": pending_review,
        "db": os.path.abspath(args.db)
    }
    conn.execute(
        "INSERT INTO imports (paper_id, files_json, report_json, created_at) VALUES (?, ?, ?, ?)",
        (
            paper_id,
            json.dumps({"paper": args.paper, "answers": args.answers}),
            json.dumps(report, ensure_ascii=False),
            now
        )
    )
    conn.commit()
    conn.close()
    if args.json:
        print(json.dumps(report, ensure_ascii=False))
    else:
        print(json.dumps(report, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
