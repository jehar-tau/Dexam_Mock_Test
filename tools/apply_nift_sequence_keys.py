#!/usr/bin/env python3
"""Apply source answers where the local paper's sequence is independently established.

These are kept separate from text matches because some local rows are image-only or
have damaged OCR.  The answer choice is transferred by option position, not by text.
"""

import datetime
import json
import pathlib
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
CACHE = ROOT / "server/data/sources/answer-keys/nift-examsnet"


def source_number(paper_id, local_number):
    if paper_id == "nift-2012-written-set1":
        if 1 <= local_number <= 90:
            return "ug-2012", local_number + 60
        if 95 <= local_number <= 150:
            return "ug-2012", local_number - 94
    if paper_id == "nift-2013-written-set2":
        if 1 <= local_number <= 25:
            return "ug-2013", local_number + 125
        if 26 <= local_number <= 150:
            return "ug-2013", local_number - 25
    if paper_id == "nift-2013-written-set4" and 1 <= local_number <= 150:
        return "pg-2013", local_number
    return None


def main():
    sources = {
        set_id: {int(row["number"]): row for row in json.loads((CACHE / f"{set_id}.json").read_text())}
        for set_id in ("ug-2012", "ug-2013", "pg-2013")
    }
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name(f"dexam.before-nift-sequence-keys-{stamp}.sqlite")
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)

    rows = conn.execute(
        "SELECT id,paper_id,question_no,options_json FROM questions "
        "WHERE paper_id IN (?,?,?) AND question_type <> 'DESCRIPTIVE'",
        ("nift-2012-written-set1", "nift-2013-written-set2", "nift-2013-written-set4"),
    ).fetchall()
    applied = []
    for row in rows:
        try:
            number = int(row["question_no"])
            options = json.loads(row["options_json"] or "[]")
        except (TypeError, ValueError, json.JSONDecodeError):
            continue
        mapping = source_number(row["paper_id"], number)
        if not mapping or not options:
            continue
        set_id, source_no = mapping
        source = sources[set_id].get(source_no)
        if not source:
            continue
        answer_index = int(source["correctIndex"])
        if answer_index >= len(options):
            continue
        answer_id = str(options[answer_index].get("id", ""))
        if not answer_id:
            continue
        conn.execute(
            "UPDATE questions SET answer_key=?, answer_status='matched-source-positional', "
            "reference_url=?, explanation_source=?, updated_at=datetime('now') WHERE id=?",
            (
                answer_id,
                source["source"],
                f"ExamsNet solved set {set_id} Q{source_no}; paper sequence verified by multiple exact text matches; answer transferred by option position",
                row["id"],
            ),
        )
        applied.append({"id": row["id"], "sourceSet": set_id, "sourceNumber": source_no, "answerId": answer_id})

    conn.commit()
    report = CACHE / f"sequence-report-{stamp}.json"
    report.write_text(json.dumps(applied, indent=2))
    print("backup", backup)
    print("report", report)
    print("applied", len(applied))
    for result in conn.execute(
        "SELECT paper_id,answer_status,count(*) FROM questions "
        "WHERE paper_id LIKE 'nift-%' GROUP BY paper_id,answer_status ORDER BY paper_id,answer_status"
    ):
        print(*result)
    conn.close()


if __name__ == "__main__":
    main()
