#!/usr/bin/env python3
"""Build a topic-first, exam-neutral bank from reviewed source-paper records.

The official/source database is never destructively edited. This derived bank
omits descriptive questions and any picture question whose lossless PNG crop has
not been approved (`crop_review = 'approved'`), strips exam branding from
question-facing text, and retains provenance only in a private metadata block.
SVG reconstruction is optional and is not required for publication.
"""

import datetime
import json
import pathlib
import re
import sqlite3


ROOT = pathlib.Path(__file__).resolve().parents[1]
DB = ROOT / "server/data/dexam.sqlite"
OUTPUT = ROOT / "server/data/generic-question-bank.json"
NEEDS_KEY_OUTPUT = ROOT / "server/data/needs-answer-key-bank.json"
PART_B_OUTPUT = ROOT / "server/data/part-b-question-bank.json"
REPORT = ROOT / "server/data/sources/generic-bank-report.json"
READY_ANSWER_STATUSES = {
    "official-key", "matched-source", "matched-source-positional", "independently-solved"
}

EXAM_NAME_RE = re.compile(
    r"\b(?:U\.?C\.?E\.?E\.?D|C\.?E\.?E\.?D|N\.?I\.?F\.?T|N\.?I\.?D(?:\s+(?:UG|DAT))?)\b",
    re.I,
)
PAPER_NOISE_RE = re.compile(
    r"\b(?:question\s+paper|entrance\s+exam|official\s+paper)\b",
    re.I,
)
IMAGE_ONLY_RE = re.compile(r"image-only question|see page image", re.I)
# Same cue list as tools/regenerate_visual_questions.py, which crops every match.
# A match without a crop means the picture has not been isolated yet.
VISUAL_RE = re.compile(
    r"\b(image|image-only|figure|diagram|illustration|picture|photograph|photo|visual|map|"
    r"drawing|sketch|logo|symbol|shape|pattern|grid|graph|chart|cube|cuboid|polygon|object|"
    r"layout|plan|view|shown|above|below|observe|identify)\b",
    re.I,
)
MEDIA_MARKER = "server/data/media/"
TOPIC_RULES = {
    "Language": ["synonym", "antonym", "meaning", "word", "sentence", "grammar", "idiom", "phrase", "spelt", "spelling", "passage", "comprehension", "blank"],
    "Numerical Reasoning": ["calculate", "number", "ratio", "percent", "average", "profit", "loss", "distance", "speed", "area", "perimeter", "volume", "sum", "interest", "fraction", "equation"],
    "Analytical Reasoning": ["statement", "conclusion", "inference", "arrangement", "sequence", "series", "relation", "direction", "coded", "code", "logic", "odd one", "rank", "order"],
    "General Knowledge": ["country", "city", "capital", "award", "founded", "invented", "known as", "located", "museum", "organisation", "organization", "festival", "year"],
    "Design Awareness": ["design", "designer", "product", "brand", "logo", "usability", "interface", "sustainable", "prototype"],
    "Materials": ["material", "fabric", "textile", "fibre", "fiber", "wood", "metal", "plastic", "glass", "ceramic", "paper"],
    "Indian Culture": ["traditional", "craft", "folk", "temple", "saree", "handloom", "dance", "painting"],
    "Spatial Reasoning": ["cube", "cuboid", "fold", "rotation", "rotate", "mirror", "three-dimensional", "3d", "top view", "front view"],
}


def parse_json(value, fallback):
    try:
        return json.loads(value or "")
    except json.JSONDecodeError:
        return fallback


def clean_text(value):
    text = EXAM_NAME_RE.sub("", str(value or ""))
    text = PAPER_NOISE_RE.sub("", text)
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" *\n *", "\n", text)
    text = re.sub(r"\s+([,.;:?!])", r"\1", text)
    return text.strip(" -–—·\n\t")


def media_url(value):
    """Map a stored repository path to the URL server.js serves it from."""
    text = str(value or "").replace("\\", "/")
    index = text.find(MEDIA_MARKER)
    return "/media/" + text[index + len(MEDIA_MARKER):] if index >= 0 else text


def crop_blocker(figures, crop_review):
    """Return why a picture question's crop cannot be served yet, or None."""
    if any(not (ROOT / str(path)).is_file() for path in figures):
        return "visual-crop-file-missing"
    if crop_review == "rejected":
        return "visual-crop-rejected"
    if crop_review != "approved":
        return "visual-crop-awaiting-review"
    return None


def readiness_bucket(lane, reason, answer_ready):
    if lane == "ready":
        return "ready"
    if lane == "needs-answer-key":
        return "needsAnswerKey"
    if lane == "part-b":
        return "partB"
    if reason == "visual-crop-awaiting-review":
        return "readyOnceCropApproved" if answer_ready else "cropReviewAndAnswerKey"
    if reason in ("visual-crop-missing", "visual-crop-file-missing", "visual-crop-rejected"):
        return "needsCrop"
    if reason == "structured-options-missing":
        return "needsTranscription"
    return "excluded"


def infer_generic_topic(prompt, options):
    haystack = (prompt + " " + " ".join(str(item.get("text", "")) for item in options)).lower()
    scored = []
    for topic, terms in TOPIC_RULES.items():
        score = sum(1 for term in terms if term in haystack)
        if score:
            scored.append((score, topic))
    return max(scored)[1] if scored else "General Aptitude"


def main():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    rows = conn.execute(
        "SELECT q.*,p.exam_id,p.year FROM questions q JOIN papers p ON p.id=q.paper_id "
        "ORDER BY q.topic,q.paper_id,CAST(q.question_no AS INTEGER),q.question_no"
    ).fetchall()
    has_crop_review = "crop_review" in rows[0].keys() if rows else False
    included, needs_key, part_b, excluded = [], [], [], []
    readiness = {}

    def tally(row, lane, reason=None, answer_ready=False):
        exam = readiness.setdefault(row["exam_id"], {})
        kind_counts = exam.setdefault(str(row["question_type"] or "MCQ").upper(), {})
        bucket = readiness_bucket(lane, reason, answer_ready)
        kind_counts[bucket] = kind_counts.get(bucket, 0) + 1

    for row in rows:
        reason = None
        kind = str(row["question_type"] or "").upper()
        figures = parse_json(row["figure_paths_json"], [])
        prompt = str(row["prompt"] or "")
        options = parse_json(row["options_json"], [])
        crop_review = str(row["crop_review"] or "pending") if has_crop_review else "pending"
        answer_ready = bool(row["answer_key"]) and str(row["answer_status"] or "pending") in READY_ANSWER_STATUSES
        if kind == "DESCRIPTIVE":
            clean_prompt = clean_text(prompt)
            if clean_prompt:
                part_b.append({
                    "id": "part-b-" + row["id"],
                    "topic": clean_text(row["topic"] or "Drawing and Design") or "Drawing and Design",
                    "subtopic": clean_text(row["subtopic"]),
                    "type": "DESCRIPTIVE",
                    "difficulty": row["difficulty"] or "Unassessed",
                    "prompt": clean_prompt,
                    "figurePaths": [media_url(path) for path in figures],
                    "response": {
                        "mode": "upload",
                        "accept": ["image/jpeg", "image/png", "application/pdf"],
                        "maxFiles": 5,
                        "rubricStatus": "needs-review",
                    },
                    "reviewStatus": row["status"] or "review",
                    "_sourceId": row["id"],
                })
            reason = "descriptive-written"
            tally(row, "part-b" if clean_prompt else "excluded", reason)
        elif IMAGE_ONLY_RE.search(prompt):
            reason = "image-only-no-semantic-text"
        elif kind in ("MCQ", "MSQ") and len(options) < 2:
            reason = "structured-options-missing"
        elif not clean_text(prompt):
            reason = "empty-after-brand-removal"
        elif figures:
            reason = crop_blocker(figures, crop_review)
        elif VISUAL_RE.search(prompt):
            reason = "visual-crop-missing"
        if reason:
            if kind != "DESCRIPTIVE":
                tally(row, "excluded", reason, answer_ready)
            excluded.append({
                "sourceId": row["id"], "reason": reason, "answerReady": answer_ready,
                "hasFigure": bool(figures), "cropReview": crop_review if figures else None,
            })
            continue

        cleaned_options = []
        for option in options:
            text = clean_text(option.get("text", ""))
            if text:
                cleaned_options.append({"id": str(option.get("id", "")), "text": text})
        topic = clean_text(row["topic"] or "Unassigned") or "Unassigned"
        if topic == "Unassigned":
            topic = infer_generic_topic(prompt, options)
        question = {
            "id": "generic-" + row["id"],
            "topic": topic,
            "subtopic": clean_text(row["subtopic"]),
            "type": kind or "MCQ",
            "difficulty": row["difficulty"] or "Unassessed",
            "prompt": clean_text(prompt),
            "options": cleaned_options,
            "figurePaths": [media_url(path) for path in figures],
            "answer": row["answer_key"] or None,
            "answerStatus": row["answer_status"] or "pending",
            "explanation": clean_text(row["explanation"]),
            "reviewStatus": row["status"] or "review",
        }
        question["_sourceId"] = row["id"]
        if answer_ready:
            included.append(question)
            tally(row, "ready")
        else:
            question["queueReason"] = "answer-key-required"
            needs_key.append(question)
            tally(row, "needs-answer-key")

    public_questions = []
    public_needs_key = []
    public_part_b = []
    provenance = []
    source_by_id = {row["id"]: row for row in rows}
    for question in included:
        source_id = question.pop("_sourceId")
        source = source_by_id[source_id]
        public_questions.append(question)
        provenance.append({
            "genericId": question["id"],
            "sourceQuestionId": source_id,
            "sourcePaperId": source["paper_id"],
            "sourceQuestionNo": source["question_no"],
            "sourceYear": source["year"],
        })
    for question in needs_key:
        source_id = question.pop("_sourceId")
        source = source_by_id[source_id]
        public_needs_key.append(question)
        provenance.append({
            "genericId": question["id"], "sourceQuestionId": source_id,
            "sourcePaperId": source["paper_id"], "sourceQuestionNo": source["question_no"],
            "sourceYear": source["year"], "lane": "needs-answer-key",
        })
    for question in part_b:
        source_id = question.pop("_sourceId")
        source = source_by_id[source_id]
        public_part_b.append(question)
        provenance.append({
            "genericId": question["id"], "sourceQuestionId": source_id,
            "sourcePaperId": source["paper_id"], "sourceQuestionNo": source["question_no"],
            "sourceYear": source["year"], "lane": "part-b-upload",
        })
    included = public_questions
    topics = {}
    for question in included:
        topics.setdefault(question["topic"], []).append(question)
    payload = {
        "schemaVersion": 1,
        "generatedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "questionCount": len(included),
        "topicCount": len(topics),
        "topics": [
            {"name": name, "questionCount": len(questions), "questions": questions}
            for name, questions in sorted(topics.items(), key=lambda item: (-len(item[1]), item[0].lower()))
        ],
    }
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2))
    NEEDS_KEY_OUTPUT.write_text(json.dumps({
        "schemaVersion": 1, "generatedAt": payload["generatedAt"],
        "questionCount": len(public_needs_key), "questions": public_needs_key,
    }, ensure_ascii=False, indent=2))
    PART_B_OUTPUT.write_text(json.dumps({
        "schemaVersion": 1, "generatedAt": payload["generatedAt"],
        "questionCount": len(public_part_b), "questions": public_part_b,
    }, ensure_ascii=False, indent=2))
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    reason_counts = {}
    for item in excluded:
        reason_counts[item["reason"]] = reason_counts.get(item["reason"], 0) + 1
    REPORT.write_text(json.dumps({
        "generatedAt": payload["generatedAt"],
        "included": len(included),
        "needsAnswerKey": len(public_needs_key),
        "partBUpload": len(public_part_b),
        "excluded": len(excluded),
        "excludedByReason": reason_counts,
        "cropReviewQueue": sum(1 for item in excluded if item["reason"] == "visual-crop-awaiting-review"),
        "readiness": readiness,
        "excludedQuestions": excluded,
        "privateProvenance": provenance,
        "topics": {name: len(questions) for name, questions in topics.items()},
    }, ensure_ascii=False, indent=2))
    print(json.dumps({
        "output": str(OUTPUT),
        "report": str(REPORT),
        "included": len(included),
        "needsAnswerKey": len(public_needs_key),
        "partBUpload": len(public_part_b),
        "excluded": len(excluded),
        "topics": len(topics),
        "excludedByReason": reason_counts,
        "cropReviewQueue": sum(1 for item in excluded if item["reason"] == "visual-crop-awaiting-review"),
    }))
    conn.close()


if __name__ == "__main__":
    main()
