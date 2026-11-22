#!/usr/bin/env python3
"""Prepare and explicitly approve source-linked manual answer-key transcriptions."""

import argparse
import html
import json
import pathlib
import re
import sys
import tempfile
from urllib.parse import quote

import fitz

import answer_key as ak
from intake import inside_git_worktree
from key_review import ReviewError, valid_box


def digest_json(value):
    return ak.sha256(json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":")).encode())


def valid_review(base, manifest, key, record):
    """A manual key is usable only while its private proposal and receipt still match."""
    review = record.get("review") or {}
    fingerprint = review.get("fingerprint")
    if not isinstance(fingerprint, str) or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        return False
    root = pathlib.Path(base) / "04-key-review"
    packet_path = root / "proposals" / fingerprint / "packet.json"
    receipt_path = root / "approved" / fingerprint / "receipt.json"
    prior_path = root / "approved" / fingerprint / "pre-review-key.json"
    if not all(path.is_file() for path in (packet_path, receipt_path, prior_path)):
        return False
    try:
        packet, receipt = json.loads(packet_path.read_text()), json.loads(receipt_path.read_text())
        payload = {name: value for name, value in packet.items() if name != "fingerprint"}
        entry = next(item for item in payload["entries"] if item["key"] == key)
    except (ValueError, KeyError, StopIteration, TypeError):
        return False
    try:
        return (packet.get("fingerprint") == fingerprint and digest_json(payload) == fingerprint
                and payload.get("paperId") == manifest.get("paperId")
                and payload.get("sourceSha256") == manifest.get("source", {}).get("sha256")
                and payload.get("segmentsSha256") == manifest.get("segmentsSha256")
                and payload.get("keyManifestSha256") == ak.sha256(prior_path.read_bytes())
                and receipt.get("fingerprint") == fingerprint
                and isinstance(review.get("reviewer"), str) and bool(review["reviewer"].strip())
                and receipt.get("reviewer") == review.get("reviewer")
                and isinstance(receipt.get("questions"), list) and key in receipt["questions"]
                and review.get("sourceSha256") == payload.get("sourceSha256")
                and entry.get("printed") == record.get("printed") and entry.get("raw") == record.get("raw")
                and entry.get("kind") == record.get("kind") and entry.get("page") == record.get("page")
                and entry.get("cropSha256") == review.get("cropSha256"))
    except (KeyError, TypeError, ValueError):
        return False


def evidence(work, paper_id):
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", paper_id):
        raise ReviewError("Choose a simple paper id")
    base = pathlib.Path(work).expanduser().resolve() / paper_id
    if inside_git_worktree(base):
        raise ReviewError("Choose a private work folder outside any Git worktree")
    key_path, segment_path = base / "04-key/key.json", base / "02-segments/questions.json"
    if not key_path.is_file() or not segment_path.is_file():
        raise ReviewError("Run segmentation and the answer-key stage first")
    key_bytes, segment_bytes = key_path.read_bytes(), segment_path.read_bytes()
    manifest = json.loads(key_bytes)
    source = manifest.get("source") or {}
    name = source.get("name")
    if (manifest.get("paperId") != paper_id or manifest.get("segmentsSha256") != ak.sha256(segment_bytes)
            or not name or pathlib.Path(name).name != name):
        raise ReviewError("Answer-key evidence does not match the current paper")
    source_path = base / "04-key/source" / name
    if not source_path.is_file() or ak.sha256(source_path.read_bytes()) != source.get("sha256"):
        raise ReviewError("The preserved answer-key PDF changed or is missing")
    questions = {q["key"]: q for q in json.loads(segment_bytes)["questions"] if q.get("part") == "A"}
    return base, key_path, key_bytes, manifest, questions, source_path


def cell_png(page, box):
    rect = valid_box(box, page)
    if rect is None:
        raise ReviewError("A proposed key has no valid source-PDF cell box")
    expanded = fitz.Rect(max(0, rect.x0 - 58), max(0, rect.y0 - 2),
                         min(page.rect.width, rect.x1), min(page.rect.height, rect.y1 + 2))
    return page.get_pixmap(matrix=fitz.Matrix(4, 4), clip=expanded, alpha=False).tobytes("png")


def prepare(work, paper_id, decisions_path):
    base, _, key_bytes, manifest, questions, source_path = evidence(work, paper_id)
    decisions_path = pathlib.Path(decisions_path).expanduser().resolve()
    if inside_git_worktree(decisions_path.parent):
        raise ReviewError("Keep real answer-key proposals outside every Git worktree")
    decisions = json.loads(decisions_path.read_text())
    if (decisions.get("schema") != 1 or decisions.get("paperId") != paper_id
            or decisions.get("sourceSha256") != manifest["source"]["sha256"]
            or not isinstance(decisions.get("entries"), list) or not decisions["entries"]):
        raise ReviewError("Proposal does not match the preserved answer-key PDF")
    reviewed = []
    images = {}
    with fitz.open(source_path) as doc:
        if doc.needs_pass:
            raise ReviewError("The answer-key PDF is password-protected")
        seen = set()
        for item in decisions["entries"]:
            key, printed = item.get("key"), item.get("printed")
            if key in seen or key not in questions or not isinstance(printed, str):
                raise ReviewError("Each proposed question must be unique and present in Part A")
            seen.add(key)
            original = manifest["keys"].get(key) or {}
            if original.get("status") not in ("missing", "unreadable") or original.get("checks"):
                raise ReviewError(f"{key} is not an unresolved, check-free key cell")
            if any(issue.get("key") == key for issue in manifest.get("report", {}).get("issues", [])):
                raise ReviewError(f"{key} has a source-key issue to resolve first")
            page_number = original.get("page")
            if type(page_number) is not int or not 1 <= page_number <= len(doc):
                raise ReviewError(f"{key} has no verified source page")
            box = original.get("span") or original.get("cell")
            png = cell_png(doc[page_number - 1], box)
            raw, status, _ = ak.normalise(printed, questions[key]["type"])
            if status != "official-key":
                raise ReviewError(f"{key} has an invalid proposed answer")
            reviewed.append({"key": key, "printed": printed, "raw": raw, "kind": questions[key]["type"],
                             "page": page_number, "box": box, "cropSha256": ak.sha256(png),
                             "statusBefore": original["status"]})
            images[key] = png
    payload = {"schema": 1, "paperId": paper_id, "sourceSha256": manifest["source"]["sha256"],
               "segmentsSha256": manifest["segmentsSha256"], "keyManifestSha256": ak.sha256(key_bytes),
               "entries": reviewed}
    fingerprint = digest_json(payload)
    parent = base / "04-key-review/proposals"
    parent.mkdir(parents=True, exist_ok=True)
    target = parent / fingerprint
    if target.exists():
        existing = target / "packet.json"
        if not existing.is_file() or json.loads(existing.read_text()) != {**payload, "fingerprint": fingerprint}:
            raise ReviewError("An existing proposal folder does not match its fingerprint")
    else:
        target.mkdir(mode=0o700)
        for key, png in images.items():
            (target / f"{key}.png").write_bytes(png)
        (target / "packet.json").write_text(json.dumps({**payload, "fingerprint": fingerprint}, indent=2) + "\n")
        cards = []
        for item in reviewed:
            key = item["key"]
            cards.append(f'<article><h2>{html.escape(key.upper())}</h2>'
                         f'<p><b>Proposed printed value:</b> {html.escape(item["printed"])}</p>'
                         f'<p><b>Normalized answer:</b> {html.escape(item["raw"])}</p>'
                         f'<img src="{key}.png" alt="Source key cell for {html.escape(key.upper())}"></article>')
        safe_source = html.escape(quote(manifest["source"]["name"]), quote=True)
        page = ('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
                '<title>Manual answer-key proposal</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:960px;margin:auto;padding:28px;'
                'background:#f7f3eb;color:#24352a}main{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px}'
                'article{background:#fff;border:1px solid #d7d3c9;border-radius:12px;padding:16px}img{display:block;width:100%;height:auto}'
                'code{word-break:break-all}</style>'
                f'<h1>{html.escape(paper_id.upper())} manual key proposal</h1>'
                '<p>Review the proposed values against the PDF crops. This page does not approve or publish them.</p>'
                f'<p>Review fingerprint <code>{fingerprint}</code> · <a href="../../../04-key/source/{safe_source}">source PDF</a></p>'
                f'<main>{"".join(cards)}</main></html>')
        (target / "index.html").write_text(page)
    return {"paperId": paper_id, "page": str(target / "index.html"), "packet": str(target / "packet.json"),
            "fingerprint": fingerprint, "proposed": len(reviewed)}


def approve(work, paper_id, packet_path, fingerprint, reviewer, bank_questions=None):
    if not reviewer or not reviewer.strip():
        raise ReviewError("Record the human reviewer who checked the source PDF")
    base, key_path, key_bytes, manifest, questions, source_path = evidence(work, paper_id)
    packet_path = pathlib.Path(packet_path).expanduser().resolve()
    expected_parent = base / "04-key-review/proposals" / fingerprint
    if packet_path != expected_parent / "packet.json" or not re.fullmatch(r"[0-9a-f]{64}", fingerprint):
        raise ReviewError("Use the reviewed private proposal packet and its fingerprint")
    packet = json.loads(packet_path.read_text())
    payload = {key: value for key, value in packet.items() if key != "fingerprint"}
    if (packet.get("fingerprint") != fingerprint or digest_json(payload) != fingerprint
            or payload.get("paperId") != paper_id or payload.get("sourceSha256") != manifest["source"]["sha256"]
            or payload.get("segmentsSha256") != manifest["segmentsSha256"]
            or payload.get("keyManifestSha256") != ak.sha256(key_bytes)):
        raise ReviewError("The reviewed proposal or source key changed; prepare it again")
    updated = json.loads(key_bytes)
    with fitz.open(source_path) as doc:
        if doc.needs_pass:
            raise ReviewError("The answer-key PDF is password-protected")
        for item in payload["entries"]:
            key = item["key"]
            if key not in questions or key not in updated["keys"]:
                raise ReviewError("A proposed question is absent from the current key")
            old = updated["keys"][key]
            if old.get("status") != item["statusBefore"] or old.get("status") not in ("missing", "unreadable"):
                raise ReviewError(f"{key} is no longer unresolved")
            if old.get("page") != item["page"] or (old.get("span") or old.get("cell")) != item["box"]:
                raise ReviewError(f"{key}'s source cell changed")
            if ak.sha256(cell_png(doc[item["page"] - 1], item["box"])) != item["cropSha256"]:
                raise ReviewError(f"{key}'s source crop changed")
            raw, status, _ = ak.normalise(item["printed"], questions[key]["type"])
            if status != "official-key" or raw != item["raw"] or item["kind"] != questions[key]["type"]:
                raise ReviewError(f"{key}'s proposed answer changed")
            old.update({"printed": item["printed"], "raw": raw, "kind": item["kind"], "status": "official-key",
                        "readBy": "human-transcription", "notes": ["source-cell-reviewed-from-PDF"],
                        "review": {"reviewer": reviewer.strip(), "fingerprint": fingerprint,
                                   "cropSha256": item["cropSha256"], "sourceSha256": payload["sourceSha256"]}})
            if bank_questions is not None:
                old["bank"] = ak.compare_bank(bank_questions.get(key), raw, item["kind"], "official-key")
            elif "bank" in old:
                old["bank"] = "not-rechecked"
    records = updated["keys"]
    statuses = {}
    for record in records.values():
        statuses[record["status"]] = statuses.get(record["status"], 0) + 1
    updated["report"]["statuses"] = statuses
    updated["report"]["missing"] = sorted((key for key in questions if key not in records), key=lambda key: int(key[1:]))
    updated["report"]["keysRead"] = len(records)
    if "bank" in updated["report"]:
        tally = {}
        for record in records.values():
            label = record.get("bank", "not-rechecked")
            tally[label] = tally.get(label, 0) + 1
        updated["report"]["bank"] = tally
    approved_root = base / "04-key-review/approved" / fingerprint
    if approved_root.exists():
        raise ReviewError("This proposal has already been approved")
    approved_root.mkdir(parents=True, mode=0o700)
    (approved_root / "pre-review-key.json").write_bytes(key_bytes)
    (approved_root / "receipt.json").write_text(json.dumps({"schema": 1, "paperId": paper_id, "reviewer": reviewer.strip(),
                                                             "fingerprint": fingerprint, "sourceSha256": payload["sourceSha256"],
                                                             "questions": [item["key"] for item in payload["entries"]]}, indent=2) + "\n")
    with tempfile.NamedTemporaryFile(mode="w", prefix=".reviewed-key-", suffix=".json", dir=key_path.parent,
                                     delete=False) as temporary:
        json.dump(updated, temporary, ensure_ascii=False, indent=1)
        temporary.write("\n")
        replacement = pathlib.Path(temporary.name)
    replacement.replace(key_path)
    return {"paperId": paper_id, "approved": len(payload["entries"]), "fingerprint": fingerprint,
            "key": str(key_path), "receipt": str(approved_root / "receipt.json")}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--work", required=True)
    parser.add_argument("--paper-id", required=True)
    commands = parser.add_subparsers(dest="command", required=True)
    proposed = commands.add_parser("prepare")
    proposed.add_argument("--decisions", required=True)
    accepted = commands.add_parser("approve")
    accepted.add_argument("--packet", required=True)
    accepted.add_argument("--fingerprint", required=True)
    accepted.add_argument("--reviewer", required=True)
    accepted.add_argument("--compare-bank", action="store_true")
    args = parser.parse_args(argv)
    try:
        if args.command == "prepare":
            result = prepare(args.work, args.paper_id, args.decisions)
        else:
            repo = pathlib.Path(__file__).resolve().parents[3]
            bank = ak.load_bank(args.paper_id, repo) if args.compare_bank else None
            result = approve(args.work, args.paper_id, args.packet, args.fingerprint, args.reviewer, bank)
        print(json.dumps(result))
    except (ReviewError, fitz.FileDataError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
