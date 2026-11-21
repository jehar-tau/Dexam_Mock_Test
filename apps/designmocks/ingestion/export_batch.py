#!/usr/bin/env python3
"""Stage reviewed corrections from one paper as a single private bank export."""

import argparse
import json
import pathlib
import shutil
import sys
import tempfile

from export import DIGEST, REPO, SolutionError, prepare, run_bank_prepare
from solutions import QUESTION_KEY


def prepare_batch(*, work, paper_id, entries, expected_source, rights_note, media_root=None,
                  output=None, repo=REPO, run_prepare=run_bank_prepare):
    if not isinstance(entries, list) or not 2 <= len(entries) <= 100:
        raise SolutionError("Select two to 100 reviewed corrections from one paper; use export.py for one")
    keys = [item.get("key") for item in entries if isinstance(item, dict)]
    if (len(keys) != len(entries) or len(set(keys)) != len(keys)
            or any(not isinstance(key, str) or not QUESTION_KEY.fullmatch(key) for key in keys)):
        raise SolutionError("Use distinct reviewed question keys in the correction batch")
    for item in entries:
        if any(not isinstance(item.get(field), str) or not DIGEST.fullmatch(item[field])
               for field in ("fingerprint", "replaceExpected")):
            raise SolutionError("Each correction needs its reviewed fingerprint and current bank version")

    with tempfile.TemporaryDirectory(prefix="dmocks-ingestion-batch-") as directory:
        temporary = pathlib.Path(directory)
        downloads = temporary / "downloads"
        downloads.mkdir(mode=0o700)
        packets = []

        def capture(args, candidate_repo):
            if pathlib.Path(candidate_repo).resolve() != pathlib.Path(repo).resolve():
                raise SolutionError("The reviewed candidate used another bank repository")
            source = pathlib.Path(args[args.index("--packet") + 1])
            expected = args[args.index("--expect") + 1]
            packet = temporary / f"packet-{len(packets) + 1}.json"
            shutil.copyfile(source, packet)
            source_downloads = pathlib.Path(args[args.index("--downloads-dir") + 1])
            for image in source_downloads.glob("*.png"):
                destination = downloads / image.name
                data = image.read_bytes()
                if destination.exists() and destination.read_bytes() != data:
                    raise SolutionError("Reviewed figures conflict within this paper batch")
                if not destination.exists():
                    destination.write_bytes(data)
            packets.append((packet, expected, args[args.index("--replace-expect") + 1]))
            # The final canonical preparer verifies the entire batch below.
            return {"mode": "dry-run", "review": "objective-complete"}

        for item in entries:
            prepare(work=work, paper_id=paper_id, key=item["key"], fingerprint=item["fingerprint"],
                    expected_source=expected_source, replace_expected=item["replaceExpected"],
                    rights_note=rights_note, media_root=media_root, repo=repo, run_prepare=capture)

        args = ["--expect-source", expected_source, "--downloads-dir", str(downloads)]
        if media_root is not None:
            args.extend(["--media-root", str(media_root)])
        if output is not None:
            args.extend(["--output", str(output)])
        for packet, expected, version in packets:
            args.extend(["--packet", str(packet), "--expect", expected, "--replace-expect", version])
        result = run_prepare(args, repo)
        expected_mode = "staged" if output is not None else "dry-run"
        if result.get("mode") not in (expected_mode, "no-op") or (
                result["mode"] == expected_mode and
                result.get("reviews", {}).get("objective-complete", 0) + result.get("alreadyPresent", 0) != len(entries)):
            raise SolutionError("The bank checks did not accept every correction in the paper batch")
    return {**result, "paperId": paper_id, "selected": len(entries)}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("paper_id")
    parser.add_argument("--work", required=True)
    parser.add_argument("--manifest", required=True, help="Private JSON with questions: key, fingerprint, replaceExpected")
    parser.add_argument("--expect-source", dest="expected_source", required=True)
    parser.add_argument("--media-root", dest="media_root")
    parser.add_argument("--rights-note", dest="rights_note", required=True)
    parser.add_argument("--output")
    try:
        options = vars(parser.parse_args(argv))
        manifest = json.loads(pathlib.Path(options.pop("manifest")).read_text())
        if not isinstance(manifest, dict) or set(manifest) != {"questions"}:
            raise SolutionError("Use a private correction manifest with only a questions list")
        result = prepare_batch(entries=manifest["questions"], **options)
    except (SolutionError, OSError, ValueError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(result, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
