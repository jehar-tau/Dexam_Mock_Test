#!/usr/bin/env python3
"""Approve fresh NIFT crops that the answer engine's workers have vouched for.

A crop becomes 'approved' (so the platform shows it as the printed question) only when
  - an independent image pass reproduced the answer (answer_verification = 'second-pass-reproduced'),
  - no worker flagged it as cut off ('crop-defect') or as depending on missing context
    ('context-missing', 'broken-text').
This is the engine's quality gate, not the owner's review: the owner can still reject any of them
in the review page. Writes a log to server/data/reviews/worker-crop-approvals.json.
The database is backed up first.

Usage: tools/approve_verified_crops.py [ids.json]   (default: server/data/answer-engine/nift-crop-ids.json)"""
import datetime
import json
import pathlib
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
BLOCKING = {"crop-defect", "context-missing", "broken-text"}


def main():
    ids_file = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "server/data/answer-engine/nift-crop-ids.json"
    ids = json.loads(ids_file.read_text())
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-worker-crop-approvals-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    approved = []
    for question_id in ids:
        row = conn.execute(
            "SELECT crop_review, answer_key, answer_verification, review_notes_json, block_path FROM questions WHERE id=?",
            (question_id,)).fetchone()
        if not row or not row["block_path"] or row["crop_review"] != "pending" or not row["answer_key"]:
            continue
        if row["answer_verification"] != "second-pass-reproduced":
            continue
        if BLOCKING & set(json.loads(row["review_notes_json"] or "{}").get("reasons") or []):
            continue
        conn.execute("UPDATE questions SET crop_review='approved', updated_at=datetime('now') WHERE id=?", (question_id,))
        approved.append(question_id)
    conn.commit()
    log = ROOT / "server/data/reviews/worker-crop-approvals.json"
    history = json.loads(log.read_text()) if log.exists() else []
    history.append({"at": datetime.datetime.now().isoformat(timespec="seconds"), "approved": len(approved), "ids": approved,
                    "basis": "Two independent image reads agreed on the answer and neither flagged the crop. Not reviewed by the owner."})
    log.write_text(json.dumps(history, indent=1) + "\n")
    print("approved", len(approved))


if __name__ == "__main__":
    main()
