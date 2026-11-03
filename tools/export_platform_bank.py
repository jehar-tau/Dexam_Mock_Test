#!/usr/bin/env python3
"""Export the workstation bank in the dexam-platform F038 contract (schema v1).

Writes server/data/exports/dexam-bank-export.json. Asset paths are relative to
server/data/media, which is the --media root for `pnpm assessment:import`.

Every question is exported. Reasons the workstation already knows a question cannot be served
(for example a crop awaiting review) travel as `holds`, using the same rules as
build_generic_question_bank.py, and the platform importer quarantines on them.
"""
import datetime
import hashlib
import json
import pathlib
import re
import sqlite3
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from ingest_task_collection import drawing_type  # noqa: E402
from build_generic_question_bank import (  # noqa: E402
    IMAGE_ONLY_RE,
    VISUAL_RE,
    clean_text,
    crop_blocker,
    infer_generic_topic,
    parse_json,
)

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
MEDIA_ROOT = ROOT / "server/data/media"
OUTPUT = ROOT / "server/data/exports/dexam-bank-export.json"
REVIEW_OUTPUT = ROOT / "server/data/exports/dexam-review.json"
MEDIA_MARKER = "server/data/media/"


def slug(value):
    text = re.sub(r"[^a-z0-9]+", "-", str(value or "").lower()).strip("-")
    return text[:80].strip("-") or None


def file_sha256(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def media_relative(value):
    text = str(value or "").replace("\\", "/")
    index = text.find(MEDIA_MARKER)
    return text[index + len(MEDIA_MARKER):] if index >= 0 else None


def workstation_holds(kind, prompt, options, figures, crop_review):
    """The builder's reasons, in its order; descriptive questions only need a prompt."""
    if kind == "DESCRIPTIVE":
        return [] if clean_text(prompt) else ["empty-after-brand-removal"]
    if IMAGE_ONLY_RE.search(prompt):
        return ["image-only-no-semantic-text"]
    if kind in ("MCQ", "MSQ") and len(options) < 2:
        return ["structured-options-missing"]
    if not clean_text(prompt):
        return ["empty-after-brand-removal"]
    if figures:
        blocker = crop_blocker(figures, crop_review)
        return [blocker] if blocker else []
    if VISUAL_RE.search(prompt):
        return ["visual-crop-missing"]
    return []


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    papers = {row["id"]: row for row in conn.execute("SELECT * FROM papers")}
    paper_sha = {}

    def source_sha(paper_id):
        if paper_id not in paper_sha:
            pdf = papers[paper_id]["question_pdf"]
            paper_sha[paper_id] = file_sha256(pdf) if pdf and pathlib.Path(pdf).is_file() else None
        return paper_sha[paper_id]

    questions = []
    review_items = []
    for row in conn.execute(
        "SELECT q.*, p.exam_id, p.year FROM questions q JOIN papers p ON p.id = q.paper_id "
        "ORDER BY q.paper_id, CAST(q.question_no AS INTEGER), q.question_no"
    ):
        kind = str(row["question_type"] or "MCQ").upper()
        prompt = str(row["prompt"] or "")
        options = parse_json(row["options_json"], [])
        figures = parse_json(row["figure_paths_json"], [])
        crop_review = str(row["crop_review"] or "pending")
        source_kind = papers[row["paper_id"]]["source_kind"] or "official"
        original = source_kind == "original"
        owner_provided = source_kind == "owner_authorized"
        block = row["block_path"] if "block_path" in row.keys() else None
        block_file = ROOT / block if block else None
        block_ready = bool(block_file and block_file.is_file())
        # The exact printed block is what students see once its crop is approved. Until then a
        # text-only question keeps its text display; a picture question (or a drawing task whose
        # prompt points at a picture) waits for the review.
        display = "block" if block_ready and crop_review == "approved" else "text"
        if display == "block":
            figures = [block]
            holds = [] if clean_text(prompt) or kind == "DESCRIPTIVE" else ["empty-after-brand-removal"]
        else:
            holds = workstation_holds(kind, prompt, options, figures, crop_review)
            if kind == "DESCRIPTIVE" and block_ready and VISUAL_RE.search(prompt) and not original:
                holds.append("visual-crop-awaiting-review" if crop_review != "rejected" else "visual-crop-rejected")
        if str(row["status"] or "") == "excluded":
            holds.append("not-a-question")  # e.g. an answer-key line the ingest stored as a question
        if original:
            holds = []
        if owner_provided:
            # The owner's collection is split by machine: every task waits for the owner's review.
            holds = [] if crop_review == "approved" else ["awaiting-owner-review"]
            if crop_review != "approved" and (row["display_hint"] if "display_hint" in row.keys() else "") == "needs-figure":
                holds.append("figure-missing-in-source")
        # The answer engine marks questions that cannot be understood alone (a reading passage or
        # puzzle setup the bank does not store), so they are not served without it.
        notes = parse_json(row["review_notes_json"], {}) if "review_notes_json" in row.keys() else {}
        for reason in ("context-missing", "broken-text"):
            if reason in (notes.get("reasons") or []):
                holds.append(reason)

        assets = []
        for position, figure in enumerate(figures):
            relative = media_relative(figure)
            absolute = MEDIA_ROOT / relative if relative else None
            if not absolute or not absolute.is_file():
                holds.append("visual-crop-file-missing")
                continue
            with Image.open(absolute) as image:
                width, height = image.size
            assets.append({
                "role": "figure",
                "path": relative,
                "sha256": file_sha256(absolute),
                "width": width,
                "height": height,
                "review": crop_review if crop_review in ("approved", "pending", "rejected") else "pending",
            })

        if display == "block" and kind in ("MCQ", "MSQ") and len(options) < 2:
            # The options are printed inside the block; the answer buttons only need their letters.
            options = [{"id": letter, "text": ""} for letter in "ABCD"]
        exported_options = []
        for index, option in enumerate(options):
            key = re.sub(r"[^A-Za-z0-9]", "", str(option.get("id", ""))).upper()
            if not re.fullmatch(r"[A-F1-6]", key):
                key = "ABCDEF"[index] if index < 6 else None
                holds.append("option-keys-renumbered")
            text = clean_text(option.get("text", ""))
            if len(text) > 4000:
                # Usually OCR that swept a page into one option: hold it back for transcription.
                holds.append("option-text-too-long")
                text = text[:4000]
            if key and len(exported_options) < 6:
                exported_options.append({"key": key, "text": text, "asset": None})

        topic = clean_text(row["topic"] or "")
        if kind == "DESCRIPTIVE":
            # Drawing tasks are mixed into mocks by type (scene, story, product, communication...).
            stored = row["drawing_type"] if "drawing_type" in row.keys() else None
            topic = "drawing-" + (stored or drawing_type(prompt))
        elif not topic or topic == "Unassigned":
            topic = infer_generic_topic(prompt, options)
        answer_raw = str(row["answer_key"] or "").strip() or None

        questions.append({
            "externalKey": str(row["id"]).lower(),
            "type": kind if kind in ("NAT", "MSQ", "MCQ", "DESCRIPTIVE") else "MCQ",
            "prompt": clean_text(prompt),
            "options": exported_options,
            "assets": assets,
            "answer": None if kind == "DESCRIPTIVE" else {
                "raw": answer_raw,
                "status": str(row["answer_status"] or "pending"),
                **({"verification": "second-pass-reproduced"}
                   if "answer_verification" in row.keys() and row["answer_verification"] == "second-pass-reproduced" else {}),
            },
            "explanation": clean_text(row["explanation"]) if row["explanation_status"] == "verified" else None,
            "topic": slug(topic),
            "subtopic": slug(clean_text(row["subtopic"])),
            "difficulty": str(row["difficulty"] or "unassessed").lower()
            if str(row["difficulty"] or "").lower() in ("easy", "medium", "hard") else "unassessed",
            "estimatedSeconds": None,
            "visualDependency": bool(figures) or bool(VISUAL_RE.search(prompt)),
            "licence": "dexam-original" if original else "owner-provided" if owner_provided else "official-unlicensed",
            "sourceKind": "original" if original else "owner_authorized" if owner_provided else "official",
            "display": display,
            "taskMarks": row["task_marks"] if "task_marks" in row.keys() and row["task_marks"] else None,
            "holds": sorted(set(holds)),
            "provenance": {
                "exam": row["exam_id"],
                "year": row["year"],
                "paperId": row["paper_id"],
                "questionNo": str(row["question_no"] or "") or None,
                "page": row["page_no"],
                "sourceSha256": None if original else source_sha(row["paper_id"]),
                "extraction": "workstation",
                "answerKeySource": pathlib.Path(papers[row["paper_id"]]["answer_pdf"]).name
                if papers[row["paper_id"]]["answer_pdf"] else None,
                "verification": row["status"],
            },
        })

        review_items.append({
            "id": row["id"],
            "paperId": row["paper_id"],
            "paperTitle": papers[row["paper_id"]]["title"],
            "exam": row["exam_id"],
            "year": row["year"],
            "number": str(row["question_no"] or ""),
            "type": kind,
            "prompt": clean_text(prompt),
            "options": [{"key": o["key"], "text": o["text"]} for o in exported_options],
            "answer": answer_raw,
            "answerStatus": str(row["answer_status"] or "pending"),
            "block": media_relative(block) if block_ready else None,
            "blockFlags": parse_json(row["block_meta_json"], {}).get("flags", []) if "block_meta_json" in row.keys() else [],
            "figures": [media_relative(f) for f in parse_json(row["figure_paths_json"], []) if media_relative(f)],
            "sourcePages": [media_relative(f) for f in parse_json(row["page_images_json"], []) if media_relative(f)],
            "page": row["page_no"],
            "cropReview": crop_review,
            "display": display,
            "holds": sorted(set(holds)),
            "taskMarks": row["task_marks"] if "task_marks" in row.keys() else None,
            "original": original,
            "ownerProvided": owner_provided,
            "drawingType": topic[len("drawing-"):] if kind == "DESCRIPTIVE" else None,
        })

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    REVIEW_OUTPUT.write_text(json.dumps({
        "exportedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "papers": [{"id": p["id"], "exam": p["exam_id"], "year": p["year"], "title": p["title"],
                    "original": (p["source_kind"] or "official") == "original"} for p in papers.values()],
        "questions": review_items,
    }, ensure_ascii=False))
    OUTPUT.write_text(json.dumps({
        "schemaVersion": 1,
        "exportedAt": datetime.datetime.now(datetime.timezone.utc).replace(microsecond=0).isoformat(),
        "questions": questions,
    }, ensure_ascii=False, indent=1))
    held = sum(1 for question in questions if question["holds"])
    print(f"Exported {len(questions)} questions ({held} with workstation holds) to {OUTPUT.relative_to(ROOT)}")
    print(f"Media root: {MEDIA_ROOT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
