#!/usr/bin/env python3
"""Apply the owner's question-review verdicts (server/data/reviews/owner-verdicts.json, written
by the platform's local review page) to the bank.

- "Looks right" approves the question's crop (crop_review = 'approved'), so the export shows the
  exact printed block to students.
- "Needs a fix" rejects the crop and keeps the question held; the reasons and note are stored in
  review_notes_json for the fixing pass.

Prints a summary of the fix reasons so patterns can be applied to the rest of the bank.
The database is backed up first. Then run tools/export_platform_bank.py and the platform import.
"""
import collections
import datetime
import json
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
VERDICTS = ROOT / "server/data/reviews/owner-verdicts.json"


def main():
    verdicts = json.loads(VERDICTS.read_text()) if VERDICTS.exists() else {}
    if not verdicts:
        print("No verdicts yet.")
        return
    conn = sqlite3.connect(DB)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-owner-verdicts-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(questions)")}
    for column in ("review_notes_json", "answer_verification"):
        if column not in columns:
            conn.execute(f"ALTER TABLE questions ADD COLUMN {column} TEXT")
    applied, unknown = collections.Counter(), []
    reasons = collections.Counter()
    for question_id, verdict in verdicts.items():
        row = conn.execute("SELECT block_path, crop_review FROM questions WHERE id=?", (question_id,)).fetchone()
        if not row:
            unknown.append(question_id)
            continue
        if verdict["verdict"] == "ok":
            # Approve the crop, or (for the owner's text-only tasks) the task itself.
            if row[1] != "not-applicable":
                conn.execute("UPDATE questions SET crop_review='approved', updated_at=datetime('now') WHERE id=?", (question_id,))
            conn.execute("UPDATE questions SET review_notes_json=NULL WHERE id=?", (question_id,))
            # The owner's check is the second pass for an answer Dexam solved itself.
            conn.execute(
                "UPDATE questions SET answer_verification='second-pass-reproduced' "
                "WHERE id=? AND answer_status='independently-solved'", (question_id,))
        else:
            if row[1] != "not-applicable":
                conn.execute("UPDATE questions SET crop_review='rejected' WHERE id=?", (question_id,))
            conn.execute(
                "UPDATE questions SET review_notes_json=?, updated_at=datetime('now') WHERE id=?",
                (json.dumps({k: verdict[k] for k in ("reasons", "note", "reviewedAt")}), question_id),
            )
            reasons.update(verdict.get("reasons") or ["unspecified"])
        # A key the owner typed in the review replaces any other key for this question.
        if verdict.get("answer"):
            conn.execute(
                "UPDATE questions SET answer_key=?, answer_status='owner-provided', answer_verification=NULL, "
                "updated_at=datetime('now') WHERE id=?", (verdict["answer"], question_id))
            applied["keys typed"] += 1
        applied[verdict["verdict"]] += 1
    conn.commit()
    print("applied", dict(applied), "unknown", len(unknown))
    if reasons:
        print("fix reasons", dict(reasons.most_common()))


if __name__ == "__main__":
    main()
