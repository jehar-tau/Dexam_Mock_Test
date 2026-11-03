#!/usr/bin/env python3
"""Apply a human-reviewed recovery JSON file to the source question database."""

import argparse
import json
import pathlib
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("patch")
    args = parser.parse_args()
    payload = json.loads(pathlib.Path(args.patch).read_text())
    conn = sqlite3.connect(DB)
    applied = []
    for question in payload.get("questions", []):
        result = conn.execute(
            "UPDATE questions SET prompt=?,options_json=?,answer_key=?,answer_status='independently-solved',"
            "explanation=?,explanation_status='verified',explanation_source=?,status='verified',updated_at=datetime('now') WHERE id=?",
            (
                question["prompt"],
                json.dumps(question["options"], ensure_ascii=False),
                question["answer"],
                question["explanation"],
                "Manual transcription and independent solution; reviewed against " + payload.get("reviewedAgainst", "source page"),
                question["id"],
            ),
        )
        if result.rowcount != 1:
            raise SystemExit("Question not found: " + question["id"])
        applied.append(question["id"])
    conn.commit()
    conn.close()
    print(json.dumps({"applied": applied, "count": len(applied)}))


if __name__ == "__main__":
    main()
