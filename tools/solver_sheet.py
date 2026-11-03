#!/usr/bin/env python3
"""Solver workbench: list unkeyed objective questions and build contact sheets of their exact
crops (or source pages) so they can be solved in batches. Writes nothing to the bank.

Usage: tools/solver_sheet.py --paper ceed-2019 --from 0 --count 6 --out <dir>"""
import argparse
import json
import pathlib
import sqlite3

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--paper", required=True)
    parser.add_argument("--from", dest="start", type=int, default=0)
    parser.add_argument("--count", type=int, default=6)
    parser.add_argument("--out", required=True)
    parser.add_argument("--width", type=int, default=1500)
    args = parser.parse_args()
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = [dict(r) for r in conn.execute(
        "SELECT id, question_no, question_type, prompt, options_json, block_path, page_images_json FROM questions "
        "WHERE paper_id=? AND question_type IN ('MCQ','MSQ','NAT') AND coalesce(status,'')!='excluded' "
        "AND (answer_key IS NULL OR answer_key='') ORDER BY CAST(question_no AS INT)", (args.paper,))]
    batch = rows[args.start:args.start + args.count]
    pieces = []
    for row in batch:
        path = row["block_path"] or (json.loads(row["page_images_json"] or "[]") or [None])[0]
        print(json.dumps({"id": row["id"], "type": row["question_type"],
                          "options": [o.get("id") for o in json.loads(row["options_json"] or "[]")],
                          "image": bool(path)}))
        if not path:
            continue
        with Image.open(ROOT / path) as image:
            image = image.convert("RGB")
            scale = min(1.0, args.width / image.width)
            image = image.resize((int(image.width * scale), int(image.height * scale)))
        label = Image.new("RGB", (image.width, 34), (230, 230, 230))
        ImageDraw.Draw(label).text((8, 8), f"{row['id']}  [{row['question_type']}]", fill="black")
        pieces += [label, image]
    if pieces:
        sheet = Image.new("RGB", (max(p.width for p in pieces), sum(p.height for p in pieces)), "white")
        y = 0
        for p in pieces:
            sheet.paste(p, (0, y))
            y += p.height
        out = pathlib.Path(args.out)
        out.mkdir(parents=True, exist_ok=True)
        target = out / f"{args.paper}-{args.start:03d}.png"
        sheet.save(target)
        print("sheet", target, sheet.size)
    print("remaining", max(0, len(rows) - args.start - args.count), "of", len(rows))


if __name__ == "__main__":
    main()
