#!/usr/bin/env python3
"""Stage 2 of the question-paper ingestion pipeline: segmentation.

Reads <work>/<paper-id>/01-intake/ and writes <work>/<paper-id>/02-segments/:

    questions.json   one record per question: part, number, section and type,
                     prompt text, options, figure placements, page regions, flags
    ocr/page-NNN.json OCR lines merged into pages flagged by stage 1

How it works:
1. Lines come from the PDF text layer. On pages stage 1 flagged, OCR lines
   (Apple Vision, local) are added where the text layer has nothing.
2. Repeated page furniture (running headers, "Page 4 of 32") is set aside.
3. Question markers ("Q.01", "Q.42 text", "Q. 58", "12.") are candidates; the
   questions are the longest run numbered 1, 2, 3 ... so numbered instruction
   lists are ignored. Part B follows a "PART B" heading, whether it restarts
   at 1 (CEED) or continues the numbering (UCEED).
4. Each question spans from its marker to the next one, across pages.

Operator-only, deterministic for the same intake and OCR output.
See docs/ingestion/PLAN.md.
"""

import argparse
import hashlib
import math
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

SCHEMA = 1
STAGE = "02-segments"
INTAKE = "01-intake"
OCR_CACHE = "ocr-vision-v1"
REPO_ROOT = pathlib.Path(__file__).resolve().parents[3]
OCR_SOURCE = REPO_ROOT / "tools" / "ocr_vision.swift"

MARKER_RE = re.compile(r"^\s*(?:Q\s*\.?\s*(\d{1,3})\b\s*[.):\-]?|(\d{1,3})\s*[.)])(?:\s+|$)", re.I)
# A number alone on its line: what is left when a text layer drops the "Q." of "Q.55".
LONE_RE = re.compile(r"^\s*(\d{1,3})\s*$")
OPTION_RE = re.compile(r"^\s*(?:\(([A-D])\)|([A-D])[.)])\s+(\S.*)$")
OPTION_LABEL_RE = re.compile(r"^\s*\(?([A-D])\)?\s*$")
PART_B_RE = re.compile(r"^\s*part\s*[-–—]?\s*b\b", re.I)
SECTION_RE = re.compile(r"\bsection\s*(?:[0-9]+|[ivx]+|[a-c])\b", re.I)
TYPE_WORDS = [
    ("NAT", re.compile(r"numerical\s+answer|\bNAT\b", re.I)),
    ("MSQ", re.compile(r"multiple\s+select|\bMSQ\b", re.I)),
    ("MCQ", re.compile(r"multiple\s+choice|\bMCQ\b", re.I)),
]
PAGE_NO_RE = re.compile(r"\bpage\s*\d+\s*of\s*\d+\b|\|\s*\d+\s*of\s*\d+\s*$", re.I)
FURNITURE_BAND = 0.07
PHOTO_LAYOUT_WIDTH = 595
PHOTO_OPTION_ROLES = {f"option-{key}" for key in "ABCD"}
MAX_SKIP = 2
# Stage 1 flags pages with a lot of ink the text layer misses. A lost "Q.02" label is
# far smaller than that, so stage 2 also reads pages with slight unexplained ink, and
# every page of a paper that has any flagged page. Clean official papers measure 0.
OCR_SLIGHT_INK = 0.0003  # a run may skip at most this many unseen numbers (flagged)


class SegmentError(Exception):
    """A refusal the operator can act on. The message is safe to print."""


# ---------------------------------------------------------------- OCR


def vision_ocr(work_root):
    """Return an OCR function backed by the local Apple Vision helper, compiled once."""
    binary = work_root / ".tools" / "ocr_vision"

    def run(render_path):
        if not binary.exists():
            if not OCR_SOURCE.exists() or not shutil.which("swiftc"):
                raise SegmentError("OCR needs macOS with swiftc and tools/ocr_vision.swift")
            binary.parent.mkdir(parents=True, exist_ok=True)
            subprocess.run(["swiftc", "-O", str(OCR_SOURCE), "-o", str(binary)], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        result = subprocess.run([str(binary), str(render_path)], check=True, capture_output=True, text=True)
        rows = []
        for line in result.stdout.splitlines():
            row = json.loads(line)
            rows.append({"text": row["text"], "x": row["x"], "y": row["y"], "w": row["w"], "h": row["h"]})
        return rows

    return run


def ocr_lines(rows, width_pt, height_pt):
    """Vision boxes are normalised with the origin at the bottom left; convert to PDF points."""
    lines = []
    for row in rows:
        text = " ".join(str(row["text"]).split())
        if not text:
            continue
        x0, x1 = row["x"] * width_pt, (row["x"] + row["w"]) * width_pt
        y0, y1 = (1 - row["y"] - row["h"]) * height_pt, (1 - row["y"]) * height_pt
        lines.append({"box": [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)], "text": text,
                      "size": round(y1 - y0, 2), "bold": None, "source": "ocr"})
    return lines


def overlap_share(box, others):
    """Share of box's area covered by any of the other boxes (pairwise, capped at 1)."""
    x0, y0, x1, y1 = box
    area = max((x1 - x0) * (y1 - y0), 1e-6)
    covered = 0.0
    for a0, b0, a1, b1 in others:
        w, h = min(x1, a1) - max(x0, a0), min(y1, b1) - max(y0, b0)
        if w > 0 and h > 0:
            covered += w * h
    return min(1.0, covered / area)


def merge_ocr(text_lines, ocr, figure_boxes):
    """Keep text-layer lines; add OCR lines the text layer does not already cover."""
    merged = [dict(line, source="text") for line in text_lines]
    taken = [line["box"] for line in text_lines]
    for line in ocr:
        if overlap_share(line["box"], taken) >= 0.5:
            # The text layer has this line's words but may have lost its question
            # marker ("Q.19" drawn separately). Keep the marker on its own.
            marker = MARKER_RE.match(line["text"])
            if marker and len(line["text"]) > marker.end():
                x0, y0, x1, y1 = line["box"]
                width = (x1 - x0) * len(marker.group(0).rstrip()) / len(line["text"])
                box = [x0, y0, round(x0 + width, 2), y1]
                if overlap_share(box, taken) < 0.5:
                    merged.append(dict(line, text=marker.group(0).strip(), box=box, inFigure=False))
            continue
        line = dict(line)
        line["inFigure"] = overlap_share(line["box"], figure_boxes) >= 0.6
        merged.append(line)
    return merged


# ---------------------------------------------------------------- layout


def furniture_keys(pages):
    """Normalised texts of header/footer lines that repeat across pages."""
    counts = {}
    for page in pages:
        seen = set()
        for line in page["lines"]:
            if band(line, page) and line["text"].strip():
                key = re.sub(r"\d+", "#", line["text"].lower()).strip()
                if key not in seen:
                    counts[key] = counts.get(key, 0) + 1
                    seen.add(key)
    needed = max(3, int(0.3 * len(pages)))
    return {key for key, count in counts.items() if count >= needed}


def band(line, page):
    centre = (line["box"][1] + line["box"][3]) / 2
    return centre < page["heightPt"] * FURNITURE_BAND or centre > page["heightPt"] * (1 - FURNITURE_BAND)


def is_furniture(line, page, keys):
    if not band(line, page):
        return False
    key = re.sub(r"\d+", "#", line["text"].lower()).strip()
    return key in keys or bool(PAGE_NO_RE.search(line["text"]))


def body_left(pages):
    """The usual left edge of body text, so markers must sit at the margin."""
    lefts = sorted(round(line["box"][0]) for page in pages for line in page["lines"] if not line.get("furniture"))
    return lefts[len(lefts) // 10] if lefts else 0


def marker_of(line, left):
    if line.get("furniture") or line.get("inFigure") or line["box"][0] > left + 24:
        return None
    match = MARKER_RE.match(line["text"])
    if not match:
        lone = LONE_RE.match(line["text"])
        if lone and int(lone.group(1)) > 0:
            return {"number": int(lone.group(1)), "rest": "", "explicit": "lone"}
        return None
    number = int(match.group(1) or match.group(2))
    if number == 0:
        return None
    return {"number": number, "rest": line["text"][match.end():].strip(), "explicit": bool(match.group(1))}


def best_run(candidates, start_number=1, after=-1, only_style=None):
    """Longest run start_number, +1, +2 ... in reading order, beginning after index `after`.

    candidates: list of (order, number, style). A run keeps one marker style ("Q.1" or "1."),
    gaps of up to MAX_SKIP numbers are allowed (and reported), and of two equally long runs
    the later one wins: numbered instructions come before the questions and may flow into
    their numbering."""
    best = []
    for begin, (order, number, style) in enumerate(candidates):
        if order <= after or number != start_number or (only_style is not None and style != only_style):
            continue
        same = [(o, n, st) for o, n, st in candidates[begin + 1:] if st == style or st == "lone"]
        run = [(order, number)]
        current = number
        for later_order, later_number, later_style in same:
            if later_style == "lone" and later_number != current + 1:
                continue  # a lone number only fills the exact next slot
            if current < later_number <= current + 1 + MAX_SKIP:
                # Prefer the exact next number if it appears before a skipping one.
                if later_number != current + 1 and any(
                        run[-1][0] < o < later_order and n == current + 1 for o, n, _ in same):
                    continue
                run.append((later_order, later_number))
                current = later_number
        # Equal length: the later run wins only when the runs share markers, i.e. the
        # earlier one is a numbered list that flowed into the real numbering.
        if len(run) > len(best) or (len(run) == len(best) and set(run) & set(best)):
            best = run
    return best


LABEL_ONLY_RE = re.compile(r"^\s*(?:\(?[A-D]\)|[A-D][.)]|Q\s*\.?\s*\d{1,3}\s*[.):]?|\d{1,3}[.)])\s*$", re.I)


def reading_order(lines):
    """Group lines into rows by vertical overlap, order rows top to bottom and lines left to right.
    A lone label ("A.", "Q.18") is joined to the text that starts just right of it on the same row."""
    rows = []
    for line in sorted(lines, key=lambda l: ((l["box"][1] + l["box"][3]) / 2, l["box"][0])):
        centre = (line["box"][1] + line["box"][3]) / 2
        height = max(line["box"][3] - line["box"][1], 1)
        if rows:
            last = rows[-1]
            last_centre = sum((l["box"][1] + l["box"][3]) / 2 for l in last) / len(last)
            last_height = min(max(l["box"][3] - l["box"][1], 1) for l in last)
            if abs(centre - last_centre) < 0.5 * min(height, last_height):
                last.append(line)
                continue
        rows.append([line])
    ordered = []
    for row in rows:
        row.sort(key=lambda l: l["box"][0])
        merged = []
        for line in row:
            prev = merged[-1] if merged else None
            if (prev is not None and LABEL_ONLY_RE.match(prev["text"]) and not prev.get("inFigure")
                    and not line.get("inFigure") and 0 <= line["box"][0] - prev["box"][2] < 30):
                joined = dict(prev)
                joined["text"] = f"{prev['text'].strip()} {line['text'].strip()}"
                joined["box"] = [prev["box"][0], min(prev["box"][1], line["box"][1]), line["box"][2], max(prev["box"][3], line["box"][3])]
                if line.get("source") == "ocr" or prev.get("source") == "ocr":
                    joined["source"] = "ocr"
                merged[-1] = joined
            else:
                merged.append(line)
        ordered.extend(merged)
    return ordered


BARE_SECTION_RE = re.compile(r"^\s*(?:part\s*a\s*[-–—]?\s*)?section\s*(?:[0-9]+|[ivx]+|[a-c])\s*:?\s*$", re.I)


def is_heading(text):
    return (section_type(text) is not None or BARE_SECTION_RE.match(text) is not None
            or (PART_B_RE.match(text) is not None and len(text) <= 60))


def section_type(text):
    if not SECTION_RE.search(text) or re.search(r"\bcontains?\b|\bbelong", text, re.I):
        return None
    for kind, pattern in TYPE_WORDS:
        if pattern.search(text):
            return kind
    return None


# ---------------------------------------------------------------- questions


def join_text(lines):
    out = ""
    for line in lines:
        text = line.strip()
        if not text:
            continue
        if out.endswith("-") and not out.endswith(" -"):
            out = out[:-1] + text
        else:
            out = f"{out} {text}" if out else text
    return out


def split_options(lines):
    """Split a question's body lines into prompt lines and A-D options with continuations."""
    prompt, options, trailing = [], [], []
    current = None
    for line in lines:
        match = OPTION_RE.match(line["text"])
        if match:
            key = match.group(1) or match.group(2)
            current = {"key": key, "lines": [match.group(3)], "box": list(line["box"])}
            options.append(current)
            continue
        if current is None:
            prompt.append(line["text"])
            continue
        height = max(line["box"][3] - line["box"][1], 1)
        if -0.3 * height <= line["box"][1] - current["box"][3] < 1.6 * height and line["page"] == current.get("page", line["page"]):
            current["lines"].append(line["text"])
            current["box"][3] = line["box"][3]
        else:
            trailing.append(line["text"])
            current = {"key": None, "lines": [], "box": [0, 1e9, 0, 1e9]}  # stop collecting
    keys = [option["key"] for option in options]
    clean = [{"key": o["key"], "text": join_text(o["lines"]), "box": [round(v, 2) for v in o["box"]]} for o in options]
    return prompt, clean, trailing, keys


def build_question(part, number, stream, start, end, pages_by_no, section):
    head = stream[start]
    lines = []
    for index in range(start, end):
        line = stream[index]
        if line.get("furniture") or line.get("inFigure") or (index != start and (is_heading(line["text"]) or line.get("sectionHeading"))):
            continue
        text = line["text"]
        if index == start:
            text = line["marker"]["rest"]
            if not text:
                continue
        lines.append(dict(line, text=text))
    body_lines = [line for line in lines if not OPTION_LABEL_RE.match(line["text"])]
    labels = [{"key": OPTION_LABEL_RE.match(line["text"]).group(1), "page": line["page"], "box": line["box"]}
              for line in lines if OPTION_LABEL_RE.match(line["text"])]
    if part == "B":  # lettered sub-tasks in a drawing question are not answer options
        prompt, options, trailing, keys = [line["text"] for line in body_lines], [], [], []
    else:
        prompt, options, trailing, keys = split_options(body_lines)

    # Regions: per page, from the marker (or page top) to the next marker (or the end of the content).
    end_line = stream[end] if end < len(stream) else None
    first_page, last_page = head["page"], (end_line["page"] if end_line else max(pages_by_no))
    if end_line and not pages_by_no[end_line["page"]].get("photo"):
        end_page = pages_by_no[end_line["page"]]
        tops = [l["box"][1] for l in end_page["lines"] if not l.get("furniture")]
        tops += [img["box"][1] for img in end_page["images"] if not img["decorative"]]
        if end_line["box"][1] <= 0.5 + min(tops):
            last_page -= 1  # next question starts at the very top of its page, above any figure
    regions, figures, vectors = [], [], 0
    for page_no in range(first_page, last_page + 1):
        page = pages_by_no[page_no]
        ends_here = end_line and page_no == end_line["page"]
        photo = page.get("photo")
        if photo:
            # OCR can be empty on a continuation page. Keep its visual area in the block.
            top = head["box"][1] if page_no == first_page else 0
            bottom = end_line["box"][1] if ends_here else page["heightPt"]
            page_figures = [img for img in page["images"] if top <= (img["box"][1] + img["box"][3]) / 2 < bottom]
            if bottom > top:
                regions.append({"page": page_no, "box": photo_box([0, top, page["widthPt"], bottom], photo),
                                "units": "px", "renderSha256": photo["renderSha256"]})
            figures.extend({"page": page_no, "box": img["pixelBox"], "units": "px",
                            "renderSha256": photo["renderSha256"], "sha256": None,
                            "role": img["role"]} for img in page_figures)
            continue
        body = [l for l in page["lines"] if not l.get("furniture")]
        top = head["box"][1] if page_no == first_page else min([l["box"][1] for l in body] + [page["heightPt"] * FURNITURE_BAND])
        bottom = end_line["box"][1] if ends_here else page["heightPt"] * (1 - FURNITURE_BAND)
        inside = lambda box: top - 2 <= (box[1] + box[3]) / 2 <= bottom
        page_figures = [img for img in page["images"] if not img["decorative"] and inside(img["box"])]
        content = [l["box"] for l in body if inside(l["box"])] + [img["box"] for img in page_figures]
        vectors += sum(1 for d in page["drawings"] if inside(d["box"]))
        if not content:
            continue
        box = [min(b[0] for b in content), top, max(b[2] for b in content), max(b[3] for b in content)]
        regions.append({"page": page_no, "box": [round(v, 2) for v in box]})
        for img in page_figures:
            figures.append({"page": page_no, "box": img["box"], "sha256": img["sha256"],
                            "nativeWidth": img["nativeWidth"], "nativeHeight": img["nativeHeight"]})

    flags = []
    if any(not pages_by_no[region["page"]]["photo"]["reviewed"] for region in regions if region.get("units") == "px"):
        flags.append("photo-layout-unreviewed")
    if options and keys != ["A", "B", "C", "D"][:len(keys)]:
        flags.append("option-keys-out-of-order")
    if options and len(options) != 4:
        flags.append("option-count")
    kind = "DESCRIPTIVE" if part == "B" else section
    if part == "A" and kind is None:
        flags.append("type-unknown")
    visual_choices = bool(figures)
    if pages_by_no[head["page"]].get("photo"):
        roles = [figure["role"] for figure in figures if figure["role"] in PHOTO_OPTION_ROLES]
        complete_roles = len(roles) == 4 and set(roles) == PHOTO_OPTION_ROLES
        complete_labels = {label["key"] for label in labels} == set("ABCD")
        visual_choices = complete_roles or (bool(figures) and complete_labels)
        if roles and (not complete_roles or kind not in ("MCQ", "MSQ") or options):
            flags.append("photo-option-roles-need-review")
    if kind in ("MCQ", "MSQ") and not options and not visual_choices:
        flags.append("choices-not-found")
    if kind == "NAT" and options:
        flags.append("nat-with-options")
    prompt_text = join_text(prompt + trailing)
    if not prompt_text:
        flags.append("prompt-empty")
    if re.search(r"animated\s+GIF|\banimation\s+(?:loop|of)\b", prompt_text, re.I):
        flags.append("animated-figure")  # the PDF holds one still frame of an on-screen animation
    return {
        "key": f"q{number}" if part == "A" else f"qb{number}",
        "part": part,
        "number": number,
        "printedNumber": head["marker"]["number"],
        "type": kind,
        "prompt": prompt_text,
        "options": options,
        "optionsInFigure": bool(kind in ("MCQ", "MSQ") and not options and visual_choices),
        "optionLabels": [
            {**label, "box": photo_box(label["box"], pages_by_no[label["page"]]["photo"]), "units": "px"}
            if pages_by_no[label["page"]].get("photo") else label for label in labels
        ],
        "figures": figures,
        "vectorDrawings": vectors,
        "regions": regions,
        "ocr": any(line.get("source") == "ocr" for line in lines),
        "flags": flags,
    }


def segment_pages(pages):
    """Pure segmentation over pages with merged lines. Returns (questions, report)."""
    keys = furniture_keys(pages)
    stream = []
    for page in pages:
        for line in reading_order(page["lines"]):
            line["furniture"] = is_furniture(line, page, keys)
            line["page"] = page["page"]
            stream.append(line)
    left = body_left(pages)
    photo_left = {page["page"]: body_left([page]) for page in pages if page.get("photo")}
    candidates = []
    for order, line in enumerate(stream):
        marker = marker_of(line, photo_left.get(line["page"], left))
        if marker:
            line["marker"] = marker
            candidates.append((order, marker["number"], marker["explicit"]))

    # "Q.n" markers are unambiguous; bare "n." also numbers instructions and criteria.
    # Use the bare style only when the paper has no comparable explicit run (UCEED 2015).
    explicit, bare = best_run(candidates, only_style=True), best_run(candidates, only_style=False)
    run_a = explicit if explicit and len(explicit) * 2 >= len(bare) else bare
    style_a = next((st for order, n, st in candidates if order == run_a[0][0]), None) if run_a else None
    if not run_a:
        raise SegmentError("No question numbering found (expected Q.1 or 1. at the left margin)")
    part_b_at = next((i for i, l in enumerate(stream) if i > run_a[0][0] and not l.get("furniture")
                      and PART_B_RE.match(l["text"]) and len(l["text"]) <= 60), None)
    entries = []
    if part_b_at is None:
        entries = [("A", n, order) for order, n in run_a]
    else:
        entries = [("A", n, order) for order, n in run_a if order < part_b_at]
        continued = [(order, n) for order, n in run_a if order > part_b_at]
        if continued:
            entries += [("B", i + 1, order) for i, (order, _) in enumerate(continued)]
        else:
            # Part B restarts at 1 in the same marker style as Part A, which keeps
            # numbered evaluation criteria ("1. Originality ...") out of the run.
            run_b = best_run(candidates, 1, part_b_at, style_a)
            entries += [("B", n, order) for order, n in run_b]
            if not run_b:
                # One unnumbered drawing question under the PART B heading (UCEED 2020-2023).
                stream[part_b_at]["marker"] = {"number": None, "rest": "", "explicit": None}
                entries.append(("B", 1, part_b_at))

    sections = []  # (order, type)
    for order, line in enumerate(stream):
        if line.get("furniture"):
            continue
        kind = section_type(line["text"])
        if not kind and BARE_SECTION_RE.match(line["text"]):
            # "Section 3:" with its name on the next line.
            following = next((l for l in stream[order + 1:order + 3] if not l.get("furniture")), None)
            if following and following["page"] == line["page"]:
                kind = section_type(f"{line['text']} {following['text']}")
                if kind:
                    following["sectionHeading"] = True
        if kind:
            sections.append((order, kind))

    heading_orders = [order for order, line in enumerate(stream) if not line.get("furniture") and is_heading(line["text"])]
    questions = []
    for index, (part, number, order) in enumerate(entries):
        end = entries[index + 1][2] if index + 1 < len(entries) else (part_b_at if part == "A" and part_b_at else len(stream))
        if part == "A" and part_b_at and end > part_b_at:
            end = part_b_at
        # A section heading ends the question: its intro (marking scheme, question range)
        # belongs to no question.
        end = min([end] + [h for h in heading_orders if order < h < end])
        section = None
        for s_order, kind in sections:
            if s_order < order:
                section = kind
        pages_by_no = {page["page"]: page for page in pages}
        questions.append(build_question(part, number, stream, order, end, pages_by_no, section))

    numbers_a = [q["number"] for q in questions if q["part"] == "A"]
    missing = sorted(set(range(1, max(numbers_a) + 1)) - set(numbers_a)) if numbers_a else []
    report = {
        "partA": len(numbers_a),
        "partB": sum(1 for q in questions if q["part"] == "B"),
        "missingNumbers": missing,
        "byType": {kind: sum(1 for q in questions if q["type"] == kind) for kind in ("NAT", "MSQ", "MCQ", "DESCRIPTIVE", None)
                   if any(q["type"] == kind for q in questions)},
        "flagged": {q["key"]: q["flags"] for q in questions if q["flags"]},
    }
    return questions, report


# ---------------------------------------------------------------- driver


def photo_box(box, photo):
    return [round(value / photo["scale"], 2) for value in box]


def read_photo_layout(path, pages):
    """Read an operator's review of every upright photo, including pages without figures."""
    if path is None:
        return {}
    try:
        document = json.loads(pathlib.Path(path).read_bytes())
    except (OSError, ValueError) as error:
        raise SegmentError("Cannot read the photo layout JSON") from error
    records = document.get("pages") if isinstance(document, dict) else None
    if not isinstance(records, list) or len(records) != len(pages):
        raise SegmentError("The photo layout must review every page in intake order")
    result = {}
    for record, page in zip(records, pages):
        if (not isinstance(record, dict) or type(record.get("page")) is not int or record["page"] != page["page"]
                or record.get("renderSha256") != page["renderSha256"] or not isinstance(record.get("figures"), list)):
            raise SegmentError("A photo layout page does not match the current intake render")
        figures = []
        for placement in record["figures"]:
            if isinstance(placement, dict):
                box, role = placement.get("box"), placement.get("role")
            else:
                box, role = placement, "figure"
            if not isinstance(role, str) or role not in PHOTO_OPTION_ROLES | {"figure", "stem"}:
                raise SegmentError(f"Page {page['page']} has an invalid photo figure role")
            if (not isinstance(box, list) or len(box) != 4 or any(type(value) is not int for value in box)
                    or not (0 <= box[0] < box[2] <= page["renderWidth"] and 0 <= box[1] < box[3] <= page["renderHeight"])):
                raise SegmentError(f"Page {page['page']} needs in-bounds integer pixel figure boxes")
            figures.append({"pixelBox": box, "role": role})
        if len({tuple(figure["pixelBox"]) for figure in figures}) != len(figures):
            raise SegmentError(f"Page {page['page']} has duplicate figure boxes")
        result[page["page"]] = figures
    return result


def load_pages(intake_dir, manifest, ocr, work_root, out_dir, photo_layout):
    pages = []
    cache = work_root / ".cache" / OCR_CACHE
    # A paper whose text layer is broken on one page tends to lose small pieces
    # (single "Q.03" labels) on others too, below any ink threshold: read it all.
    read_all = any(page["needsOcr"] for page in manifest["pages"])
    for page in manifest["pages"]:
        text = json.loads((intake_dir / page["text"]).read_text()) if page.get("text") else {"lines": []}
        render = intake_dir / page["render"]
        photo = None
        images = page["images"]
        if page["kind"] == "photo":
            source = render.resolve()
            if (source.parent != intake_dir.resolve() / "pages" or not source.is_file()
                    or hashlib.sha256(source.read_bytes()).hexdigest() != page["renderSha256"]):
                raise SegmentError(f"Page {page['page']} photo render does not match intake")
            # Scale only layout analysis so that OCR tolerances work at any camera resolution.
            scale = PHOTO_LAYOUT_WIDTH / page["renderWidth"]
            width, height = PHOTO_LAYOUT_WIDTH, page["renderHeight"] * scale
            reviewed = page["page"] in photo_layout
            photo = {"scale": scale, "renderSha256": page["renderSha256"], "reviewed": reviewed}
            images = [{**figure, "box": [value * scale for value in figure["pixelBox"]], "decorative": False}
                      for figure in photo_layout.get(page["page"], [])]
        else:
            width, height = page["widthPt"], page["heightPt"]
        lines = text["lines"]
        # A full-page scan is the page, not a figure: OCR lines on it are body text.
        figure_boxes = [img["box"] for img in images if not img["decorative"]
                        and (photo or (img["box"][2] - img["box"][0]) * (img["box"][3] - img["box"][1]) < 0.5 * width * height)]
        if read_all or page["needsOcr"] or (page.get("unexplainedInk") or 0) >= OCR_SLIGHT_INK:
            cached = cache / f"{page['renderSha256']}.json"
            if cached.exists():
                rows = json.loads(cached.read_text())
            else:
                rows = ocr(render)
                cache.mkdir(parents=True, exist_ok=True)
                cached.write_text(json.dumps(rows) + "\n")
            found = ocr_lines(rows, width, height)
            audit_lines = [dict(line, box=photo_box(line["box"], photo), size=round(line["size"] / photo["scale"], 2))
                           for line in found] if photo else found
            (out_dir / "ocr").mkdir(exist_ok=True)
            (out_dir / "ocr" / f"page-{page['page']:03d}.json").write_text(
                json.dumps({"page": page["page"], "units": "px" if photo else "pt", "lines": audit_lines}, ensure_ascii=False, indent=1) + "\n")
            lines = merge_ocr(lines, found, figure_boxes)
        else:
            lines = [dict(line, source="text") for line in lines]
        pages.append({"page": page["page"], "widthPt": width, "heightPt": height, "lines": lines,
                      "images": images, "drawings": page["drawings"], "photo": photo})
    return pages


def run_segment(*, work, paper_id, replace=False, ocr=None, photo_layout=None):
    work_root = pathlib.Path(work).expanduser().resolve()
    intake_dir = work_root / paper_id / INTAKE
    manifest_path = intake_dir / "paper.json"
    if not manifest_path.is_file():
        raise SegmentError(f"Run stage 1 first: {paper_id}/{INTAKE}/paper.json is missing")
    manifest_bytes = manifest_path.read_bytes()
    manifest = json.loads(manifest_bytes)
    if manifest.get("schema") != 1 or manifest.get("stage") != INTAKE:
        raise SegmentError("Unsupported intake manifest")
    is_photo = manifest.get("source", {}).get("kind") == "photos"
    if photo_layout is not None and not is_photo:
        raise SegmentError("A photo layout can only be used with ordered page photos")
    layout = read_photo_layout(photo_layout, manifest["pages"])
    target = work_root / paper_id / STAGE
    if target.exists() and not replace:
        raise SegmentError(f"{paper_id}/{STAGE} already exists; pass --replace to redo segmentation")
    staging = pathlib.Path(tempfile.mkdtemp(prefix=f".{STAGE}-", dir=target.parent))
    try:
        pages = load_pages(intake_dir, manifest, ocr or vision_ocr(work_root), work_root, staging, layout)
        questions, report = segment_pages(pages)
        if layout:
            expected = {(page, tuple(figure["pixelBox"])) for page, figures in layout.items() for figure in figures}
            assigned = [(figure["page"], tuple(figure["box"])) for q in questions for figure in q["figures"]]
            if len(assigned) != len(expected) or set(assigned) != expected:
                raise SegmentError("Every reviewed photo figure must belong to exactly one segmented question")
            for q in questions:
                regions = {region["page"]: region["box"] for region in q["regions"]}
                for figure in q["figures"]:
                    _, y0, _, y1 = figure["box"]
                    region = regions[figure["page"]]
                    if y0 < math.floor(region[1]) or y1 > math.ceil(region[3]):
                        raise SegmentError("A reviewed photo figure crosses a question boundary")
        result = {
            "schema": SCHEMA, "stage": STAGE, "paperId": paper_id, "exam": manifest["exam"], "year": manifest["year"],
            "intakeSha256": hashlib.sha256(manifest_bytes).hexdigest(),
            "report": report, "questions": questions,
        }
        if is_photo:
            result["photoLayout"] = {"units": "px", "reviewed": bool(layout)}
        (staging / "questions.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        if target.exists():
            shutil.rmtree(target)
        staging.replace(target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"paperId": paper_id, "output": str(target), **{k: v for k, v in report.items() if k != "flagged"},
            "flaggedQuestions": len(report["flagged"])}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stage 2: split an ingested paper into questions.")
    parser.add_argument("--paper-id", required=True, help="Paper id from stage 1, e.g. uceed-2026")
    parser.add_argument("--work", required=True, help="The private work folder used for stage 1")
    parser.add_argument("--photo-layout", help="Private JSON review of the upright photo figure boxes")
    parser.add_argument("--replace", action="store_true", help="Redo segmentation for this paper")
    args = parser.parse_args(argv)
    try:
        summary = run_segment(work=args.work, paper_id=args.paper_id, replace=args.replace, photo_layout=args.photo_layout)
    except (SegmentError, subprocess.CalledProcessError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
