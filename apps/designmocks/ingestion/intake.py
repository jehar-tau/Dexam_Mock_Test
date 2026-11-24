#!/usr/bin/env python3
"""Stage 1 of the question-paper ingestion pipeline: intake.

Turns one question paper (a PDF, or photos of its pages) into a private work
folder that later stages read:

    <work>/<paper-id>/01-intake/
        paper.json                 manifest (deterministic for the same input)
        source/<original files>    byte-for-byte copies, hashed
        pages/page-NNN.png         page renders for review and segmentation
        text/page-NNN.json         lines and words with boxes (PDF points)
        images/<sha256>.<ext>      embedded images, native bytes, never resampled

Operator-only. The work folder must be outside every Git worktree so real
papers never land in the repository. See docs/ingestion/PLAN.md.
"""

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

try:
    import fitz  # PyMuPDF
except ImportError:  # pragma: no cover - reported at runtime
    fitz = None

try:
    from PIL import Image, ImageDraw, ImageOps
except ImportError:  # pragma: no cover - reported at runtime
    Image = ImageDraw = ImageOps = None

SCHEMA = 1
STAGE = "01-intake"
EXAMS = {"uceed", "ceed", "nid"}
MAX_SOURCE_BYTES = 100 * 1024 * 1024
MAX_PAGES = 80
MAX_PHOTO_PIXELS = 60_000_000
DEFAULT_DPI = 200
# An embedded image smaller than this on both sides is treated as decoration
# (bullets, radio circles, rule ornaments), not as a question figure.
DECORATIVE_PX = 24
# A page needs OCR when it has almost no real text but images cover much of it
# (text typeset as image tiles), or when it is a photo.
OCR_TEXT_CHARS = 80
OCR_IMAGE_COVER = 0.35
# Dark pixels on the render that no extracted text line, figure or ruled line
# explains: text drawn as outlines, or fonts without a usable text layer.
# Measured 20 Nov 2026: clean official papers score 0; pages with lost text 0.004-0.04.
OCR_UNEXPLAINED_INK = 0.002
INK_LEVEL = 140


class IntakeError(Exception):
    """A refusal the operator can act on. The message is safe to print."""


def sha256_bytes(data):
    return hashlib.sha256(data).hexdigest()


def sha256_file(path):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for chunk in iter(lambda: handle.read(1 << 20), b""):
            digest.update(chunk)
    return digest.hexdigest()


def rounded(box, places=2):
    return [round(float(value), places) for value in box]


def inside_git_worktree(path):
    """True when path (or its nearest existing parent) is inside a Git worktree."""
    probe = pathlib.Path(path).resolve()
    while not probe.exists():
        probe = probe.parent
    try:
        subprocess.run(
            ["git", "rev-parse", "--show-toplevel"], cwd=probe, check=True,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False


def paper_id_for(exam, year, paper_id=None):
    if exam not in EXAMS:
        raise IntakeError("Exam must be one of: " + ", ".join(sorted(EXAMS)))
    if not isinstance(year, int) or not 2000 <= year <= 2100:
        raise IntakeError("Year must be a four-digit exam year")
    value = paper_id or f"{exam}-{year}"
    if not re.fullmatch(r"[a-z0-9][a-z0-9-]{0,63}", value):
        raise IntakeError("Paper id may use lowercase letters, digits and hyphens only")
    return value


def page_text(page):
    """Lines and words with boxes in PDF points, plus font size and bold flag per line."""
    lines = []
    for block in page.get_text("dict")["blocks"]:
        if block.get("type") != 0:
            continue
        for line in block["lines"]:
            spans = [span for span in line["spans"] if span["text"].strip()]
            if not spans:
                continue
            text = "".join(span["text"] for span in line["spans"]).strip()
            size = max(span["size"] for span in spans)
            bold = all(span["flags"] & 16 or "bold" in span["font"].lower() for span in spans)
            lines.append({"box": rounded(line["bbox"]), "text": text, "size": round(size, 2), "bold": bool(bold)})
    lines.sort(key=lambda line: (round(line["box"][1] / 2), line["box"][0]))
    words = [
        {"box": rounded(word[:4]), "text": word[4], "block": word[5], "line": word[6]}
        for word in page.get_text("words")
    ]
    return lines, words


def drawing_boxes(page):
    boxes = []
    for drawing in page.get_drawings():
        rect = drawing.get("rect")
        if rect is None or rect.is_empty and rect.width == 0 and rect.height == 0:
            continue
        boxes.append({
            "box": rounded(rect),
            "fill": drawing.get("fill") is not None,
            "stroke": drawing.get("color") is not None,
        })
    return boxes


def union_area(boxes, page_area):
    """Fraction of the page covered by boxes, counted on a coarse grid (cheap and order-free)."""
    if not boxes or page_area <= 0:
        return 0.0
    step = 4.0
    cells = set()
    for x0, y0, x1, y1 in boxes:
        for gx in range(int(max(x0, 0) // step), int(max(x1, 0) // step) + 1):
            for gy in range(int(max(y0, 0) // step), int(max(y1, 0) // step) + 1):
                cells.add((gx, gy))
    return min(1.0, len(cells) * step * step / page_area)


def unexplained_ink(render_path, zoom, lines, placements, drawings):
    """Share of the page's pixels that are dark but not covered by any extracted line,
    figure placement or thin ruled line. Reads the render; changes nothing."""
    with Image.open(render_path) as opened:
        mask = opened.convert("L").point(lambda value: 255 if value < INK_LEVEL else 0)
    draw = ImageDraw.Draw(mask)

    def clear(box, pad):
        x0, y0, x1, y1 = box
        draw.rectangle([(x0 - pad) * zoom, (y0 - pad) * zoom, (x1 + pad) * zoom, (y1 + pad) * zoom], fill=0)

    for line in lines:
        clear(line["box"], 2)
    for placement in placements:
        if not placement["decorative"]:
            clear(placement["box"], 1)
    for drawing in drawings:
        x0, y0, x1, y1 = drawing["box"]
        # Rules and table borders are thin; vector figures are taller than a text line.
        # Glyph outlines are neither, so they stay counted. A false alarm costs one OCR pass.
        if min(x1 - x0, y1 - y0) < 2 or y1 - y0 > 24:
            clear(drawing["box"], 1)
    return mask.histogram()[255] / float(mask.width * mask.height)


def store_image(doc, xref, images, out_images):
    """Extract an embedded image's own bytes once per digest. Returns the digest or None."""
    if not xref:
        return None
    try:
        info = doc.extract_image(xref)
    except Exception:  # broken streams are recorded as unextractable, not fatal
        return None
    if not info or not info.get("image"):
        return None
    data = info["image"]
    digest = sha256_bytes(data)
    if digest not in images:
        ext = (info.get("ext") or "bin").lower()
        name = f"{digest}.{ext}"
        (out_images / name).write_bytes(data)
        images[digest] = {
            "sha256": digest, "file": f"images/{name}", "ext": ext, "bytes": len(data),
            "width": info.get("width"), "height": info.get("height"),
            "colorComponents": info.get("colorspace"), "bitsPerComponent": info.get("bpc"),
            "hasMask": bool(info.get("smask")),
        }
    return digest


def intake_pdf(source, out, dpi):
    if fitz is None or Image is None:
        raise IntakeError("PyMuPDF and Pillow are required: pip install -r apps/designmocks/ingestion/requirements.txt")
    with open(source, "rb") as handle:
        if handle.read(5) != b"%PDF-":
            raise IntakeError("The paper is not a PDF file")
    try:
        doc = fitz.open(source)
    except Exception:
        raise IntakeError("The PDF could not be opened")
    with doc:
        if doc.needs_pass or doc.is_encrypted:
            raise IntakeError("The PDF is password-protected; export an unlocked copy first")
        if doc.page_count == 0 or doc.page_count > MAX_PAGES:
            raise IntakeError(f"The PDF must have between 1 and {MAX_PAGES} pages")
        (out / "pages").mkdir()
        (out / "text").mkdir()
        (out / "images").mkdir()
        images = {}
        pages = []
        zoom = dpi / 72.0
        for index, page in enumerate(doc):
            number = index + 1
            name = f"page-{number:03d}"
            pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), alpha=False)
            pix.save(str(out / "pages" / f"{name}.png"))
            lines, words = page_text(page)
            (out / "text" / f"{name}.json").write_text(
                json.dumps({"page": number, "units": "pt", "lines": lines, "words": words}, ensure_ascii=False, indent=1) + "\n",
                encoding="utf-8",
            )
            placements = []
            for item in page.get_image_info(xrefs=True):
                box = item["bbox"]
                width_pt = max(box[2] - box[0], 1e-6)
                digest = store_image(doc, item.get("xref"), images, out / "images")
                native_w, native_h = item.get("width") or 0, item.get("height") or 0
                placements.append({
                    "box": rounded(box),
                    "sha256": digest,
                    "nativeWidth": native_w,
                    "nativeHeight": native_h,
                    "effectiveDpi": round(native_w / width_pt * 72) if native_w else None,
                    "decorative": native_w < DECORATIVE_PX and native_h < DECORATIVE_PX,
                    "extractable": digest is not None,
                })
            drawings = drawing_boxes(page)
            text_chars = sum(len(line["text"].replace(" ", "")) for line in lines)
            area = page.rect.width * page.rect.height
            cover = union_area([p["box"] for p in placements if not p["decorative"]], area)
            ink = unexplained_ink(out / "pages" / f"{name}.png", zoom, lines, placements, drawings)
            reasons = []
            if text_chars < OCR_TEXT_CHARS and cover >= OCR_IMAGE_COVER:
                reasons.append("text-as-image")
            if ink >= OCR_UNEXPLAINED_INK:
                reasons.append("ink-without-text")
            needs_ocr = bool(reasons)
            kind = "blank" if text_chars == 0 and not placements and not drawings else ("image-text" if needs_ocr else "text")
            pages.append({
                "page": number,
                "render": f"pages/{name}.png",
                "renderSha256": sha256_file(out / "pages" / f"{name}.png"),
                "renderWidth": pix.width,
                "renderHeight": pix.height,
                "widthPt": round(page.rect.width, 2),
                "heightPt": round(page.rect.height, 2),
                "rotation": page.rotation,
                "text": f"text/{name}.json",
                "textChars": text_chars,
                "lineCount": len(lines),
                "images": placements,
                "drawings": drawings,
                "imageCover": round(cover, 3),
                "unexplainedInk": round(ink, 4),
                "kind": kind,
                "needsOcr": needs_ocr,
                "ocrReasons": reasons,
            })
        meta = doc.metadata or {}
        document = {
            "pageCount": doc.page_count,
            "producer": meta.get("producer") or None,
            "creator": meta.get("creator") or None,
        }
    return document, pages, sorted(images.values(), key=lambda image: image["sha256"])


def intake_photos(sources, out):
    if Image is None:
        raise IntakeError("Pillow is required: pip install -r apps/designmocks/ingestion/requirements.txt")
    if len(sources) > MAX_PAGES:
        raise IntakeError(f"Give at most {MAX_PAGES} page photos")
    (out / "pages").mkdir()
    pages = []
    for index, source in enumerate(sources):
        number = index + 1
        name = f"page-{number:03d}"
        try:
            with Image.open(source) as opened:
                if opened.width * opened.height > MAX_PHOTO_PIXELS:
                    raise IntakeError(f"Photo {number} is larger than {MAX_PHOTO_PIXELS // 1_000_000} megapixels")
                upright = ImageOps.exif_transpose(opened).convert("RGB")
        except IntakeError:
            raise
        except Exception:
            raise IntakeError(f"Photo {number} is not a readable image")
        # Strip EXIF (location, device) by re-encoding the upright pixels only.
        upright.save(out / "pages" / f"{name}.png", format="PNG")
        pages.append({
            "page": number,
            "render": f"pages/{name}.png",
            "renderSha256": sha256_file(out / "pages" / f"{name}.png"),
            "renderWidth": upright.width,
            "renderHeight": upright.height,
            "widthPt": None, "heightPt": None, "rotation": 0,
            "text": None, "textChars": 0, "lineCount": 0,
            "images": [], "drawings": [], "imageCover": 1.0,
            "unexplainedInk": None, "kind": "photo", "needsOcr": True, "ocrReasons": ["photo"],
        })
    return {"pageCount": len(pages), "producer": None, "creator": None}, pages, []


def run_intake(*, exam, year, work, pdf=None, photos=None, paper_id=None, dpi=DEFAULT_DPI, replace=False):
    """Run stage 1 and return the summary. Raises IntakeError on any refusal."""
    if bool(pdf) == bool(photos):
        raise IntakeError("Give either one PDF or a list of page photos")
    if not 72 <= int(dpi) <= 400:
        raise IntakeError("Render resolution must be between 72 and 400 dpi")
    paper = paper_id_for(exam, year, paper_id)
    sources = [pathlib.Path(pdf)] if pdf else [pathlib.Path(item) for item in photos]
    for source in sources:
        if not source.is_file():
            raise IntakeError(f"Cannot read {source.name}")
    if sum(source.stat().st_size for source in sources) > MAX_SOURCE_BYTES:
        raise IntakeError("The paper is larger than 100 MB")
    if len({source.name for source in sources}) != len(sources):
        raise IntakeError("Page photos must have distinct file names")

    work_root = pathlib.Path(work).expanduser().resolve()
    if inside_git_worktree(work_root):
        raise IntakeError("The work folder must be outside every Git repository so papers are never committed")
    target = work_root / paper / STAGE
    if target.exists() and not replace:
        raise IntakeError(f"{paper}/{STAGE} already exists; pass --replace to redo intake")
    target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)

    staging = pathlib.Path(tempfile.mkdtemp(prefix=f".{STAGE}-", dir=target.parent))
    try:
        (staging / "source").mkdir()
        files = []
        for source in sources:
            copy = staging / "source" / source.name
            shutil.copyfile(source, copy)
            files.append({"name": source.name, "sha256": sha256_file(copy), "bytes": copy.stat().st_size})
        if pdf:
            document, pages, images = intake_pdf(staging / "source" / sources[0].name, staging, int(dpi))
        else:
            document, pages, images = intake_photos([staging / "source" / s.name for s in sources], staging)
        manifest = {
            "schema": SCHEMA,
            "stage": STAGE,
            "paperId": paper,
            "exam": exam,
            "year": year,
            "source": {"kind": "pdf" if pdf else "photos", "files": files},
            "document": document,
            "renderDpi": int(dpi) if pdf else None,
            "pages": pages,
            "images": images,
            "summary": summarise(pages, images),
        }
        (staging / "paper.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
        if target.exists():
            shutil.rmtree(target)
        os.replace(staging, target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"paperId": paper, "output": str(target), **manifest["summary"]}


def summarise(pages, images):
    placements = [placement for page in pages for placement in page["images"]]
    figures = [p for p in placements if not p["decorative"]]
    return {
        "pages": len(pages),
        "textPages": sum(1 for page in pages if page["kind"] == "text"),
        "needsOcr": [page["page"] for page in pages if page["needsOcr"]],
        "imagePlacements": len(placements),
        "figurePlacements": len(figures),
        "uniqueImages": len(images),
        "unextractable": sum(1 for p in figures if not p["extractable"]),
        "vectorPages": [page["page"] for page in pages if page["drawings"]],
    }


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stage 1: take in a UCEED, CEED or NID question paper.")
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--paper", help="Question-paper PDF")
    source.add_argument("--photos", nargs="+", help="Page photos in page order")
    parser.add_argument("--exam", required=True, choices=sorted(EXAMS))
    parser.add_argument("--year", required=True, type=int)
    parser.add_argument("--paper-id", help="Override the default <exam>-<year> id")
    parser.add_argument("--work", required=True, help="Private work folder outside the repository")
    parser.add_argument("--dpi", type=int, default=DEFAULT_DPI, help="Page render resolution (default 200)")
    parser.add_argument("--replace", action="store_true", help="Redo intake for this paper")
    args = parser.parse_args(argv)
    try:
        summary = run_intake(
            exam=args.exam, year=args.year, work=args.work, pdf=args.paper, photos=args.photos,
            paper_id=args.paper_id, dpi=args.dpi, replace=args.replace,
        )
    except IntakeError as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
