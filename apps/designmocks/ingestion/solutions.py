#!/usr/bin/env python3
"""Stage 5 of the question-paper ingestion pipeline: worked solutions.

Solutions are drafted by Claude in a local session (owner decision D3, 20 Nov 2026)
and kept in the private work folder. This tool does the parts that must be exact:

    brief  <paper> <key>   everything a drafter needs: prompt, options, figures, official key
    check  <paper>         validate every 05-solutions/<key>.json; a draft that does not reach
                           the official key, or breaks the format, is held
    render <paper>         05-solutions/review.html: each solution with its step-by-step
                           annotations drawn over the canonical figure, for human review
    index                  private work/index.html: paper-level review progress and links
    approve <paper> <key>  record a human decision for the exact reviewed inputs
    adjudicate <paper> <key>  privately record an independent owner decision for a keyless draft

The format is in docs/ingestion/PLAN.md ("Solution format"). Nothing here writes
into the repository.
"""

import argparse
from decimal import Decimal
from functools import cache
import hashlib
import html
import importlib.util
import json
import pathlib
import re
import sys
import tempfile
import xml.etree.ElementTree as ET
from urllib.parse import quote

SCHEMA = 1
STAGE = "05-solutions"
REVIEW_STAGE = "06-review"
OBJECTIVE = {"MCQ", "MSQ", "NAT"}
PROPOSAL_SOURCES = ("model-proposed", "human-proposed")
QUESTION_KEY = re.compile(r"q(?:b)?[0-9]+")
DIFFICULTY = {"easy", "medium", "hard"}
STATUS = {"draft", "verified", "held"}
STEP_WORDS_WARN, STEP_WORDS_MAX, MAX_STEPS = 30, 45, 8
SVG_NS = "http://www.w3.org/2000/svg"
OVERLAY_TAGS = {"g", "circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "text", "tspan"}
OVERLAY_ATTRS = {"cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points", "d",
                 "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray", "stroke-linecap",
                 "stroke-linejoin", "opacity", "font-size", "font-weight", "text-anchor", "transform"}
SAFE_VALUE = re.compile(r"^[-#%.,()0-9A-Za-z \t]*$")


class SolutionError(Exception):
    """A refusal the operator can act on. The message is safe to print."""


@cache
def load(name):
    spec = importlib.util.spec_from_file_location(name, pathlib.Path(__file__).with_name(f"{name}.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def paper_files(work, paper_id):
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", paper_id):
        raise SolutionError("Use a paper ID such as uceed-2026")
    base = (pathlib.Path(work).expanduser() / paper_id).resolve()
    inside_git = load("intake").inside_git_worktree
    if any(inside_git(path) for path in (base, (base / STAGE).resolve(), (base / REVIEW_STAGE).resolve())):
        raise SolutionError("Choose a private work folder outside any Git worktree")
    needed = {"segments": base / "02-segments" / "questions.json", "figures": base / "03-figures" / "figures.json"}
    for name, path in needed.items():
        if not path.is_file():
            raise SolutionError(f"Run the earlier stages first: {path.relative_to(base.parent)} is missing")
    segment_bytes = needed["segments"].read_bytes()
    segment_hash = sha256(segment_bytes)
    segment_manifest = json.loads(segment_bytes)
    segments = {q["key"]: q for q in segment_manifest["questions"]}
    figure_manifest = json.loads(needed["figures"].read_text())
    if figure_manifest.get("segmentsSha256") != segment_hash:
        raise SolutionError("Run stage 3 again for the current segments")
    figures = {q["key"]: q for q in figure_manifest["questions"]}
    key_path = base / "04-key" / "key.json"
    key_manifest = json.loads(key_path.read_bytes()) if key_path.is_file() else {}
    return base, segments, figures, key_manifest, segment_hash, segment_manifest.get("intakeSha256")


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def key_evidence(base, paper_id, manifest, segment_hash):
    """Check that the parsed keys still refer to the current segments and a preserved source PDF."""
    if not manifest:
        return False
    source = manifest.get("source", {})
    name = source.get("name")
    if not name or pathlib.Path(name).name != name:
        return False
    path = base / "04-key" / "source" / name
    return (manifest.get("paperId") == paper_id and manifest.get("segmentsSha256") == segment_hash
            and path.is_file() and sha256(path.read_bytes()) == source.get("sha256"))


def official_record(manifest, key, question, evidence_valid):
    record = manifest.get("keys", {}).get(key, {})
    status = record.get("status", "missing")
    kind, raw, printed, page = question["type"], record.get("raw"), record.get("printed"), record.get("page")
    issues = [issue for issue in manifest.get("report", {}).get("issues", []) if issue.get("key") == key]
    verified = False
    if (evidence_valid and status == "official-key" and record.get("kind") == kind
            and not record.get("checks") and not issues and type(page) is int and page > 0
            and record.get("readBy") in ("text", "ocr", "letter-match", "crop-ocr")
            and isinstance(raw, str) and isinstance(printed, str)):
        ak = load("answer_key")
        canonical = ak.canonical(raw, kind)
        verified = canonical is not None and canonical == ak.canonical(printed, kind)
    return {**record, "raw": raw, "status": status,
            "source": manifest.get("source"),
            "segmentsSha256": manifest.get("segmentsSha256"),
            "issues": issues,
            "verifiedKey": verified}


def option_labels(question):
    if question["type"] not in ("MCQ", "MSQ"):
        return []
    return [option["key"] for option in question["options"]] or list("ABCD")


# ---------------------------------------------------------------- brief


def brief(work, paper_id, key):
    base, segments, figures, key_manifest, segment_hash, _ = paper_files(work, paper_id)
    if key not in segments:
        raise SolutionError(f"No question {key} in {paper_id}")
    question, record = segments[key], figures.get(key, {})
    if question["type"] not in OBJECTIVE:
        raise SolutionError("Worked-solution drafts support NAT, MCQ and MSQ questions")
    official = official_record(key_manifest, key, question, key_evidence(base, paper_id, key_manifest, segment_hash))
    source = "official-key" if official["verifiedKey"] else "model-proposed"
    if official["status"] == "dropped" or (official["status"] == "official-key" and not official["verifiedKey"]):
        raise SolutionError("Resolve the official key evidence before drafting this question")
    return {
        "paperId": paper_id, "key": key, "type": question["type"], "prompt": question["prompt"],
        "options": [{"key": o["key"], "text": o["text"]} for o in question["options"]],
        "officialKey": official,
        "draftTemplate": {
            "schema": SCHEMA, "answer": {"source": source, "value": None},
            "keyIdea": "", "steps": [{"text": ""}],
            "optionCheck": [{"option": label, "verdict": None, "why": ""} for label in option_labels(question)],
            "meta": {"topic": "", "difficulty": None, "seconds": None},
            "provenance": {"status": "draft", "draftedBy": ""},
        },
        "draftInstruction": (
            "Derive the answer from the question and figures, then compare with the official key."
            if official["verifiedKey"] else
            "Derive a candidate answer only if the question and figures support it. Leave the answer blank and hold the draft if unsure."
        ),
        "figures": [{"id": f["id"], "role": f["role"], "file": str(base / "03-figures" / f["canonical"]["file"]),
                     "width": f["canonical"]["width"], "height": f["canonical"]["height"]} for f in record.get("figures", [])],
        "block": str(base / "03-figures" / record["block"]["file"]) if record.get("block") else None,
        "flags": question["flags"],
    }


# ---------------------------------------------------------------- validation


def overlay_problems(fragment):
    """Overlay fragments may only draw shapes and text: no links, scripts, styles or images."""
    try:
        root = ET.fromstring(f'<g xmlns="{SVG_NS}">{fragment}</g>')
    except ET.ParseError:
        return ["overlay-not-well-formed"]
    problems = []
    for element in root.iter():
        tag = element.tag.split("}")[-1]
        if tag not in OVERLAY_TAGS:
            problems.append(f"overlay-element-{tag}")
        for name, value in element.attrib.items():
            local = name.split("}")[-1]
            if local not in OVERLAY_ATTRS:
                problems.append(f"overlay-attribute-{local}")
            elif not SAFE_VALUE.match(value) or "url" in value.lower():
                problems.append(f"overlay-value-{local}")
    return sorted(set(problems))


def reaches_key(ak, value, official_raw, kind):
    """True when the solution's answer is the official key: the same choices for MCQ/MSQ,
    or for NAT a printed value or a value inside a printed range."""
    mine, theirs = ak.canonical(value, kind), ak.canonical(official_raw, kind)
    if mine is None or theirs is None:
        return False
    if kind in ("MCQ", "MSQ"):
        return mine == theirs or (len(mine) == 1 and mine[0] in theirs)
    if mine == theirs or len(mine) != 1 or mine[0][0] != mine[0][1]:
        return mine == theirs
    point = Decimal(mine[0][0])
    return any(Decimal(low) <= point <= Decimal(high) for low, high in theirs)


def words(text):
    return len(str(text).split())


def shape_problems(solution):
    if not isinstance(solution, dict):
        return ["solution-must-be-an-object"]
    errors = []
    for field, expected in (("answer", dict), ("keyIdea", str), ("steps", list), ("meta", dict), ("provenance", dict)):
        if not isinstance(solution.get(field), expected):
            errors.append(f"invalid-{field}")
    for field in ("trap", "fastTrack"):
        if field in solution and not isinstance(solution[field], str):
            errors.append(f"invalid-{field}")
    steps = solution.get("steps")
    if isinstance(steps, list) and any(
        not isinstance(s, dict) or not isinstance(s.get("text"), str) or not isinstance(s.get("overlay", ""), str)
        for s in steps
    ):
        errors.append("invalid-steps")
    options = solution.get("optionCheck", [])
    if not isinstance(options, list) or any(
        not isinstance(c, dict) or any(not isinstance(c.get(field), str) for field in ("option", "verdict", "why"))
        for c in options
    ):
        errors.append("invalid-optionCheck")
    overlay = solution.get("overlay")
    if overlay is not None and (not isinstance(overlay, dict) or not isinstance(overlay.get("figure"), str)
                                or not isinstance(overlay.get("viewBox"), str) or not isinstance(overlay.get("steps"), dict)
                                or not all(isinstance(v, str) for v in overlay["steps"].values())):
        errors.append("invalid-overlay")
    return errors


def validate(solution, question, official, figures):
    """Return (errors, warnings, reaches_key). Errors hold the solution."""
    ak = load("answer_key")
    errors, warnings = shape_problems(solution), []
    if errors:
        return errors, warnings, False
    if solution.get("schema") != SCHEMA:
        errors.append("unsupported-schema")
    kind = question["type"]
    if kind not in OBJECTIVE:
        return errors + ["unsupported-question-type"], warnings, None
    value = solution["answer"].get("value")
    proposed = ak.canonical(value, kind) if isinstance(value, str) else None
    if proposed is None:
        errors.append("answer-value-invalid")
    status = official.get("status")
    reaches = None
    source = solution["answer"].get("source")
    if official.get("verifiedKey"):
        reaches = proposed is not None and reaches_key(ak, value, official["raw"], kind)
        if not reaches:
            errors.append("does-not-reach-official-key")
        if source != "official-key":
            errors.append("answer-source-must-be-official-key")
    elif status == "official-key":
        errors.append("official-key-evidence-needs-review")
    elif status == "dropped":
        errors.append("official-key-dropped")
    else:
        warnings.append("proposed-answer-unverified")
        if source not in PROPOSAL_SOURCES:
            errors.append("answer-source-must-be-model-or-human-proposed")
        if proposed and (len(proposed) != 1 or (kind == "NAT" and proposed[0][0] != proposed[0][1])):
            errors.append("proposed-answer-must-be-single-candidate")
    if not str(solution["keyIdea"]).strip():
        errors.append("key-idea-empty")
    elif words(solution["keyIdea"]) > 2 * STEP_WORDS_WARN:
        warnings.append("key-idea-long")
    steps = solution["steps"]
    if not isinstance(steps, list) or not 1 <= len(steps) <= MAX_STEPS:
        errors.append(f"steps-must-be-1-to-{MAX_STEPS}")
        steps = steps if isinstance(steps, list) else []
    for index, step in enumerate(steps, 1):
        count = words(step.get("text", ""))
        if not count:
            errors.append(f"step-{index}-empty")
        elif count > STEP_WORDS_MAX:
            errors.append(f"step-{index}-too-long")
        elif count > STEP_WORDS_WARN:
            warnings.append(f"step-{index}-long")
    if kind == "NAT" and not any(re.search(r"\d\s*[-+×x*/÷=]\s*\d|=", s.get("text", "")) for s in steps):
        warnings.append("nat-shows-no-arithmetic")  # some NAT questions ask "which number", not a sum
    if kind in ("MCQ", "MSQ"):
        letters = option_labels(question)
        check = solution.get("optionCheck") or []
        if sorted(c.get("option") for c in check) != sorted(letters):
            errors.append("option-check-must-cover-every-option")
        correct = sorted(c["option"] for c in check if c.get("verdict") == "correct")
        if proposed and ",".join(correct) not in proposed:
            errors.append("option-verdicts-disagree-with-key" if reaches else "option-verdicts-disagree-with-answer")
        if any(c.get("verdict") not in ("correct", "wrong") or not str(c.get("why", "")).strip() for c in check):
            errors.append("option-check-needs-verdict-and-reason")
    overlay = solution.get("overlay")
    step_refs = [s.get("overlay") for s in steps if s.get("overlay")]
    if overlay:
        figure = figures.get(overlay.get("figure"))
        if figure is None:
            errors.append("overlay-figure-unknown")
        elif overlay.get("viewBox") != f"0 0 {figure['canonical']['width']} {figure['canonical']['height']}":
            errors.append("overlay-viewbox-must-match-figure")
        for name, fragment in (overlay.get("steps") or {}).items():
            errors.extend(f"{problem}-in-{name}" for problem in overlay_problems(fragment))
        missing = [ref for ref in step_refs if ref not in (overlay.get("steps") or {})]
        if missing:
            errors.append("step-overlay-missing")
    elif step_refs:
        errors.append("steps-refer-to-an-overlay-that-is-absent")
    meta = solution["meta"]
    if meta.get("difficulty") not in tuple(DIFFICULTY):
        errors.append("meta-difficulty")
    if type(meta.get("seconds")) is not int or not 10 <= meta["seconds"] <= 600:
        errors.append("meta-seconds")
    if not isinstance(meta.get("topic"), str) or not meta["topic"].strip():
        errors.append("meta-topic")
    provenance = solution["provenance"]
    if provenance.get("status") not in tuple(STATUS):
        errors.append("provenance-status")
    if not isinstance(provenance.get("draftedBy"), str) or not provenance["draftedBy"].strip():
        errors.append("provenance-drafter-required")
    if provenance.get("status") == "verified":
        warnings.append("inline-review-ignored")
    return errors, warnings, reaches


def review_fingerprint(base, paper_id, question, official, figures, solution_bytes):
    """Bind a review to the exact solution, key evidence, question and displayed assets."""
    folder = base / "03-figures"
    assets = [f["canonical"] for f in figures.get("figures", [])]
    if figures.get("block"):
        assets.append(figures["block"])
    for asset in assets:
        path = (folder / asset["file"]).resolve()
        if (not path.is_relative_to(folder.resolve()) or not path.is_file()
                or sha256(path.read_bytes()) != asset.get("sha256")):
            raise SolutionError("Figure evidence does not match the stage 3 manifest")
    evidence = {"paperId": paper_id, "question": question, "officialKey": official, "figures": figures,
                "solutionSha256": sha256(solution_bytes)}
    return sha256(json.dumps(evidence, sort_keys=True, ensure_ascii=False).encode())


def source_matches(base, paper_id, intake_hash):
    """Check the original PDF or ordered photo set linked to the current segmentation."""
    folder = base / "01-intake"
    try:
        manifest_bytes = (folder / "paper.json").read_bytes()
        if sha256(manifest_bytes) != intake_hash:
            return False
        manifest = json.loads(manifest_bytes)
        if manifest["paperId"] != paper_id or manifest["stage"] != "01-intake":
            return False
        source = manifest["source"]
        files = source["files"]
        if source["kind"] not in ("pdf", "photos") or not files or (source["kind"] == "pdf" and len(files) != 1):
            return False
        originals = (folder / "source").resolve()
        if not originals.is_relative_to(base):
            return False
        for item in files:
            path = (originals / item["name"]).resolve()
            if path.parent != originals or load("intake").sha256_file(path) != item["sha256"]:
                return False
    except (OSError, ValueError, KeyError, TypeError):
        return False
    return True


def adjudication_fingerprint(fingerprint, question, figures, official, source_verified, segment_hash, key_evidence_usable):
    if (not fingerprint or question["flags"] or not figures.get("block") or not key_evidence_usable
            or official.get("checks") or official["issues"] or official["raw"] is not None or not source_verified()):
        return None
    return sha256(f"owner-adjudication-v1:{segment_hash}:{fingerprint}".encode())


def independent_agreement(question, solution, reviewer, value, reasoning):
    canonical = load("answer_key").canonical
    return (isinstance(reviewer, str) and bool(reviewer.strip())
            and reviewer.strip().casefold() != solution["provenance"]["draftedBy"].strip().casefold()
            and isinstance(value, str) and isinstance(reasoning, str) and bool(reasoning.strip())
            and canonical(value, question["type"]) == canonical(solution["answer"]["value"], question["type"]))


def read_review(base, key):
    path = base / REVIEW_STAGE / f"{key}.json"
    try:
        record = json.loads(path.read_bytes())
    except (FileNotFoundError, ValueError):
        return None
    return record if isinstance(record, dict) else None


def solution_result(base, paper_id, question, figures, official, solution_bytes,
                    *, source_verified, segment_hash, key_evidence_usable):
    try:
        solution = json.loads(solution_bytes)
    except ValueError:
        return {"status": "held", "errors": ["not-json"], "warnings": [], "eligibleForExport": False}
    figure_index = {f["id"]: f for f in figures.get("figures", [])}
    errors, warnings, reaches = validate(solution, question, official, figure_index)
    claimed = solution["provenance"].get("status") if not shape_problems(solution) else None
    fingerprint = None
    if not errors:
        try:
            fingerprint = review_fingerprint(base, paper_id, question, official, figures, solution_bytes)
        except SolutionError:
            errors.append("figure-evidence-needs-review")
    if claimed == "held":
        errors.append("draft-held-by-author")
    receipt = read_review(base, question["key"])
    reviewable = not errors and bool(reaches) and fingerprint is not None
    approved = (reviewable and receipt is not None and receipt.get("decision") == "approve"
                and receipt.get("fingerprint") == fingerprint and receipt.get("paperId") == paper_id
                and receipt.get("key") == question["key"] and isinstance(receipt.get("reviewer"), str)
                and bool(receipt["reviewer"].strip()))
    keyless_fingerprint = None
    if not errors and official["status"] in ("missing", "unreadable"):
        keyless_fingerprint = adjudication_fingerprint(
            fingerprint, question, figures, official, source_verified, segment_hash, key_evidence_usable)
        if not keyless_fingerprint:
            warnings.append("owner-adjudication-needs-source-evidence")
    adjudicated = (keyless_fingerprint is not None and receipt is not None
                   and receipt.get("decision") == "owner-adjudicated"
                   and receipt.get("fingerprint") == keyless_fingerprint and receipt.get("paperId") == paper_id
                   and receipt.get("key") == question["key"]
                   and independent_agreement(question, solution, receipt.get("reviewer"),
                                             receipt.get("independentAnswer"), receipt.get("reasoning")))
    if adjudicated:
        warnings.remove("proposed-answer-unverified")
    if receipt and not (approved or adjudicated):
        warnings.append("review-no-longer-matches")
    status = "held" if errors else "draft"
    if approved or adjudicated:
        status = "verified" if approved else "owner-adjudicated"
    return {"status": status, "reachesKey": reaches,
            "officialKey": official, "errors": errors, "warnings": warnings, "fingerprint": fingerprint,
            "segmentsSha256": segment_hash,
            "reviewable": reviewable, "eligibleForExport": approved,
            "adjudicationFingerprint": keyless_fingerprint,
            "ownerAdjudication": receipt if adjudicated else None,
            "reviewedBy": receipt["reviewer"] if approved or adjudicated else None}


def collect(work, paper_id, *, write_report=True):
    base, segments, figures, manifest, segment_hash, intake_hash = paper_files(work, paper_id)
    folder = base / STAGE
    evidence_valid = key_evidence(base, paper_id, manifest, segment_hash)
    # A present key manifest must match its PDF. Orphan key files require review.
    key_stage = base / "04-key"
    no_key = not (key_stage / "key.json").exists() and not any((key_stage / "source").glob("*"))

    @cache
    def source_verified():
        return source_matches(base, paper_id, intake_hash)

    results, drafts = {}, {}
    paths = [p for p in folder.glob("q*.json") if QUESTION_KEY.fullmatch(p.stem)]
    for path in sorted(paths, key=lambda p: (p.stem.startswith("qb"), int(re.sub(r"\D", "", p.stem)))):
        key = path.stem
        if key not in segments:
            results[key] = {"status": "held", "errors": ["no-such-question"], "warnings": [], "eligibleForExport": False}
            continue
        question = segments[key]
        official = official_record(manifest, key, question, evidence_valid)
        drafts[key] = path.read_bytes()
        results[key] = solution_result(
            base, paper_id, question, figures.get(key, {}), official, drafts[key],
            source_verified=source_verified, segment_hash=segment_hash, key_evidence_usable=evidence_valid or no_key)
    part_a = [k for k, q in segments.items() if q["part"] == "A"]
    report = {"paperId": paper_id, "solutions": len(results), "partAQuestions": len(part_a),
              "withoutSolution": [k for k in part_a if k not in results],
              "byStatus": {s: sum(1 for r in results.values() if r["status"] == s) for s in ("draft", "verified", "held", "owner-adjudicated")},
              "ownerAdjudicated": [key for key, result in results.items() if result["status"] == "owner-adjudicated"],
              "eligibleForExport": [key for key, result in results.items() if result["eligibleForExport"]],
              "results": results}
    if write_report:
        folder.mkdir(exist_ok=True)
        (folder / "check.json").write_text(json.dumps(report, indent=1) + "\n")
    return report, base, segments, figures, drafts


def check(work, paper_id):
    report, *_ = collect(work, paper_id)
    return report


def approve(work, paper_id, key, reviewer, fingerprint):
    if not QUESTION_KEY.fullmatch(key) or not reviewer.strip():
        raise SolutionError("Specify a question key and the human reviewer's name")
    result = check(work, paper_id)["results"].get(key, {})
    if not result.get("reviewable"):
        raise SolutionError("Only a valid solution that agrees with a verified official key can be approved")
    if fingerprint != result["fingerprint"]:
        raise SolutionError("The fingerprint changed. Render and review the current evidence before approving")
    receipt = {"paperId": paper_id, "key": key, "decision": "approve", "reviewer": reviewer.strip(),
               "fingerprint": fingerprint}
    return write_review((pathlib.Path(work).expanduser() / paper_id).resolve(), key, receipt)


def adjudicate(work, paper_id, key, reviewer, fingerprint, independent_answer, reasoning):
    report, base, segments, _, drafts = collect(work, paper_id, write_report=False)
    result = report["results"].get(key, {})
    current = result.get("adjudicationFingerprint")
    if current is None:
        raise SolutionError("Owner adjudication requires a valid keyless draft and intact source evidence")
    if fingerprint != current:
        raise SolutionError("The fingerprint changed. Render and review the current evidence before adjudicating")
    if not independent_agreement(segments[key], json.loads(drafts[key]), reviewer, independent_answer, reasoning):
        raise SolutionError("A different human reviewer must supply an independent answer agreeing with the draft and written reasoning")
    receipt = {"paperId": paper_id, "key": key, "decision": "owner-adjudicated", "reviewer": reviewer.strip(),
               "fingerprint": fingerprint, "independentAnswer": independent_answer.strip(), "reasoning": reasoning.strip()}
    return write_review(base, key, receipt)


def write_review(base, key, receipt):
    folder = base / REVIEW_STAGE
    folder.mkdir(mode=0o700, exist_ok=True)
    with tempfile.NamedTemporaryFile(mode="w", dir=folder, delete=False) as tmp:
        tmp.write(json.dumps(receipt, indent=2) + "\n")
    pathlib.Path(tmp.name).replace(folder / f"{key}.json")
    return receipt


# ---------------------------------------------------------------- review page


def render(work, paper_id):
    report, base, segments, figures, drafts = collect(work, paper_id)
    folder = base / STAGE
    cards = []
    for key, result in report["results"].items():
        esc = html.escape
        problems = "".join(f"<li>{esc(e)}</li>" for e in result["errors"] + result["warnings"])
        if "not-json" in result["errors"] or key not in segments:
            cards.append(f'<article class="card held"><h2>{esc(key.upper())}</h2><ul class="problems">{problems}</ul></article>')
            continue
        solution = json.loads(drafts[key])
        if shape_problems(solution):
            cards.append(f'<article class="card held"><h2>{esc(key.upper())}</h2><ul class="problems">{problems}</ul></article>')
            continue
        question = segments[key]
        record = figures.get(key, {})
        figure_index = {f["id"]: f for f in record.get("figures", [])}
        figure_html = ""
        source_block = ""
        if record.get("block"):
            source_block = f'<details><summary>Source question</summary><figure class="stage"><img src="../03-figures/{esc(record["block"]["file"])}" alt="Source question crop"></figure></details>'
        question_options = "".join(f'<li><b>{esc(o["key"])}</b> {esc(o["text"])}</li>' for o in question["options"])
        official = result["officialKey"]
        inferred_run = "consecutive-row-run-needs-visual-review" in official.get("notes", [])
        cropped_number = "two-crop-ocr-agreement-needs-visual-review" in official.get("notes", [])
        recovered_row = "whole-row-recovered-by-two-crop-pairs-needs-visual-review" in official.get("notes", [])
        official_details = ("Source-linked OCR key; visually review its inferred question number"
                            if inferred_run else "Source-linked cropped OCR key; visually review its recovered row and answer"
                            if recovered_row else "Source-linked cropped OCR key; visually review its printed number"
                            if cropped_number else "Verified official key" if official["verifiedKey"]
                            else f'Key status {esc(official["status"])}')
        if official["source"] and official.get("page"):
            name = official["source"]["name"]
            source_name = esc(name)
            source_page = esc(str(official["page"]))
            official_details += (f' · <a href="../04-key/source/{quote(name, safe="")}#page={source_page}">{source_name}, page {source_page}</a>'
                                f' · printed {esc(str(official.get("printed")))} · key {esc(str(official["raw"]))}')
        answer_label = "Proposed answer" if solution["answer"].get("source") in PROPOSAL_SOURCES else "Worked answer"
        review_info = ""
        if result["eligibleForExport"]:
            review_info = f'<p>Approved by {esc(result["reviewedBy"])}</p>'
        elif result["reviewable"]:
            review_info = f'<p>Review fingerprint <code>{esc(result["fingerprint"])}</code></p>'
        elif result["ownerAdjudication"]:
            decision = result["ownerAdjudication"]
            review_info = (f'<p>Owner-adjudicated by {esc(decision["reviewer"])} · private review only</p>'
                           f'<p>Independent answer {esc(decision["independentAnswer"])}</p>'
                           f'<p>{esc(decision["reasoning"])}</p>'
                           f'<p>Adjudication fingerprint <code>{esc(decision["fingerprint"])}</code></p>')
        elif result["adjudicationFingerprint"]:
            review_info = f'<p>Adjudication fingerprint <code>{esc(result["adjudicationFingerprint"])}</code></p>'
        overlay = solution.get("overlay")
        if overlay and overlay.get("figure") in figure_index and not any(e.startswith("overlay") for e in result["errors"]):
            figure = figure_index[overlay["figure"]]
            layers = "".join(f'<g class="layer" data-step="{esc(name)}">{fragment}</g>' for name, fragment in overlay["steps"].items())
            figure_html = (f'<figure class="stage"><div class="frame"><img src="../03-figures/{esc(figure["canonical"]["file"])}" alt="">'
                           f'<svg viewBox="{esc(overlay["viewBox"])}" preserveAspectRatio="none">{layers}</svg></div>'
                           f'<div class="scrub"><button type="button" class="prev">Back</button><span class="count"></span>'
                           f'<button type="button" class="next">Next step</button></div></figure>')
        if result.get("adjudicationFingerprint") or (not figure_html and not source_block):
            figure_html += "".join(
                f'<figure class="stage"><img src="../03-figures/{esc(f["canonical"]["file"])}" alt="Question figure"></figure>'
                for f in figure_index.values()
            )
        steps = "".join(f'<li data-step="{esc(s.get("overlay") or "")}">{esc(s["text"])}</li>' for s in solution["steps"])
        options = "".join(f'<li><b>{esc(c["option"])}</b> <span class="{esc(c["verdict"])}">{esc(c["verdict"])}</span> {esc(c["why"])}</li>'
                          for c in solution.get("optionCheck") or [])
        extras = "".join(f'<p><b>{label}</b> {esc(solution[field])}</p>' for field, label in (("trap", "Trap:"), ("fastTrack", "Faster:")) if solution.get(field))
        meta = solution["meta"]
        cards.append(f'''<article class="card {esc(result["status"])}">
<header><h2>{esc(key.upper())} <small>{esc(question["type"])} · {esc(str(meta.get("topic", "")))} · {esc(str(meta.get("difficulty", "")))} · {esc(str(meta.get("seconds", "")))} s</small></h2>
<span class="badge">{esc(result["status"])}</span></header>
<p class="prompt">{esc(question["prompt"])}</p>
{f'<ul>{question_options}</ul>' if question_options else ''}
{source_block}
{figure_html}
<p class="answer">{answer_label} <b>{esc(str(solution["answer"].get("value")))}</b></p>
<p><small>{official_details}</small></p>
<p class="idea">{esc(solution["keyIdea"])}</p>
<ol class="steps">{steps}</ol>
{f'<ul class="options">{options}</ul>' if options else ''}
{extras}
{review_info}
{f'<ul class="problems">{problems}</ul>' if problems else ''}
</article>''')
    page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Solution review</title><style>
:root{{--paper:#f7f3ea;--ink:#1f2a24;--forest:#2f5d46;--orange:#d9772b;--muted:#6b6f68;--line:#ddd5c4;--card:#fffdf8}}
@media (prefers-color-scheme:dark){{:root{{--paper:#171b18;--ink:#ece7dc;--forest:#7fb89a;--orange:#f0a060;--muted:#a5a99f;--line:#33392f;--card:#1f241f}}}}
body{{margin:0;background:var(--paper);color:var(--ink);font:16px/1.5 system-ui,sans-serif}}
main{{max-width:860px;margin:0 auto;padding:24px 16px}} h1{{font-size:24px;margin:0 0 4px}}
.card{{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px 20px;margin:20px 0}}
.card header{{display:flex;justify-content:space-between;align-items:baseline;gap:12px}} h2{{font-size:18px;margin:0}} h2 small{{color:var(--muted);font-weight:400;font-size:13px}}
.badge{{font-size:12px;padding:2px 8px;border-radius:99px;border:1px solid var(--line)}} .held .badge{{background:#c0392b;color:#fff}} .draft .badge{{background:var(--orange);color:#fff}} .verified .badge{{background:var(--forest);color:#fff}}
.prompt{{color:var(--muted)}} .answer b{{color:var(--forest);font-size:18px}} .idea{{border-left:3px solid var(--orange);padding-left:10px}}
.stage{{margin:12px 0}} .frame{{position:relative;background:#fff;border-radius:8px;overflow:hidden}} .frame img,.stage>img{{display:block;width:100%;height:auto}}
.frame svg{{position:absolute;inset:0;width:100%;height:100%}} .layer{{opacity:0;transition:opacity .25s}} .layer.on{{opacity:1}}
.scrub{{display:flex;gap:10px;align-items:center;margin-top:8px}} button{{font:inherit;padding:4px 12px;border-radius:8px;border:1px solid var(--line);background:var(--card);color:var(--ink);cursor:pointer}}
.steps li.on{{font-weight:600}} .correct{{color:var(--forest)}} .wrong{{color:#c0392b}} .problems{{color:#c0392b;font-size:14px}}
</style></head><body><main><h1>{html.escape(paper_id.upper())} solutions</h1>
<p>{report["solutions"]} drafted · {report["byStatus"]["draft"]} draft · {report["byStatus"]["verified"]} verified · {report["byStatus"]["held"]} held · {report["byStatus"]["owner-adjudicated"]} owner-adjudicated · {len(report["withoutSolution"])} Part A questions without a solution yet. Private review copy.</p>
{"".join(cards)}</main><script>
document.querySelectorAll('.card').forEach(card=>{{const layers=[...card.querySelectorAll('.layer')];const items=[...card.querySelectorAll('.steps li')];
const names=items.map(li=>li.dataset.step);let at=0;const count=card.querySelector('.count');if(!count)return;
const show=()=>{{const upto=names.slice(0,at+1);layers.forEach(l=>l.classList.toggle('on',upto.includes(l.dataset.step)));
items.forEach((li,i)=>li.classList.toggle('on',i===at));count.textContent=`Step ${{at+1}} of ${{items.length}}`;}};
card.querySelector('.prev').onclick=()=>{{at=Math.max(0,at-1);show();}};card.querySelector('.next').onclick=()=>{{at=Math.min(items.length-1,at+1);show();}};show();}});
</script></body></html>'''
    (folder / "review.html").write_text(page)
    return {**{k: v for k, v in report.items() if k != "results"}, "page": str(folder / "review.html")}


def render_index(work):
    """Render a private whole-workspace index; never publish questions or keys."""
    root = pathlib.Path(work).expanduser().resolve()
    if not root.is_dir():
        raise SolutionError("Private work folder does not exist")
    rows, totals = [], {"papers": 0, "partA": 0, "draft": 0, "verified": 0, "held": 0,
                        "owner-adjudicated": 0, "missing": 0}
    for base in sorted(root.iterdir(), key=lambda path: path.name, reverse=True):
        if not base.is_dir() or not re.fullmatch(r"[a-z0-9][a-z0-9-]{1,80}", base.name):
            continue
        if not (base / "02-segments/questions.json").is_file():
            continue
        try:
            report, *_ = collect(root, base.name, write_report=False)
            if report["solutions"]:
                render(root, base.name)
        except (SolutionError, ValueError, KeyError) as error:
            rows.append(f'<tr><th scope="row">{html.escape(base.name)}</th><td colspan="6">'
                        f'Source review needed: {html.escape(str(error))}</td></tr>')
            continue
        totals["papers"] += 1
        totals["partA"] += report["partAQuestions"]
        for name in ("draft", "verified", "held", "owner-adjudicated"):
            totals[name] += report["byStatus"][name]
        totals["missing"] += len(report["withoutSolution"])
        paper = html.escape(base.name)
        link = (f'<a href="{quote(base.name, safe="")}/05-solutions/review.html">Review solutions</a>'
                if report["solutions"] else "Not started")
        priorities = (f' · <a href="{quote(base.name, safe="")}/05-solutions/REVIEW_PRIORITIES.md">Priorities</a>'
                      if (base / STAGE / "REVIEW_PRIORITIES.md").is_file() else "")
        rows.append(f'<tr><th scope="row">{paper}</th><td>{report["partAQuestions"]}</td>'
                    f'<td>{report["byStatus"]["draft"]}</td><td>{report["byStatus"]["held"]}</td>'
                    f'<td>{report["byStatus"]["verified"]}</td><td>{report["byStatus"]["owner-adjudicated"]}</td>'
                    f'<td>{link}{priorities}</td></tr>')
    page = '''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Private paper review</title><style>
body{margin:0;background:#f7f3ea;color:#1f2a24;font:16px/1.5 system-ui,sans-serif}main{max-width:1000px;margin:auto;padding:24px 16px}
h1{font-size:28px}p{max-width:70ch}.wrap{overflow-x:auto;border:1px solid #ddd5c4;border-radius:12px;background:#fffdf8}
table{border-collapse:collapse;width:100%;min-width:680px;text-align:left}th,td{padding:11px 13px;border-bottom:1px solid #e9e2d5}thead{background:#e8eee6}
a{color:#1f6043}a:focus-visible{outline:3px solid #d9772b;outline-offset:2px}.metrics{display:flex;gap:10px;flex-wrap:wrap}
.metrics span{background:#e8eee6;border-radius:8px;padding:5px 9px}small{color:#58665b}
</style></head><body><main><h1>Paper and solution review</h1>
<p>Private local workspace. Drafts need exact human review before export. Held solutions and missing solutions cannot enter the bank.</p>
<div class="metrics">''' + ''.join(f'<span>{label}: <b>{totals[key]}</b></span>' for key, label in (
        ("papers", "Papers"), ("partA", "Part A questions"), ("draft", "Drafts"),
        ("held", "Held"), ("verified", "Verified"), ("missing", "Without a solution"))) + '''</div>
<div class="wrap"><table><thead><tr><th scope="col">Paper</th><th scope="col">Part A</th><th scope="col">Draft</th><th scope="col">Held</th><th scope="col">Verified</th><th scope="col">Adjudicated</th><th scope="col">Review</th></tr></thead><tbody>''' + ''.join(rows) + '''</tbody></table></div>
<p><small>Counts come from current source, key and solution evidence each time this index is rebuilt.</small></p></main></body></html>'''
    output = root / "index.html"
    output.write_text(page, encoding="utf-8")
    return {"page": str(output), **totals}


def main(argv=None):
    parser = argparse.ArgumentParser(description="Private worked-solution drafting and review.")
    sub = parser.add_subparsers(dest="command", required=True)
    one = sub.add_parser("brief")
    one.add_argument("paper_id")
    one.add_argument("key")
    for name in ("check", "render"):
        sub.add_parser(name).add_argument("paper_id")
    sub.add_parser("index", help="Render a private whole-workspace review index")
    review = sub.add_parser("approve", help="Approve the exact draft and evidence you reviewed")
    review.add_argument("paper_id")
    review.add_argument("key")
    review.add_argument("--reviewer", required=True)
    review.add_argument("--fingerprint", required=True)
    owner = sub.add_parser("adjudicate", help="Privately adjudicate a keyless solution after independently solving it")
    owner.add_argument("paper_id")
    owner.add_argument("key")
    owner.add_argument("--reviewer", required=True)
    owner.add_argument("--fingerprint", required=True)
    owner.add_argument("--independent-answer", required=True)
    owner.add_argument("--reasoning", required=True, help="Private text file containing the owner's independently worked reasoning")
    parser.add_argument("--work", required=True)
    args = parser.parse_args(argv)
    try:
        if args.command == "brief":
            result = brief(args.work, args.paper_id, args.key)
        elif args.command == "index":
            result = render_index(args.work)
        elif args.command == "check":
            report = check(args.work, args.paper_id)
            result = {k: v for k, v in report.items() if k != "results"}
            result["held"] = {k: r["errors"] for k, r in report["results"].items() if r["status"] == "held"}
        elif args.command == "approve":
            result = approve(args.work, args.paper_id, args.key, args.reviewer, args.fingerprint)
        elif args.command == "adjudicate":
            try:
                reasoning = pathlib.Path(args.reasoning).read_text(encoding="utf-8")
            except (OSError, UnicodeError) as error:
                raise SolutionError("Read the owner's reasoning from a UTF-8 text file") from error
            result = adjudicate(args.work, args.paper_id, args.key, args.reviewer, args.fingerprint,
                                args.independent_answer, reasoning)
            result = {k: v for k, v in result.items() if k not in ("reasoning", "independentAnswer")}
        else:
            result = render(args.work, args.paper_id)
    except SolutionError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(result, ensure_ascii=False, indent=1))
    return 0


if __name__ == "__main__":
    sys.exit(main())
