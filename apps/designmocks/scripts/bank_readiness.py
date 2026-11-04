#!/usr/bin/env python3
"""Read-only workstation audit. Output is metadata, never prompts or answer keys.

No source code from the bank is imported/executed. Source files are hashed and
checked again after inspection, so a concurrent review edit invalidates the run.
This is a readiness report, not permission to publish or a claimed full mock.
"""
import argparse
import collections
import datetime
import hashlib
import json
import math
import pathlib
import re
import sqlite3


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def question_holds(question, review):
    holds = []
    if not isinstance(review, dict) or review.get("marked") is not True:
        holds.append("human-review-not-recorded")
    if isinstance(review, dict) and review.get("flagged"):
        holds.append("human-review-flagged")
    kind = question.get("type")
    if kind not in ("MCQ", "MSQ", "NAT", "DESCRIPTIVE"):
        holds.append("unsupported-format")
    if not str(question.get("question_text") or "").strip():
        holds.append("empty-prompt")
    if question.get("exam") not in ("UCEED", "CEED", "NID", "NIFT"):
        holds.append("unsupported-exam")
    if kind == "DESCRIPTIVE":
        holds.append("drawing-needs-separate-self-review-contract")
    else:
        answer = str(question.get("answer_key") or "").strip()
        if not answer or str(question.get("answer_status") or "").lower() in ("pending", "unknown", "missing"):
            holds.append("answer-not-ready")
        if kind == "NAT":
            try:
                if not math.isfinite(float(answer)):
                    raise ValueError()
            except ValueError:
                holds.append("numeric-key-needs-explicit-range-or-value")
        if kind in ("MCQ", "MSQ"):
            options = question.get("options") or []
            ids = [str(option.get("position") or "").strip().upper() for option in options if isinstance(option, dict)]
            if len(ids) < 2 or len(set(ids)) != len(ids) or any(not value for value in ids):
                holds.append("structured-options-missing-or-duplicate")
            elif any(not str(option.get("text") or "").strip() for option in options):
                holds.append("empty-option-text")
            # Never silently turn 1-4 into A-D or invent options from a figure.
            keys = re.split(r"[,;&/\s]+", answer.upper()) if kind == "MSQ" else [answer.upper()]
            if not keys or len(set(keys)) != len(keys) or any(value not in ids for value in keys):
                holds.append("key-option-mapping-needs-review")
        if not str(question.get("explanation") or "").strip():
            holds.append("explanation-missing")
    return holds


def inspect(root):
    bank_path = root / "dexam-bank-machine-readable.json"
    review_path = root / "server/review-state.json"
    export_path = root / "server/data/exports/dexam-bank-export.json"
    tracked = [bank_path, review_path] + ([export_path] if export_path.is_file() else [])
    before = {str(path.relative_to(root)): digest(path) for path in tracked}
    bank = json.loads(bank_path.read_text())
    review = json.loads(review_path.read_text())
    questions = bank["questions"]
    if not isinstance(questions, list) or not isinstance(review, dict):
        raise ValueError("Unexpected bank/review contract")
    ids = [q["id"] for q in questions]
    if len(ids) != len(set(ids)):
        raise ValueError("Duplicate source question IDs")
    papers = {}
    for question in questions:
        paper_id = question.get("paper_id") or "unknown"
        paper = papers.setdefault(paper_id, {"exam": question.get("exam"), "questions": 0, "reviewRecorded": 0, "flagged": 0, "objectiveCandidates": 0, "formats": collections.Counter(), "holds": collections.Counter()})
        paper["questions"] += 1
        paper["formats"][str(question.get("type"))] += 1
        state = review.get(question["id"], {})
        paper["reviewRecorded"] += state.get("marked") is True
        paper["flagged"] += bool(state.get("flagged"))
        holds = question_holds(question, state)
        figure = question.get("figure_image")
        if figure:
            text = str(figure).replace("\\", "/")
            marker = "server/data/media/"
            if marker not in text:
                holds.append("media-path-needs-mapping")
            else:
                media_root = (root / "server/data/media").resolve()
                media = (media_root / text.split(marker, 1)[1]).resolve()
                if not media.is_relative_to(media_root):
                    holds.append("unsafe-media-path")
                elif media.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
                    holds.append("media-needs-raster-conversion")
                elif not media.is_file():
                    holds.append("media-file-missing")
        paper["objectiveCandidates"] += not holds
        paper["holds"].update(holds)
    database = root / "server/data/dexam.sqlite"
    database_summary = None
    if database.is_file():
        # mode=ro and query_only: never run a bank exporter that writes source state.
        with sqlite3.connect(database.resolve().as_uri() + "?mode=ro", uri=True) as connection:
            connection.execute("pragma query_only=on")
            database_ids = {row[0] for row in connection.execute("select id from questions")}
            database_summary = {"questions": len(database_ids), "papers": connection.execute("select count(*) from papers").fetchone()[0], "onlyInDatabase": len(database_ids - set(ids)), "onlyInMachineReadable": len(set(ids) - database_ids)}
    older_export = None
    if export_path.is_file():
        export = json.loads(export_path.read_text())
        older_export = {"exportedAt": export.get("exportedAt"), "questions": len(export.get("questions", []))}
    after = {str(path.relative_to(root)): digest(path) for path in tracked}
    if before != after:
        raise ValueError("Source changed during audit; rerun after the review save completes")
    return {
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "sourceHashes": before,
        "machineReadable": {"exportedAt": bank.get("exported_at"), "questions": len(questions), "papers": len(papers)},
        "database": database_summary,
        "olderPlatformExport": older_export,
        "reviewRecords": len(review),
        "unmatchedReviewRecords": len(set(review) - set(ids)),
        "objectiveCandidates": sum(p["objectiveCandidates"] for p in papers.values()),
        "publicationReady": False,
        "publicationHolds": ["Reconcile machine-readable bank, SQLite and current review state", "Approve exact per-paper selection, sections, timing and marking", "Confirm content rights and publication", "Validate representative attempts and signed media delivery"],
        "papers": dict(sorted(papers.items())),
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=pathlib.Path, required=True)
    parser.add_argument("--report", type=pathlib.Path, required=True)
    args = parser.parse_args()
    result = inspect(args.source.resolve())
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"questions": result["machineReadable"]["questions"], "papers": result["machineReadable"]["papers"], "objectiveCandidates": result["objectiveCandidates"], "publicationReady": False, "report": str(args.report)}))


if __name__ == "__main__":
    main()
