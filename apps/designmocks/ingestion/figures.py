#!/usr/bin/env python3
"""Stage 3 of the question-paper ingestion pipeline: figures.

Reads 01-intake and 02-segments and writes <work>/<paper-id>/03-figures/:

    figures.json            per question: block crop, figures, canonical PNG, SVG trial
    <key>/block.png         the whole question as printed (review and fallback)
    <key>/fig-N.png         canonical figure: the embedded image's own pixels, or a
                            page render when the page shows something else
    <key>/fig-N.svg         vector recreation, only when it passed every check
    <key>/fig-N.board.png   source | SVG | difference, for the owner's approval

The canonical PNG is what students see. An SVG is an addition that a person
must still approve (stage 6). See docs/ingestion/PLAN.md, "Figure decision".
"""

import argparse
import hashlib
import io
import json
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile

import fitz
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

SCHEMA = 1
STAGE = "03-figures"
BLOCK_DPI = 250
MIN_RENDER_DPI = 200
MAX_SIDE = 8192
MAX_PNG_BYTES = 10 * 1024 * 1024
# Native image versus what the page shows, tolerant of a one-pixel shift and resampling.
APPEARANCE_LEVEL = 40       # grey levels outside the 3x3 neighbourhood range
APPEARANCE_SHARE = 0.003    # share of pixels allowed to differ
# Vector eligibility: a few flat colours cover almost every pixel.
FLAT_COLOURS = 6
FLAT_COVER = 0.97
TRACE_SCALE = 4
# Verification thresholds (PLAN.md).
PASS = {"inkIou": 0.98, "edgeP99": 1.5, "ssim": 0.95, "deltaE": 3.0}


class FigureError(Exception):
    """A refusal the operator can act on. The message is safe to print."""


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def png_bytes(image):
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def check_png(data, image):
    if image.width > MAX_SIDE or image.height > MAX_SIDE or len(data) > MAX_PNG_BYTES:
        raise FigureError("A figure is larger than the bank accepts (8192 px or 10 MB)")


# ---------------------------------------------------------------- canonical PNG


def decode_native(data):
    """Decode the embedded bytes once. Grey stays grey; CMYK and palettes become RGB."""
    with Image.open(io.BytesIO(data)) as opened:
        opened.load()
        mode = opened.mode
        if mode in ("L", "RGB"):
            return opened.copy(), None
        if mode == "1":
            return opened.convert("L"), None
        if mode == "CMYK":
            return opened.convert("RGB"), "converted-from-cmyk"
        return opened.convert("RGB"), f"converted-from-{mode.lower()}"


def render_clip(page, box, dpi):
    zoom = dpi / 72.0
    pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=fitz.Rect(*box), alpha=False)
    return Image.frombytes("RGB", (pix.width, pix.height), pix.samples)


def appearance_differs(native, rendered):
    """Share of pixels where the page shows something the native image cannot explain,
    allowing one pixel of shift. Catches Word crops and labels drawn over a picture.

    Returns (differs over the picture, differs over its blank background). Text that the
    page prints over an empty margin of the image (the next question, often) belongs to
    the page, not the figure, so only the first share decides."""
    grey_n = native.convert("L").resize(rendered.size, Image.BILINEAR)
    low = np.asarray(grey_n.filter(ImageFilter.MinFilter(3)), dtype=np.int16)
    high = np.asarray(grey_n.filter(ImageFilter.MaxFilter(3)), dtype=np.int16)
    blank = np.asarray(grey_n.filter(ImageFilter.MinFilter(9)), dtype=np.int16) > 235
    page = np.asarray(rendered.convert("L"), dtype=np.int16)
    off = (page < low - APPEARANCE_LEVEL) | (page > high + APPEARANCE_LEVEL)
    return float((off & ~blank).mean()), float((off & blank).mean())


def placement_xref(page, box):
    for info in page.get_image_info(xrefs=True):
        if [round(float(v), 2) for v in info["bbox"]] == list(box):
            return info.get("xref") or None
    return None


def with_mask(doc, xref):
    """An image with a transparency mask (smask), composited on white as the page shows it.
    The colour data alone is often black where the mask hides it."""
    smask = doc.extract_image(xref).get("smask")
    if not smask:
        return None
    base = fitz.Pixmap(doc, xref)
    if base.alpha:
        base = fitz.Pixmap(base, 0)
    if base.n != 3:
        base = fitz.Pixmap(fitz.csRGB, base)
    mask = fitz.Pixmap(doc, smask)
    if (mask.width, mask.height) != (base.width, base.height):
        return None
    rgba = Image.frombytes("RGBA", (base.width, base.height), fitz.Pixmap(base, mask).samples)
    flat = Image.new("RGB", rgba.size, "white")
    flat.paste(rgba, mask=rgba.split()[3])
    return flat


def area(rect):
    return max(rect.width, 0) * max(rect.height, 0)


def visible_box(page, box):
    """The part of an image the page actually shows. Word "crops" a picture with a clip
    path and keeps the whole image underneath; the clip is the smallest finite clip
    rectangle that lies mostly inside the image's box."""
    rect = fitz.Rect(*box)
    best = None
    for item in page.get_drawings(extended=True):
        if item.get("type") != "clip":
            continue
        scissor = fitz.Rect(item["scissor"])
        if scissor.is_empty or scissor.width > 10 * page.rect.width:
            continue
        inside = scissor & rect
        if inside.is_empty or area(inside) < 0.5 * area(scissor):
            continue
        if best is None or area(inside) < area(best):
            best = inside
    visible = (best or rect) & page.rect
    return [round(v, 2) for v in visible]


def crop_native(native, box, visible):
    """Cut the embedded pixels to the visible area (axis-aligned placements only)."""
    x0, y0, x1, y1 = box
    sx, sy = native.width / (x1 - x0), native.height / (y1 - y0)
    left = max(0, round((visible[0] - x0) * sx))
    top = max(0, round((visible[1] - y0) * sy))
    right = min(native.width, round((visible[2] - x0) * sx))
    bottom = min(native.height, round((visible[3] - y0) * sy))
    return native.crop((left, top, right, bottom)), [left, top, right, bottom]


def canonical_figure(doc, placement, image_bytes):
    """Return (PIL image, provenance dict) for one figure placement."""
    page = doc[placement["page"] - 1]
    box = placement["box"]
    width_pt = box[2] - box[0]
    native_dpi = placement["nativeWidth"] / width_pt * 72 if width_pt > 0 else 0
    reasons = []
    differs = None
    if image_bytes is not None:
        xref = placement_xref(page, box)
        native = with_mask(doc, xref) if xref else None
        if native is not None:
            reasons.append("transparency-composited-on-white")
        else:
            native, note = decode_native(image_bytes)
            if note:
                reasons.append(note)
        visible = visible_box(page, box)
        if any(abs(a - b) > 0.5 for a, b in zip(visible, box)):
            native, cut = crop_native(native, box, visible)
            reasons.append("cropped-to-visible-area")
            provenance_extra = {"visibleBox": visible, "cropPx": cut}
            box = visible
        else:
            provenance_extra = {}
        rendered = render_clip(page, box, max(native_dpi, 72))
        differs, margin = appearance_differs(native, rendered)
        if margin > APPEARANCE_SHARE:
            reasons.append("page-prints-over-blank-margin")
        if differs <= APPEARANCE_SHARE:
            return native, {"source": "embedded", "pageDifference": round(differs, 4), "notes": reasons, **provenance_extra}
        reasons.append("page-shows-something-else")  # cropped on the page, or drawn over
    else:
        reasons.append("not-extractable")
    dpi = max(native_dpi, MIN_RENDER_DPI)
    image = render_clip(page, box, dpi)
    return image, {"source": "page-render", "renderDpi": round(dpi), "notes": reasons,
                   "pageDifference": round(differs, 4) if differs is not None else None}


def block_image(doc, regions, dpi=BLOCK_DPI, pad=6):
    parts = []
    for region in regions:
        page = doc[region["page"] - 1]
        x0, y0, x1, y1 = region["box"]
        rect = fitz.Rect(x0 - pad, y0 - pad, x1 + pad, y1 + pad) & page.rect
        parts.append(render_clip(page, rect, dpi))
    gap = 24
    width = max(part.width for part in parts)
    block = Image.new("RGB", (width, sum(part.height for part in parts) + gap * (len(parts) - 1)), "white")
    top = 0
    for part in parts:
        block.paste(part, (0, top))
        top += part.height + gap
    return block


# ---------------------------------------------------------------- vector trial


def palette_of(image):
    """Flat-colour palette, or None when the figure is a photo, a shaded render or a texture.

    A colour counts when it covers at least 1% of the pixels. Anti-aliased and JPEG-blurred
    edge pixels are not colours: they are explained when they sit next to a boundary
    between two palette colours."""
    rgb = np.asarray(image.convert("RGB"), dtype=np.int16)
    binned = (rgb // 32).reshape(-1, 3)
    codes = binned[:, 0] * 64 + binned[:, 1] * 8 + binned[:, 2]
    keys, counts = np.unique(codes, return_counts=True)
    order = np.argsort(-counts)
    significant = [keys[i] for i in order[:FLAT_COLOURS] if counts[i] >= 0.01 * codes.size]
    if not significant:
        return None
    flat = rgb.reshape(-1, 3)
    colours = [tuple(int(v) for v in np.median(flat[codes == key], axis=0)) for key in significant]
    labels = nearest_labels(image, colours)
    palette = np.asarray(colours, dtype=np.float32)
    distance = np.sqrt(((rgb.astype(np.float32) - palette[labels]) ** 2).sum(axis=2))
    boundary = np.zeros(labels.shape, dtype=bool)
    boundary[:, 1:] |= labels[:, 1:] != labels[:, :-1]
    boundary[1:, :] |= labels[1:, :] != labels[:-1, :]
    near_boundary = np.asarray(Image.fromarray(boundary.astype(np.uint8) * 255).filter(ImageFilter.MaxFilter(5))) > 0
    explained = (distance < 48) | near_boundary
    if explained.mean() < FLAT_COVER:
        return None
    return colours


def nearest_labels(image, colours):
    rgb = np.asarray(image.convert("RGB"), dtype=np.float32)
    palette = np.asarray(colours, dtype=np.float32)
    distance = ((rgb[:, :, None, :] - palette[None, None, :, :]) ** 2).sum(axis=3)
    return distance.argmin(axis=2)


def trace_layer(mask, potrace="potrace"):
    """Trace one boolean mask with potrace; return the inner SVG group in pixel units."""
    height, width = mask.shape
    pbm = b"P4\n%d %d\n" % (width, height) + np.packbits(mask, axis=1).tobytes()
    result = subprocess.run(
        [potrace, "--svg", "--flat", "-r", "72", "-t", "2", "-a", "1.0", "-O", "0.2", "-o", "-", "-"],
        input=pbm, capture_output=True, check=True,
    )
    svg = result.stdout.decode("ascii")
    group = re.search(r"<g transform=\"([^\"]+)\"[^>]*>(.*?)</g>", svg, re.S)
    if not group:
        return None
    paths = re.findall(r"<path d=\"([^\"]+)\"\s*/>", group.group(2))
    return group.group(1), paths


SAFE_SVG = re.compile(r"^<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 \d+ \d+\" width=\"\d+\" height=\"\d+\">"
                      r"(?:<rect [^<>]*/>)?(?:<g [^<>]*>(?:<path d=\"[-0-9 .,a-zA-Z]+\"/>)*</g>)*</svg>$")


def svg_document(width, height, background, layers):
    parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" width="{width}" height="{height}">']
    parts.append(f'<rect width="{width}" height="{height}" fill="#{background}"/>')
    for colour, transform, paths in layers:
        parts.append(f'<g transform="{transform}" fill="#{colour}" stroke="none">')
        parts.extend(f'<path d="{" ".join(d.split())}"/>' for d in paths)
        parts.append("</g>")
    parts.append("</svg>")
    svg = "".join(parts)
    if not SAFE_SVG.match(svg):  # only rect, g and path; no scripts, links, styles or rasters
        raise FigureError("Traced SVG failed the safety check")
    return svg


def rasterise_svg(svg, width, height):
    with fitz.open(stream=svg.encode("utf-8"), filetype="svg") as doc:
        page = doc[0]
        pix = page.get_pixmap(matrix=fitz.Matrix(width / page.rect.width, height / page.rect.height), alpha=False)
        return Image.frombytes("RGB", (pix.width, pix.height), pix.samples).resize((width, height))


def hexcolour(rgb):
    return "%02x%02x%02x" % tuple(rgb)


def delta_e(a, b):
    from skimage.color import deltaE_ciede2000, rgb2lab
    lab = rgb2lab(np.asarray([[a, b]], dtype=np.float64) / 255.0)
    return float(deltaE_ciede2000(lab[0, 0], lab[0, 1]))


def verify(source, rendered, colours, labels, background_index):
    """The checks in PLAN.md, against the canonical PNG at its own pixel size."""
    import cv2
    from skimage.metrics import structural_similarity
    grey_s = np.asarray(source.convert("L"), dtype=np.uint8)
    grey_r = np.asarray(rendered.convert("L"), dtype=np.uint8)
    # Both images are classified with the same palette, so the overlap compares like with like.
    ink_s = labels != background_index
    ink_r = nearest_labels(rendered, colours) != background_index
    union = (ink_s | ink_r).sum()
    iou = float((ink_s & ink_r).sum() / union) if union else 1.0
    edges_s = cv2.Canny(grey_s, 60, 160) > 0
    edges_r = cv2.Canny(grey_r, 60, 160) > 0
    distances = []
    for a, b in ((edges_s, edges_r), (edges_r, edges_s)):
        if a.any() and b.any():
            field = cv2.distanceTransform((~b).astype(np.uint8), cv2.DIST_L2, 3)
            distances.append(field[a])
    joined = np.concatenate(distances) if distances else np.zeros(1)
    window = 7 if min(grey_s.shape) >= 7 else (min(grey_s.shape) // 2) * 2 + 1
    ssim = float(structural_similarity(grey_s, grey_r, win_size=window, data_range=255))
    rgb = np.asarray(source.convert("RGB"), dtype=np.float32)
    worst = 0.0
    for index, colour in enumerate(colours):
        if index == background_index:
            continue
        # Interior pixels only: blurred edges are not the colour of the region.
        mask = Image.fromarray((labels == index).astype(np.uint8) * 255).filter(ImageFilter.MinFilter(5))
        members = rgb[np.asarray(mask) > 0]
        if len(members) >= 25:
            worst = max(worst, delta_e(tuple(members.mean(axis=0)), colour))
    metrics = {"inkIou": round(iou, 4), "edgeP99": round(float(np.percentile(joined, 99)), 2),
               "edgeMax": round(float(joined.max()), 2), "ssim": round(ssim, 4), "deltaE": round(worst, 2)}
    failures = [name for name, limit in PASS.items()
                if (metrics[name] < limit if name in ("inkIou", "ssim") else metrics[name] > limit)]
    return metrics, failures


def board(source, rendered, metrics, failures):
    """Source | SVG | difference (red: ink the SVG lost, blue: ink it added), with the numbers."""
    s = np.asarray(source.convert("L")) < 128
    r = np.asarray(rendered.convert("L")) < 128
    diff = np.full(s.shape + (3,), 255, dtype=np.uint8)
    diff[s & ~r] = (220, 30, 30)
    diff[r & ~s] = (30, 80, 220)
    diff[s & r] = (200, 200, 200)
    width, height = source.size
    caption = 34
    out = Image.new("RGB", (width * 3 + 40, height + caption), "white")
    for index, part in enumerate((source.convert("RGB"), rendered, Image.fromarray(diff))):
        out.paste(part, (index * (width + 20), caption))
    verdict = "PASS" if not failures else "FAIL " + ",".join(failures)
    text = (f"{verdict}  ink IoU {metrics['inkIou']}  edge p99 {metrics['edgeP99']}px (max {metrics['edgeMax']})"
            f"  SSIM {metrics['ssim']}  dE {metrics['deltaE']}")
    ImageDraw.Draw(out).text((6, 10), text, fill=(0, 0, 0))
    return out


def vector_trial(image, potrace):
    """Try an SVG recreation. Returns (svg or None, report)."""
    colours = palette_of(image)
    if colours is None:
        return None, {"status": "not-eligible", "reasons": ["not-flat-colour"]}
    labels = nearest_labels(image, colours)
    counts = np.bincount(labels.ravel(), minlength=len(colours))
    luminance = [0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2] for c in colours]
    # The background is the most common colour, unless it is dark (then the lightest common one).
    background = int(counts.argmax()) if luminance[int(counts.argmax())] > 128 else int(np.argmax(luminance))
    width, height = image.size
    # Trace a smooth 4x upscale so thin lines keep their sub-pixel position, then scale back.
    scale = max(1, min(TRACE_SCALE, MAX_SIDE // max(width, height)))
    fine = nearest_labels(image.convert("RGB").resize((width * scale, height * scale), Image.BICUBIC), colours)
    layers = []
    for index in sorted(range(len(colours)), key=lambda i: -counts[i]):
        if index == background or counts[index] == 0:
            continue
        traced = trace_layer(fine == index, potrace)
        if traced and traced[1]:
            transform = f"scale({1 / scale:.6g}) {traced[0]}" if scale > 1 else traced[0]
            layers.append((hexcolour(colours[index]), transform, traced[1]))
    if not layers:
        return None, {"status": "not-eligible", "reasons": ["no-ink"]}
    svg = svg_document(width, height, hexcolour(colours[background]), layers)
    rendered = rasterise_svg(svg, width, height)
    metrics, failures = verify(image, rendered, colours, labels, background)
    report = {"status": "verified" if not failures else "failed", "reasons": failures,
              "metrics": metrics, "colours": [hexcolour(c) for c in colours], "approval": "pending"}
    return (svg, rendered), report


# ---------------------------------------------------------------- driver


def figure_text(ocr, png_path, digest, cache):
    """Lines of text OCR reads inside a figure, cached by the PNG's digest."""
    cached = cache / f"{digest}.json"
    if cached.exists():
        rows = json.loads(cached.read_text())
    else:
        rows = ocr(png_path)
        cache.mkdir(parents=True, exist_ok=True)
        cached.write_text(json.dumps(rows) + "\n")
    return [row["text"] for row in rows if re.search(r"[A-Za-z0-9]", str(row["text"]))]


def default_ocr(work_root):
    import importlib.util
    spec = importlib.util.spec_from_file_location("segment", pathlib.Path(__file__).with_name("segment.py"))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.vision_ocr(work_root)


def run_figures(*, work, paper_id, replace=False, ocr=None, potrace=None):
    work_root = pathlib.Path(work).expanduser().resolve()
    paper_dir = work_root / paper_id
    manifest_path, segments_path = paper_dir / "01-intake" / "paper.json", paper_dir / "02-segments" / "questions.json"
    if not segments_path.is_file():
        raise FigureError(f"Run stages 1 and 2 first: {paper_id}/02-segments/questions.json is missing")
    manifest, segments = json.loads(manifest_path.read_text()), json.loads(segments_path.read_text())
    if segments.get("intakeSha256") != sha256(manifest_path.read_bytes()):
        raise FigureError("Stage 2 output is older than the intake; rerun segmentation first")
    potrace = potrace or shutil.which("potrace")
    target = paper_dir / STAGE
    if target.exists() and not replace:
        raise FigureError(f"{paper_id}/{STAGE} already exists; pass --replace to redo figures")
    images = {image["sha256"]: image for image in manifest["images"]}
    ocr = ocr or default_ocr(work_root)
    ocr_cache = work_root / ".cache" / "ocr-vision-v1"

    staging = pathlib.Path(tempfile.mkdtemp(prefix=f".{STAGE}-", dir=paper_dir))
    totals = {"questions": 0, "figures": 0, "embedded": 0, "pageRender": 0,
              "svgVerified": 0, "svgFailed": 0, "notEligible": 0}
    records = []
    try:
        with fitz.open(paper_dir / "01-intake" / "source" / manifest["source"]["files"][0]["name"]) as doc:
            for question in segments["questions"]:
                folder = staging / question["key"]
                folder.mkdir()
                block = block_image(doc, question["regions"]) if question["regions"] else None
                record = {"key": question["key"], "block": None, "figures": []}
                if block is not None:
                    data = png_bytes(block)
                    (folder / "block.png").write_bytes(data)
                    record["block"] = {"file": f"{question['key']}/block.png", "sha256": sha256(data),
                                       "width": block.width, "height": block.height, "dpi": BLOCK_DPI}
                for number, placement in enumerate(question["figures"], 1):
                    stored = images.get(placement["sha256"]) if placement["sha256"] else None
                    raw = (paper_dir / "01-intake" / stored["file"]).read_bytes() if stored else None
                    image, provenance = canonical_figure(doc, placement, raw)
                    data = png_bytes(image)
                    check_png(data, image)
                    with Image.open(io.BytesIO(data)) as reopened:  # PNG must hold exactly these pixels
                        if not np.array_equal(np.asarray(reopened), np.asarray(image)):
                            raise FigureError("PNG round trip changed pixels")
                    name = f"fig-{number}"
                    (folder / f"{name}.png").write_bytes(data)
                    figure = {
                        "id": f"{question['key']}-{name}", "page": placement["page"], "box": placement["box"],
                        "role": None, "canonical": {"file": f"{question['key']}/{name}.png", "sha256": sha256(data),
                                                    "width": image.width, "height": image.height,
                                                    "embeddedSha256": placement["sha256"], **provenance},
                    }
                    totals["figures"] += 1
                    totals["embedded" if provenance["source"] == "embedded" else "pageRender"] += 1
                    words = figure_text(ocr, folder / f"{name}.png", figure["canonical"]["sha256"], ocr_cache)
                    figure["textInside"] = words
                    if potrace:
                        result, report = vector_trial(image, potrace)
                        if words and report["status"] in ("verified", "failed"):
                            # Labels inside the picture are traced as outlines: faithful to look at,
                            # but not editable text. The reviewer sees this flag.
                            report["textAsOutlines"] = True
                    else:
                        result, report = None, {"status": "not-run", "reasons": ["potrace-not-installed"]}
                    if report["status"] in ("verified", "failed"):
                        svg, rendered = result
                        board(image, rendered, report["metrics"], report["reasons"]).save(folder / f"{name}.board.png")
                        report["board"] = f"{question['key']}/{name}.board.png"
                        if report["status"] == "verified":
                            (folder / f"{name}.svg").write_text(svg)
                            report["file"] = f"{question['key']}/{name}.svg"
                            report["sha256"] = sha256(svg.encode("utf-8"))
                    totals[{"verified": "svgVerified", "failed": "svgFailed"}.get(report["status"], "notEligible")] += 1
                    figure["vector"] = report
                    record["figures"].append(figure)
                assign_roles(question, record["figures"])
                records.append(record)
                totals["questions"] += 1
        result = {"schema": SCHEMA, "stage": STAGE, "paperId": paper_id,
                  "segmentsSha256": sha256(segments_path.read_bytes()), "totals": totals, "questions": records}
        (staging / "figures.json").write_text(json.dumps(result, indent=1) + "\n")
        if target.exists():
            shutil.rmtree(target)
        staging.replace(target)
    except BaseException:
        shutil.rmtree(staging, ignore_errors=True)
        raise
    return {"paperId": paper_id, "output": str(target), **totals}


def assign_roles(question, figures):
    """Name figures when the layout says so: four similar images are options A-D, and a
    fifth before them is the stem. Anything else stays "figure" for the reviewer."""
    if question["type"] not in ("MCQ", "MSQ") or not figures:
        for figure in figures:
            figure["role"] = "figure"
        return
    areas = [f["canonical"]["width"] * f["canonical"]["height"] for f in figures]
    tail = figures[-4:]
    tail_areas = areas[-4:]
    similar = len(tail) == 4 and max(tail_areas) <= 1.6 * min(tail_areas)
    if similar and len(figures) in (4, 5) and not question["options"]:
        for key, figure in zip("ABCD", tail):
            figure["role"] = f"option-{key}"
        if len(figures) == 5:
            figures[0]["role"] = "stem"
        return
    for figure in figures:
        figure["role"] = "figure"


def main(argv=None):
    parser = argparse.ArgumentParser(description="Stage 3: canonical figures and verified SVG trials.")
    parser.add_argument("--paper-id", required=True)
    parser.add_argument("--work", required=True)
    parser.add_argument("--replace", action="store_true")
    args = parser.parse_args(argv)
    try:
        summary = run_figures(work=args.work, paper_id=args.paper_id, replace=args.replace)
    except (FigureError, subprocess.CalledProcessError) as error:
        print(json.dumps({"error": str(error)}), file=sys.stderr)
        return 1
    print(json.dumps(summary))
    return 0


if __name__ == "__main__":
    sys.exit(main())
