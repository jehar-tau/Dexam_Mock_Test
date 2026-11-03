#!/usr/bin/env python3
"""Answer engine: fill missing answer keys with two independent passes.

Stage "solve": every unkeyed objective question that can be read (an approved crop, or stored
text and options) is sent to a worker, who first looks for a published key for that paper on the
web and otherwise solves it. The answer is recorded as 'independently-solved' with its method and
source, and stays held.

Stage "check": every 'independently-solved' answer without a verification is sent, blind, to a
different worker who solves it again. Agreement records 'second-pass-reproduced' (the platform
then serves the question); disagreement records 'second-pass-disagreed' and keeps it held for
the owner. Official and owner-provided keys are never touched.

Workers always answer by option position (A = first printed option), which the engine maps to the
question's stored option ids.

Usage:
  tools/answer_engine.py queue --stage solve|check [--size 20] [--exam ceed]
  tools/answer_engine.py ingest --stage solve|check results.json [...]
  tools/answer_engine.py apply-web [--official paper ...] web-keys/<paper>.json [...]
  tools/answer_engine.py ingest-free <lane>/results/<provider>/<batch>.json [...]   (free-LLM votes)
  tools/answer_engine.py report
Batches go to server/data/answer-engine/<stage>/batches/, results to .../<stage>/results/.
The database is backed up before every ingest."""
import argparse
import collections
import datetime
import json
import pathlib
import re
import sqlite3

ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
WORK = ROOT / "server/data/answer-engine"
NEEDS_CONTEXT = re.compile(
    r"\b(passage|the author|the following (figure|diagram|image|picture)|given (figure|diagram|image)|"
    r"shown (below|above)|in the figure|image-only|see page image)\b", re.I)
NUMBER = r"-?\d+(?:\.\d+)?"


def connect():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    if "answer_source_json" not in {r[1] for r in conn.execute("PRAGMA table_info(questions)")}:
        conn.execute("ALTER TABLE questions ADD COLUMN answer_source_json TEXT")
    return conn


def options_of(row):
    try:
        return [o for o in json.loads(row["options_json"] or "[]") if isinstance(o, dict)]
    except json.JSONDecodeError:
        return []


def has_crop(row):
    """A cropped block the workers can read. Crops awaiting review count: the workers' blind passes
    are what vouch for a fresh crop (see the `badCrop` flag), the owner reviews the rest."""
    return bool(row["block_path"]) and row["crop_review"] in ("approved", "pending") and (ROOT / row["block_path"]).is_file()


def option_ids(row):
    """The ids the platform will use, in printed order (see export_platform_bank.py)."""
    options = options_of(row)
    if has_crop(row) and len(options) < 2:
        return list("ABCD")
    return [re.sub(r"[^A-Za-z0-9]", "", str(o.get("id", ""))).upper() or "ABCDEF"[i] for i, o in enumerate(options)]


def readable(row):
    if has_crop(row):
        return True
    prompt = row["prompt"] or ""
    if row["question_type"] == "NAT":
        return bool(prompt.strip()) and not NEEDS_CONTEXT.search(prompt)
    return len(options_of(row)) >= 2 and not NEEDS_CONTEXT.search(prompt) and row["figure_paths_json"] in (None, "", "[]")


def normalise(row, answer):
    """Map a worker's answer to the stored key format, or None when it is not usable."""
    if answer is None:
        return None
    text = str(answer).strip().upper()
    kind = row["question_type"]
    if kind == "NAT":
        text = text.lower().replace("–", " to ").replace(" - ", " to ")
        if re.fullmatch(NUMBER, text) or re.fullmatch(rf"{NUMBER} to {NUMBER}", " ".join(text.split())):
            return " ".join(text.split())
        return None
    ids = option_ids(row)
    letters = re.findall(r"[A-F]", re.sub(r"OPTION", "", text))
    if not letters or any("ABCDEF".index(l) >= len(ids) for l in letters):
        return None
    picked = sorted({ids["ABCDEF".index(l)] for l in letters}, key=ids.index)
    if kind == "MCQ" and len(picked) != 1:
        return None
    return "".join(picked)


def nat_range(value):
    parts = [float(p) for p in re.findall(NUMBER, value)]
    return (min(parts), max(parts)) if parts else None


def agree(row, first, second):
    if row["question_type"] != "NAT":
        return sorted(first.replace(",", "")) == sorted(second.replace(",", ""))
    a, b = nat_range(first), nat_range(second)
    return bool(a and b) and a[0] <= b[1] + 1e-6 and b[0] <= a[1] + 1e-6


def item(row, include_prompt=True):
    options = options_of(row)
    crop = has_crop(row)
    return {
        "id": row["id"],
        "paper": row["paper_id"],
        "questionNo": row["question_no"],
        "type": row["question_type"],
        "image": str(ROOT / row["block_path"]) if crop else None,
        "prompt": " ".join(str(row["prompt"] or "").split())[:1500] if include_prompt else None,
        "options": [] if crop and len(options) < 2 else
        [{"position": "ABCDEF"[i], "text": " ".join(str(o.get("text", "")).split())[:300]} for i, o in enumerate(options[:6])],
    }


def done_ids(stage):
    ids = set()
    for path in (WORK / stage / "results").glob("*.json"):
        ids.update(json.loads(path.read_text()).keys())
    return ids


def queue(args):
    conn = connect()
    if args.stage == "solve":
        where = "(answer_key IS NULL OR answer_key='')"
    else:
        where = ("answer_status IN ('independently-solved','matched-source','matched-source-positional') "
                 "AND coalesce(answer_verification,'')='' AND coalesce(answer_key,'')!=''")
    rows = conn.execute(
        f"SELECT * FROM questions WHERE question_type IN ('MCQ','MSQ','NAT') AND coalesce(status,'')!='excluded' "
        f"AND {where} AND paper_id LIKE ? ORDER BY paper_id, CAST(question_no AS INT)", (f"{args.exam or ''}%",)).fetchall()
    lane = args.stage + ("-" + args.lane if args.lane else "")
    finished = done_ids(lane)
    only = set(json.loads(pathlib.Path(args.ids_file).read_text())) if args.ids_file else None
    rows = [r for r in rows if only is None or r["id"] in only]
    queued = [item(r) for r in rows if r["id"] not in finished and readable(r)]
    out = WORK / lane / "batches"
    out.mkdir(parents=True, exist_ok=True)
    # Batches stay within one paper so a worker can look its key up once.
    batches, current = [], []
    for entry in queued:
        if current and (len(current) >= args.size or current[-1]["paper"] != entry["paper"]):
            batches.append(current)
            current = []
        current.append(entry)
    if current:
        batches.append(current)
    run = datetime.datetime.now().strftime("%m%d%H%M%S")
    for index, batch in enumerate(batches, 1):
        (out / f"{args.stage}-{run}-{index:03d}.json").write_text(json.dumps(batch, indent=1, ensure_ascii=False) + "\n")
    skipped = len([r for r in rows if r["id"] not in finished]) - len(queued)
    print(f"{args.stage}: {len(queued)} questions in {len(batches)} batches ({skipped} unreadable without more context)")


def ingest(args):
    conn = connect()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-answer-engine-{args.stage}-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    counts = collections.Counter()
    for name in args.files:
        results = json.loads(pathlib.Path(name).read_text())
        for question_id, result in results.items():
            row = conn.execute("SELECT * FROM questions WHERE id=?", (question_id,)).fetchone()
            if not row or not isinstance(result, dict):
                counts["unknown"] += 1
                continue
            if result.get("badCrop"):
                notes = json.loads(row["review_notes_json"] or "{}")
                notes["reasons"] = sorted(set(notes.get("reasons") or []) | {"crop-defect"})
                conn.execute("UPDATE questions SET crop_review='rejected', review_notes_json=? WHERE id=?", (json.dumps(notes), question_id))
                counts["bad crop"] += 1
                continue
            if result.get("needsContext"):
                notes = json.loads(row["review_notes_json"] or "{}")
                notes["reasons"] = sorted(set(notes.get("reasons") or []) | {"context-missing"})
                conn.execute("UPDATE questions SET review_notes_json=? WHERE id=?", (json.dumps(notes), question_id))
                counts["needs context"] += 1
            answer = normalise(row, result.get("answer"))
            if not answer or result.get("confidence") == "low":
                counts["no answer"] += 1
                continue
            source = json.loads(row["answer_source_json"] or "{}")
            note = {k: result.get(k) for k in ("method", "source", "confidence") if result.get(k)}
            if args.stage == "solve":
                if row["answer_key"]:
                    counts["already keyed"] += 1
                    continue
                source["solve"] = {**note, "answer": answer}
                conn.execute(
                    "UPDATE questions SET answer_key=?, answer_status='independently-solved', answer_verification=NULL, "
                    "answer_source_json=?, updated_at=datetime('now') WHERE id=?", (answer, json.dumps(source), question_id))
                counts["solved"] += 1
            else:
                matched = row["answer_status"] in ("matched-source", "matched-source-positional")
                if (row["answer_status"] != "independently-solved" and not matched) or row["answer_verification"]:
                    counts["not awaiting check"] += 1
                    continue
                source["check"] = {**note, "answer": answer}
                verdict = "second-pass-reproduced" if agree(row, row["answer_key"], answer) else "second-pass-disagreed"
                # A matched key that a careful reader contradicts is held for the owner like any other.
                status = "independently-solved" if matched and verdict == "second-pass-disagreed" else row["answer_status"]
                conn.execute(
                    "UPDATE questions SET answer_verification=?, answer_status=?, answer_source_json=?, updated_at=datetime('now') WHERE id=?",
                    (verdict, status, json.dumps(source), question_id))
                counts[verdict] += 1
    conn.commit()
    print(args.stage, dict(counts))


def apply_web(args):
    """Apply web-keys/<paper>.json files. Papers named in --official carry the exam body's own key
    (found mirrored online) and become 'official-key', replacing Dexam's own solves; the rest are
    first-pass answers that still need the blind check."""
    conn = connect()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-answer-engine-web-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    counts = collections.Counter()
    for name in args.files:
        path = pathlib.Path(name)
        paper, key = path.stem, json.loads(path.read_text())
        official = paper in args.official
        for number, raw in key["answers"].items():
            row = conn.execute("SELECT * FROM questions WHERE paper_id=? AND question_no=? AND coalesce(status,'')!='excluded'",
                               (paper, str(number))).fetchone()
            if not row or row["question_type"] not in ("MCQ", "MSQ", "NAT"):
                counts["no such question"] += 1
                continue
            answer = normalise(row, raw)
            if not answer:
                counts["unusable answer"] += 1
                continue
            if row["answer_status"] in ("official-key", "owner-provided"):
                counts["already official"] += 1
                continue
            source = json.loads(row["answer_source_json"] or "{}")
            if official:
                if row["answer_key"]:
                    source["replaced"] = {"answer": row["answer_key"], "status": row["answer_status"]}
                source["web"] = {"source": key["source"], "official": True}
                conn.execute(
                    "UPDATE questions SET answer_key=?, answer_status='official-key', answer_verification=NULL, "
                    "answer_source_json=?, updated_at=datetime('now') WHERE id=?", (answer, json.dumps(source), row["id"]))
                counts["official" + (" (replaced own solve, differed)" if row["answer_key"] and not agree(row, row["answer_key"], answer)
                                     else "")] += 1
            elif not row["answer_key"]:
                source["solve"] = {"method": "web", "source": key["source"], "answer": answer}
                conn.execute(
                    "UPDATE questions SET answer_key=?, answer_status='independently-solved', answer_verification=NULL, "
                    "answer_source_json=?, updated_at=datetime('now') WHERE id=?", (answer, json.dumps(source), row["id"]))
                counts["unofficial, awaiting check"] += 1
            else:
                counts["already keyed"] += 1
    conn.commit()
    print("web", dict(counts))


# Free-tier models are weaker readers, so their answers are votes. A key written by a Claude worker
# is verified when this many different free providers agree with it; a key that came from free
# providers themselves needs one more, because they cannot verify their own answer.
FREE_AGREE_FOR_CLAUDE_KEY = 2
FREE_AGREE_FOR_FREE_KEY = 3
FREE_AGREE_TO_SET_KEY = 2


def ingest_free(args):
    """Fold free-LLM result files (tools/free_llm_reader.py) in as votes.

    Files live at <lane>/results/<provider>/<batch>.json; the provider is the folder name. Only
    high or medium confidence answers count, and a free model's badCrop / needsContext opinion is
    ignored (only the Claude workers' flags reject a crop). Then, per question touched:
      - keyed, not yet verified: enough agreeing providers -> 'second-pass-reproduced'; two or more
        providers agreeing on a different answer, and none on the key -> 'second-pass-disagreed';
      - unkeyed: two providers agreeing on one answer (and more than any other) set it as an
        'independently-solved' key that still waits for a verifying read."""
    conn = connect()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-answer-engine-free-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    counts = collections.Counter()
    touched = set()
    for name in args.files:
        path = pathlib.Path(name)
        provider = path.parent.name
        for question_id, result in json.loads(path.read_text()).items():
            row = conn.execute("SELECT * FROM questions WHERE id=?", (question_id,)).fetchone()
            if not row or not isinstance(result, dict):
                counts["unknown"] += 1
                continue
            answer = normalise(row, result.get("answer"))
            if not answer or result.get("confidence") not in ("high", "medium"):
                counts["no usable vote"] += 1
                continue
            source = json.loads(row["answer_source_json"] or "{}")
            source.setdefault("free_votes", {})[provider] = answer
            conn.execute("UPDATE questions SET answer_source_json=? WHERE id=?", (json.dumps(source), question_id))
            touched.add(question_id)
            counts["votes"] += 1
    for question_id in touched:
        row = conn.execute("SELECT * FROM questions WHERE id=?", (question_id,)).fetchone()
        source = json.loads(row["answer_source_json"] or "{}")
        votes = source.get("free_votes", {})
        if row["answer_key"]:
            if row["answer_verification"] or row["answer_status"] in ("official-key", "owner-provided"):
                continue
            from_free = (source.get("solve") or {}).get("method") == "free-llm"
            needed = FREE_AGREE_FOR_FREE_KEY if from_free else FREE_AGREE_FOR_CLAUDE_KEY
            agree = [p for p, a in votes.items() if agree_answers(row, row["answer_key"], a)]
            other = collections.Counter(a for p, a in votes.items() if not agree_answers(row, row["answer_key"], a))
            if len(agree) >= needed:
                source["verified_by"] = {"free-llm": sorted(agree)}
                conn.execute("UPDATE questions SET answer_verification='second-pass-reproduced', answer_source_json=?, "
                             "updated_at=datetime('now') WHERE id=?", (json.dumps(source), question_id))
                counts["reproduced"] += 1
            elif not agree and other and other.most_common(1)[0][1] >= 2:
                conn.execute("UPDATE questions SET answer_verification='second-pass-disagreed', updated_at=datetime('now') WHERE id=?", (question_id,))
                counts["disagreed"] += 1
        else:
            tally = collections.Counter(votes.values())
            if not tally:
                continue
            (best, best_count), *rest = tally.most_common()
            if best_count >= FREE_AGREE_TO_SET_KEY and (not rest or best_count > rest[0][1]):
                supporters = sorted(p for p, a in votes.items() if a == best)
                source["solve"] = {"method": "free-llm", "providers": supporters, "answer": best}
                conn.execute("UPDATE questions SET answer_key=?, answer_status='independently-solved', answer_verification=NULL, "
                             "answer_source_json=?, updated_at=datetime('now') WHERE id=?", (best, json.dumps(source), question_id))
                counts["key set"] += 1
    conn.commit()
    print("free", dict(counts))


def agree_answers(row, first, second):
    return agree(row, first, second)


def ingest_audit(args):
    """Record the context audit: questions that cannot be understood alone, or whose stored text is
    garbled, get a review note that the export turns into a hold ('context-missing', 'broken-text')."""
    conn = connect()
    stamp = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    with sqlite3.connect(DB.with_name(f"dexam.before-answer-engine-audit-{stamp}.sqlite")) as backup:
        conn.backup(backup)
    counts = collections.Counter()
    for name in args.files:
        for question_id, result in json.loads(pathlib.Path(name).read_text()).items():
            row = conn.execute("SELECT review_notes_json FROM questions WHERE id=?", (question_id,)).fetchone()
            if not row or not isinstance(result, dict):
                counts["unknown"] += 1
                continue
            reasons = [reason for flag, reason in (("needsContext", "context-missing"), ("broken", "broken-text")) if result.get(flag)]
            if not reasons:
                counts["fine"] += 1
                continue
            notes = json.loads(row["review_notes_json"] or "{}")
            notes["reasons"] = sorted(set(notes.get("reasons") or []) | set(reasons))
            conn.execute("UPDATE questions SET review_notes_json=?, updated_at=datetime('now') WHERE id=?", (json.dumps(notes), question_id))
            counts.update(reasons)
    conn.commit()
    print("audit", dict(counts))


def report(_args):
    conn = connect()
    for row in conn.execute(
        "SELECT substr(paper_id,1,instr(paper_id,'-')-1) exam, "
        "sum(answer_status IN ('official-key','matched-source','matched-source-positional','owner-provided') "
        "OR answer_verification='second-pass-reproduced') trusted, "
        "sum(answer_status='independently-solved' AND coalesce(answer_verification,'')='') awaiting_check, "
        "sum(answer_verification='second-pass-disagreed') disagreed, "
        "sum(coalesce(answer_key,'')='') unkeyed "
        "FROM questions WHERE question_type IN ('MCQ','MSQ','NAT') AND coalesce(status,'')!='excluded' GROUP BY 1"):
        print(dict(row))


def main():
    parser = argparse.ArgumentParser()
    sub = parser.add_subparsers(dest="command", required=True)
    q = sub.add_parser("queue")
    q.add_argument("--stage", choices=("solve", "check"), required=True)
    q.add_argument("--size", type=int, default=20)
    q.add_argument("--exam")
    q.add_argument("--lane", help="Separate result folder, e.g. img for the re-answer from fresh crops")
    q.add_argument("--ids-file", help="JSON list of question ids to queue")
    i = sub.add_parser("ingest")
    i.add_argument("--stage", choices=("solve", "check"), required=True)
    i.add_argument("files", nargs="+")
    w = sub.add_parser("apply-web")
    w.add_argument("--official", nargs="*", default=[])
    w.add_argument("files", nargs="+")
    f = sub.add_parser("ingest-free")
    f.add_argument("files", nargs="+")
    a = sub.add_parser("ingest-audit")
    a.add_argument("files", nargs="+")
    sub.add_parser("report")
    args = parser.parse_args()
    {"queue": queue, "ingest": ingest, "apply-web": apply_web, "ingest-audit": ingest_audit, "ingest-free": ingest_free, "report": report}[args.command](args)


if __name__ == "__main__":
    main()
