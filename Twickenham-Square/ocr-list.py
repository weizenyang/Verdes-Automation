#!/usr/bin/env python3
import cv2
import numpy as np
import easyocr
import os
import math
import xml.sax.saxutils as saxutils
from pathlib import Path
from PIL import Image


def composite_onto_black(foreground_path, bg_width=4096, bg_height=4096):
    background = np.zeros((bg_height, bg_width, 3), dtype=np.uint8)
    foreground = cv2.imread(str(foreground_path), cv2.IMREAD_UNCHANGED)
    if foreground is None:
        pil_img = Image.open(str(foreground_path)).convert("RGBA")
        fg = np.array(pil_img)
        foreground = cv2.cvtColor(fg, cv2.COLOR_RGBA2BGRA)
    h, w = foreground.shape[:2]
    if foreground.shape[2] == 3:
        alpha = np.ones((h, w), np.uint8) * 255
        foreground = np.dstack((foreground, alpha))
    b, g, r, a = cv2.split(foreground)
    fg_rgb = cv2.merge((b, g, r))
    x_off = (bg_width - w) // 2
    y_off = (bg_height - h) // 2
    roi = background[y_off:y_off+h, x_off:x_off+w]
    alpha_f = a.astype(float) / 255.0
    alpha_3 = cv2.merge((alpha_f, alpha_f, alpha_f))
    blended = (alpha_3 * fg_rgb.astype(float) + (1 - alpha_3) * roi.astype(float)).astype(np.uint8)
    background[y_off:y_off+h, x_off:x_off+w] = blended
    return background


def detect_bullets(image_bgr,
                   min_area=500,
                   max_area=5000,
                   circularity_thresh=0.6):
    """
    Detect filled circular bullets via contour analysis.
    Returns a list of 4-point boxes around each bullet.
    """
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    # Threshold to isolate dark circular shapes on light background
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    # Clean small noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5))
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        perimeter = cv2.arcLength(cnt, True)
        if perimeter == 0:
            continue
        circ = 4 * math.pi * area / (perimeter * perimeter)
        if circ < circularity_thresh:
            continue
        x,y,w,h = cv2.boundingRect(cnt)
        # filter by aspect ratio ~1
        ar = w/h if h>0 else 0
        if ar < 0.7 or ar > 1.3:
            continue
        # create 4-point box
        coords = [(x,y), (x+w,y), (x+w,y+h), (x,y+h)]
        boxes.append(coords)
    return boxes


def draw_ocr_results_svg(results, svg_filename, image_width=4096, image_height=4096):
    svg = [
        f'<svg width="{image_width}" height="{image_height}" xmlns="http://www.w3.org/2000/svg">'
    ]
    for coords, text, _ in results:
        xs = [pt[0] for pt in coords]
        ys = [pt[1] for pt in coords]
        x_min, y_min = min(xs), min(ys)
        w, h = max(xs)-x_min, max(ys)-y_min
        svg.append(
            '<rect '
            f'x="{x_min}" y="{y_min}" width="{w}" height="{h}" '
            f'/>'
        )
    svg.append('</svg>')
    with open(svg_filename, 'w', encoding='utf-8') as f:
        f.write("\n".join(svg))
    print(f"Saved SVG overlay to: {svg_filename}")


def main():
    input_dir = Path("images/original")
    output_dir = Path("images/mask")
    output_dir.mkdir(parents=True, exist_ok=True)

    reader = easyocr.Reader(['en'], gpu=False)
    exts = {'.png', '.webp'}
    images = [p for p in input_dir.iterdir() if p.suffix.lower() in exts]
    if not images:
        print(f"No supported images found in {input_dir}")
        return

    for p in images:
        print(f"Processing: {p.name}")
        img_bgr = composite_onto_black(p, 4096, 4096)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)

        # OCR words
        word_results = reader.readtext(img_rgb)
        # Detect bullets via contour
        bullet_boxes = detect_bullets(img_bgr)
        bullet_results = [(coords, '•', 1.0) for coords in bullet_boxes]

        results = word_results + bullet_results
        if not results:
            print(f"No detections in {p.name}")
            continue

        for _, txt, conf in word_results:
            print(f"  {txt} (conf={conf:.2f})")
        print(f"  Detected {len(bullet_boxes)} bullet(s)")

        svg_file = output_dir / f"{p.stem}.svg"
        draw_ocr_results_svg(results, str(svg_file), 4096, 4096)

if __name__ == '__main__':
    main()
