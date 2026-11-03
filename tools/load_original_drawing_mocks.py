#!/usr/bin/env python3
"""Load Dexam's original NID DAT drawing mocks (content/nid-dat-drawing-mocks.json) into the bank.

Each mock is a paper of DESCRIPTIVE (drawing) tasks with their marks. Re-running replaces the
tasks of these papers only. The database is backed up first."""
import datetime
import hashlib
import json
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
SOURCE = ROOT / "content/nid-dat-drawing-mocks.json"


def main():
    data = json.loads(SOURCE.read_text())
    conn = sqlite3.connect(DB)
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-nid-drawing-mocks-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    columns = {row[1] for row in conn.execute("PRAGMA table_info(questions)")}
    if "task_marks" not in columns:
        conn.execute("ALTER TABLE questions ADD COLUMN task_marks REAL")
    paper_columns = {row[1] for row in conn.execute("PRAGMA table_info(papers)")}
    if "source_kind" not in paper_columns:
        conn.execute("ALTER TABLE papers ADD COLUMN source_kind TEXT DEFAULT 'official'")
    now = datetime.datetime.now().isoformat(timespec="seconds")
    count = 0
    for paper in data["papers"]:
        assert sum(task["marks"] for task in paper["tasks"]) == data["totalMarks"], paper["id"]
        conn.execute(
            "INSERT INTO papers (id, exam_id, year, title, source_note, page_count, imported_at, status, source_kind) "
            "VALUES (?, 'nid', 2026, ?, ?, 0, ?, 'original', 'original') "
            "ON CONFLICT(id) DO UPDATE SET title=excluded.title, source_note=excluded.source_note, source_kind='original'",
            (paper["id"], paper["title"], data["note"], now),
        )
        conn.execute("DELETE FROM questions WHERE paper_id=?", (paper["id"],))
        for number, task in enumerate(paper["tasks"], 1):
            prompt = task["prompt"] + f"\n({task['marks']} marks)"
            digest = hashlib.sha256(f"{paper['id']}|{number}|{prompt}".encode()).hexdigest()
            conn.execute(
                "INSERT INTO questions (id, paper_id, question_no, question_type, topic, difficulty, prompt, "
                "options_json, answer_status, page_no, page_images_json, figure_paths_json, content_hash, status, "
                "created_at, updated_at, crop_review, task_marks) "
                "VALUES (?, ?, ?, 'DESCRIPTIVE', 'Drawing', 'Unassessed', ?, '[]', 'not-applicable', NULL, '[]', '[]', "
                "?, 'verified', ?, ?, 'not-applicable', ?)",
                (f"{paper['id']}-q{number}", paper["id"], str(number), prompt, digest, now, now, task["marks"]),
            )
            count += 1
    conn.commit()
    print(f"loaded {len(data['papers'])} papers, {count} tasks")


if __name__ == "__main__":
    main()
