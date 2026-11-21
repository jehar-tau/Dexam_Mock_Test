"""Fictional intake and bank records for the stage 7 dry-run bridge."""

import copy
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest
from PIL import Image

from test_solutions import HERE, NAT, PAPER, build_work

sys.path.insert(0, str(HERE))
import export
import solutions


class ExportTest(unittest.TestCase):
    def setUp(self):
        temporary = tempfile.TemporaryDirectory()
        self.addCleanup(temporary.cleanup)
        root = pathlib.Path(temporary.name)
        self.work = root / "private"
        self.base = build_work(self.work)
        self.repo = root / "bank"
        self.repo.mkdir()
        self.git("init", "-q")
        self.git("config", "user.name", "Fictional fixture")
        self.git("config", "user.email", "fictional@example.invalid")

        intake_path = self.base / "01-intake/paper.json"
        self.original = intake_path.parent / "source/fictional-paper.pdf"
        self.original.parent.mkdir(parents=True)
        self.original.write_bytes(b"Fictional question paper")
        self.source_hash = solutions.sha256(self.original.read_bytes())
        intake_path.write_text(json.dumps({"paperId": PAPER, "exam": "uceed", "year": 2031,
                                           "source": {"kind": "pdf", "files": [
                                               {"name": self.original.name, "sha256": self.source_hash}
                                           ]}}))

        segments_path = self.base / "02-segments/questions.json"
        segments = json.loads(segments_path.read_text())
        self.question = segments["questions"][0]
        self.question.update({"number": 1, "regions": [{"page": 2}]})
        segments["intakeSha256"] = solutions.sha256(intake_path.read_bytes())
        segments_path.write_text(json.dumps(segments))
        for relative in ("03-figures/figures.json", "04-key/key.json"):
            path = self.base / relative
            manifest = json.loads(path.read_text())
            manifest["segmentsSha256"] = solutions.sha256(segments_path.read_bytes())
            path.write_text(json.dumps(manifest))
        self.draft = copy.deepcopy(NAT)
        self.draft.pop("overlay")
        for step in self.draft["steps"]:
            step.pop("overlay")
        self.save_draft()
        self.pin_bank([])
        self.payload = None

    def git(self, *args):
        return subprocess.check_output(["git", *args], cwd=self.repo, text=True).strip()

    def pin_bank(self, questions):
        bank = self.repo / export.BANK_PATH
        bank.parent.mkdir(parents=True, exist_ok=True)
        bank.write_text(json.dumps({"schemaVersion": 1, "questions": questions}, indent=1) + "\n")
        self.git("add", export.BANK_PATH)
        self.git("commit", "-qm", "Create fictional bank snapshot")
        self.source_commit = self.git("rev-parse", "HEAD")
        self.git("update-ref", "refs/remotes/origin/main", self.source_commit)

    def save_draft(self):
        (self.base / "05-solutions/q1.json").write_text(json.dumps(self.draft))

    def approve(self):
        fingerprint = solutions.check(self.work, PAPER)["results"]["q1"]["fingerprint"]
        solutions.approve(self.work, PAPER, "q1", "Fictional reviewer", fingerprint)
        return fingerprint

    def existing(self):
        figure = json.loads((self.base / "03-figures/figures.json").read_text())["questions"][0]["figures"][0]["canonical"]
        return {
            "externalKey": f"{PAPER}-q1", "type": "NAT", "sourceKind": "official", "licence": "official-unlicensed",
            "prompt": self.question["prompt"], "options": [], "holds": [],
            "provenance": {"exam": "uceed", "year": 2031, "paperId": PAPER, "questionNo": "1",
                           "sourceSha256": self.source_hash, "existingSourceLabel": "preserve this"},
            "answer": {"raw": "13", "status": "official-key"}, "explanation": None, "topic": "retain",
            "visualDependency": True, "assets": [
                {"path": "fictional/canonical.png", **{field: figure[field] for field in ("width", "height", "sha256")}},
            ],
        }

    def fake_prepare(self, args, repo):
        self.args = args
        self.packet_path = pathlib.Path(args[args.index("--packet") + 1])
        self.packet = json.loads(self.packet_path.read_text())
        self.payload = json.loads(self.packet["payloadText"])
        self.assertEqual(self.repo, repo)
        persistent = "--output" in args
        self.assertEqual(args[args.index("--expect") + 1], solutions.sha256(self.packet["payloadText"].encode()))
        self.assertEqual("git-review-required", self.packet["publicationState"])
        downloads = pathlib.Path(args[args.index("--downloads-dir") + 1])
        for asset in self.payload["assets"]:
            staged = downloads / f'{asset["sha256"]}.png'
            if not staged.exists():
                self.assertIn("--media-root", args)
                staged = pathlib.Path(args[args.index("--media-root") + 1]) / asset["path"]
            self.assertEqual(asset["sha256"], solutions.sha256(staged.read_bytes()))
        return {"mode": "staged" if persistent else "dry-run", "review": "objective-complete"}

    def export(self, fingerprint, **kwargs):
        if "replace_expected" not in kwargs:
            kwargs.setdefault("source_classification", "official-unlicensed")
        return export.prepare(work=self.work, repo=self.repo, paper_id=PAPER, key="q1", fingerprint=fingerprint,
                              rights_note="Fictional source rights reviewed", expected_source=self.source_commit,
                              run_prepare=self.fake_prepare, **kwargs)

    def test_addition_uses_key_evidence_and_discards_temporary_packet(self):
        self.fictional_block()
        fingerprint = self.approve()
        before = {path: path.read_bytes() for path in self.base.rglob("*") if path.is_file()}
        result = self.export(fingerprint)
        self.assertEqual(("dry-run", "addition"), (result["mode"], result["operation"]))
        self.assertEqual("12", self.payload["answer"]["raw"])
        self.assertEqual("fictional-key.pdf", self.payload["answer"]["source"]["name"])
        self.assertEqual(2, self.payload["provenance"]["page"])
        self.assertIn("3 × 4 = 12", self.payload["explanation"])
        self.assertEqual("block", self.payload["display"])
        self.assertEqual(fingerprint, self.payload["solutionReview"]["fingerprint"])
        self.assertFalse(self.packet_path.exists())
        self.assertEqual(before, {path: path.read_bytes() for path in self.base.rglob("*") if path.is_file()})
        self.assertEqual("", self.git("status", "--short"))

    def test_staged_export_passes_the_private_output_directory_to_bank_preparer(self):
        self.fictional_block()
        output = self.work / "approved-export"
        result = self.export(self.approve(), output=output)
        self.assertEqual("staged", result["mode"])
        self.assertEqual(str(output), self.args[self.args.index("--output") + 1])
        self.assertFalse(self.packet_path.exists())

    def test_staged_export_rejects_a_dry_run_result(self):
        self.fictional_block()
        fingerprint = self.approve()

        def mismatched(args, repo):
            self.fake_prepare(args, repo)
            return {"mode": "dry-run", "review": "objective-complete"}

        with self.assertRaisesRegex(solutions.SolutionError, "bank checks did not accept"):
            export.prepare(work=self.work, repo=self.repo, paper_id=PAPER, key="q1", fingerprint=fingerprint,
                           rights_note="Fictional source rights reviewed", expected_source=self.source_commit,
                           source_classification="official-unlicensed", output=self.work / "approved-export",
                           run_prepare=mismatched)

    def test_addition_uses_only_explicit_reviewed_source_labels(self):
        self.fictional_block()
        fingerprint = self.approve()
        with self.assertRaisesRegex(solutions.SolutionError, "reviewed source classification"):
            self.export(fingerprint, source_classification=None)
        self.export(fingerprint, source_classification="owner-authorized")
        self.assertEqual(("owner_authorized", "owner-provided"), (self.payload["sourceKind"], self.payload["licence"]))

    def fictional_block(self):
        path = self.base / "03-figures/figures.json"
        figures = json.loads(path.read_text())
        figures["questions"][0]["block"] = figures["questions"][0]["figures"][0]["canonical"]
        path.write_text(json.dumps(figures))

    def test_export_requires_current_approval(self):
        with self.assertRaisesRegex(solutions.SolutionError, "current human approval"):
            self.export("a" * 64)
        fingerprint = self.approve()
        self.draft["steps"][0]["text"] = "A changed step"
        self.save_draft()
        with self.assertRaisesRegex(solutions.SolutionError, "current human approval"):
            self.export(fingerprint)
        self.assertIsNone(self.payload)

    def test_numeric_range_stays_in_the_official_bank_key(self):
        self.fictional_block()
        path = self.base / "04-key/key.json"
        official = json.loads(path.read_text())
        official["keys"]["q1"].update(raw="11.5 to 12.5", printed="11.5 - 12.5")
        path.write_text(json.dumps(official))
        self.export(self.approve())
        self.assertEqual("11.5 to 12.5", self.payload["answer"]["raw"])
        self.assertEqual("11.5 - 12.5", self.payload["answer"]["source"]["printed"])

    def test_existing_paper_position_cannot_be_added_under_another_key(self):
        self.fictional_block()
        current = self.existing()
        current["externalKey"] = "fictional-legacy-key"
        current["provenance"]["sourceSha256"] = "c" * 64
        self.pin_bank([current])
        with self.assertRaisesRegex(solutions.SolutionError, "already exists"):
            self.export(self.approve())

    def test_rejects_changed_original_paper_and_stale_bank_pin(self):
        self.fictional_block()
        fingerprint = self.approve()
        current_commit = self.source_commit
        self.pin_bank([self.existing()])
        self.source_commit = current_commit
        with self.assertRaisesRegex(solutions.SolutionError, "does not match the expected"):
            self.export(fingerprint)
        self.original.write_bytes(b"Changed original")
        with self.assertRaisesRegex(solutions.SolutionError, "does not match the reviewed intake"):
            self.export(fingerprint)

    def test_correction_preserves_question_and_passes_exact_target_digest(self):
        current = self.existing()
        current.update(sourceKind="owner_authorized", licence="owner-provided")
        self.pin_bank([current])
        fingerprint = self.approve()
        version = "a" * 64
        with self.assertRaisesRegex(solutions.SolutionError, "already exists"):
            self.export(fingerprint)
        with self.assertRaisesRegex(solutions.SolutionError, "retain their existing source classification"):
            self.export(fingerprint, replace_expected=version, source_classification="official-unlicensed")
        result = self.export(fingerprint, replace_expected=version)
        self.assertEqual("correction", result["operation"])
        self.assertEqual(version, self.args[self.args.index("--replace-expect") + 1])
        self.assertEqual("12", self.payload["answer"]["raw"])
        for key in ("provenance", "licence", "sourceKind", "type", "prompt", "options", "assets", "topic"):
            self.assertEqual(current[key], self.payload[key])

    def test_correction_rejects_different_prompt_or_unreviewed_figure(self):
        current = self.existing()
        current["prompt"] = "A different question"
        self.pin_bank([current])
        fingerprint = self.approve()
        with self.assertRaisesRegex(solutions.SolutionError, "does not match the eligible canonical question"):
            self.export(fingerprint, replace_expected="b" * 64)
        current["prompt"] = self.question["prompt"]
        current["assets"][0]["sha256"] = "c" * 64
        self.pin_bank([current])
        with self.assertRaisesRegex(solutions.SolutionError, "existing canonical media root"):
            self.export(fingerprint, replace_expected="b" * 64)

    def test_correction_keeps_the_legacy_block_and_adds_a_solution_only_figure(self):
        legacy = self.base / "legacy-block.png"
        Image.new("RGB", (400, 200), "black").save(legacy)
        current = self.existing()
        current["assets"][0].update(sha256=solutions.sha256(legacy.read_bytes()))
        self.pin_bank([current])
        media_root = self.work / "canonical-media"
        old_media = media_root / current["assets"][0]["path"]
        old_media.parent.mkdir(parents=True)
        old_media.write_bytes(legacy.read_bytes())
        self.draft = copy.deepcopy(NAT)
        self.save_draft()
        fingerprint = self.approve()
        self.export(fingerprint, replace_expected="b" * 64, media_root=media_root)
        self.assertEqual(current["assets"][0], self.payload["assets"][0])
        solution_asset = self.payload["assets"][1]
        self.assertEqual("solution", solution_asset["role"])
        self.assertEqual(self.payload["workedSolution"]["figure"]["sha256"], solution_asset["sha256"])
        self.assertEqual(2, len(self.payload["assets"]))
        self.assertIn("--media-root", self.args)

    def test_new_paper_keeps_its_solution_figure_separate_from_question_media(self):
        block_path = self.base / "03-figures/q1/block.png"
        Image.new("RGB", (400, 200), "black").save(block_path)
        path = self.base / "03-figures/figures.json"
        figures = json.loads(path.read_text())
        figures["questions"][0]["block"] = {
            "file": "q1/block.png", "sha256": solutions.sha256(block_path.read_bytes()),
            "width": 400, "height": 200,
        }
        path.write_text(json.dumps(figures))
        self.draft = copy.deepcopy(NAT)
        self.save_draft()
        self.export(self.approve())
        self.assertEqual(["figure", "solution"], [asset["role"] for asset in self.payload["assets"]])
        self.assertEqual(self.payload["workedSolution"]["figure"]["sha256"], self.payload["assets"][1]["sha256"])

    def test_overlay_is_bound_to_the_reviewed_png_and_preserves_each_step(self):
        self.fictional_block()
        self.draft = copy.deepcopy(NAT)
        self.save_draft()
        self.export(self.approve())
        worked = self.payload["workedSolution"]
        self.assertEqual(self.payload["assets"][0]["sha256"], worked["figure"]["sha256"])
        self.assertEqual("rect", worked["steps"][0]["shapes"][0]["tag"])
        self.assertEqual("12", worked["steps"][1]["shapes"][0]["text"])
        self.assertIn("3 × 4 = 12", self.payload["explanation"])

    def test_worked_packet_refuses_unrendered_overlay_content(self):
        self.fictional_block()
        self.draft = copy.deepcopy(NAT)
        self.draft["overlay"]["steps"]["total"] = '<text x="4"><tspan>12</tspan></text>'
        self.save_draft()
        with self.assertRaisesRegex(solutions.SolutionError, "shape groups and short SVG labels"):
            self.export(self.approve())

    def test_incomplete_objective_result_is_a_refusal(self):
        self.fictional_block()
        with self.assertRaisesRegex(solutions.SolutionError, "did not accept"):
            export.prepare(work=self.work, repo=self.repo, paper_id=PAPER, key="q1", fingerprint=self.approve(),
                           rights_note="Fictional source rights reviewed", expected_source=self.source_commit,
                           source_classification="official-unlicensed",
                           run_prepare=lambda *_: {"mode": "dry-run", "review": "objective-incomplete"})
