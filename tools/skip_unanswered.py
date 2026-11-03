#!/usr/bin/env python3
"""Add the last shown batch's still-unkeyed questions to the solver's skip list."""
import pathlib
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
shown = (ROOT / "server/data/sources/solved/last-shown.txt").read_text().split()
conn = sqlite3.connect(ROOT / "server/data/dexam.sqlite")
open_ids = [i for i in shown if not (conn.execute("SELECT answer_key FROM questions WHERE id=?", (i,)).fetchone() or [None])[0]]
with open(ROOT / "server/data/sources/solved/skipped.txt", "a") as handle:
    handle.write("\n".join(open_ids) + "\n")
print("skipped", len(open_ids))
