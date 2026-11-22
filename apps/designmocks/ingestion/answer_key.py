#!/usr/bin/env python3
"""Stage 4 of the question-paper ingestion pipeline: the official answer key.

Reads an answer-key PDF and 02-segments, writes <work>/<paper-id>/04-key/:

    key.json          per question: the key as printed, the key in the bank's notation,
                      its kind and status, and checks against the question and the bank
    source/<file>     byte-for-byte copy of the key PDF, hashed

Official keys are printed as tables: "Q. No." and "Key" column pairs under a
section heading (NAT / MSQ / MCQ). Cells are paired by column position, not text
order, so multi-column tables and keys that wrap onto a second line read correctly.
Pages without a text layer are read with the local OCR helper.

The key is copied, never guessed: a cell that cannot be read is reported, and a
dropped question stays dropped. See docs/ingestion/PLAN.md.
"""

import argparse
import hashlib
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import fitz

SCHEMA = 1
STAGE = "04-key"
MAX_KEY_BYTES = 20 * 1024 * 1024
OCR_DPI = 200

Q_HEADER = re.compile(r"^\s*Q\s*\.?\s*No\.?\s*$", re.I)
KEY_HEADER = re.compile(r"^\s*(?:key|keys|key\s*/\s*s|key\s*range|answer)s?\b", re.I)
SECTION = re.compile(r"\bsection\b", re.I)
TYPES = [("NAT", re.compile(r"\bNAT\b|numerical", re.I)),
         ("MSQ", re.compile(r"\bMSQ\b|multiple\s+select", re.I)),
         ("MCQ", re.compile(r"\bMCQ\b|multiple\s+choice", re.I))]
QNUM = re.compile(r"^\s*(?:Q\s*\.?\s*)?0*(\d{1,3})\s*$", re.I)
NUMBER = r"[+-]?(?:\d+(?:\.\d*)?|\.\d+)"
DROPPED = re.compile(r"\b(dropped|full\s+marks|bonus|marks?\s+awarded\s+to\s+all|cancel+ed|deleted)\b", re.I)


class KeyError_(Exception):
    """A refusal the operator can act on. The message is safe to print."""


def sha256(data):
    return hashlib.sha256(data).hexdigest()


# ---------------------------------------------------------------- notation


def normalise(printed, kind):
    """Printed key -> (raw in the bank's notation, status, notes). raw is None when unreadable or dropped."""
    text = " ".join(str(printed).replace("–", "-").replace("—", "-").split())
    text = re.sub(r"(?<=[A-D])(or)\b", r" \1", text, flags=re.I)  # OCR glues "C or" into "Cor"
    text = re.sub(r"[,;]?\s+or\s*[,;]?\s+", " or ", text, flags=re.I)  # "0.26-0.27 or, 26-27"
    if not text:
        return None, "missing", ["empty-cell"]
    if DROPPED.search(text):
        return None, "dropped", [f"printed: {text}"]
    branches = [b.strip() for b in re.split(r"\s+or\s+", text, flags=re.I) if b.strip()]
    if kind == "NAT":
        out = []
        for branch in branches:
            # "94.2 (92.9 - 94.6)": a printed value with its accepted range; the range is the key.
            bracket = re.fullmatch(rf"({NUMBER})\s*\(\s*({NUMBER})\s*(?:-|to)\s*({NUMBER})\s*\)", branch, re.I)
            if bracket:
                out.append(f"{bracket.group(2)} to {bracket.group(3)}")
                continue
            span = re.fullmatch(rf"({NUMBER})\s*(?:-|to)\s*({NUMBER})", branch, re.I)
            if span:
                low, high = span.group(1), span.group(2)
                if float(low) > float(high):
                    return None, "unreadable", [f"range-reversed: {text}"]
                out.append(f"{low} to {high}")
                continue
            if re.fullmatch(NUMBER, branch):
                out.append(branch)
                continue
            return None, "unreadable", [f"printed: {text}"]
        if len(set(out)) != len(out):
            return None, "unreadable", [f"repeated-alternative: {text}"]
        return " or ".join(out), "official-key", []
    out = []
    for branch in branches:
        letters = re.findall(r"[A-Za-z]+", branch)
        joined = "".join(letters).upper()
        # "A B D", "A, C", "B. D", "ACD": letters only, each A-D, no repeats.
        if not joined or not re.fullmatch(r"[A-D]+", joined) or len(set(joined)) != len(joined):
            return None, "unreadable", [f"printed: {text}"]
        if kind == "MCQ" and len(joined) != 1:
            return None, "unreadable", [f"several-letters-for-mcq: {text}"]
        out.append(",".join(sorted(joined)))
    if len(set(out)) != len(out):
        return None, "unreadable", [f"repeated-alternative: {text}"]
    return " or ".join(out), "official-key", []


def canonical(raw, kind):
    """A comparable form of a key in any of the bank's notations ("AC", "A,C", "15 to 16", "65-66")."""
    if raw is None:
        return None
    value, status, _ = normalise(raw, kind)
    if status != "official-key":
        return None
    branches = []
    for branch in value.split(" or "):
        if kind == "NAT":
            parts = branch.split(" to ")
            branches.append(tuple(decimal_identity(p) for p in (parts if len(parts) == 2 else parts * 2)))
        else:
            branches.append(branch)
    return tuple(sorted(branches))


def decimal_identity(value):
    sign = "-" if value.startswith("-") else ""
    whole, _, fraction = value.lstrip("+-").partition(".")
    whole, fraction = whole.lstrip("0") or "0", fraction.rstrip("0")
    return f"{sign if (whole != '0' or fraction) else ''}{whole}.{fraction}"


# ---------------------------------------------------------------- reading the table


def text_lines(page):
    lines = []
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(span["text"] for span in line["spans"]).strip()
            if text:
                lines.append({"box": list(line["bbox"]), "text": text})
    return lines


def ocr_page_lines(page, ocr, scratch):
    zoom = OCR_DPI / 72
    path = scratch / f"key-page-{page.number + 1}.png"
    page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False).save(str(path))
    width, height = page.rect.width, page.rect.height
    lines = []
    for row in ocr(path):
        text = " ".join(str(row["text"]).split())
        if text:
            x0, x1 = row["x"] * width, (row["x"] + row["w"]) * width
            y0, y1 = (1 - row["y"] - row["h"]) * height, (1 - row["y"]) * height
            lines.append({"box": [x0, y0, x1, y1], "text": text})
    return lines


def centre(box):
    return (box[0] + box[2]) / 2, (box[1] + box[3]) / 2


HEAD_Q = re.compile(r"^\s*(?:Q\s*\.?\s*(?:No\.?|Number)?|No\.?)\s*$", re.I)
HEAD_OTHER = re.compile(r"^\s*(?:type|section|marks?)\s*$", re.I)
EXPLICIT_Q = re.compile(r"^\s*Q\s*\.?\s*0*(\d{1,3})\s*$", re.I)


def is_header(text):
    return bool(HEAD_Q.match(text) or KEY_HEADER.match(text) or HEAD_OTHER.match(text))


def section_kind(text):
    if SECTION.search(text) and len(text) < 80:
        return next((k for k, pattern in TYPES if pattern.search(text)), None) or "?"
    return None


def rows_of(lines, tolerance=5):
    rows = []
    for line in sorted(lines, key=lambda l: centre(l["box"])[1]):
        y = centre(line["box"])[1]
        if rows and abs(rows[-1][0] - y) <= tolerance:
            rows[-1][1].append(line)
        else:
            rows.append([y, [line]])
    return [sorted(row, key=lambda l: l["box"][0]) for _, row in rows]


def header_table(header, body):
    """Pair cells under "Q. No." / "Key" headers by column position.

    Each key line goes to the question row whose centre is nearest (a key printed on
    two lines is centred on its row). Lines far from every row are footers or keys
    whose question number was not read; the latter are recovered from the grid."""
    q_heads = sorted((l for l in header if HEAD_Q.match(l["text"])), key=lambda l: centre(l["box"])[0])
    clusters = []  # "Q." above "No." is one column
    for head in q_heads:
        if clusters and abs(centre(head["box"])[0] - centre(clusters[-1][-1]["box"])[0]) < 20:
            clusters[-1].append(head)
        else:
            clusters.append([head])
    others = sorted(header, key=lambda l: l["box"][0])
    columns = []
    for cluster in clusters:
        q_left = min(h["box"][0] for h in cluster) - 12
        q_right = max(h["box"][2] for h in cluster)
        key_head = next((k for k in others if KEY_HEADER.match(k["text"]) and k["box"][0] > q_right - 4), None)
        if key_head is None:
            continue
        right = next((h["box"][0] - 4 for h in others if h["box"][0] > key_head["box"][2] - 2
                      and h is not key_head and not KEY_HEADER.match(h["text"])), float("inf"))
        key_left = key_head["box"][0] - 8
        q_cells = sorted((l for l in body if q_left <= centre(l["box"])[0] < key_left and QNUM.match(l["text"])),
                         key=lambda l: l["box"][1])
        key_lines = [l for l in body if key_left <= centre(l["box"])[0] < right]
        columns.append({"left": key_left, "right": min(right, key_left + 160), "q": q_cells, "keys": key_lines})
    centres = sorted(centre(c["box"])[1] for column in columns for c in column["q"])
    gaps = [b - a for a, b in zip(centres, centres[1:]) if b - a > 4]
    spacing = sorted(gaps)[len(gaps) // 2] if gaps else 20.0
    rows = []  # (column index, number or None, y centre, key lines)
    for index, column in enumerate(columns):
        owned = {id(c): [] for c in column["q"]}
        orphans = []
        for line in column["keys"]:
            y = centre(line["box"])[1]
            nearest = min(column["q"], key=lambda c: abs(centre(c["box"])[1] - y), default=None)
            if nearest is not None and abs(centre(nearest["box"])[1] - y) <= 0.6 * spacing:
                owned[id(nearest)].append(line)
            else:
                orphans.append(line)
        for cell in column["q"]:
            rows.append({"column": index, "number": int(QNUM.match(cell["text"]).group(1)),
                         "y": centre(cell["box"])[1], "lines": owned[id(cell)], "inferred": False})
        for line in orphans:  # group orphan lines by row
            y = centre(line["box"])[1]
            group = next((r for r in rows if r["column"] == index and r["number"] is None and abs(r["y"] - y) <= 0.6 * spacing), None)
            if group:
                group["lines"].append(line)
            else:
                rows.append({"column": index, "number": None, "y": y, "lines": [line], "inferred": False})
    infer_numbers(rows, spacing)
    entries = []
    for row in rows:
        if row["number"] is None:
            continue
        parts = sorted(row["lines"], key=lambda l: (l["box"][1], l["box"][0]))
        column = columns[row["column"]]
        # The cell reaches halfway to the neighbouring rows: tall wrapped keys stay inside it.
        # Rows line up across the table, so any column's row marks a boundary (a label OCR
        # missed in this column is usually read in another).
        same = sorted(r["y"] for r in rows if r["number"] is not None)
        above = [y for y in same if y < row["y"] - 0.3 * spacing]
        below = [y for y in same if y > row["y"] + 0.3 * spacing]
        top = (above[-1] + row["y"]) / 2 if above else row["y"] - 0.6 * spacing
        bottom = (below[0] + row["y"]) / 2 if below else row["y"] + 0.6 * spacing
        entries.append({"number": row["number"], "printed": " ".join(p["text"] for p in parts), "lines": [p["box"] for p in parts],
                        "cell": [column["left"], row["y"] - 0.45 * spacing, column["right"], row["y"] + 0.45 * spacing],
                        "span": [column["left"], top, column["right"], bottom],
                        "inferred": row["inferred"], "inferredRun": row.get("inferredRun", False)})
    return entries


def row_index(rows, spacing):
    """Map a y position to the table's row number, from every row seen in any column."""
    centres = []
    for y in sorted(r["y"] for r in rows):
        if not centres or y - centres[-1] > 0.5 * spacing:
            centres.append(y)
    return lambda y: min(range(len(centres)), key=lambda i: abs(centres[i] - y))


def infer_numbers(rows, spacing):
    """A key whose question-number cell was not read gets its number from the grid, only
    when both neighbours agree: the cells left and right in its row (numbered across) or
    above and below in its column (numbered down)."""
    known = [r for r in rows if r["number"] is not None]
    taken = {r["number"] for r in known}

    def at(column, y):
        return next((r["number"] for r in known if r["column"] == column and abs(r["y"] - y) <= 0.6 * spacing), None)

    for row in rows:
        if row["number"] is not None:
            continue
        left, right = at(row["column"] - 1, row["y"]), at(row["column"] + 1, row["y"])
        above = next((r["number"] for r in known if r["column"] == row["column"] and 0.6 * spacing < row["y"] - r["y"] <= 1.6 * spacing), None)
        below = next((r["number"] for r in known if r["column"] == row["column"] and 0.6 * spacing < r["y"] - row["y"] <= 1.6 * spacing), None)
        guess = None
        if left is not None and right is not None and right - left == 2:
            guess = left + 1
        elif above is not None and below is not None and below - above == 2:
            guess = above + 1
        else:
            # Numbered down the column: every known row fits number = row index + constant.
            index_of = row_index(rows, spacing)
            column = [(index_of(r["y"]), r["number"]) for r in known if r["column"] == row["column"]]
            offsets = {n - i for i, n in column}
            here = index_of(row["y"])
            # Fill gaps only: never number a row above or below the column's known rows.
            if len(column) >= 3 and len(offsets) == 1 and min(i for i, _ in column) < here < max(i for i, _ in column):
                guess = offsets.pop() + here
        if guess is not None and guess not in taken:
            row["number"], row["inferred"] = guess, True
            taken.add(guess)

    # A scan can omit several consecutive question-number cells while reading
    # their answer cells. A one-row neighbour check cannot recover that run.
    # Number it only when every intervening row contains key ink and the two
    # printed endpoint numbers account for exactly that many rows.
    for column in sorted({row["column"] for row in rows}):
        ordered = sorted((row for row in rows if row["column"] == column), key=lambda row: row["y"])
        anchors = [index for index, row in enumerate(ordered) if row["number"] is not None]
        for start, end in zip(anchors, anchors[1:]):
            between = ordered[start + 1:end]
            low, high = ordered[start]["number"], ordered[end]["number"]
            if (not between or high - low != len(between) + 1
                    or any(row["number"] is not None or not row["lines"] for row in between)
                    or any(low + offset in taken for offset in range(1, len(between) + 1))):
                continue
            for offset, row in enumerate(between, 1):
                row["number"], row["inferred"], row["inferredRun"] = low + offset, True, True
                taken.add(low + offset)


LOOSE_LABEL = re.compile(r"^[|\s]*[Q0O]?\s*[.,]?\s*0*(\d{1,3})\s*$", re.I)


def headerless_table(body):
    """Rows of "Q01 19  Q31 ABC  Q61 B": each Q-labelled cell owns the cells to its right.

    Label columns come from cells that clearly read "Q12". A cell in a label column that
    OCR misread ("| Q24", "037", "Q,78") still counts as a label; a key with no label
    gets its number from the labels above and below it in the same column."""
    sure = [c for c in body if EXPLICIT_Q.match(c["text"])]
    if not sure:
        return []
    starts = []
    for x in sorted(c["box"][0] for c in sure):
        if not starts or x - starts[-1][-1] > 12:
            starts.append([x])
        else:
            starts[-1].append(x)
    columns = [sum(group) / len(group) for group in starts if len(group) >= 2]
    label_width = sorted(c["box"][2] - c["box"][0] for c in sure)[len(sure) // 2]
    spans = [(x + label_width, (columns[i + 1] - 2) if i + 1 < len(columns) else x + label_width + 90)
             for i, x in enumerate(columns)]

    def label_column(cell):
        for index, x in enumerate(columns):
            if abs(cell["box"][0] - x) <= 10 and LOOSE_LABEL.match(cell["text"]):
                return index
        return None

    table = []  # per row: {column: {"number", "parts", "box"}}
    for row in rows_of(body):
        y0, y1 = min(c["box"][1] for c in row), max(c["box"][3] for c in row)
        found = {}
        for cell in row:
            index = label_column(cell)
            if index is not None:
                found[index] = {"number": int(LOOSE_LABEL.match(cell["text"]).group(1)), "parts": [], "inferred": False}
        for cell in row:
            if label_column(cell) is not None:
                continue
            middle = centre(cell["box"])[0]
            for index, (left, right) in enumerate(spans):
                if left - 4 <= middle < right:
                    found.setdefault(index, {"number": None, "parts": [], "inferred": False})["parts"].append(cell)
                    break
        table.append((y0, y1, found))
    for position, (_, _, found) in enumerate(table):
        for index, entry in found.items():
            if entry["number"] is not None or not entry["parts"]:
                continue
            above = next((t[2][index]["number"] for t in reversed(table[:position]) if index in t[2] and t[2][index]["number"]), None)
            below = next((t[2][index]["number"] for t in table[position + 1:] if index in t[2] and t[2][index]["number"]), None)
            if above is not None and below is not None and below - above == 2:
                entry["number"], entry["inferred"] = above + 1, True
            elif position and index in table[position - 1][2] and table[position - 1][2][index]["number"] is not None \
                    and table[position][0] - table[position - 1][1] < 0.8 * (table[position - 1][1] - table[position - 1][0]):
                # A wrapped key ("A C D" / "or A C"): the line below continues the cell above.
                previous = table[position - 1][2][index]
                previous["parts"].extend(entry["parts"])
                previous["extendTo"] = table[position][1]
                entry["parts"] = []
    entries = []
    for y0, y1, found in table:
        for index, entry in sorted(found.items()):
            if entry["number"] is None:
                continue
            left, right = spans[index]
            parts = sorted(entry["parts"], key=lambda c: c["box"][0])
            parts = sorted(entry["parts"], key=lambda c: (round(c["box"][1] / 4), c["box"][0]))
            entries.append({"number": entry["number"], "printed": " ".join(c["text"] for c in parts),
                            "cell": [left - 2, y0 - 3, right, entry.get("extendTo", y1) + 3], "inferred": entry["inferred"],
                            "lines": [c["box"] for c in parts]})
    return entries


def read_tables(pages_lines):
    """Return ([(section kind or None, question number, printed key, page)], issues)."""
    entries, issues = [], []
    kind = None
    for page_no, lines in pages_lines:
        ordered = sorted(lines, key=lambda l: (centre(l["box"])[1], l["box"][0]))
        # Split the page into blocks at section headings.
        headings = [l for l in ordered if section_kind(l["text"])]
        side_by_side = any(abs(centre(a["box"])[1] - centre(b["box"])[1]) < 6
                           for i, a in enumerate(headings) for b in headings[i + 1:])
        blocks, current = [], (kind, [])
        for line in ordered:
            found = section_kind(line["text"])
            if found and side_by_side:
                kind, current = None, (None, current[1])  # headings across one row: types by column are unknown
                continue
            if found:
                blocks.append(current)
                current = (found if found != "?" else None, [])
            else:
                current[1].append(line)
        blocks.append(current)
        for block_kind, block in blocks:
            if block_kind:
                kind = block_kind
            heads = [l for l in block if HEAD_Q.match(l["text"])]
            if heads:
                top = min(centre(h["box"])[1] for h in heads)
                header = [l for l in block if is_header(l["text"]) and top - 14 <= centre(l["box"])[1] <= top + 26]
                bottom = max(l["box"][3] for l in header)
                body = [l for l in block if centre(l["box"])[1] > bottom and l not in header]
                found = header_table(header, body)
                if not found:
                    issues.append({"page": page_no, "issue": "header-without-key-column"})
            else:
                found = headerless_table(block)
            entries.extend(dict(entry, kind=kind, page=page_no) for entry in found)
    return entries, issues


# ---------------------------------------------------------------- driver


LETTER_SIZE = 20
LETTER_SCORE = 0.8
LETTER_MARGIN = 0.08


def glyphs(scan, box_pt, dpi=OCR_DPI):
    """Crops of the separate marks inside a cell, left to right (split on empty columns)."""
    import numpy as np
    zoom = dpi / 72
    x0, y0, x1, y1 = (round(v * zoom) for v in box_pt)
    grey = np.asarray(scan.crop((max(x0, 0), max(y0, 0), x1, y1)).convert("L"), dtype=np.int16)
    if grey.size == 0:
        return []
    # Dark letters on a white or coloured cell: threshold against the cell's own background.
    region = grey < min(128, int(np.median(grey)) - 60)
    # Table rules crossing the cell are not letters.
    region[region.mean(axis=1) > 0.6, :] = False
    region[:, region.mean(axis=0) > 0.8] = False
    if not region.any():
        return []
    columns = region.any(axis=0)
    marks, start = [], None
    for x, filled in enumerate(list(columns) + [False]):
        if filled and start is None:
            start = x
        elif not filled and start is not None:
            piece = region[:, start:x]
            rows = piece.any(axis=1)
            top, bottom = rows.argmax(), len(rows) - rows[::-1].argmax()
            if piece.sum() >= 12:  # specks are not letters
                marks.append(piece[top:bottom])
            start = None
    tallest = max((m.shape[0] for m in marks), default=0)
    # Commas and full stops are short; table borders are thin. A-D are neither.
    return [m for m in marks if m.shape[0] >= 0.6 * tallest and m.shape[1] >= 0.4 * m.shape[0]]


def normalised_glyph(mark):
    import numpy as np
    from PIL import Image
    image = Image.fromarray((mark * 255).astype("uint8")).resize((LETTER_SIZE, LETTER_SIZE), Image.BILINEAR)
    vector = np.asarray(image, dtype=float).ravel()
    vector -= vector.mean()
    norm = np.linalg.norm(vector)
    return vector / norm if norm else vector


def audit_cells(scan_path, entries):
    """On a scanned key, ink in a cell that no OCR line covers means OCR skipped part of
    the key (a lone "C" on a wrapped line, typically). Such a key is not trusted."""
    import numpy as np
    from PIL import Image
    if not scan_path.exists():
        return
    with Image.open(scan_path) as opened:
        scan = opened.convert("L")
    zoom = OCR_DPI / 72
    for entry in entries:
        if entry["cell"] is None or not entry["printed"].strip() or entry.get("letterMatch") or entry.get("cropMatch"):
            continue
        x0, y0, x1, y1 = entry.get("span") or entry["cell"]
        x1 = min(x1, x0 + 160)
        grey = np.asarray(scan.crop(tuple(round(v * zoom) for v in (x0, y0, x1, y1))), dtype=np.int16)
        if grey.size == 0:
            continue
        ink = grey < min(128, int(np.median(grey)) - 60)
        ink[ink.mean(axis=1) > 0.6, :] = False
        ink[:, ink.mean(axis=0) > 0.8] = False
        ink[:, : int(0.12 * zoom * 8)] = False  # the cell's left border
        covered = np.zeros(ink.shape[0], dtype=bool)
        for box in entry.get("lines", []):
            top, bottom = round((box[1] - y0) * zoom) - 2, round((box[3] - y0) * zoom) + 2
            covered[max(top, 0):max(bottom, 0)] = True
        rows = ink.sum(axis=1) >= 3
        if (rows & ~covered).sum() >= 0.35 * 10 * zoom:  # a third of a 10 pt text line
            entry["partial"] = True


def match_empty_letters(scan_path, entries):
    """Fill key cells OCR left empty, using the letters OCR did read on the same scan as
    samples of how A-D look there. A cell is filled only on a clear match."""
    import numpy as np
    from PIL import Image
    if not scan_path.exists():
        return 0
    with Image.open(scan_path) as opened:
        scan = opened.convert("L")
    samples = {}
    for entry in entries:
        letters = re.sub(r"[^A-D]", "", entry["printed"].upper())
        if (entry["cell"] is None or entry.get("cropMatch") or not letters
                or not re.fullmatch(r"[A-D ,.]+", entry["printed"].upper())):
            continue
        marks = glyphs(scan, entry["cell"])
        if len(marks) == len(letters):
            for letter, mark in zip(letters, marks):
                samples.setdefault(letter, []).append(normalised_glyph(mark))
    if len(samples) < 2:
        return 0
    means = {letter: np.mean(vectors, axis=0) for letter, vectors in samples.items()}
    filled = 0
    for entry in entries:
        if entry["printed"].strip() or entry["cell"] is None:
            continue
        found, scores = [], []
        for mark in glyphs(scan, entry["cell"]):
            vector = normalised_glyph(mark)
            ranked = sorted(((float(vector @ m / (np.linalg.norm(m) or 1)), letter) for letter, m in means.items()), reverse=True)
            best = ranked[0]
            second = ranked[1][0] if len(ranked) > 1 else -1
            if best[0] < LETTER_SCORE or best[0] - second < LETTER_MARGIN:
                found = []
                break
            found.append(best[1])
            scores.append(round(best[0], 2))
        if found:
            entry["printed"] = " ".join(found)
            entry["letterMatch"] = scores
            filled += 1
    return filled


def crop_ocr_text(scan, box, ocr, scratch, name):
    """Read one isolated cell; callers compare distinct crops before trusting it."""
    zoom = OCR_DPI / 72
    crop = scan.crop(tuple(round(v * zoom) for v in box))
    if crop.width < 8 or crop.height < 8:
        return None
    enlarged = crop.resize((crop.width * 4, crop.height * 4))
    path = scratch / f"key-cell-{name}.png"
    try:
        enlarged.save(path)
        lines = [str(row["text"]).strip() for row in ocr(path) if str(row["text"]).strip()]
    finally:
        path.unlink(missing_ok=True)
    return lines[0] if len(lines) == 1 else None


def match_empty_nat_cells(scan_path, entries, questions, ocr, scratch):
    """Retry an empty numeric key cell in two tighter crops; require exact OCR agreement.

    The full-page scan remains the evidence. Cropping only helps Vision see a small
    isolated number, and the review page still calls for visual source checking.
    """
    from PIL import Image
    if not scan_path.exists():
        return 0
    with Image.open(scan_path) as opened:
        scan = opened.convert("RGB")
    filled = 0
    for entry in entries:
        question = questions.get(f'q{entry["number"]}')
        if entry["printed"].strip() or entry["cell"] is None or not question or question["type"] != "NAT":
            continue
        x0, y0, x1, y1 = entry.get("span") or entry["cell"]
        if x1 - x0 < 90 or y1 - y0 < 5:
            continue
        readings = []
        for width in (70, 90):
            right = min(x1, x0 + width)
            readings.append(crop_ocr_text(scan, (x0, y0, right, y1), ocr, scratch,
                                          f'{entry["page"]}-{entry["number"]}-{width}'))
        if readings[0] and readings[0] == readings[1] and normalise(readings[0], "NAT")[1] == "official-key":
            entry["printed"], entry["cropMatch"] = readings[0], True
            filled += 1
    return filled


def match_missing_rows(scan_path, entries, questions, ocr, scratch, page_no):
    """Recover a wholly missed row only when adjacent labels and two crop pairs agree."""
    from PIL import Image
    if not scan_path.exists():
        return 0
    with Image.open(scan_path) as opened:
        scan = opened.convert("RGB")
    found = 0
    ordered = sorted((entry for entry in entries if entry["page"] == page_no and entry.get("cell")),
                     key=lambda entry: entry["number"])
    occupied = {entry["number"] for entry in ordered}
    for before, after in zip(ordered, ordered[1:]):
        number = before["number"] + 1
        question = questions.get(f"q{number}")
        previous_question = questions.get(f'q{before["number"]}')
        next_question = questions.get(f'q{after["number"]}')
        if (after["number"] != number + 1 or number in occupied or not question
                or question["type"] not in ("NAT", "MSQ", "MCQ")
                or not previous_question or not next_question
                or not (previous_question["type"] == question["type"] == next_question["type"])
                or abs(before["cell"][0] - after["cell"][0]) > 4):
            continue
        x = (before["cell"][0] + after["cell"][0]) / 2
        y0, y1 = before["span"][3], after["span"][1]
        if not 8 <= y1 - y0 <= 45 or x < 55 or x + 70 > before["cell"][2]:
            continue
        label = [crop_ocr_text(scan, box, ocr, scratch, f"{page_no}-{number}-label-{index}")
                 for index, box in enumerate(((x - 50, y0, x, y1), (x - 35, y0 + 1, x, y1 - 1)))]
        if label != [str(number), str(number)]:
            continue
        keys = [crop_ocr_text(scan, box, ocr, scratch, f"{page_no}-{number}-answer-{index}")
                for index, box in enumerate(((x, y0, x + 70, y1), (x + 9, y0 + 1, x + 64, y1 - 1)))]
        if not keys[0] or keys[0] != keys[1] or normalise(keys[0], question["type"])[1] != "official-key":
            continue
        entries.append({"number": number, "printed": keys[0], "lines": [],
                        "cell": [x, y0, before["cell"][2], y1], "span": [x, y0, before["cell"][2], y1],
                        "inferred": True, "inferredMissingRow": True, "cropMatch": True,
                        "kind": before.get("kind"), "page": page_no})
        occupied.add(number)
        found += 1
    return found


def default_ocr(work_root):
    import importlib.util
    spec = importlib.util.spec_from_file_location("segment", pathlib.Path(__file__).with_name("segment.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.vision_ocr(work_root)


def run_key(*, work, paper_id, key_pdf, replace=False, ocr=None, bank_questions=None):
    work_root = pathlib.Path(work).expanduser().resolve()
    paper_dir = work_root / paper_id
    segments_path = paper_dir / "02-segments" / "questions.json"
    if not segments_path.is_file():
        raise KeyError_(f"Run stages 1 and 2 first: {paper_id}/02-segments/questions.json is missing")
    key_pdf = pathlib.Path(key_pdf)
    if not key_pdf.is_file() or key_pdf.stat().st_size > MAX_KEY_BYTES:
        raise KeyError_("Choose a readable answer-key PDF of at most 20 MB")
    with open(key_pdf, "rb") as handle:
        if handle.read(5) != b"%PDF-":
            raise KeyError_("The answer key is not a PDF file")
    target = paper_dir / STAGE
    if target.exists() and not replace:
        raise KeyError_(f"{paper_id}/{STAGE} already exists; pass --replace to redo the key")
    segments = json.loads(segments_path.read_text())
    questions = {q["key"]: q for q in segments["questions"] if q["part"] == "A"}

    staging = pathlib.Path(tempfile.mkdtemp(prefix=f".{STAGE}-", dir=paper_dir))
    try:
        (staging / "source").mkdir()
        copy = staging / "source" / key_pdf.name
        shutil.copyfile(key_pdf, copy)
        pages_lines, read_by = [], {}
        try:
            doc = fitz.open(copy)
        except Exception:
            raise KeyError_("The answer-key PDF could not be opened")
        with doc:
            if doc.needs_pass:
                raise KeyError_("The answer-key PDF is password-protected")
            for page in doc:
                lines = text_lines(page)
                if sum(len(l["text"]) for l in lines) < 80:  # an image of a table: read it
                    lines = ocr_page_lines(page, ocr or default_ocr(work_root), staging)
                    read_by[page.number + 1] = "ocr"
                else:
                    read_by[page.number + 1] = "text"
                pages_lines.append((page.number + 1, lines))
        entries, issues = read_tables(pages_lines)
        letters_by_page = {}
        for page_no, how in read_by.items():
            if how == "ocr":
                scan = staging / f"key-page-{page_no}.png"
                match_missing_rows(scan, entries, questions, ocr or default_ocr(work_root), staging, page_no)
                letters_by_page[page_no] = match_empty_letters(scan, [e for e in entries if e["page"] == page_no])
                match_empty_nat_cells(scan, [e for e in entries if e["page"] == page_no], questions,
                                      ocr or default_ocr(work_root), staging)
                audit_cells(scan, [e for e in entries if e["page"] == page_no])
        for scratch in staging.glob("key-page-*.png"):
            scratch.unlink()

        keys, seen = {}, set()
        for entry in entries:
            kind, number, printed, page_no = entry["kind"], entry["number"], entry["printed"], entry["page"]
            name = f"q{number}"
            if name in seen:
                issues.append({"key": name, "issue": "printed-twice"})
                continue
            seen.add(name)
            question = questions.get(name)
            qtype = question["type"] if question else None
            use = qtype or kind
            raw, status, notes = normalise(printed, use) if use in ("NAT", "MSQ", "MCQ") else (None, "unreadable", ["type-unknown"])
            if entry.get("partial") and status == "official-key":
                raw, status, notes = None, "unreadable", notes + ["ocr-missed-part-of-cell"]
            checks = []
            if question is None:
                checks.append("no-such-question")
            if kind and qtype and kind != qtype:
                checks.append(f"key-section-{kind}-but-question-{qtype}")
            if raw and qtype in ("MCQ", "MSQ") and question["options"]:
                letters = {o["key"] for o in question["options"]}
                if not set(re.findall(r"[A-D]", raw)) <= letters:
                    checks.append("letter-not-an-option")
            how = read_by.get(page_no)
            if entry.get("letterMatch"):
                how = "letter-match"
                notes = notes + [f"letter scores {entry['letterMatch']}"]
            if entry.get("cropMatch"):
                how = "crop-ocr"
                notes = notes + ["two-crop-ocr-agreement-needs-visual-review"]
            if entry.get("inferredMissingRow"):
                notes = notes + ["whole-row-recovered-by-two-crop-pairs-needs-visual-review"]
            if entry.get("inferred"):
                notes = notes + ["question-number-inferred-from-grid"]
            if entry.get("inferredRun"):
                notes = notes + ["consecutive-row-run-needs-visual-review"]
            record = {"printed": printed, "raw": raw, "kind": use, "status": status, "page": page_no,
                      "readBy": how, "notes": notes, "checks": checks}
            if bank_questions is not None:
                record["bank"] = compare_bank(bank_questions.get(name), raw, use, status)
            keys[name] = record
        missing = sorted((k for k in questions if k not in keys), key=lambda k: int(k[1:]))
        statuses = {}
        for record in keys.values():
            statuses[record["status"]] = statuses.get(record["status"], 0) + 1
        report = {"partAQuestions": len(questions), "keysRead": len(keys), "missing": missing,
                  "statuses": statuses, "checks": {k: r["checks"] for k, r in keys.items() if r["checks"]},
                  "issues": issues, "pagesReadByOcr": sorted(p for p, how in read_by.items() if how == "ocr")}
        if bank_questions is not None:
            tally = {}
            for record in keys.values():
                tally[record["bank"]] = tally.get(record["bank"], 0) + 1
            report["bank"] = tally
        result = {"schema": SCHEMA, "stage": STAGE, "paperId": paper_id,
                  "source": {"name": key_pdf.name, "sha256": sha256(copy.read_bytes())},
                  "segmentsSha256": sha256(segments_path.read_bytes()), "report": report,
                  "keys": dict(sorted(keys.items(), key=lambda kv: int(kv[0][1:])))}
        (staging / "key.json").write_text(json.dumps(result, ensure_ascii=False, indent=1) + "\n")
        if target.exists():
            shutil.rmtree(target)
        staging.replace(target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"paperId": paper_id, "output": str(target), **{k: v for k, v in report.items() if k not in ("checks", "issues")},
            "checked": len(report["checks"]), "issues": len(report["issues"])}


def compare_bank(bank_question, raw, kind, status):
    """How this key compares with the canonical bank's answer for the same question."""
    if bank_question is None:
        return "not-in-bank"
    answer = bank_question.get("answer") or {}
    bank_raw = answer.get("raw")
    if status == "dropped":
        return "same" if bank_raw and DROPPED.search(str(bank_raw)) else "bank-has-answer-key-dropped"
    if bank_raw in (None, "", "None"):
        return "bank-missing"
    mine, theirs = canonical(raw, kind), canonical(str(bank_raw), kind)
    if theirs is None:
        return "bank-unreadable"
    if mine == theirs:
        return "same" if answer.get("status") == "official-key" else "same-bank-was-solved"
    return "different"


def load_bank(paper_id, repo_root):
    """Read the canonical bank's records for this paper from origin/main, keyed q1, q2 ..."""
    raw = subprocess.run(["git", "show", "origin/main:server/data/exports/dexam-bank-export.json"],
                         cwd=repo_root, capture_output=True, check=True).stdout
    prefix = f"{paper_id}-"
    return {q["externalKey"][len(prefix):]: q for q in json.loads(raw)["questions"]
            if q.get("provenance", {}).get("paperId") == paper_id}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stage 4: read the official answer key and match it.")
    parser.add_argument("--paper-id", required=True)
    parser.add_argument("--key", required=True, help="Official answer-key PDF")
    parser.add_argument("--work", required=True)
    parser.add_argument("--replace", action="store_true")
    parser.add_argument("--compare-bank", action="store_true", help="Compare with the canonical bank on origin/main")
    args = parser.parse_args(argv)
    try:
        bank = load_bank(args.paper_id, pathlib.Path(__file__).resolve().parents[3]) if args.compare_bank else None
        summary = run_key(work=args.work, paper_id=args.paper_id, key_pdf=args.key, replace=args.replace, bank_questions=bank)
    except (KeyError_, subprocess.CalledProcessError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
