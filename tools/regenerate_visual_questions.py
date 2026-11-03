#!/usr/bin/env python3
"""Regenerate structured visual questions from exact PDF page pixels.

The database prompt/options remain semantic text. This tool isolates the source
question block from the lossless page PNG and stores it as the question figure.
No diagram is redrawn and no raster content is synthesized.
"""

import argparse
import datetime
import json
import pathlib
import re
import sqlite3
import subprocess

from PIL import Image, ImageChops


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
OCR = ROOT / "server/data/.cache/ocr_vision"
CACHE = ROOT / "server/data/.cache/figure-ocr"
VISUAL_RE = re.compile(
    r"\b(image|image-only|figure|diagram|illustration|picture|photograph|photo|visual|map|"
    r"drawing|sketch|logo|symbol|shape|pattern|grid|graph|chart|cube|cuboid|polygon|object|"
    r"layout|plan|view|shown|above|below|observe|identify)\b",
    re.I,
)
QUESTION_RE = re.compile(r"^\s*(?:Q(?:uestion)?\s*[.: -]*)?(\d{1,3})(?:\s*[.): -]|\s*$)", re.I)


def parse_json(value, fallback):
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def ocr_rows(image_path):
    CACHE.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE / (image_path.parent.name + "-" + image_path.stem + ".json")
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    result = subprocess.run([str(OCR), str(image_path)], capture_output=True, text=True, check=True, timeout=90)
    rows = []
    for line in result.stdout.splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict) and row.get("text"):
            rows.append(row)
    cache_path.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
    return rows


def question_markers(rows, height):
    markers = []
    explicit = []
    for row in rows:
        text = str(row.get("text", ""))
        match = QUESTION_RE.match(text)
        if not match:
            continue
        y = int((1.0 - float(row.get("y", 0)) - float(row.get("h", 0))) * height)
        item = (int(match.group(1)), y)
        markers.append(item)
        if re.match(r"^\s*Q", text, re.I):
            explicit.append(item)
    return sorted(explicit or markers, key=lambda item: item[1])


def trim_white(image, padding=16):
    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, (255, 255, 255))
    difference = ImageChops.difference(rgb, background).convert("L")
    difference = difference.point(lambda value: 255 if value > 12 else 0)
    box = difference.getbbox()
    if not box:
        return image
    left, top, right, bottom = box
    return image.crop((max(0, left - padding), max(0, top - padding), min(image.width, right + padding), min(image.height, bottom + padding)))


def crop_question(image_path, question_no, output_path):
    with Image.open(image_path) as source:
        image = source.convert("RGB")
    rows = ocr_rows(image_path)
    markers = question_markers(rows, image.height)
    current = [item for item in markers if question_no is not None and item[0] == question_no]
    if current:
        top = max(0, current[0][1] - 28)
        following = [y for number, y in markers if y > top + 40 and number != question_no]
        bottom = min(following) - 22 if following else int(image.height * 0.94)
    else:
        top = 0
        bottom = int(image.height * 0.94)
    if bottom <= top + 80:
        top, bottom = 0, int(image.height * 0.94)
    cropped = trim_white(image.crop((0, top, image.width, bottom)))
    output_path.parent.mkdir(parents=True, exist_ok=True)
    cropped.save(output_path, format="PNG", optimize=True)
    return {"width": cropped.width, "height": cropped.height, "markerFound": bool(current)}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Optional development limit")
    args = parser.parse_args()
    if not OCR.is_file():
        raise SystemExit("Vision OCR helper is missing; run the PDF ingest once with OCR enabled.")
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name(f"dexam.before-visual-regeneration-{stamp}.sqlite")
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)

    candidates = [row for row in conn.execute(
        "SELECT id,paper_id,question_no,prompt,page_images_json FROM questions ORDER BY paper_id,CAST(question_no AS INTEGER),question_no"
    ) if VISUAL_RE.search(row["prompt"] or "")]
    if args.limit:
        candidates = candidates[:args.limit]
    results, failures = [], []
    for index, row in enumerate(candidates, 1):
        pages = parse_json(row["page_images_json"], [])
        source_path = ROOT / pages[0] if pages else None
        if not source_path or not source_path.is_file():
            failures.append({"id": row["id"], "reason": "missing source page"})
            continue
        output_rel = pathlib.Path("server/data/media") / row["paper_id"] / "questions" / (row["id"] + ".png")
        output_path = ROOT / output_rel
        previous = output_path.read_bytes() if output_path.is_file() else None
        try:
            numeric_no = int(row["question_no"]) if str(row["question_no"]).isdigit() else None
            details = crop_question(source_path, numeric_no, output_path)
        except Exception as error:
            failures.append({"id": row["id"], "reason": str(error)})
            continue
        conn.execute(
            "UPDATE questions SET figure_paths_json=?, updated_at=datetime('now') WHERE id=?",
            (json.dumps([str(output_rel)], ensure_ascii=False), row["id"]),
        )
        if output_path.read_bytes() != previous:
            # A crop approval covers specific pixels; changed pixels need a fresh review.
            conn.execute("UPDATE questions SET crop_review='pending' WHERE id=?", (row["id"],))
        results.append({"id": row["id"], "source": str(pages[0]), "output": str(output_rel), **details})
        if index % 50 == 0:
            print(f"processed {index}/{len(candidates)}", flush=True)
            conn.commit()
    conn.commit()
    report_dir = ROOT / "server/data/sources/figure-reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report = report_dir / f"visual-regeneration-{stamp}.json"
    report.write_text(json.dumps({"generated": results, "failures": failures}, indent=2))
    print("backup", backup)
    print("report", report)
    print("generated", len(results), "failures", len(failures), "candidates", len(candidates))
    conn.close()


if __name__ == "__main__":
    main()
