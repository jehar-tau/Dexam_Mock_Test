#!/usr/bin/env python3
"""Ingest an owner-provided collection of NID-style drawing tasks (scanned PDF) into the bank.

Each page is rendered and read with the Vision OCR helper. Tasks are split at question labels
("Q.1", "Q1.", "Question 12:"), keeping sub-parts ("Q.1 A)", "Q.1 B)") together; a page without
labels is one task. Assignment titles and institute headers above the first task are dropped.

A task is stored as clean text (no number, no header) unless it has a picture, in which case its
exact crop (number blanked) is kept for display. Duplicates, within the collection and against
the bank, are skipped. Every task gets a drawing type (scene, product, communication, problem,
story, skill, creative) so mocks can mix them, and its printed marks when it states them.
All tasks wait for the owner's review. The database is backed up first.

Usage: tools/ingest_task_collection.py <pdf> --paper nid-task-collection-01 --title "..."
"""
import argparse
import datetime
import hashlib
import json
import pathlib
import re
import sqlite3
import sys

import fitz
from PIL import Image, ImageDraw

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from crop_question_blocks import (  # noqa: E402
    DB,
    MEDIA,
    blank_numbers,
    cut_answer_space,
    normalise,
    ocr_rows,
    page_layout,
    trim_white,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
# "Q.1", "Q1.", "Question 12:" and the zero-padded "01", "02" of assignment sheets.
STRONG_RE = re.compile(
    r"^\s*(?:(?:Q(?:uestion)?\s*(?:no\.?)?\s*[.:\-]?\s*)(\d{1,3})|0(\d)(?=\s+[A-Z(]))\s*[.):\-]?\s*([A-Da-d]\s*[).])?",
    re.I,
)
BRAND_RE = re.compile(
    r"(design\s*(and|&)\s*architecture|design\s*pro|weekly\s*assignment|monthly\s*assignment|mega\s*assignment|"
    r"sectional\s*test|mock\s*test|batch|assign?m?ne?n?t[\s-]*\d+|assignmnet|www\.|\.com|©|whatsapp\s*image)",
    re.I,
)
UI_RE = re.compile(r"^[\W_]{0,3}$")
MARKS_RE = re.compile(r"\(\s*(\d{1,3})\s*marks?\s*\)", re.I)
TYPES = [
    ("story", r"\b(comic|story|storyboard|frames?\b|strip|narrat)"),
    ("communication", r"\b(poster|logo|pictogram|icon|stamp|social media|campaign|slogan|banner|mascot|typograph|calligraph|signage|advert|leaflet|brochure|app\b|screens?\b|map for|emotions?|letter)"),
    ("problem", r"\bproblem identification|\b(identify|list|annotate)\b[^.]*\b(problems?|challenges?|issues?)\b"),
    ("product", r"\b(design|redesign|invent|create)\s+(a|an|the|your)\b|\bproduct\b"),
    ("scene", r"\b(scene|point of view|perspective of|from the (view|eyes|perspective)|imagine you are|you are (sitting|standing|at|in)|view of|sketch the following)"),
    ("skill", r"\b(one|two|three)[\s-]point perspective|\bplan,? (and|&)? ?(front )?elevation|\bshading\b|\bisometric|\bcolou?r (wheel|theory)"),
    ("creative", r"\b(imagine|creative|alternative|combine|transform|metaphor|surreal)"),
]


def drawing_type(text):
    lowered = text.lower()
    for name, pattern in TYPES:
        if re.search(pattern, lowered):
            return name
    return "creative"


def render_pages(pdf, paper_id):
    folder = MEDIA / paper_id
    folder.mkdir(parents=True, exist_ok=True)
    pages = {}
    doc = fitz.open(pdf)
    for index in range(doc.page_count):
        path = folder / f"page-{index + 1:03d}.png"
        if not path.exists():
            pix = doc[index].get_pixmap(dpi=144)
            Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(path, optimize=True)
        pages[index + 1] = path
    return pages


def picture_share(image, rows, top, bottom):
    """Share of the region that is ink but not text: photos, drawings, figures."""
    region = image.crop((0, top, image.width, bottom)).convert("L")
    draw = ImageDraw.Draw(region)
    for row in rows:
        if top - 20 <= row["top"] < bottom:
            draw.rectangle((0, row["top"] - top - 6, image.width, row["bottom"] - top + 6), fill=255)
    small = region.resize((max(1, region.width // 4), max(1, region.height // 4)))
    data = list(small.getdata())
    return sum(1 for value in data if value < 200) / max(1, len(data))


def join_text(rows):
    lines = []
    for row in rows:
        text = row["text"].strip()
        if not text or UI_RE.match(text) or BRAND_RE.search(text):
            continue
        new_line = (not lines or re.match(r"^(\d{1,2}[.)]|[•\-–*]|[A-Da-d][.)]|\(?[a-d]\))\s", text)
                    or lines[-1].endswith((":", "?")))
        if new_line:
            lines.append(text)
        else:
            lines[-1] += " " + text
    return "\n".join(lines).strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf")
    parser.add_argument("--paper", required=True)
    parser.add_argument("--title", required=True)
    parser.add_argument("--exam", default="nid")
    args = parser.parse_args()

    pages = render_pages(args.pdf, args.paper)
    for path in pages.values():
        ocr_rows(path)
    layouts = {n: page_layout(path) for n, path in pages.items()}

    # Reading order: each page's columns, left to right (assignment sheets are two columns).
    segments = []
    for n in sorted(layouts):
        layout = layouts[n]
        width = layout["width"]
        rows = layout["rows"]
        right = [r for r in rows if r["left"] > width * 0.45]
        left = [r for r in rows if r["left"] <= width * 0.45]
        if len(right) >= 4 and len(left) >= 4:
            split = min(r["left"] for r in right) - 8
            segments.append({"page": n, "x0": 0, "x1": split, "rows": left})
            segments.append({"page": n, "x0": split, "x1": width, "rows": right})
        else:
            segments.append({"page": n, "x0": 0, "x1": width, "rows": rows})

    # Tasks: (segment, row) .. next start, across segments.
    starts = []
    for k, segment in enumerate(segments):
        rows = segment["rows"]
        col_left = min((r["left"] for r in rows), default=segment["x0"])
        width = layouts[segment["page"]]["width"]
        strong = [(i, STRONG_RE.match(r["text"])) for i, r in enumerate(rows)]
        strong = [(i, m) for i, m in strong if m and rows[i]["left"] < col_left + width * 0.12]
        if not strong:
            if rows:
                starts.append({"seg": k, "row": 0, "number": None})
            continue
        for i, match in strong:
            number = int(match.group(1) or match.group(2))
            if match.group(3) and starts and starts[-1]["number"] == number and starts[-1]["seg"] >= k - 2:
                continue  # A sub-part of the task already started.
            starts.append({"seg": k, "row": i, "number": number})

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-task-collection-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    for column, kind in (("task_marks", "REAL"), ("block_path", "TEXT"), ("block_meta_json", "TEXT"),
                         ("display_hint", "TEXT"), ("drawing_type", "TEXT")):
        if column not in {r[1] for r in conn.execute("PRAGMA table_info(questions)")}:
            conn.execute(f"ALTER TABLE questions ADD COLUMN {column} {kind}")
    if "source_kind" not in {r[1] for r in conn.execute("PRAGMA table_info(papers)")}:
        conn.execute("ALTER TABLE papers ADD COLUMN source_kind TEXT DEFAULT 'official'")

    seen = {normalise(row[0])[:80] for row in conn.execute(
        "SELECT prompt FROM questions WHERE paper_id != ?", (args.paper,))}
    now = datetime.datetime.now().isoformat(timespec="seconds")
    conn.execute(
        "INSERT INTO papers (id, exam_id, year, title, source_note, question_pdf, page_count, imported_at, status, source_kind) "
        "VALUES (?, ?, NULL, ?, 'Owner-provided task collection (D-061)', ?, ?, ?, 'imported', 'owner_authorized') "
        "ON CONFLICT(id) DO UPDATE SET title=excluded.title, page_count=excluded.page_count, source_kind='owner_authorized'",
        (args.paper, args.exam, args.title, args.pdf, len(pages), now),
    )
    conn.execute("DELETE FROM questions WHERE paper_id=?", (args.paper,))

    made, pictures, duplicates, empty = 0, 0, 0, 0
    for index, start in enumerate(starts):
        end = starts[index + 1] if index + 1 < len(starts) else None
        rows, pieces, share = [], [], 0.0
        last = end["seg"] if end else start["seg"]
        for k in range(start["seg"], last + 1):
            segment = segments[k]
            n = segment["page"]
            layout = layouts[n]
            first = start["row"] if k == start["seg"] else 0
            stop = end["row"] if end and k == end["seg"] else len(segment["rows"])
            if end and k == end["seg"] and end["row"] == 0:
                break
            seg_rows = segment["rows"][first:stop]
            # Titles and logos are never part of a task.
            seg_rows = [r for r in seg_rows if not (k != start["seg"] and BRAND_RE.search(r["text"]))]
            if not seg_rows:
                continue
            rows += seg_rows
            top = max(0, seg_rows[0]["top"] - 14)
            bottom = (segment["rows"][stop]["top"] - 10) if stop < len(segment["rows"]) else layout["height"]
            with Image.open(pages[n]) as source:
                image = source.convert("RGB")
            share = max(share, picture_share(image.crop((segment["x0"], 0, segment["x1"], image.height)),
                                             [r for r in segment["rows"]], top, bottom))
            region = image.crop((0, top, image.width, bottom))
            marker = {"box": seg_rows[0].get("marker"), "number": start["number"] or -1}
            blank_numbers(region, top, bottom, layout, marker, k == start["seg"])
            draw = ImageDraw.Draw(region)
            for r in seg_rows:
                if BRAND_RE.search(r["text"]):
                    draw.rectangle((segment["x0"], r["top"] - top - 4, segment["x1"], r["bottom"] - top + 4), fill="white")
            piece = trim_white(region.crop((segment["x0"], 0, segment["x1"], region.height)))
            if piece is not None:
                pieces.append(piece)
        text = join_text(rows)
        text = re.sub(r"^\s*(?:Q(?:uestion)?\s*(?:no\.?)?\s*[.:\-]?\s*)?\d{1,3}\s*[.):\-]?\s*", "", text, flags=re.I)
        text = re.sub(r"\s+\b0\d\s*$", "", text)
        text = re.sub(r"\n\s*(?:Q(?:uestion)?\s*[.:\-]?\s*)?\d{1,3}\s*([A-Da-d]\s*[).])", r"\n\1", text, flags=re.I)
        if len(normalise(text)) < 40:
            empty += 1
            continue
        key = normalise(text)[:80]
        if key in seen:
            duplicates += 1
            continue
        seen.add(key)
        marks = [int(m) for m in MARKS_RE.findall(text)]
        number = made + 1
        qid = f"{args.paper}-q{number}"
        block_rel = None
        hint = "text"
        # Exact crops only for single-column pages with a real picture; assignment sheets'
        # title bars and column rules are not pictures.
        single = all(sum(1 for seg in segments if seg["page"] == segments[k]["page"]) == 1
                     for k in range(start["seg"], last + 1))
        # A task that points at a picture ("the image above", "following figures"), not a human figure.
        visual_text = bool(re.search(
            r"\b(images?|pictures?|photos?|photographs?|silhouette|(given|following|above|below)\s+(figures?|objects|shapes))\b"
            r"|\bfigures?\s+(given|below|above|shown)|\bshown\s+(below|above|here)|\bgiven\s+(below|above|here)",
            text, re.I))
        if share > 0.035 and pieces and single:
            width = max(p.width for p in pieces)
            block = Image.new("RGB", (width, sum(p.height for p in pieces) + 18 * (len(pieces) - 1)), "white")
            y = 0
            for p in pieces:
                block.paste(p, (0, y))
                y += p.height + 18
            block_rel = pathlib.Path("server/data/media") / args.paper / "blocks" / f"{qid}.png"
            (ROOT / block_rel).parent.mkdir(parents=True, exist_ok=True)
            block.save(ROOT / block_rel, optimize=True)
            hint = "block"
            pictures += 1
        elif visual_text:
            hint = "needs-figure"
        conn.execute(
            "INSERT INTO questions (id, paper_id, question_no, question_type, topic, difficulty, prompt, options_json, "
            "answer_status, page_no, page_images_json, figure_paths_json, content_hash, status, created_at, updated_at, "
            "crop_review, task_marks, block_path, block_meta_json, display_hint, drawing_type) "
            "VALUES (?, ?, ?, 'DESCRIPTIVE', 'Drawing', 'Unassessed', ?, '[]', 'not-applicable', ?, ?, '[]', ?, 'review', "
            "?, ?, 'pending', ?, ?, ?, ?, ?)",
            (qid, args.paper, str(number), text, segments[start["seg"]]["page"],
             json.dumps([str(pages[segments[start["seg"]]["page"]].relative_to(ROOT))]),
             hashlib.sha256(f"{args.paper}|{text}".encode()).hexdigest(), now, now,
             (sum(marks) if len(marks) > 1 and max(marks) < sum(marks) else (marks[0] if marks else None)),
             str(block_rel) if block_rel else None,
             json.dumps({"flags": [], "pages": sorted({segments[start["seg"]]["page"], segments[last]["page"]}),
                         "pictureShare": round(share, 3)}),
             hint, drawing_type(text)),
        )
        made += 1
    conn.commit()
    types = dict(conn.execute("SELECT drawing_type, count(*) FROM questions WHERE paper_id=? GROUP BY 1", (args.paper,)).fetchall())
    print(f"{args.paper}: {made} tasks ({pictures} with pictures), {duplicates} duplicates skipped, {empty} too short")
    print("types", types)


if __name__ == "__main__":
    main()
