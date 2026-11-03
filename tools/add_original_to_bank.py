#!/usr/bin/env python3
"""Adds the original NIFT drills from practice-batch-4.js to dexam-bank-machine-readable.json so they
can be reviewed in the Question Bank Viewer. Safe to re-run: earlier entries are replaced.
Usage: python3 tools/add_original_to_bank.py"""
import json, pathlib, subprocess

ROOT = pathlib.Path(__file__).resolve().parent.parent
PAPER_ID = "nift-original-batch-4"
BANK = ROOT / "dexam-bank-machine-readable.json"

drills = json.loads(subprocess.run(
    ["node", "-e", "global.window={PRACTICE_BANK:[],MOCK_PAPERS:[]};require('./practice-batch-4.js');console.log(JSON.stringify(window.PRACTICE_BANK))"],
    cwd=ROOT, capture_output=True, text=True, check=True).stdout)

bank = json.loads(BANK.read_text())
bank["questions"] = [q for q in bank["questions"] if q["paper_id"] != PAPER_ID]
for i, d in enumerate(drills, 1):
    bank["questions"].append({
        "id": f"{PAPER_ID}-q{i}", "exam": "NIFT", "paper_id": PAPER_ID, "question_no": str(i), "type": "MCQ",
        "question_text": d["prompt"],
        "options": [{"position": o["id"], "text": o["text"]} for o in d["options"]],
        "figure_image": None, "answer_key": d["correctAnswer"], "answer_status": "original-authored",
        "source_paper": "NIFT Original (Dexam)"})
exams = {}
for q in bank["questions"]:
    exams[q["exam"]] = exams.get(q["exam"], 0) + 1
bank["summary"] = {"total_questions": len(bank["questions"]), "exams": exams}
BANK.write_text(json.dumps(bank, indent=2))
print("added", len(drills), "total", len(bank["questions"]), exams)
