#!/usr/bin/env python3
"""Create an actionable queue for questions excluded from the generic bank."""

import datetime
import json
import pathlib
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
GENERIC_REPORT = ROOT / "server/data/sources/generic-bank-report.json"
VISUAL_REPORT_DIR = ROOT / "server/data/sources/figure-reports"
OUTPUT = ROOT / "server/data/question-recovery-queue.json"


def parse_json(value, fallback):
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def visual_crop_details():
    """Latest regeneration details per question; later reports win."""
    details = {}
    for report in sorted(VISUAL_REPORT_DIR.glob("visual-regeneration-*.json")):
        for item in json.loads(report.read_text()).get("generated", []):
            details[item["id"]] = item
    return details


def main():
    excluded = json.loads(GENERIC_REPORT.read_text())["excludedQuestions"]
    visual = visual_crop_details()
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = {row["id"]: row for row in conn.execute(
        "SELECT q.*,p.question_pdf,p.year FROM questions q JOIN papers p ON p.id=q.paper_id"
    )}
    queue = []
    for item in excluded:
        row = rows[item["sourceId"]]
        reason = item["reason"]
        if reason == "visual-crop-awaiting-review":
            action = "review-clean-crop"
            destination = "generic-objective-bank"
            priority = 1
        elif reason in ("visual-crop-rejected", "visual-crop-file-missing"):
            action = "manual-crop-from-page"
            destination = "generic-objective-bank"
            priority = 2
        elif reason == "visual-crop-missing":
            action = "generate-crop-from-page"
            destination = "generic-objective-bank"
            priority = 2
        elif reason == "structured-options-missing":
            action = "transcribe-and-structure-options"
            destination = "generic-objective-bank"
            priority = 1
        elif reason == "image-only-no-semantic-text":
            action = "transcribe-prompt-options-and-isolate-visual"
            destination = "generic-objective-bank"
            priority = 2
        else:
            action = "transcribe-brief-and-create-rubric"
            destination = "drawing-studio-bank"
            priority = 3
        queue.append({
            "id": row["id"],
            "reason": reason,
            "action": action,
            "destination": destination,
            "priority": priority,
            "status": "queued",
            "topic": row["topic"],
            "type": row["question_type"],
            "questionNo": row["question_no"],
            "sourcePdf": row["question_pdf"],
            "sourcePages": parse_json(row["page_images_json"], []),
            "currentCrop": parse_json(row["figure_paths_json"], []),
            "cropReview": item.get("cropReview"),
            # False means the detector fell back to a wide page block; check its edges closely.
            "cropMarkerFound": visual.get(row["id"], {}).get("markerFound"),
            "answerReady": item.get("answerReady", False),
            "prompt": row["prompt"],
            "options": parse_json(row["options_json"], []),
            "answer": row["answer_key"],
            "answerStatus": row["answer_status"],
        })
    # Within a reason, records that already have a trusted answer unlock the ready bank first.
    queue.sort(key=lambda row: (row["priority"], row["reason"], not row["answerReady"], row["id"]))
    batches = []
    for start in range(0, len(queue), 25):
        batch = queue[start:start + 25]
        batches.append({
            "id": "recovery-%03d" % (start // 25 + 1),
            "status": "queued",
            "questionIds": [row["id"] for row in batch],
        })
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "questionCount": len(queue),
        "batchSize": 25,
        "batchCount": len(batches),
        "counts": {
            reason: sum(1 for row in queue if row["reason"] == reason)
            for reason in sorted({row["reason"] for row in queue})
        },
        "actionCounts": {
            action: sum(1 for row in queue if row["action"] == action)
            for action in sorted({row["action"] for row in queue})
        },
        "batches": batches,
        "questions": queue,
    }
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    print(json.dumps({
        "output": str(OUTPUT), "questions": len(queue), "batches": len(batches),
        "counts": payload["counts"], "actionCounts": payload["actionCounts"],
    }))
    conn.close()


if __name__ == "__main__":
    main()
