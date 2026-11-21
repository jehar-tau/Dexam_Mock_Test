#!/usr/bin/env python3
"""Stage 7: dry-run one approved addition or correction through the bank packet verifier."""

import argparse
from datetime import datetime, timezone
import json
import pathlib
import re
import subprocess
import sys
import tempfile
import uuid
import xml.etree.ElementTree as ET

from solutions import QUESTION_KEY, SVG_NS, SolutionError, collect, load, sha256


REPO = pathlib.Path(__file__).resolve().parents[3]
BANK_PATH = "server/data/exports/dexam-bank-export.json"
PREPARE = "apps/designmocks/scripts/prepare-question-bank-addition.mjs"
DIGEST = re.compile(r"[0-9a-f]{64}")
SOURCE_CLASSIFICATIONS = {
    "official-unlicensed": ("official", "official-unlicensed"),
    "owner-authorized": ("owner_authorized", "owner-provided"),
}
SHAPES = {"circle", "ellipse", "rect", "line", "polyline", "polygon", "path", "text", "g"}
ATTRIBUTES = {"cx", "cy", "r", "rx", "ry", "x", "y", "x1", "y1", "x2", "y2", "width", "height",
              "points", "d", "fill", "fill-opacity", "stroke", "stroke-width", "stroke-dasharray",
              "stroke-linecap", "stroke-linejoin", "opacity", "font-size", "font-weight", "text-anchor", "transform"}
SVG_VALUE = re.compile(r"[-#%.,()0-9A-Za-z \t]{1,1200}")


def read_bank(repo, expected_source):
    if not re.fullmatch(r"[0-9a-f]{40}", expected_source):
        raise SolutionError("Supply the full reviewed origin/main commit SHA")
    try:
        actual = subprocess.check_output(
            ["git", "rev-parse", "--verify", "refs/remotes/origin/main^{commit}"], cwd=repo, stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
        if actual != expected_source:
            raise SolutionError("origin/main does not match the expected source commit")
        return json.loads(subprocess.check_output(
            ["git", "show", f"{actual}:{BANK_PATH}"], cwd=repo, stderr=subprocess.DEVNULL,
        ))
    except (subprocess.CalledProcessError, ValueError) as error:
        raise SolutionError("The pinned canonical bank could not be read") from error


def paper_evidence(base, paper_id, approval):
    segments_bytes = (base / "02-segments/questions.json").read_bytes()
    if sha256(segments_bytes) != approval["officialKey"]["segmentsSha256"]:
        raise SolutionError("The paper segments changed. Review the current inputs")
    intake_folder = base / "01-intake"
    manifest_path = intake_folder / "paper.json"
    if not manifest_path.is_file():
        raise SolutionError("Run intake for the original paper PDF before preparing export")
    manifest_bytes = manifest_path.read_bytes()
    if sha256(manifest_bytes) != json.loads(segments_bytes).get("intakeSha256"):
        raise SolutionError("The original paper manifest does not match the reviewed segments")
    manifest = json.loads(manifest_bytes)
    source = manifest["source"]
    if manifest.get("paperId") != paper_id or source["kind"] != "pdf" or len(source["files"]) != 1:
        raise SolutionError("This dry run supports one original paper PDF")
    original = source["files"][0]
    source_root = (intake_folder / "source").resolve()
    path = (source_root / original["name"]).resolve()
    if (path.parent != source_root or not path.is_file()
            or load("intake").sha256_file(path) != original["sha256"]):
        raise SolutionError("The original paper PDF does not match the reviewed intake")
    return manifest["exam"], manifest["year"], original["sha256"]


def worked_explanation(draft):
    parts = [draft["keyIdea"].strip()]
    parts.extend(f"{index}. {step['text'].strip()}" for index, step in enumerate(draft["steps"], 1))
    for option in draft.get("optionCheck", []):
        parts.append(f"{option['option']} ({option['verdict']}). {option['why'].strip()}")
    if draft.get("trap"):
        parts.append(f"Common mistake. {draft['trap'].strip()}")
    if draft.get("fastTrack"):
        parts.append(f"Quicker method. {draft['fastTrack'].strip()}")
    explanation = "\n\n".join(parts)
    if len(explanation) > 8000:
        raise SolutionError("The worked explanation exceeds the bank's 8,000-character limit")
    return explanation


def shape_nodes(fragment, budget):
    root = ET.fromstring(f'<g xmlns="{SVG_NS}">{fragment}</g>')

    def convert(node, depth):
        tag = node.tag.removeprefix(f"{{{SVG_NS}}}")
        budget[0] -= 1
        if (tag not in SHAPES or depth > 4 or budget[0] < 0
                or any(name not in ATTRIBUTES or not SVG_VALUE.fullmatch(value) or "url" in value.lower()
                       for name, value in node.attrib.items())
                or (node.tail or "").strip()):
            raise SolutionError("The solution overlay uses unsupported drawing markup")
        label = (node.text or "").strip()
        if (label and tag != "text") or len(label) > 160 or (len(node) and tag != "g"):
            raise SolutionError("Use shape groups and short SVG labels in solution overlays")
        return {"tag": tag, "attrs": node.attrib,
                **({"text": label} if label else {}),
                **({"children": [convert(child, depth + 1) for child in node]} if len(node) else {})}

    if (root.text or "").strip():
        raise SolutionError("Place overlay labels inside SVG text elements")
    return [convert(node, 1) for node in root]


def visual_solution(draft, image_record):
    overlay = draft.get("overlay")
    if not overlay:
        return None, None
    figure = next(f["canonical"] for f in image_record["figures"] if f["id"] == overlay["figure"])
    referenced = {step["overlay"] for step in draft["steps"] if step.get("overlay")}
    if referenced != set(overlay["steps"]) or not referenced:
        raise SolutionError("Each solution overlay must correspond to a worked step")
    budget = [96]
    layers = {name: shape_nodes(fragment, budget) for name, fragment in overlay["steps"].items()}
    solution = {
        "version": 1, "figure": {name: figure[name] for name in ("sha256", "width", "height")},
        "keyIdea": draft["keyIdea"], "steps": [
            {"text": step["text"], "shapes": layers.pop(step.get("overlay"), [])} for step in draft["steps"]
        ],
    }
    if not any(step["shapes"] for step in solution["steps"]):
        raise SolutionError("Add a visible shape to at least one worked step")
    if len(json.dumps(solution, ensure_ascii=False).encode()) > 32000:
        raise SolutionError("The worked solution overlay exceeds the delivery size limit")
    return solution, figure


def question_options(question):
    if question["type"] == "NAT":
        return []
    options = [{"key": item["key"], "text": item["text"], "asset": None} for item in question["options"]]
    if not options and question.get("optionsInFigure"):
        options = [{"key": key, "text": "", "asset": None} for key in "ABCD"]
    if [option["key"] for option in options] != list("ABCD"):
        raise SolutionError("Review the complete A–D choices before preparing export")
    return options


def objective_answer(official):
    return {
        "raw": official["raw"], "status": "official-key",
        "source": {
            "name": official["source"]["name"], "sha256": official["source"]["sha256"],
            "page": official["page"], "printed": official["printed"], "readBy": official["readBy"],
        },
    }


def same_position(payload, provenance):
    candidate = payload.get("provenance", {})
    return all(str(candidate.get(field)) == str(provenance[field])
               for field in ("exam", "year", "paperId", "questionNo"))


def match_correction(current, question, options):
    def clean(text):
        return " ".join(text.split())

    source_labels = (current.get("sourceKind"), current.get("licence"))
    if (current.get("holds") != [] or source_labels not in SOURCE_CLASSIFICATIONS.values()
            or current.get("type") != question["type"]
            or clean(current.get("prompt") or "") != clean(question["prompt"])
            or [(o["key"], clean(o.get("text") or ""), o.get("asset")) for o in current.get("options", [])]
            != [(o["key"], clean(o["text"]), o["asset"]) for o in options]):
        raise SolutionError("The reviewed question does not match the eligible canonical question and choices")


def approved_assets(record):
    images = [figure["canonical"] for figure in record.get("figures", [])]
    if record.get("block"):
        images.append(record["block"])
    return {(image["sha256"], image["width"], image["height"]): image for image in images}


def stage_media(assets, available, figures_dir, downloads):
    downloads.mkdir(mode=0o700)
    for asset in assets:
        identity = (asset["sha256"], asset["width"], asset["height"])
        approved = available.get(identity)
        if not approved:
            raise SolutionError("The current canonical figures differ from the approved question")
        path = (figures_dir / approved["file"]).resolve()
        if not path.is_relative_to(figures_dir.resolve()) or not path.is_file():
            raise SolutionError("The reviewed canonical image is missing")
        image = path.read_bytes()
        if sha256(image) != asset["sha256"]:
            raise SolutionError("The reviewed canonical image changed")
        (downloads / f'{asset["sha256"]}.png').write_bytes(image)


def run_bank_prepare(args, repo):
    result = subprocess.run(["node", PREPARE, *args], cwd=repo, capture_output=True, text=True)
    if result.returncode:
        raise SolutionError(result.stderr.strip() or "Canonical bank preparation failed")
    return json.loads(result.stdout)


def prepare(*, work, paper_id, key, fingerprint, expected_source, rights_note, replace_expected=None, source_classification=None,
            repo=REPO, run_prepare=run_bank_prepare):
    if not QUESTION_KEY.fullmatch(key) or key.startswith("qb") or not DIGEST.fullmatch(fingerprint):
        raise SolutionError("Supply an objective question key and its reviewed SHA-256 fingerprint")
    if replace_expected is not None and not DIGEST.fullmatch(replace_expected):
        raise SolutionError("A correction needs the current canonical question's full SHA-256")
    if replace_expected is None and source_classification not in SOURCE_CLASSIFICATIONS:
        raise SolutionError("Choose the reviewed source classification for a new addition")
    if replace_expected is not None and source_classification is not None:
        raise SolutionError("Corrections retain their existing source classification")
    rights_note = rights_note.strip()
    if not 10 <= len(rights_note) <= 1000:
        raise SolutionError("Supply the reviewed source rights note (10 to 1,000 characters)")

    report, base, questions, figures, drafts = collect(work, paper_id, write_report=False)
    review = report["results"].get(key, {})
    if not review.get("eligibleForExport") or review.get("fingerprint") != fingerprint:
        raise SolutionError("A current human approval for the exact export fingerprint is required")
    exam, year, source_hash = paper_evidence(base, paper_id, review)
    question = questions[key]
    image_record = figures.get(key, {})
    number = str(question.get("printedNumber") or question.get("number") or "")
    if not number.isdecimal() or f"q{int(number)}" != key or question.get("flags"):
        raise SolutionError("Resolve the question number and segmentation flags before preparing export")
    if not 3 <= len(question["prompt"].strip()) <= 8000:
        raise SolutionError("Review the question wording before preparing export")
    page = (question.get("regions") or [{}])[0].get("page")
    if type(page) is not int or page < 1:
        raise SolutionError("The reviewed question needs a source page")

    solution = json.loads(drafts[key])
    explanation = worked_explanation(solution)
    worked_solution, overlay_figure = visual_solution(solution, image_record)
    options = question_options(question)
    external_key = f"{paper_id}-{key}"
    provenance = {
        "exam": exam, "year": year, "paperId": paper_id, "questionNo": number, "page": page,
        "sourceSha256": source_hash, "extraction": "paper-ingestion", "answerKeySource": review["officialKey"]["source"]["name"],
    }
    bank = read_bank(repo, expected_source)
    current = next((item for item in bank["questions"] if item["externalKey"] == external_key), None)
    visual = bool(question.get("figures") or question.get("vectorDrawings") or question.get("optionsInFigure")
                  or image_record.get("figures") or any(not o["text"].strip() for o in options))
    available = approved_assets(image_record)
    answer = objective_answer(review["officialKey"])
    evidence = {"fingerprint": fingerprint, "solutionSha256": sha256(drafts[key])}

    if replace_expected is not None:
        if (current is None or not same_position(current, provenance)
                or current["provenance"].get("sourceSha256") != source_hash):
            raise SolutionError("The correction needs a canonical record from the same original paper and question")
        match_correction(current, question, options)
        assets = current.get("assets", [])
        if visual and not assets:
            raise SolutionError("Existing canonical figures are required for a visual correction")
        if overlay_figure and not any(asset["sha256"] == overlay_figure["sha256"] for asset in assets):
            raise SolutionError("The correction's overlay must match an existing canonical figure")
        payload = {**current, "answer": answer, "explanation": explanation, "solutionReview": evidence}
        payload.pop("workedSolution", None)
    else:
        if current is not None or any(same_position(item, provenance) for item in bank["questions"]):
            raise SolutionError("This question already exists. Use the exact-version correction path")
        assets = []
        if visual:
            block = image_record.get("block")
            if not block:
                raise SolutionError("The reviewed source block is required for a visual question")
            assets.append({"role": "figure", "review": "approved", "path": f"ingestion/{external_key}.png",
                           **{field: block[field] for field in ("sha256", "width", "height")}})
            if overlay_figure and overlay_figure["sha256"] != block["sha256"]:
                assets.append({"role": "figure", "review": "approved", "path": f"ingestion/{external_key}-solution-figure.png",
                               **{field: overlay_figure[field] for field in ("sha256", "width", "height")}})
        source_kind, licence = SOURCE_CLASSIFICATIONS[source_classification]
        payload = {
            "externalKey": external_key, "type": question["type"], "prompt": question["prompt"], "options": options,
            "assets": assets, "answer": answer, "explanation": explanation, "solutionReview": evidence,
            "topic": solution["meta"]["topic"], "difficulty": solution["meta"]["difficulty"],
            "estimatedSeconds": solution["meta"]["seconds"], "visualDependency": visual,
            "display": "block" if assets else "text", "sourceKind": source_kind, "licence": licence,
            "holds": [], "provenance": provenance,
        }
    if worked_solution:
        payload["workedSolution"] = worked_solution

    payload_text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    payload_hash = sha256(payload_text.encode("utf-8"))
    packet = {
        "format": "dmocks-question-export-v1", "artifactId": str(uuid.uuid4()), "externalKey": external_key,
        "contentSha256": payload_hash, "payloadText": payload_text, "rightsNote": rights_note,
        "createdAt": datetime.now(timezone.utc).isoformat(), "sourceType": "pdf",
        "publicationState": "git-review-required",
    }
    with tempfile.TemporaryDirectory(prefix="dmocks-ingestion-") as directory:
        temporary = pathlib.Path(directory)
        downloads = temporary / "downloads"
        stage_media(assets, available, base / "03-figures", downloads)
        packet_path = temporary / "packet.json"
        packet_path.write_text(json.dumps(packet, ensure_ascii=False), encoding="utf-8")
        args = ["--packet", str(packet_path), "--expect", payload_hash, "--expect-source", expected_source,
                "--downloads-dir", str(downloads)]
        if replace_expected is not None:
            args.extend(["--replace-expect", replace_expected])
        result = run_prepare(args, repo)
        if result.get("mode") not in ("dry-run", "no-op") or (
                result["mode"] == "dry-run" and result.get("review") != "objective-complete"):
            raise SolutionError("The bank checks did not accept the objective question")
    return {**result, "externalKey": external_key, "reviewFingerprint": fingerprint,
            "operation": "correction" if replace_expected is not None else "addition"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paper_id")
    parser.add_argument("key")
    parser.add_argument("--work", required=True)
    parser.add_argument("--fingerprint", required=True)
    parser.add_argument("--expect-source", dest="expected_source", required=True)
    parser.add_argument("--replace-expect", dest="replace_expected")
    parser.add_argument("--source-classification", choices=SOURCE_CLASSIFICATIONS)
    parser.add_argument("--rights-note", required=True)
    try:
        result = prepare(**vars(parser.parse_args(argv)))
    except (SolutionError, OSError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
