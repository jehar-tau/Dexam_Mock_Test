#!/usr/bin/env python3
"""Shared context for NIFT questions: the printed directions, passage or situation a question
depends on, stacked above the question's own crop.

NIFT GAT papers print a "Directions (Questions 26 - 45) : ..." line before each section and a
"Passage I" / "Situation-I" block before the questions that use it. A single-question crop cannot
show those, so the question cannot be answered on its own. This tool finds those headings in the
cached page OCR, crops each region once, and builds a composite block (context, a thin rule, then
the question) for the questions that need it. The question-only crop is kept as <id>-only.png.

Which questions get which context:
  - A small directions group ("Questions 1 - 5") applies to the questions in its range.
  - A passage or situation applies to the questions after its heading, up to the next heading, as
    long as an umbrella "Directions (Questions 26 - 45): Study the passages ..." covers them.
  - An umbrella directions line (more than 15 questions) is not repeated on every question.

Usage:
  tools/context_blocks.py --ids-file ids.json [--paper P ...] [--dry-run]
Only questions listed in the ids file are rebuilt. A rebuilt question goes back to crop_review
'pending' with its holds cleared, and an answer it already had is re-checked (verification reset).
The database is backed up first."""
import argparse
import datetime
import json
import pathlib
import re
import sqlite3
import sys

from PIL import Image, ImageDraw

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import crop_question_blocks as cropper  # noqa: E402

ROOT = cropper.ROOT
DB = cropper.DB
DIR_RE = re.compile(r"^\W*D?irections?\s*\(\s*Questions?\s*(\d{1,3})\s*[-–—]\s*(\d{1,3})\s*\)", re.I)
PASSAGE_RE = re.compile(r"^\W*(Passage|Situation)\s*[-–—]?\s*[IVXLivxl1-9]{1,4}\W*$", re.I)
SMALL_GROUP = 15


def headings_of(layouts):
    found = []
    for page_no in sorted(layouts):
        for row in layouts[page_no]["rows"]:
            text = row["text"].strip()
            match = DIR_RE.match(text)
            if match:
                found.append({"kind": "dir", "page": page_no, "top": row["top"], "a": int(match.group(1)),
                              "b": int(match.group(2)), "text": text[:80]})
            elif len(text) <= 22 and PASSAGE_RE.match(text):
                found.append({"kind": "passage", "page": page_no, "top": row["top"], "text": text})
    found.sort(key=lambda h: (h["page"], h["top"]))
    return found


def attach(number, position, headings):
    """The headings a question numbered `number` at (page, top) depends on."""
    before = [h for h in headings if (h["page"], h["top"]) < position]
    if not before:
        return []
    latest = before[-1]
    if latest["kind"] == "dir":
        if latest["a"] <= number <= latest["b"] and latest["b"] - latest["a"] + 1 <= SMALL_GROUP:
            return [latest]
        return []
    # A passage or situation: only while an umbrella directions line still covers the number.
    umbrella = next((h for h in reversed(before) if h["kind"] == "dir"), None)
    if umbrella and umbrella["a"] <= number <= umbrella["b"]:
        return [latest]
    return []


def region_image(heading, first_marker, pages, layouts):
    """The page region from a heading down to the first question that uses it."""
    pseudo = {"page": heading["page"], "top": heading["top"], "number": -1, "box": None, "text": heading["text"]}
    image, flags = cropper.build_block({"question_type": "MCQ"}, pseudo, first_marker, pages, layouts, clean=True, region=True)
    return image, flags


def stack(parts):
    width = max(part.width for part in parts)
    gap = 22
    height = sum(part.height for part in parts) + gap * (len(parts) - 1)
    canvas = Image.new("RGB", (width, height), "white")
    draw = ImageDraw.Draw(canvas)
    y = 0
    for index, part in enumerate(parts):
        canvas.paste(part, (0, y))
        y += part.height
        if index < len(parts) - 1:
            draw.line((0, y + gap // 2, width, y + gap // 2), fill=(170, 170, 170), width=2)
            y += gap
    return canvas


def build_paper(conn, paper_id, only, dry_run, report):
    questions = [dict(row) for row in conn.execute(
        "SELECT id, question_no, question_type, page_no, prompt, block_path, figure_paths_json != '[]' AS visual "
        "FROM questions WHERE paper_id=? ORDER BY page_no, question_no", (paper_id,))]
    pages = cropper.page_files(paper_id)
    if not pages:
        return 0
    layouts = {number: cropper.page_layout(path) for number, path in pages.items()}
    markers, stream = cropper.find_markers(questions, pages, layouts)
    headings = headings_of(layouts)
    ordered = sorted((q for q in questions if q["id"] in markers), key=lambda q: (markers[q["id"]]["page"], markers[q["id"]]["top"]))
    regions, built = {}, 0
    for index, question in enumerate(ordered):
        if question["id"] not in only:
            continue
        marker = markers[question["id"]]
        number = cropper.expected_number(question["question_no"])
        if number is None:
            continue
        needed = attach(number, (marker["page"], marker["top"]), headings)
        if not needed:
            continue
        if dry_run:
            report.append({"id": question["id"], "context": [h["text"] for h in needed]})
            built += 1
            continue
        parts, labels = [], []
        for heading in needed:
            key = (heading["page"], heading["top"])
            if key not in regions:
                # The first question that uses a heading ends its region, whether or not it is rebuilt.
                first = next(markers[q["id"]] for q in ordered
                             if (markers[q["id"]]["page"], markers[q["id"]]["top"]) > key)
                regions[key] = region_image(heading, first, pages, layouts)
            image, flags = regions[key]
            if image is None or "empty-block" in flags:
                parts = []
                break
            parts.append(image)
            labels.append(heading["text"])
        if not parts:
            report.append({"id": question["id"], "flags": ["context-region-empty"]})
            continue
        following = cropper.next_boundary(marker, markers[ordered[index + 1]["id"]] if index + 1 < len(ordered) else None, stream)
        own, own_flags = cropper.build_block(question, marker, following, pages, layouts, clean=True)
        if own is None:
            report.append({"id": question["id"], "flags": own_flags})
            continue
        out_rel = pathlib.Path("server/data/media") / paper_id / "blocks" / f"{question['id']}.png"
        out_path = ROOT / out_rel
        out_path.parent.mkdir(parents=True, exist_ok=True)
        own.save(out_path.with_name(f"{question['id']}-only.png"), format="PNG", optimize=True)
        stack(parts + [own]).save(out_path, format="PNG", optimize=True)
        meta = {"flags": sorted(set(own_flags) | {"with-context"}), "context": labels, "pages": [marker["page"]],
                "width": stack(parts + [own]).width, "height": stack(parts + [own]).height}
        conn.execute("UPDATE questions SET block_path=?, block_meta_json=?, crop_review='pending', updated_at=datetime('now') WHERE id=?",
                     (str(out_rel), json.dumps(meta), question["id"]))
        report.append({"id": question["id"], "context": labels})
        built += 1
    return built


def reset_answer_state(conn, question_ids):
    """A rebuilt question is a new thing to read: clear the holds that came from missing context and
    make any answer it already had be checked again from the new image."""
    for question_id in question_ids:
        row = conn.execute("SELECT review_notes_json FROM questions WHERE id=?", (question_id,)).fetchone()
        notes = json.loads(row[0] or "{}")
        kept = [r for r in (notes.get("reasons") or []) if r not in ("context-missing", "crop-defect", "broken-text")]
        notes["reasons"] = kept
        conn.execute("UPDATE questions SET review_notes_json=?, answer_verification=NULL WHERE id=?",
                     (json.dumps(notes) if kept else None, question_id))
        # An answer solved without the context is a first pass at best: keep it only as that.
        conn.execute("UPDATE questions SET answer_status='independently-solved' "
                     "WHERE id=? AND answer_key IS NOT NULL AND answer_status NOT IN ('official-key','owner-provided','matched-source','matched-source-positional')",
                     (question_id,))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--ids-file", required=True)
    parser.add_argument("--paper", action="append")
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    only = set(json.loads(pathlib.Path(args.ids_file).read_text()))
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    papers = args.paper or sorted({i.rsplit("-q", 1)[0] for i in only})
    if not args.dry_run:
        stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
        conn.execute("PRAGMA wal_checkpoint(FULL)")
        with sqlite3.connect(DB.with_name(f"dexam.before-context-blocks-{stamp}.sqlite")) as backup:
            conn.backup(backup)
    report, total = [], 0
    for paper_id in papers:
        made = build_paper(conn, paper_id, only, args.dry_run, report)
        conn.commit()
        total += made
        print(f"{paper_id}: {made} with context", flush=True)
    done = [item["id"] for item in report if item.get("context")]
    if not args.dry_run:
        reset_answer_state(conn, done)
        conn.commit()
        cropper.REPORTS.mkdir(parents=True, exist_ok=True)
        (cropper.REPORTS / f"context-blocks-{datetime.datetime.now().strftime('%Y%m%d-%H%M%S')}.json").write_text(json.dumps(report, indent=1))
        (ROOT / "server/data/answer-engine/context-block-ids.json").write_text(json.dumps(done))
    print("total", total, "empty/failed", sum(1 for item in report if item.get("flags")))


if __name__ == "__main__":
    main()
