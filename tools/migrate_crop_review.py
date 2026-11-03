#!/usr/bin/env python3
"""Add the per-question `crop_review` state (pending | approved | rejected).

A reviewed lossless PNG crop is what lets a picture question enter the
candidate-facing bank. The column defaults to `pending`; only a human reviewer
sets `approved` or `rejected` through the review console. The database is
backed up with the SQLite backup API before the schema changes.
"""

import datetime
import pathlib
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"


def main():
    conn = sqlite3.connect(DB)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(questions)")}
    if "crop_review" in columns:
        print("crop_review already present; nothing to do")
        conn.close()
        return
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name(f"dexam.before-crop-review-{stamp}.sqlite")
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)
    conn.execute("ALTER TABLE questions ADD COLUMN crop_review TEXT DEFAULT 'pending'")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_questions_crop_review ON questions(crop_review)")
    conn.commit()
    counts = dict(conn.execute("SELECT crop_review, COUNT(*) FROM questions GROUP BY crop_review").fetchall())
    print("backup", backup)
    print("crop_review", counts)
    conn.close()


if __name__ == "__main__":
    main()
