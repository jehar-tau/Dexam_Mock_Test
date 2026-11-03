#!/usr/bin/env python3
"""Attach exact PDF page renders to questions that depend on visual material.

The ingest pipeline already creates lossless PNG page renders. Reusing those
pixels is more faithful than attempting to redraw diagrams in JavaScript.
"""

import datetime
import json
import pathlib
import re
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
VISUAL_RE = re.compile(
    r"\b(image|image-only|figure|diagram|illustration|picture|photograph|photo|"
    r"visual|map|drawing|sketch|logo|symbol|shape|pattern|grid|graph|chart|cube|"
    r"cuboid|polygon|object|layout|plan|view|shown|above|below)\b",
    re.I,
)


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name(f"dexam.before-figure-attachments-{stamp}.sqlite")
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)

    attached = []
    missing = []
    rows = conn.execute(
        "SELECT id,prompt,page_images_json,figure_paths_json FROM questions ORDER BY paper_id,question_no"
    ).fetchall()
    for row in rows:
        if not VISUAL_RE.search(row["prompt"] or ""):
            continue
        try:
            pages = json.loads(row["page_images_json"] or "[]")
        except json.JSONDecodeError:
            pages = []
        pages = [str(path) for path in pages if path and (ROOT / str(path)).is_file()]
        if not pages:
            missing.append(row["id"])
            continue
        conn.execute(
            "UPDATE questions SET figure_paths_json=?, updated_at=datetime('now') WHERE id=?",
            (json.dumps(pages, ensure_ascii=False), row["id"]),
        )
        if json.loads(row["figure_paths_json"] or "[]") != pages:
            conn.execute("UPDATE questions SET crop_review='pending' WHERE id=?", (row["id"],))
        attached.append({"id": row["id"], "figures": pages})

    conn.commit()
    report_dir = ROOT / "server/data/sources/figure-reports"
    report_dir.mkdir(parents=True, exist_ok=True)
    report = report_dir / f"figure-attachment-report-{stamp}.json"
    report.write_text(json.dumps({"attached": attached, "missing": missing}, indent=2))
    print("backup", backup)
    print("report", report)
    print("attached", len(attached), "missing", len(missing), "total", len(rows))
    conn.close()


if __name__ == "__main__":
    main()
