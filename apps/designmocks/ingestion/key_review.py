#!/usr/bin/env python3
"""Render a private visual review of answer-key cells that need human attention."""

import argparse
import html
import json
import math
import pathlib
import re
import shutil
import sys
import tempfile
from urllib.parse import quote

import fitz

import answer_key as ak
from intake import inside_git_worktree


class ReviewError(Exception):
    """A refusal the operator can act on."""


def valid_box(box, page):
    if (not isinstance(box, list) or len(box) != 4 or not all(type(value) in (int, float) for value in box)
            or not all(math.isfinite(value) for value in box)):
        return None
    rect = fitz.Rect(box)
    if rect.is_empty or not page.rect.contains(rect):
        return None
    return rect


def render(work, paper_id):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", paper_id):
        raise ReviewError("Choose a simple paper id")
    base = pathlib.Path(work).expanduser().resolve() / paper_id
    if inside_git_worktree(base):
        raise ReviewError("Choose a private work folder outside any Git worktree")
    key_path = base / "04-key/key.json"
    segment_path = base / "02-segments/questions.json"
    if not key_path.is_file() or not segment_path.is_file():
        raise ReviewError("Run segmentation and the answer-key stage first")
    manifest = json.loads(key_path.read_text())
    source = manifest.get("source") or {}
    name = source.get("name")
    if (manifest.get("paperId") != paper_id or not name or pathlib.Path(name).name != name
            or manifest.get("segmentsSha256") != ak.sha256(segment_path.read_bytes())):
        raise ReviewError("Answer-key evidence does not match the current paper")
    source_path = base / "04-key/source" / name
    if not source_path.is_file() or ak.sha256(source_path.read_bytes()) != source.get("sha256"):
        raise ReviewError("The preserved answer-key PDF changed or is missing")
    questions = [q for q in json.loads(segment_path.read_text())["questions"] if q.get("part") == "A"]
    review_root = base / "04-key-review"
    review_root.mkdir(exist_ok=True)
    staging = pathlib.Path(tempfile.mkdtemp(prefix=".generated-", dir=review_root))
    target = review_root / "generated"
    cards = []
    unresolved = 0
    try:
        with fitz.open(source_path) as doc:
            if doc.needs_pass:
                raise ReviewError("The answer-key PDF is password-protected")
            for question in sorted(questions, key=lambda q: q["number"]):
                key = question["key"]
                if not re.fullmatch(r"q[1-9]\d*", key):
                    raise ReviewError("A question has an invalid key")
                record = manifest.get("keys", {}).get(key) or {}
                notes = record.get("notes") or []
                needs_review = record.get("status") != "official-key" or any("needs-visual-review" in note for note in notes)
                if not needs_review:
                    continue
                if record.get("status") != "official-key":
                    unresolved += 1
                crop = ""
                page_number = record.get("page")
                if type(page_number) is int and 1 <= page_number <= len(doc):
                    page = doc[page_number - 1]
                    box = valid_box(record.get("span") or record.get("cell"), page)
                    if box:
                        expanded = fitz.Rect(max(0, box.x0 - 58), max(0, box.y0 - 2),
                                             min(page.rect.width, box.x1), min(page.rect.height, box.y1 + 2))
                        filename = f"{key}.png"
                        page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=expanded, alpha=False).save(str(staging / filename))
                        crop = f'<img src="{filename}" alt="Answer-key PDF crop for {html.escape(key.upper())}">'
                printed = html.escape(str(record.get("printed") or "—"))
                raw = html.escape(str(record.get("raw") or "—"))
                note_text = "; ".join(html.escape(str(note)) for note in notes) or "No key row was read"
                cards.append(f'<article><h2>{html.escape(key.upper())} · {html.escape(question["type"])}</h2>'
                             f'<p><b>Status:</b> {html.escape(record.get("status") or "missing-row")}</p>'
                             f'<p><b>Printed OCR:</b> {printed} · <b>Normalized:</b> {raw}</p>'
                             f'<p><b>Review reason:</b> {note_text}</p>{crop}</article>')
        safe_name = html.escape(quote(name), quote=True)
        page_html = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                     '<title>Answer-key source review</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:1000px;margin:auto;padding:28px;'
                     'background:#f7f3eb;color:#24352a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}'
                     'article{background:#fff;border:1px solid #d7d3c9;border-radius:12px;padding:16px}img{display:block;width:100%;height:auto;'
                     'margin-top:12px;border:1px solid #ddd}code{word-break:break-all}a{color:#99520d}</style>'
                     f'<h1>{html.escape(paper_id.upper())} answer-key review</h1>'
                     '<p>Compare each crop with the original PDF. This page is a review aid; it does not approve a key or publish a paper.</p>'
                     f'<p><a href="../../04-key/source/{safe_name}">Original answer-key PDF</a> · SHA-256 <code>{html.escape(source["sha256"])}</code></p>'
                     f'<p>{len(cards)} cells need review; {unresolved} have no usable answer yet.</p><main>{"".join(cards)}</main></html>')
        (staging / "index.html").write_text(page_html)
        if target.exists():
            shutil.rmtree(target)
        staging.replace(target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"paperId": paper_id, "page": str(target / "index.html"), "needsReview": len(cards), "unresolved": unresolved}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", required=True)
    parser.add_argument("--paper-id", required=True)
    args = parser.parse_args(argv)
    try:
        print(json.dumps(render(args.work, args.paper_id)))
    except (ReviewError, fitz.FileDataError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
