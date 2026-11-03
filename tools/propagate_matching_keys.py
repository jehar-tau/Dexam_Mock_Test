#!/usr/bin/env python3
"""Carry an answer key to the same question elsewhere in the bank.

NIFT booklets (sets 1-5 of a year) print the same questions in different orders, and only some
booklets come with keys. A key moves to an unkeyed question only when its prompt and its option
texts match a keyed question; the letter is mapped through the option text, so a reordered set of
options still gets the right letter. Recorded as answer_status 'matched-source'. Backed up first."""
import datetime
import json
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
TRUSTED = ("official-key", "matched-source", "matched-source-positional")


def norm(text):
    return re.sub(r"[^a-z0-9]", "", str(text or "").lower())


def options_of(row):
    try:
        options = json.loads(row["options_json"] or "[]")
    except json.JSONDecodeError:
        return {}
    return {str(o.get("id", "")).strip().upper().strip("()"): norm(o.get("text")) for o in options if norm(o.get("text"))}


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-key-propagation-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    rows = [dict(r) for r in conn.execute(
        "SELECT id, paper_id, question_type, prompt, options_json, answer_key, answer_status FROM questions "
        "WHERE question_type IN ('MCQ','MSQ','NAT') AND coalesce(status,'') != 'excluded'")]
    keyed = {}
    for row in rows:
        if row["answer_key"] and row["answer_status"] in TRUSTED:
            keyed.setdefault(norm(row["prompt"])[:90], []).append(row)
    moved = 0
    for row in rows:
        if row["answer_key"] or len(norm(row["prompt"])) < 25:
            continue
        for source in keyed.get(norm(row["prompt"])[:90], []):
            if source["id"] == row["id"] or source["question_type"] != row["question_type"]:
                continue
            if row["question_type"] == "NAT":
                answer = source["answer_key"]
            else:
                mine, theirs = options_of(row), options_of(source)
                if not mine or set(mine.values()) != set(theirs.values()):
                    continue
                by_text = {text: letter for letter, text in mine.items()}
                letters = [l for l in re.split(r"[\s,;/&]+", source["answer_key"].upper()) if l]
                if not all(l in theirs for l in letters):
                    continue
                answer = ",".join(sorted(by_text[theirs[l]] for l in letters))
            conn.execute(
                "UPDATE questions SET answer_key=?, answer_status='matched-source', updated_at=datetime('now') WHERE id=?",
                (answer, row["id"]))
            moved += 1
            break
    conn.commit()
    print("keys carried over:", moved)


if __name__ == "__main__":
    main()
