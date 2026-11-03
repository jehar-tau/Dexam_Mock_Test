#!/usr/bin/env python3
"""Crop every question as one exact block from its source page renders.

For each paper, question markers ("Q.06", "Q 12:", "Q7)", "28.") are found with the
Vision OCR helper and matched, in reading order, to the questions the bank already
holds. A question's block runs from its marker to the next question's marker, across
page breaks when it continues on the next page. Page headers/footers and section
headings are left out. The pixels are the source render: nothing is redrawn.

Writes server/data/media/<paper>/blocks/<question>.png and, per question, the
`block_path` and `block_meta_json` columns (confidence flags for review). Changed
pixels reset crop_review to 'pending'. The database is backed up first.

Usage: tools/crop_question_blocks.py [--paper ID] [--ocr-only] [--jobs N]
"""
import argparse
import concurrent.futures
import datetime
import json
import pathlib
import re
import sqlite3
import subprocess

from PIL import Image, ImageChops, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
MEDIA = ROOT / "server/data/media"
OCR = ROOT / "server/data/.cache/ocr_vision2"  # built from tools/ocr_vision.swift (with marker boxes)
CACHE = ROOT / "server/data/.cache/page-ocr-v2"
REPORTS = ROOT / "server/data/sources/figure-reports"

PAGE_RE = re.compile(r"^page-(\d{3})\.(png|jpg)$")
# "Q.06", "Q 12:", "Q18.", "Q7)", "Q.5 Problem", "Question 3", or a bare "28." / "28)" at the margin.
# Also "Question No. 8" headings; never a range such as "Question numbers 6 -15 carry ...".
MARKER_RE = re.compile(
    r"^\s*(?:(Q(?:uestion)?(?:\s*(?:no|number)\b)?)\s*[.:\-]?\s*)?(\d{1,3})(?!\s*[-–]\s*\d)\s*(?:[.):\-]|\s|$)",
    re.I,
)
HEADING_RE = re.compile(
    r"^\s*(PART\s+[AB12]\b|Part\s+[AB12]\b|SECTION\b|Section\s+\d|Passage\b|PASSAGE\b|"
    r"Directions?\b|DIRECTIONS?\b|Read the following|Instructions\b|INSTRUCTIONS\b|"
    r"END OF|End of the|Q\.?\s*\d+\s*[-–to]+\s*Q?\.?\s*\d+\s+carry|Question numbers?\s+\d+\s*[-–])",
)
# Scanned NIFT papers: a passage or situation heading also ends the question above it.
HEADING_CLEAN_RE = re.compile(HEADING_RE.pattern + r"|^\s*(?:Situation|SITUATION|Caselet)\s*[-–]?\s*[IVXLivxl1-9]{1,4}\W*$")
# Printed page footers on the scanned NIFT papers: "BT 1000/C/2K14/02", "MD 1000/B/2K12/02", "( 13 )".
PAGE_FOOTER_RE = re.compile(r"^\s*[A-Z]{2,4}\s?\d{3,4}\s?/|^\s*\(\s*\d{1,3}\s*\)\s*$")
FOOTER_RE = re.compile(
    r"(\bof\s+\d+\b|Question Paper|Page\s*\d|^\s*\(?\s*\d{1,3}\s*\)?\s*$|^\s*-\s*\d+\s*-\s*$|"
    r"BT\s*\d|\d{2}-PM|Space for rough|Rough Work|ROUGH WORK|www\.|\.com\b|Design Studio|VDDS)",
    re.I,
)


def parse_json(value, fallback):
    try:
        return json.loads(value or "")
    except (json.JSONDecodeError, TypeError):
        return fallback


def page_files(paper_id):
    folder = MEDIA / paper_id
    pages = {}
    if not folder.is_dir():
        return pages
    for path in folder.iterdir():
        match = PAGE_RE.match(path.name)
        if match:
            pages[int(match.group(1))] = path
    return pages


def ocr_rows(path):
    CACHE.mkdir(parents=True, exist_ok=True)
    cache = CACHE / f"{path.parent.name}-{path.stem}.json"
    if cache.exists():
        return json.loads(cache.read_text())
    result = subprocess.run([str(OCR), str(path)], capture_output=True, text=True, timeout=120)
    rows = []
    for line in result.stdout.splitlines():
        try:
            row = json.loads(line)
        except json.JSONDecodeError:
            continue
        if isinstance(row, dict) and row.get("text"):
            rows.append(row)
    cache.write_text(json.dumps(rows, ensure_ascii=False))
    return rows


def to_pixels(row, width, height):
    """Vision boxes are normalised with a bottom-left origin; return top, bottom, left in pixels."""
    top = int((1.0 - float(row["y"]) - float(row["h"])) * height)
    bottom = int((1.0 - float(row["y"])) * height)
    left = int(float(row["x"]) * width)
    return top, bottom, left


def page_layout(path):
    """Text rows in reading order plus the content band (header/footer excluded)."""
    with Image.open(path) as image:
        width, height = image.size
    rows = []
    for row in ocr_rows(path):
        top, bottom, left = to_pixels(row, width, height)
        item = {"text": str(row["text"]), "top": top, "bottom": bottom, "left": left}
        if isinstance(row.get("marker"), dict):
            m_top, m_bottom, m_left = to_pixels(row["marker"], width, height)
            item["marker"] = (m_left, m_top, int(m_left + float(row["marker"]["w"]) * width), m_bottom)
        rows.append(item)
    rows.sort(key=lambda r: (r["top"], r["left"]))
    content_top, content_bottom = int(height * 0.02), int(height * 0.975)
    for row in rows:
        if row["bottom"] < height * 0.09 and FOOTER_RE.search(row["text"]):
            content_top = max(content_top, row["bottom"] + 6)
    for row in rows:
        if row["top"] > height * 0.88 and FOOTER_RE.search(row["text"]):
            content_bottom = min(content_bottom, row["top"] - 6)
    margin_left = min((r["left"] for r in rows), default=0)
    return {"width": width, "height": height, "rows": rows, "top": content_top,
            "bottom": content_bottom, "marginLeft": margin_left}


def expected_number(question_no):
    match = re.search(r"(\d+)", str(question_no or ""))
    return int(match.group(1)) if match else None


def find_markers(questions, pages, layouts):
    """Match the bank's questions, in order, to marker rows in reading order."""
    stream = []
    for page_no in sorted(layouts):
        layout = layouts[page_no]
        for row in layout["rows"]:
            # Bilingual papers print "प्रश्न सं. / Question No. 1": read from the English label.
            text = row["text"]
            slash = re.search(r"/\s*(Question\b.*)$", text, re.I)
            text = slash.group(1) if slash else re.sub(r"^[^\w(]{1,3}", "", text)
            match = MARKER_RE.match(text)
            if not match:
                continue
            explicit = bool(match.group(1))
            # Bare numbers only count near the left text margin (not "1." inside a question).
            near_margin = row["left"] <= layout["marginLeft"] + layout["width"] * 0.06
            if explicit or near_margin:
                stream.append({"page": page_no, "top": row["top"], "number": int(match.group(2)),
                               "explicit": explicit, "text": row["text"], "box": row.get("marker"),
                               "left": row["left"], "bottom": row["bottom"]})
    for index, marker in enumerate(stream):
        marker["index"] = index
    found = {}
    cursor = 0
    for question in questions:
        number = expected_number(question["question_no"])
        if number is None:
            continue
        page = question["page_no"] or 0
        hit = None
        probe = normalise(question.get("prompt") or "")[:10]

        def agrees(marker):
            # A bare "6." must also read like this question ("6. Papers will be provided..." on
            # the instructions page is not Q6). Q-prefixed markers are trusted.
            if marker["explicit"] or len(probe) < 6:
                return True
            return probe in normalise(marker["text"])

        # Never jump far: a label OCR missed is found by the question's own text below.
        for tolerance in (1, 2):
            fallback = None
            for index in range(cursor, len(stream)):
                marker = stream[index]
                if marker["number"] == number and (not page or abs(marker["page"] - page) <= tolerance):
                    if agrees(marker):
                        hit = marker
                        break
                    fallback = fallback or marker
            hit = hit or (fallback if tolerance == 2 else None)
            if hit:
                break
        if hit:
            found[question["id"]] = hit
            cursor = hit["index"] + 1
    # OCR sometimes drops a "Q44." label; find such questions by the start of their text.
    for question in questions:
        if question["id"] in found or not question.get("prompt"):
            continue
        number = expected_number(question["question_no"])
        text = normalise(question["prompt"])
        # Several probes: prompts often start with a heading ("[50 Marks] Mandatory question").
        probes = [text[i:i + 16] for i in (0, 24, 48, 72) if len(text[i:i + 16]) == 16]
        if number is None or not probes:
            continue
        page = question["page_no"] or 0

        def taken(page_no, top):
            return any(m["page"] == page_no and abs(m["top"] - top) <= 12 for m in found.values())

        for page_no in [page, page - 1, page + 1, page + 2, page - 2]:
            layout = layouts.get(page_no)
            if not layout:
                continue
            row = None
            # The printed number itself, even when its row is indented past the margin test.
            for r in layout["rows"]:
                match = MARKER_RE.match(re.sub(r"^[^\w(]{1,3}", "", r["text"]))
                if match and int(match.group(2)) == number and not taken(page_no, r["top"]) \
                        and (match.group(1) or r["left"] <= layout["marginLeft"] + layout["width"] * 0.2):
                    row = r
                    break
            for probe in ([] if row else probes):
                index = next((i for i, r in enumerate(layout["rows"])
                              if probe in normalise(r["text"]) and not taken(page_no, r["top"])), None)
                if index is not None:
                    # Start at the question's label line when it sits just above the matched text.
                    while index > 0 and layout["rows"][index - 1]["top"] > layout["rows"][index]["top"] - 140 \
                            and not MARKER_RE.match(layout["rows"][index]["text"]) \
                            and probe != probes[0]:
                        index -= 1
                        if MARKER_RE.match(layout["rows"][index]["text"]):
                            break
                    row = layout["rows"][index]
                    break
            if row:
                # OCR missed the printed number: it sits to the left of the first line.
                marker = {"page": page_no, "top": row["top"], "number": number, "explicit": True,
                          "text": "(by text) " + row["text"], "left": row["left"], "bottom": row["bottom"],
                          "box": row.get("marker") if MARKER_RE.match(row["text"])
                          else (0, row["top"], max(0, row["left"] - 6), row["bottom"])}
                found[question["id"]] = marker
                stream.append(marker)
                break
    stream.sort(key=lambda m: (m["page"], m["top"]))
    for index, marker in enumerate(stream):
        marker["index"] = index
    return found, stream


def normalise(text):
    return re.sub(r"[^a-z0-9]", "", str(text).lower())


def next_boundary(marker, matched_next, stream):
    """Where this question ends: the next matched question, or an earlier marker that is
    plainly a later question number (so an unmatched Q44 still ends Q43's block)."""
    best = matched_next
    for candidate in stream[marker["index"] + 1:]:
        if best and (candidate["page"], candidate["top"]) >= (best["page"], best["top"]):
            break
        if 0 < candidate["number"] - marker["number"] <= 5:
            best = candidate
            break
    return best


def trim_white(image, padding=14):
    rgb = image.convert("RGB")
    background = Image.new("RGB", rgb.size, (255, 255, 255))
    diff = ImageChops.difference(rgb, background).convert("L").point(lambda v: 255 if v > 40 else 0)
    box = diff.getbbox()
    if not box:
        return None
    left, top, right, bottom = box
    return rgb.crop((max(0, left - padding), max(0, top - padding),
                     min(rgb.width, right + padding), min(rgb.height, bottom + padding)))


def cut_answer_space(block, run=220):
    """Drawing tasks are followed by empty answer boxes; keep the task, drop the empty space.
    A row counts as blank when under 1.5% of it is ink (a box's side borders are not content)."""
    grey = block.convert("L")
    width, height = grey.size
    data = grey.load()
    blank = 0
    for y in range(height):
        ink = 0
        for x in range(0, width, 2):
            if data[x, y] < 200:
                ink += 1
        if ink * 2 < width * 0.015:
            blank += 1
            if blank >= run:
                cut = y - run + 10
                trimmed = trim_white(block.crop((0, 0, width, max(cut, 40))))
                return trimmed or block
        else:
            blank = 0
    return block


def blank_numbers(region, top, bottom, layout, marker, first_page):
    """Paint the question's printed number white (and sub-part labels such as "21A)"), so the
    block can be mixed into any paper under a new number."""
    draw = ImageDraw.Draw(region)
    boxes = []
    if first_page and marker.get("box"):
        boxes.append(marker["box"])
    if marker:
        subpart = re.compile(rf"^\s*(?:Q\.?\s*)?{marker['number']}\s*[A-Za-z]\s*[.)]")
        boxes += [row["marker"] for row in layout["rows"]
                  if row.get("marker") and top <= row["top"] < bottom and subpart.match(row["text"])]
    for left, box_top, right, box_bottom in boxes:
        if box_bottom < top or box_top > bottom:
            continue
        draw.rectangle((max(0, left - 6), max(0, box_top - top - 4), right + 2, box_bottom - top + 4), fill="white")


def heading_stop(layout, start, end, lead=30, pattern=HEADING_RE):
    """The first section heading between start and end on a page, or end."""
    for row in layout["rows"]:
        if start + lead < row["top"] < end and pattern.match(row["text"]):
            return row["top"] - 8
    return end


def drop_edge_slivers(image, bottom_too=True):
    """Scanned text pages: a neighbouring question's line is often clipped at the top or bottom of
    the crop. Drop a first or last ink band that is much thinner than a normal text line."""
    grey = image.convert("L")
    width, height = grey.size
    data = grey.load()
    ink = [sum(1 for x in range(0, width, 2) if data[x, y] < 170) for y in range(height)]
    bands, start = [], None
    for y, value in enumerate(ink + [0]):
        if value > 1 and start is None:
            start = y
        elif value <= 1 and start is not None:
            bands.append((start, y))
            start = None
    thick = sorted(b - a for a, b in bands if b - a >= 12)
    if len(bands) < 2 or not thick:
        return image
    typical = thick[len(thick) // 2]
    top, bottom = 0, height
    if bands[0][1] - bands[0][0] < typical * 0.5 and bands[1][0] - bands[0][1] < typical * 1.5:
        top = bands[1][0] - 8
    if bottom_too and bands[-1][1] - bands[-1][0] < typical * 0.5 and bands[-1][0] - bands[-2][1] < typical * 1.5:
        bottom = bands[-2][1] + 8
    return image.crop((0, max(0, top), width, min(height, max(bottom, top + 30)))) if (top or bottom != height) else image


def whiten_scanner_bars(region):
    """Scanner shadow shows as a dark vertical bar at a page edge. Blank only long dark runs in the
    outer 5% on each side: text that runs to the edge of the page has to stay."""
    grey = region.convert("L")
    width, height = grey.size
    data = grey.load()
    draw = ImageDraw.Draw(region)
    margin = max(6, int(width * 0.05))
    # Binding tabs and stamps print letters along the far-left edge; no question starts there.
    draw.rectangle((0, 0, int(width * 0.035), height), fill="white")
    for x in list(range(0, margin)) + list(range(width - margin, width)):
        run = longest = 0
        for y in range(height):
            run = run + 1 if data[x, y] < 120 else 0
            longest = max(longest, run)
        if longest >= 38:
            draw.rectangle((x - 2, 0, x + 2, height), fill="white")


def blankest_row(path, centre, reach_up=14, reach_down=6):
    """The pixel row with the least ink near a boundary: on tightly set scans the next question's
    line starts a few pixels above this question's last line ends."""
    with Image.open(path) as source:
        grey = source.convert("L")
        width, height = grey.size
        data = grey.load()
        best, best_ink = centre, None
        for y in range(max(0, centre - reach_up), min(height - 1, centre + reach_down) + 1):
            ink = sum(1 for x in range(0, width, 3) if data[x, y] < 150)
            if best_ink is None or ink < best_ink or (ink == best_ink and y > best):
                best, best_ink = y, ink
        return best


def build_block(question, marker, following, pages, layouts, clean=False, region=False):
    pieces, flags = [], []
    page = marker["page"]
    start = max(layouts[page]["top"], marker["top"] - (12 if region else 3 if clean else 14))
    last_page = following["page"] if following else page
    if last_page - page > 2:
        flags.append("spans-many-pages")
        last_page = page + 1
    for current in range(page, last_page + 1):
        layout = layouts.get(current)
        if not layout:
            continue
        top = start if current == page else layout["top"]
        if following and current == following["page"]:
            bottom = blankest_row(pages[current], following["top"] - 2) if clean else following["top"] - 12
        else:
            bottom = layout["bottom"]
        # Scanned papers (clean): a heading ends the question, also at the very top of a later page,
        # and nothing after it belongs to this question.
        if clean:
            # The page footer ends this piece of the question; the question may still continue below.
            for row in layout["rows"]:
                if top + 30 < row["top"] < bottom and PAGE_FOOTER_RE.match(row["text"]):
                    bottom = row["top"] - 8
                    break
        stopped_at = heading_stop(layout, top, bottom, lead=30 if current == page or not clean else -10,
                                  pattern=HEADING_CLEAN_RE if clean else HEADING_RE)
        hit_heading = clean and stopped_at < bottom
        bottom = stopped_at
        if bottom - top < 24:
            if hit_heading:
                break
            continue
        with Image.open(pages[current]) as source:
            region = source.convert("RGB").crop((0, top, layout["width"], bottom))
            blank_numbers(region, top, bottom, layout, marker, current == page)
            if clean:
                whiten_scanner_bars(region)
            if pages[current].suffix == ".jpg":
                region = region.point(lambda v: 255 if v > 200 else int(v * 255 / 200))
            piece = trim_white(region)
            if piece is not None and clean and not region:
                piece = trim_white(drop_edge_slivers(piece)) or piece
        if piece is not None:
            pieces.append(piece)
        if hit_heading:
            break
        if current != page:
            flags.append("continues-on-next-page")
    if not pieces:
        return None, ["empty-block"]
    width = max(piece.width for piece in pieces)
    gap = 18
    height = sum(piece.height for piece in pieces) + gap * (len(pieces) - 1)
    block = Image.new("RGB", (width, height), "white")
    y = 0
    for piece in pieces:
        block.paste(piece, (0, y))
        y += piece.height + gap
    page_height = layouts[page]["height"]
    # Objective questions lose blank writing space. Drawing tasks keep their printed answer
    # space (boxes, frames) so students see where and how much to draw (owner, 2026-10-29).
    if question.get("question_type") != "DESCRIPTIVE":
        block = cut_answer_space(block, run=max(220, int(page_height * 0.14)))
    if block.height > page_height * 0.95:
        flags.append("very-tall")
    if block.height < 50:
        flags.append("very-short")
    return block, sorted(set(flags))


def process_paper(conn, paper_id, stamp_report, only=None):
    questions = [dict(row) for row in conn.execute(
        "SELECT id, question_no, question_type, page_no, prompt, block_path, figure_paths_json != '[]' AS visual FROM questions WHERE paper_id=? "
        "ORDER BY page_no, question_no",
        (paper_id,),
    )]
    questions.sort(key=lambda q: (q["page_no"] or 0,
                                  0 if str(q["question_no"]).isdigit() else 1,
                                  expected_number(q["question_no"]) or 0))
    pages = page_files(paper_id)
    if not pages:
        for question in questions:
            stamp_report.append({"id": question["id"], "flags": ["no-page-renders"]})
        return 0
    layouts = {number: page_layout(path) for number, path in pages.items()}
    markers, stream = find_markers(questions, pages, layouts)
    ordered = [q for q in questions if q["id"] in markers]
    ordered.sort(key=lambda q: (markers[q["id"]]["page"], markers[q["id"]]["top"]))
    made = 0
    text_paper = paper_id.startswith("nift-") and "-cat" not in paper_id
    for index, question in enumerate(questions):
        if only is not None and question["id"] not in only:
            continue  # boundaries above still use every question; only the chosen ones are cropped
        if text_paper and not question["visual"] and only is None:
            conn.execute("UPDATE questions SET block_path=NULL, block_meta_json=NULL WHERE id=?", (question["id"],))
            continue
        marker = markers.get(question["id"])
        out_rel = pathlib.Path("server/data/media") / paper_id / "blocks" / f"{question['id']}.png"
        out_path = ROOT / out_rel
        if not marker:
            meta = {"flags": ["marker-not-found"], "pages": []}
            conn.execute("UPDATE questions SET block_meta_json=? WHERE id=?", (json.dumps(meta), question["id"]))
            stamp_report.append({"id": question["id"], **meta})
            continue
        position = ordered.index(question)
        following = markers[ordered[position + 1]["id"]] if position + 1 < len(ordered) else None
        following = next_boundary(marker, following, stream)
        block, flags = build_block(question, marker, following, pages, layouts, clean=only is not None and text_paper)
        if block is None:
            meta = {"flags": flags, "pages": [marker["page"]]}
            conn.execute("UPDATE questions SET block_meta_json=? WHERE id=?", (json.dumps(meta), question["id"]))
            stamp_report.append({"id": question["id"], **meta})
            continue
        if question["page_no"] and marker["page"] != question["page_no"]:
            flags.append("page-differs-from-bank")
        out_path.parent.mkdir(parents=True, exist_ok=True)
        previous = out_path.read_bytes() if out_path.is_file() else None
        block.save(out_path, format="PNG", optimize=True)
        meta = {"flags": sorted(set(flags)), "pages": sorted({marker["page"], (following or marker)["page"]}),
                "width": block.width, "height": block.height, "marker": marker["text"][:60]}
        conn.execute(
            "UPDATE questions SET block_path=?, block_meta_json=?, updated_at=datetime('now') WHERE id=?",
            (str(out_rel), json.dumps(meta), question["id"]),
        )
        if out_path.read_bytes() != previous:
            conn.execute("UPDATE questions SET crop_review='pending' WHERE id=?", (question["id"],))
        stamp_report.append({"id": question["id"], **meta})
        made += 1
    return made


def ensure_columns(conn):
    columns = {row[1] for row in conn.execute("PRAGMA table_info(questions)")}
    if "block_path" not in columns:
        conn.execute("ALTER TABLE questions ADD COLUMN block_path TEXT")
    if "block_meta_json" not in columns:
        conn.execute("ALTER TABLE questions ADD COLUMN block_meta_json TEXT")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--paper", action="append", help="Only these paper ids")
    parser.add_argument("--ocr-only", action="store_true", help="Warm the OCR cache and stop")
    parser.add_argument("--jobs", type=int, default=6)
    parser.add_argument("--ids-file", help="JSON list of question ids to crop (NIFT text questions are cropped only this way)")
    args = parser.parse_args()
    only = set(json.loads(pathlib.Path(args.ids_file).read_text())) if args.ids_file else None
    if not OCR.is_file():
        raise SystemExit("Vision OCR helper is missing.")

    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    # Official papers only: owner collections and Dexam originals have their own pipelines.
    paper_ids = args.paper or [row[0] for row in conn.execute(
        "SELECT id FROM papers WHERE coalesce(source_kind, 'official') = 'official' ORDER BY id")]

    all_pages = [path for paper in paper_ids for path in page_files(paper).values()]
    with concurrent.futures.ThreadPoolExecutor(max_workers=args.jobs) as pool:
        for done, _ in enumerate(pool.map(ocr_rows, all_pages), 1):
            if done % 100 == 0:
                print(f"ocr {done}/{len(all_pages)}", flush=True)
    print(f"ocr ready for {len(all_pages)} pages", flush=True)
    if args.ocr_only:
        return

    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name(f"dexam.before-block-crops-{stamp}.sqlite")
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)
    ensure_columns(conn)

    report = []
    total = 0
    for paper_id in paper_ids:
        made = process_paper(conn, paper_id, report, only)
        conn.commit()
        total += made
        print(f"{paper_id}: {made} blocks", flush=True)
    REPORTS.mkdir(parents=True, exist_ok=True)
    report_path = REPORTS / f"block-crops-{stamp}.json"
    report_path.write_text(json.dumps(report, indent=1))
    flagged = sum(1 for item in report if item.get("flags"))
    print("backup", backup)
    print("report", report_path)
    print(f"blocks {total}, flagged {flagged}, questions {len(report)}")


if __name__ == "__main__":
    main()
