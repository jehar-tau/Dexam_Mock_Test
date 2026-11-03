#!/usr/bin/env python3
"""Record answers Dexam solved itself: {"<question id>": "B" | "A,C" | "12" | "12 to 13"}.

Stored as answer_status 'independently-solved' with no verification, so the platform keeps the
question held until a second check confirms it: the owner marking it right in the review page
(tools/apply_owner_verdicts.py then records 'second-pass-reproduced'). Official keys are never
overwritten. The database is backed up first.

Usage: tools/record_solved_keys.py answers.json"""
import datetime
import json
import pathlib
import re
import sqlite3
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"


def main():
    answers = json.loads(pathlib.Path(sys.argv[1]).read_text())
    conn = sqlite3.connect(DB)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-solved-keys-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    if "answer_verification" not in {r[1] for r in conn.execute("PRAGMA table_info(questions)")}:
        conn.execute("ALTER TABLE questions ADD COLUMN answer_verification TEXT")
    written = skipped = 0
    for question_id, answer in answers.items():
        answer = str(answer).strip()
        row = conn.execute("SELECT question_type, answer_key FROM questions WHERE id=?", (question_id,)).fetchone()
        if not row or row[1] or not answer:
            skipped += 1
            continue
        if row[0] in ("MCQ", "MSQ") and not re.fullmatch(r"[A-D1-4](,[A-D1-4])*", answer.replace(" ", "")):
            skipped += 1
            continue
        conn.execute(
            "UPDATE questions SET answer_key=?, answer_status='independently-solved', answer_verification=NULL, "
            "updated_at=datetime('now') WHERE id=?", (answer.replace(" ", "") if row[0] != "NAT" else answer, question_id))
        written += 1
    conn.commit()
    print("recorded", written, "skipped", skipped)


if __name__ == "__main__":
    main()
