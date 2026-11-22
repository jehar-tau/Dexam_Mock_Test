"""Fictional intake and bank records for the stage 7 dry-run bridge."""

import copy
import hashlib
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
import export_batch
import intake
import solutions
from test_solutions import MSQ


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
        intake_path.write_text(json.dumps({"paperId": PAPER, "stage": "01-intake", "exam": "uceed", "year": 2031,
                                           "source": {"kind": "pdf", "files": [
                                               {"name": self.original.name, "sha256": self.source_hash}
                                           ]}}))

        self.bind_intake()
        self.draft = copy.deepcopy(NAT)
        self.draft.pop("overlay")
        for step in self.draft["steps"]:
            step.pop("overlay")
        self.save_draft()
        self.pin_bank([])
        self.payload = None

    def bind_intake(self):
        intake_path = self.base / "01-intake/paper.json"
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

    def use_ordered_photos(self):
        photos = [self.work / name for name in ("z-first.jpg", "a-second.jpg")]
        for photo, color in zip(photos, ("white", "black")):
            Image.new("RGB", (20, 20), color).save(photo)
        intake.run_intake(exam="uceed", year=2031, work=self.work, paper_id=PAPER,
                          photos=photos, replace=True)
        self.bind_intake()
        self.fictional_block()
        return photos

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

    def owner_adjudicate(self, *, with_overlay=False):
        self.fictional_block()
        if with_overlay:
            self.draft = copy.deepcopy(NAT)
        self.draft["answer"]["source"] = "model-proposed"
        self.save_draft()
        (self.base / "04-key/key.json").unlink()
        (self.base / "04-key/source/fictional-key.pdf").unlink()
        fingerprint = solutions.check(self.work, PAPER)["results"]["q1"]["adjudicationFingerprint"]
        solutions.adjudicate(self.work, PAPER, "q1", "Fictional owner", fingerprint, "12.0",
                             "Four groups of three make twelve.")
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

    def run_fixture_preparer(self, options):
        script = (HERE.parent / "scripts/prepare-question-bank-addition.mjs").as_uri()
        code = ("const {prepareAdditions}=await import(process.argv[1]);"
                "let input='';for await(const chunk of process.stdin)input+=chunk;"
                "console.log(JSON.stringify(await prepareAdditions(JSON.parse(input))))")
        result = subprocess.run(["node", "--input-type=module", "-e", code, script],
                                input=json.dumps(options), text=True, cwd=self.repo,
                                capture_output=True)
        self.assertEqual(0, result.returncode, result.stderr)
        return json.loads(result.stdout)

    def export(self, fingerprint, **kwargs):
        if "replace_expected" not in kwargs:
            kwargs.setdefault("source_classification", "official-unlicensed")
        run_prepare = kwargs.pop("run_prepare", self.fake_prepare)
        return export.prepare(work=self.work, repo=self.repo, paper_id=PAPER, key="q1", fingerprint=fingerprint,
                              rights_note="Fictional source rights reviewed", expected_source=self.source_commit,
                              run_prepare=run_prepare, **kwargs)

    def test_addition_uses_key_evidence_and_discards_temporary_packet(self):
        self.fictional_block()
        fingerprint = self.approve()
        before = {path: path.read_bytes() for path in self.base.rglob("*") if path.is_file()}
        result = self.export(fingerprint)
        self.assertEqual(("dry-run", "addition"), (result["mode"], result["operation"]))
        self.assertEqual("12", self.payload["answer"]["raw"])
        self.assertEqual("fictional-key.pdf", self.payload["answer"]["source"]["name"])
        self.assertEqual(2, self.payload["provenance"]["page"])
        self.assertEqual(self.source_hash, self.payload["provenance"]["sourceSha256"])
        self.assertEqual("pdf", self.packet["sourceType"])
        self.assertIn("3 × 4 = 12", self.payload["explanation"])
        self.assertEqual("block", self.payload["display"])
        self.assertEqual(fingerprint, self.payload["solutionReview"]["fingerprint"])
        self.assertFalse(self.packet_path.exists())
        self.assertEqual(before, {path: path.read_bytes() for path in self.base.rglob("*") if path.is_file()})
        self.assertEqual("", self.git("status", "--short"))

    def test_photo_addition_uses_ordered_originals_and_invalidates_reordered_approval(self):
        photos = self.use_ordered_photos()
        fingerprint = self.approve()
        self.export(fingerprint)
        digest = self.payload["provenance"]["sourceSha256"]
        expected = hashlib.sha256(b"dmocks-paper-photos-v1\n" + b"\n".join(
            hashlib.sha256(photo.read_bytes()).hexdigest().encode() for photo in photos
        )).hexdigest()
        self.assertEqual(expected, digest)
        self.assertEqual("photo", self.packet["sourceType"])
        self.assertEqual(2, self.payload["provenance"]["page"])

        intake.run_intake(exam="uceed", year=2031, work=self.work, paper_id=PAPER,
                          photos=list(reversed(photos)), replace=True)
        self.bind_intake()
        with self.assertRaisesRegex(solutions.SolutionError, "current human approval"):
            self.export(fingerprint)
        self.export(self.approve())
        self.assertNotEqual(digest, self.payload["provenance"]["sourceSha256"])

    def test_canonical_preparer_stages_a_reviewed_photo_packet(self):
        self.use_ordered_photos()
        output = self.work / "photo-export"

        def verify(args, repo):
            self.fake_prepare(args, repo)
            return self.run_fixture_preparer({
                "packets": [{"packetPath": str(self.packet_path), "expected": self.packet["contentSha256"]}],
                "expectedSource": self.source_commit, "cwd": str(self.repo),
                "downloadsDir": args[args.index("--downloads-dir") + 1],
                "output": str(output),
            })

        result = self.export(self.approve(), output=output, run_prepare=verify)
        self.assertEqual("staged", result["mode"])
        staged = json.loads((output / "dexam-bank-export.json").read_text())
        self.assertEqual(self.payload["provenance"], staged["questions"][0]["provenance"])

    def test_photo_export_checks_unreferenced_original_size_digest_and_path(self):
        photos = self.use_ordered_photos()
        original = self.base / "01-intake/source" / photos[0].name
        data = original.read_bytes()
        fingerprint = self.approve()
        with self.subTest("same-size content mutation"):
            original.write_bytes(data[:-1] + bytes([data[-1] ^ 1]))
            with self.assertRaisesRegex(solutions.SolutionError, "original page photo does not match"):
                self.export(fingerprint)
        with self.subTest("wrong recorded size with matching digest"):
            original.write_bytes(data)
            intake_path = self.base / "01-intake/paper.json"
            manifest = json.loads(intake_path.read_text())
            manifest["source"]["files"][0]["bytes"] += 1
            intake_path.write_text(json.dumps(manifest))
            self.bind_intake()
            with self.assertRaisesRegex(solutions.SolutionError, "original page photo does not match"):
                self.export(self.approve())
            manifest["source"]["files"][0]["bytes"] -= 1
            intake_path.write_text(json.dumps(manifest))
            self.bind_intake()
        with self.subTest("source symlink with matching bytes"):
            original.unlink()
            original.symlink_to(photos[0])
            with self.assertRaisesRegex(solutions.SolutionError, "original page photo does not match"):
                self.export(self.approve())

    def test_photo_correction_requires_exact_canonical_source_digest(self):
        self.use_ordered_photos()
        current = self.existing()
        fingerprint = self.approve()
        self.export(fingerprint)
        photo_digest = self.payload["provenance"]["sourceSha256"]
        self.pin_bank([current])
        with self.assertRaisesRegex(solutions.SolutionError, "same original paper and question"):
            self.export(fingerprint, replace_expected="b" * 64)

        current["provenance"]["sourceSha256"] = photo_digest
        self.pin_bank([current])
        result = self.export(fingerprint, replace_expected="b" * 64)
        self.assertEqual("correction", result["operation"])
        self.assertEqual(current["provenance"], self.payload["provenance"])
        self.assertEqual("photo", self.packet["sourceType"])

    def test_owner_adjudication_stays_private(self):
        self.fictional_block()
        self.draft["answer"]["source"] = "model-proposed"
        self.save_draft()
        (self.base / "04-key/key.json").unlink()
        (self.base / "04-key/source/fictional-key.pdf").unlink()
        proposed = solutions.check(self.work, PAPER)["results"]["q1"]
        fingerprint = proposed["adjudicationFingerprint"]
        solutions.adjudicate(self.work, PAPER, "q1", "Owner", fingerprint, "12", "There are four groups of three.")
        output = self.work / "keyless-export"
        with self.assertRaisesRegex(export.SolutionError, "current human approval"):
            self.export(fingerprint, output=output)
        self.assertIsNone(self.payload)
        self.assertFalse(output.exists())

    def test_owner_adjudication_prepares_new_addition_without_private_review_notes(self):
        fingerprint = self.owner_adjudicate()
        result = self.export(fingerprint, owner_adjudicated=True)
        self.assertEqual(("dry-run", "addition"), (result["mode"], result["operation"]))
        self.assertEqual({"raw": "12", "status": "owner-adjudicated"}, self.payload["answer"])
        self.assertEqual({"fingerprint": fingerprint, "solutionSha256": solutions.sha256(
            (self.base / "05-solutions/q1.json").read_bytes()), "decision": "owner-adjudicated"},
            self.payload["solutionReview"])
        self.assertNotIn("answerKeySource", self.payload["provenance"])
        self.assertNotIn("Fictional owner", self.packet["payloadText"])
        self.assertNotIn("Four groups of three make twelve", self.packet["payloadText"])

    def test_owner_adjudication_stages_through_canonical_preparer(self):
        fingerprint = self.owner_adjudicate(with_overlay=True)
        output = self.work / "adjudicated-output"

        def canonical(args, repo):
            self.fake_prepare(args, repo)
            options = {"packets": [{"packetPath": str(self.packet_path),
                                    "expected": self.packet["contentSha256"]}],
                       "expectedSource": self.source_commit, "cwd": str(self.repo),
                       "downloadsDir": args[args.index("--downloads-dir") + 1], "output": str(output)}
            script = (HERE.parent / "scripts/prepare-question-bank-addition.mjs").as_uri()
            code = ("const {prepareAdditions}=await import(process.argv[1]);"
                    "let input='';for await(const chunk of process.stdin)input+=chunk;"
                    "console.log(JSON.stringify(await prepareAdditions(JSON.parse(input))))")
            result = subprocess.run(["node", "--input-type=module", "-e", code, script],
                                    input=json.dumps(options), text=True, cwd=self.repo,
                                    capture_output=True, check=True)
            return json.loads(result.stdout)

        result = self.export(fingerprint, owner_adjudicated=True, output=output, run_prepare=canonical)
        self.assertEqual(("staged", "objective-complete"), (result["mode"], result["review"]))
        staged = json.loads((output / "dexam-bank-export.json").read_text())
        self.assertEqual("owner-adjudicated", staged["questions"][0]["answer"]["status"])
        self.assertEqual(2, len(staged["questions"][0]["workedSolution"]["steps"]))
        self.assertTrue((output / "receipt.json").is_file())

    def test_ordered_photo_owner_adjudication_stages_with_original_source_digest(self):
        photos = self.use_ordered_photos()
        fingerprint = self.owner_adjudicate(with_overlay=True)
        output = self.work / "photo-adjudicated-output"

        def canonical(args, repo):
            self.fake_prepare(args, repo)
            return self.run_fixture_preparer({
                "packets": [{"packetPath": str(self.packet_path), "expected": self.packet["contentSha256"]}],
                "expectedSource": self.source_commit, "cwd": str(self.repo),
                "downloadsDir": args[args.index("--downloads-dir") + 1],
                "output": str(output),
            })

        result = self.export(fingerprint, owner_adjudicated=True, output=output, run_prepare=canonical)
        self.assertEqual(("staged", "objective-complete"), (result["mode"], result["review"]))
        staged = json.loads((output / "dexam-bank-export.json").read_text())["questions"][0]
        source_digest = hashlib.sha256(b"dmocks-paper-photos-v1\n" + b"\n".join(
            hashlib.sha256(photo.read_bytes()).hexdigest().encode() for photo in photos
        )).hexdigest()
        self.assertEqual(source_digest, staged["provenance"]["sourceSha256"])
        self.assertEqual("photo", self.packet["sourceType"])
        self.assertEqual("owner-adjudicated", staged["answer"]["status"])
        self.assertNotIn("answerKeySource", staged["provenance"])
        self.assertNotIn("Fictional owner", self.packet["payloadText"])

    def test_owner_adjudication_export_rejects_stale_evidence_and_corrections(self):
        fingerprint = self.owner_adjudicate()
        with self.assertRaisesRegex(export.SolutionError, "new additions"):
            self.export(fingerprint, owner_adjudicated=True, replace_expected="a" * 64)
        original = self.original.read_bytes()
        self.original.write_bytes(b"Changed fictional source")
        with self.assertRaisesRegex(export.SolutionError, "current owner adjudication"):
            self.export(fingerprint, owner_adjudicated=True)
        self.original.write_bytes(original)
        self.draft["keyIdea"] += " Check each row."
        self.save_draft()
        with self.assertRaisesRegex(export.SolutionError, "current owner adjudication"):
            self.export(fingerprint, owner_adjudicated=True)

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

    def second_question(self):
        segments_path = self.base / "02-segments/questions.json"
        segments = json.loads(segments_path.read_text())
        second = segments["questions"][1]
        second.update({"number": 2, "regions": [{"page": 3}]})
        segments_path.write_text(json.dumps(segments))
        for relative in ("03-figures/figures.json", "04-key/key.json"):
            path = self.base / relative
            manifest = json.loads(path.read_text())
            manifest["segmentsSha256"] = solutions.sha256(segments_path.read_bytes())
            path.write_text(json.dumps(manifest))
        (self.base / "05-solutions/q2.json").write_text(json.dumps(MSQ))
        return second

    def run_canonical_batch(self, args, repo):
        self.assertEqual(self.repo, repo)
        options = {
            "packets": [{"packetPath": args[index + 1], "expected": args[args.index("--expect", index) + 1]}
                        for index, item in enumerate(args) if item == "--packet"],
            "expectedSource": args[args.index("--expect-source") + 1], "cwd": str(repo),
            "downloadsDir": args[args.index("--downloads-dir") + 1],
        }
        versions = [args[index + 1] for index, item in enumerate(args) if item == "--replace-expect"]
        if versions:
            options["replaceExpecteds"] = versions
        if "--output" in args:
            options["output"] = args[args.index("--output") + 1]
        script = (HERE.parent / "scripts/prepare-question-bank-addition.mjs").as_uri()
        code = ("const {prepareAdditions}=await import(process.argv[1]);"
                "let input='';for await(const chunk of process.stdin)input+=chunk;"
                "console.log(JSON.stringify(await prepareAdditions(JSON.parse(input))))")
        result = subprocess.run(["node", "--input-type=module", "-e", code, script],
                                input=json.dumps(options), text=True, cwd=repo,
                                capture_output=True, check=True)
        return json.loads(result.stdout)

    def addition_entries(self):
        self.fictional_block()
        self.second_question()
        report = solutions.check(self.work, PAPER)["results"]
        entries = []
        for key in ("q1", "q2"):
            fingerprint = report[key]["fingerprint"]
            solutions.approve(self.work, PAPER, key, "Fictional reviewer", fingerprint)
            entries.append({"key": key, "fingerprint": fingerprint})
        return entries

    def addition_batch(self, entries, **kwargs):
        return export_batch.prepare_batch(
            work=self.work, paper_id=PAPER, entries=entries,
            expected_source=self.source_commit, rights_note="Fictional source rights reviewed",
            source_classification="owner-authorized", repo=self.repo, **kwargs,
        )

    def test_batch_stages_two_new_approved_additions_with_verified_media(self):
        entries = self.addition_entries()
        output = self.work / "batch-output"
        result = self.addition_batch(entries, output=output, run_prepare=self.run_canonical_batch)
        self.assertEqual(("staged", 2, 2), (result["mode"], result["added"], result["selected"]))
        self.assertEqual(self.source_commit, result["sourceCommit"])
        staged = json.loads((output / "dexam-bank-export.json").read_text())["questions"]
        self.assertEqual([f"{PAPER}-q1", f"{PAPER}-q2"], [question["externalKey"] for question in staged])
        self.assertEqual([entry["fingerprint"] for entry in entries],
                         [question["solutionReview"]["fingerprint"] for question in staged])
        self.assertTrue(all(question["licence"] == "owner-provided" for question in staged))
        figure = staged[0]["assets"][0]
        self.assertEqual(figure["sha256"], solutions.sha256((output / "media" / figure["path"]).read_bytes()))
        receipt = json.loads((output / "receipt.json").read_text())
        self.assertEqual(["objective-complete"] * 2, [item["review"] for item in receipt["additions"]])
        self.assertEqual("", self.git("status", "--short"))

    def test_batch_rejects_changed_second_approval_without_staging_first_addition(self):
        entries = self.addition_entries()
        draft_path = self.base / "05-solutions/q2.json"
        modified = copy.deepcopy(MSQ)
        modified["steps"][0]["text"] += " This was changed after review."
        draft_path.write_text(json.dumps(modified))
        output = self.work / "batch-output"
        with self.assertRaisesRegex(solutions.SolutionError, "current human approval"):
            self.addition_batch(entries, output=output, run_prepare=self.run_canonical_batch)
        self.assertFalse(output.exists())
        self.assertEqual("", self.git("status", "--short"))

    def test_batch_bridge_collects_two_approved_corrections_for_one_bank_check(self):
        second = self.second_question()
        first_bank = self.existing()
        second_bank = {
            "externalKey": f"{PAPER}-q2", "type": "MSQ", "sourceKind": "official",
            "licence": "official-unlicensed", "prompt": second["prompt"],
            "options": [{"key": option["key"], "text": option["text"], "asset": None}
                        for option in second["options"]], "holds": [],
            "provenance": {"exam": "uceed", "year": 2031, "paperId": PAPER,
                           "questionNo": "2", "sourceSha256": self.source_hash},
            "answer": {"raw": "A,B", "status": "official-key"}, "assets": [],
        }
        self.pin_bank([first_bank, second_bank])
        report = solutions.check(self.work, PAPER)["results"]
        entries = []
        for key, record in (("q1", first_bank), ("q2", second_bank)):
            fingerprint = report[key]["fingerprint"]
            solutions.approve(self.work, PAPER, key, "Fictional reviewer", fingerprint)
            entries.append({"key": key, "fingerprint": fingerprint,
                            "replaceExpected": hashlib.sha256(json.dumps(
                                record, sort_keys=True, separators=(",", ":"), ensure_ascii=False
                            ).encode()).hexdigest()})

        def verify_batch(args, repo):
            self.assertEqual(self.repo, repo)
            self.assertEqual(2, args.count("--packet"))
            self.assertEqual(2, args.count("--replace-expect"))
            packets = [json.loads(pathlib.Path(args[index + 1]).read_text())
                       for index, item in enumerate(args) if item == "--packet"]
            self.assertEqual([f"{PAPER}-q1", f"{PAPER}-q2"], [packet["externalKey"] for packet in packets])
            self.assertEqual([entry["replaceExpected"] for entry in entries],
                             [args[index + 1] for index, item in enumerate(args) if item == "--replace-expect"])
            self.assertEqual(str(self.work / "batch-output"), args[args.index("--output") + 1])
            options = {
                "packets": [{"packetPath": args[index + 1], "expected": args[args.index("--expect", index) + 1]}
                            for index, item in enumerate(args) if item == "--packet"],
                "replaceExpecteds": [entry["replaceExpected"] for entry in entries],
                "expectedSource": self.source_commit, "cwd": str(self.repo),
                "downloadsDir": args[args.index("--downloads-dir") + 1],
                "output": args[args.index("--output") + 1],
            }
            return self.run_fixture_preparer(options)

        result = export_batch.prepare_batch(work=self.work, paper_id=PAPER, entries=entries,
                                            expected_source=self.source_commit,
                                            rights_note="Fictional source rights reviewed",
                                            output=self.work / "batch-output", repo=self.repo,
                                            run_prepare=verify_batch)
        self.assertEqual(("staged", 2), (result["mode"], result["selected"]))
        staged = json.loads((self.work / "batch-output/dexam-bank-export.json").read_text())
        self.assertEqual([f"{PAPER}-q1", f"{PAPER}-q2"],
                         [question["externalKey"] for question in staged["questions"]])
        with self.assertRaisesRegex(solutions.SolutionError, "distinct reviewed question keys"):
            export_batch.prepare_batch(work=self.work, paper_id=PAPER, entries=[entries[0], entries[0]],
                                       expected_source=self.source_commit,
                                       rights_note="Fictional source rights reviewed", repo=self.repo)

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
