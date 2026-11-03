#!/usr/bin/env python3
"""UCEED 2015-2017: the ingest stored the paper's instruction lines as Q1-Q6, while the
answer keys on those rows belong to the real Q1-Q6 (Section A, NAT). Rebuild those rows'
prompt and page from the real question text found by OCR after the instructions page.
The database is backed up first; crop_review resets to pending."""
import datetime
import json
import re
import sqlite3
import sys

sys.path.insert(0, __import__("pathlib").Path(__file__).resolve().parent.as_posix())
from crop_question_blocks import DB, MARKER_RE, page_files, page_layout  # noqa: E402

INSTRUCTION_RE = re.compile(
    r"^(The examination is of|Section [ABC] \(|Calculators|A Scribble Pad|Papers will be provided)", re.I)


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-instruction-repair-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    fixed = []
    for paper in ("uceed-2015", "uceed-2016", "uceed-2017"):
        rows = [r for r in conn.execute(
            "SELECT id, question_no, prompt FROM questions WHERE paper_id=? AND CAST(question_no AS INT) BETWEEN 1 AND 6",
            (paper,)) if INSTRUCTION_RE.match((r["prompt"] or "").strip())]
        if not rows:
            continue
        pages = page_files(paper)
        layouts = {n: page_layout(p) for n, p in sorted(pages.items())}
        # The instructions page is the one holding "The examination is of ..."; questions follow it.
        instructions_page = next(n for n, l in layouts.items()
                                 if any(INSTRUCTION_RE.match(r["text"].lstrip("0123456789. ")) for r in l["rows"]))
        lines = [(n, r) for n, l in layouts.items() if n > instructions_page for r in l["rows"]]
        for row in rows:
            number = int(row["question_no"])
            start = next((i for i, (n, r) in enumerate(lines)
                          if (m := MARKER_RE.match(r["text"])) and int(m.group(2)) == number), None)
            if start is None:
                print("not found", row["id"])
                continue
            text, page = [], lines[start][0]
            for n, r in lines[start:]:
                m = MARKER_RE.match(r["text"])
                if text and m and int(m.group(2)) != number and r["left"] < layouts[n]["marginLeft"] + 60:
                    break
                if re.match(r"^(Section [BC]\b|UCEED \d{4})", r["text"]):
                    break
                text.append(r["text"])
            prompt = re.sub(r"^\s*\d{1,3}\s*[.)]\s*", "", " ".join(text)).strip()
            conn.execute(
                "UPDATE questions SET prompt=?, page_no=?, page_images_json=?, crop_review='pending', "
                "updated_at=datetime('now') WHERE id=?",
                (prompt, page, json.dumps([str(pages[page].relative_to(DB.parents[2]))]), row["id"]))
            fixed.append((row["id"], page, prompt[:70]))
    conn.commit()
    for item in fixed:
        print(*item)
    print("repaired", len(fixed))


if __name__ == "__main__":
    main()
