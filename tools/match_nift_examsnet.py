#!/usr/bin/env python3
"""Fetch public solved NIFT sets from ExamsNet and conservatively match local OCR rows.

This stores only provenance, source question number, answer choice, and matching
scores. It does not copy source explanations into the local question bank.
"""

import concurrent.futures
import datetime
import difflib
import html
import json
import pathlib
import re
import sqlite3
import sys
import urllib.parse
import urllib.request


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
CACHE = ROOT / "server/data/sources/answer-keys/nift-examsnet"
BASE = "https://www.examsnet.com/test/"
SETS = {
    "ug-2012": "nift-ug-2012-question-paper-with-solutions",
    "pg-2012": "nift-pg-2012-question-paper-with-solutions",
    "ug-2013": "nift-ug-2013-question-paper-with-solutions",
    "pg-2013": "nift-pg-2013-question-paper-with-solutions",
    "ug-2014": "nift-ug-2014-question-paper-with-solutions",
    "pg-2014": "nift-pg-2014-question-paper-with-solutions",
}


def strip_tags(value):
    value = re.sub(r"<script\b[^>]*>.*?</script>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<style\b[^>]*>.*?</style>", " ", value, flags=re.I | re.S)
    value = re.sub(r"<br\s*/?>", " ", value, flags=re.I)
    value = re.sub(r"<[^>]+>", " ", value)
    return re.sub(r"\s+", " ", html.unescape(value)).strip()


def fetch_one(item):
    set_id, slug, number = item
    url = BASE + slug + "/" + str(number)
    request = urllib.request.Request(
        url,
        data=urllib.parse.urlencode({"answerid": "0"}).encode(),
        headers={"User-Agent": "Mozilla/5.0 (compatible; DexamAnswerMatcher/1.0)"},
        method="POST",
    )
    with urllib.request.urlopen(request, timeout=30) as response:
        body = response.read().decode("utf-8", "replace")
    question_match = re.search(r'id="mquestion"[^>]*>(.*?)</div>\s*<script', body, re.I | re.S)
    options_match = re.search(r'id="answers"[^>]*>(.*?)</ul>', body, re.I | re.S)
    correct_match = re.search(r'var\s+c=\["(\d+)"\]', body)
    total_match = re.search(r"Question\s*:\s*\d+\s+of\s+(\d+)", body, re.I)
    if not (question_match and options_match and correct_match):
        raise RuntimeError("Could not parse %s" % url)
    options = [strip_tags(value) for value in re.findall(r"<span>(.*?)</span>", options_match.group(1), re.I | re.S)]
    correct_index = int(correct_match.group(1))
    return {
        "set": set_id,
        "source": url,
        "number": number,
        "total": int(total_match.group(1)) if total_match else None,
        "prompt": strip_tags(question_match.group(1)),
        "options": options,
        "correctIndex": correct_index,
        "correctText": options[correct_index] if correct_index < len(options) else "",
    }


def fetch_sets():
    CACHE.mkdir(parents=True, exist_ok=True)
    all_rows = []
    for set_id, slug in SETS.items():
        target = CACHE / (set_id + ".json")
        if target.exists():
            rows = json.loads(target.read_text())
            print("cache", set_id, len(rows), flush=True)
            all_rows.extend(rows)
            continue
        first = fetch_one((set_id, slug, 1))
        total = first["total"] or 150
        rows = [first]
        work = [(set_id, slug, number) for number in range(2, total + 1)]
        with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
            for index, row in enumerate(pool.map(fetch_one, work), start=2):
                rows.append(row)
                if index % 25 == 0 or index == total:
                    print("fetch", set_id, "%d/%d" % (index, total), flush=True)
        target.write_text(json.dumps(rows, ensure_ascii=False, indent=2))
        all_rows.extend(rows)
    return all_rows


def normalize(value):
    return " ".join(re.findall(r"[a-z0-9]+", str(value or "").lower()))


def signature(prompt, options):
    parts = [normalize(prompt)] + [normalize(item) for item in options]
    return " ".join(part for part in parts if part)


def similarity(left, right):
    if not left or not right:
        return 0.0
    if left == right:
        return 1.0
    if len(left) >= 35 and (left in right or right in left):
        return min(len(left), len(right)) / max(len(left), len(right)) * 0.15 + 0.85
    return difflib.SequenceMatcher(None, left, right, autojunk=False).ratio()


def token_overlap(left, right):
    left_words = set(left.split())
    right_words = set(right.split())
    if not left_words or not right_words:
        return 0.0
    return 2.0 * len(left_words & right_words) / (len(left_words) + len(right_words))


def parse_options(raw):
    try:
        return json.loads(raw or "[]")
    except json.JSONDecodeError:
        return []


def map_answer(local_options, source_answer):
    source = normalize(source_answer)
    scored = []
    for option in local_options:
        scored.append((similarity(normalize(option.get("text", "")), source), str(option.get("id", ""))))
    scored.sort(reverse=True)
    if not scored:
        return "", 0.0, 0.0
    second = scored[1][0] if len(scored) > 1 else 0.0
    return scored[0][1], scored[0][0], scored[0][0] - second


def match_and_update(source_rows):
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    now = datetime.datetime.now().strftime("%Y%m%d-%H%M%S")
    backup = DB.with_name("dexam.before-nift-matching-%s.sqlite" % now)
    conn.execute("PRAGMA wal_checkpoint(FULL)")
    with sqlite3.connect(backup) as destination:
        conn.backup(destination)

    local_rows = conn.execute(
        "SELECT id,paper_id,question_no,prompt,options_json FROM questions "
        "WHERE paper_id LIKE 'nift-%' AND question_type <> 'DESCRIPTIVE'"
    ).fetchall()
    source_by_year = {}
    for row in source_rows:
        year = row["set"].split("-")[1]
        row["signature"] = signature(row["prompt"], row["options"])
        source_by_year.setdefault(year, []).append(row)

    proposals = []
    for local in local_rows:
        match = re.search(r"nift-(20\d{2})", local["paper_id"])
        if not match:
            continue
        candidates = source_by_year.get(match.group(1), [])
        local_options = parse_options(local["options_json"])
        local_sig = signature(local["prompt"], [item.get("text", "") for item in local_options])
        # Token overlap is a fast shortlist for the more expensive character
        # comparison. Keep enough candidates to tolerate OCR word corruption.
        shortlist = sorted(
            candidates,
            key=lambda item: token_overlap(local_sig, item["signature"]),
            reverse=True,
        )[:12]
        ranked = sorted(
            ((similarity(local_sig, item["signature"]), item) for item in shortlist),
            key=lambda pair: pair[0],
            reverse=True,
        )
        if not ranked:
            continue
        best_score, best = ranked[0]
        runner_up = ranked[1][0] if len(ranked) > 1 else 0.0
        answer_id, answer_score, answer_margin = map_answer(local_options, best["correctText"])
        proposals.append({
            "localId": local["id"],
            "paperId": local["paper_id"],
            "questionNo": local["question_no"],
            "sourceSet": best["set"],
            "sourceNumber": best["number"],
            "sourceUrl": best["source"],
            "answerId": answer_id,
            "questionScore": round(best_score, 5),
            "questionMargin": round(best_score - runner_up, 5),
            "answerScore": round(answer_score, 5),
            "answerMargin": round(answer_margin, 5),
        })

    # Require a strong question match, a clear answer-option match, and separation
    # from the next-best source question. Lower-confidence proposals are retained
    # in the report for human review but are not written as answers.
    accepted = [
        row for row in proposals
        if row["questionScore"] >= 0.78
        and row["questionMargin"] >= 0.08
        and row["answerScore"] >= 0.72
        and row["answerMargin"] >= 0.12
        and row["answerId"]
    ]
    for row in accepted:
        conn.execute(
            "UPDATE questions SET answer_key=?, answer_status='matched-source', "
            "reference_url=?, explanation_source=?, updated_at=datetime('now') WHERE id=?",
            (
                row["answerId"],
                row["sourceUrl"],
                "ExamsNet solved set %s Q%s; text match %.3f, option match %.3f"
                % (row["sourceSet"], row["sourceNumber"], row["questionScore"], row["answerScore"]),
                row["localId"],
            ),
        )
    conn.commit()
    report = CACHE / ("match-report-" + now + ".json")
    report.write_text(json.dumps({"accepted": accepted, "proposals": proposals}, indent=2))
    print("backup", backup)
    print("report", report)
    print("local objective", len(local_rows), "proposals", len(proposals), "accepted", len(accepted))
    for paper_id, count in conn.execute(
        "SELECT paper_id,count(*) FROM questions WHERE answer_status='matched-source' GROUP BY paper_id ORDER BY paper_id"
    ):
        print("matched", paper_id, count)
    conn.close()


if __name__ == "__main__":
    try:
        match_and_update(fetch_sets())
    except Exception as error:
        print("ERROR:", error, file=sys.stderr)
        raise
