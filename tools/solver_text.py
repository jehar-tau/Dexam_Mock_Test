#!/usr/bin/env python3
"""Solver workbench (text): print unkeyed objective questions whose text and options are stored,
skipping ones that need a passage or a picture. Writes nothing.

Usage: tools/solver_text.py --exam nift --from 0 --count 40"""
import argparse
import json
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
NEEDS_CONTEXT = re.compile(
    r"\b(passage|author|the following (figure|diagram|image|picture)|given (figure|diagram|image)|"
    r"shown (below|above)|in the figure|image-only|see page image)\b", re.I)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--exam", required=True)
    parser.add_argument("--from", dest="start", type=int, default=0)
    parser.add_argument("--count", type=int, default=40)
    parser.add_argument("--skip-file", default=str(ROOT / "server/data/sources/solved/skipped.txt"))
    args = parser.parse_args()
    skip_path = pathlib.Path(args.skip_file)
    skipped = set(skip_path.read_text().split()) if skip_path.exists() else set()
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = []
    for r in conn.execute(
        "SELECT id, question_type, prompt, options_json, figure_paths_json FROM questions "
        "WHERE paper_id LIKE ? AND question_type IN ('MCQ','MSQ') AND coalesce(status,'')!='excluded' "
        "AND (answer_key IS NULL OR answer_key='') ORDER BY paper_id, CAST(question_no AS INT)", (args.exam + "-%",)):
        options = json.loads(r["options_json"] or "[]")
        if r["id"] in skipped or len(options) < 2 or NEEDS_CONTEXT.search(r["prompt"] or "") or r["figure_paths_json"] not in (None, "", "[]"):
            continue
        rows.append((r["id"], r["question_type"], " ".join(str(r["prompt"]).split())[:400],
                     " | ".join(f"{o.get('id')}) {' '.join(str(o.get('text')).split())[:90]}" for o in options)))
    shown = rows[args.start:args.start + args.count]
    for row in shown:
        print(f"{row[0]} [{row[1]}] {row[2]}\n    {row[3]}")
    # Ids shown in this batch; the solver adds the ones it could not answer to the skip file.
    (ROOT / "server/data/sources/solved/last-shown.txt").write_text("\n".join(r[0] for r in shown))
    print("solvable as text:", len(rows), "showing", args.start, "to", args.start + args.count)


if __name__ == "__main__":
    main()
