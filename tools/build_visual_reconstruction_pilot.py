#!/usr/bin/env python3
"""Build two traceable SVG pilots and pixel-comparison boards from NID scans."""

import json
import subprocess
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from skimage.metrics import structural_similarity


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "output/visual-pilot"
TMP = ROOT / "tmp/visual-pilot"
PILOTS = [
    {
        "id": "geometric-tile-composition",
        "source": ROOT / "server/data/media/nid-bdes-2020/page-006.png",
        "crop": (190, 250, 1500, 1000),
    },
    {
        "id": "expressive-fork-silhouettes",
        "source": ROOT / "server/data/media/nid-bdes-2018/page-006.png",
        "crop": (140, 1000, 1480, 1300),
    },
]


def deskew(gray):
    foreground = np.column_stack(np.where(gray < 180))
    if len(foreground) < 20:
        return gray, 0.0
    angle = cv2.minAreaRect(foreground[:, ::-1].astype(np.float32))[-1]
    angle = angle - 90 if angle > 45 else angle
    if abs(angle) < 0.12 or abs(angle) > 2.5:
        return gray, 0.0
    h, w = gray.shape
    matrix = cv2.getRotationMatrix2D((w / 2, h / 2), angle, 1.0)
    return cv2.warpAffine(gray, matrix, (w, h), flags=cv2.INTER_CUBIC, borderValue=255), angle


def label_font(size=24):
    candidates = [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Supplemental/Helvetica.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            return ImageFont.truetype(path, size)
    return ImageFont.load_default()


def comparison_board(source, rendered, diff, title, metrics):
    gap, header = 24, 76
    w, h = source.size
    board = Image.new("RGB", (w * 3 + gap * 4, h + header + gap), "white")
    draw = ImageDraw.Draw(board)
    font = label_font(22)
    small = label_font(17)
    draw.text((gap, 12), title, fill="#111111", font=font)
    draw.text((gap, 42), metrics, fill="#444444", font=small)
    for index, (name, image) in enumerate((("SOURCE CROP", source), ("SVG RENDER", rendered), ("PIXEL DIFFERENCE", diff))):
        x = gap + index * (w + gap)
        board.paste(image.convert("RGB"), (x, header))
        draw.rectangle((x, header, x + w - 1, header + h - 1), outline="#bbbbbb", width=1)
        draw.text((x + 8, header + 8), name, fill="#d71920" if index == 2 else "#111111", font=small, stroke_width=3, stroke_fill="white")
    return board


def build(item):
    pilot_id = item["id"]
    with Image.open(item["source"]) as page:
        source = page.convert("RGB").crop(item["crop"])
    source_path = OUT / f"{pilot_id}-source.png"
    source.save(source_path, optimize=True)

    gray = cv2.cvtColor(np.asarray(source), cv2.COLOR_RGB2GRAY)
    gray = cv2.fastNlMeansDenoising(gray, None, 7, 7, 21)
    gray, angle = deskew(gray)
    normalized = cv2.createCLAHE(clipLimit=1.5, tileGridSize=(8, 8)).apply(gray)
    binary = cv2.threshold(normalized, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, np.ones((2, 2), np.uint8))
    preprocessed_path = OUT / f"{pilot_id}-preprocessed.png"
    cv2.imwrite(str(preprocessed_path), binary)

    pbm_path = TMP / f"{pilot_id}.pbm"
    Image.fromarray(binary).convert("1").save(pbm_path)
    raw_svg = TMP / f"{pilot_id}-potrace.svg"
    final_svg = OUT / f"{pilot_id}.svg"
    subprocess.run(["potrace", str(pbm_path), "--svg", "--turdsize", "3", "--alphamax", "1.0", "--opttolerance", "0.15", "-o", str(raw_svg)], check=True)
    subprocess.run(["inkscape", str(raw_svg), "--vacuum-defs", "--export-text-to-path", f"--export-filename={final_svg}"], check=True)

    rendered_path = OUT / f"{pilot_id}-svg-render.png"
    h, w = binary.shape
    subprocess.run([
        "inkscape", str(final_svg), "--export-type=png", f"--export-width={w}",
        f"--export-height={h}", f"--export-filename={rendered_path}"
    ], check=True)
    rendered = Image.open(rendered_path).convert("L").resize((w, h), Image.Resampling.LANCZOS)
    rendered_arr = np.asarray(rendered)
    rendered_binary = cv2.threshold(rendered_arr, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)[1]
    score = structural_similarity(binary, rendered_binary, data_range=255)
    different = np.abs(binary.astype(np.int16) - rendered_binary.astype(np.int16)) > 32
    difference_percent = float(different.mean() * 100.0)
    diff_rgb = np.full((h, w, 3), 255, dtype=np.uint8)
    diff_rgb[different] = (220, 25, 35)
    diff_image = Image.fromarray(diff_rgb)
    metrics = f"SSIM {score:.5f}  |  differing pixels {difference_percent:.3f}%  |  deskew {angle:.3f}°"
    board = comparison_board(source, rendered.convert("RGB"), diff_image, pilot_id.replace("-", " ").title(), metrics)
    board_path = OUT / f"{pilot_id}-comparison.png"
    board.save(board_path, optimize=True)
    return {
        "id": pilot_id,
        "source": str(source_path.relative_to(ROOT)),
        "preprocessed": str(preprocessed_path.relative_to(ROOT)),
        "svg": str(final_svg.relative_to(ROOT)),
        "rendered": str(rendered_path.relative_to(ROOT)),
        "comparison": str(board_path.relative_to(ROOT)),
        "ssim": round(float(score), 6),
        "differentPixelPercent": round(difference_percent, 4),
        "deskewDegrees": round(float(angle), 4),
        "dimensions": [w, h],
    }


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    report = {"workflow": ["PyMuPDF source render", "OpenCV", "Pillow", "Potrace", "Inkscape", "SVG", "browser-ready"], "pilots": []}
    for item in PILOTS:
        report["pilots"].append(build(item))
    report_path = OUT / "pilot-report.json"
    report_path.write_text(json.dumps(report, indent=2))
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
