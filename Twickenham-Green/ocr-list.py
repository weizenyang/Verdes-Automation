#!/usr/bin/env python3
import cv2
import numpy as np
import easyocr
import os
import math
from pathlib import Path
from PIL import Image
import xml.sax.saxutils as saxutils


def composite_onto_black(foreground_path, bg_width=4096, bg_height=4096):
    background = np.zeros((bg_height, bg_width, 3), dtype=np.uint8)
    fg = cv2.imread(str(foreground_path), cv2.IMREAD_UNCHANGED)
    if fg is None:
        pil = Image.open(str(foreground_path)).convert("RGBA")
        arr = np.array(pil)
        fg = cv2.cvtColor(arr, cv2.COLOR_RGBA2BGRA)
    h, w = fg.shape[:2]
    if fg.shape[2] == 3:
        alpha = np.ones((h, w), np.uint8) * 255
        fg = np.dstack((fg, alpha))
    b, g, r, a = cv2.split(fg)
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
    gray = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2GRAY)
    _, thresh = cv2.threshold(gray, 200, 255, cv2.THRESH_BINARY_INV)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5,5))
    clean = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
    contours, _ = cv2.findContours(clean, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    boxes = []
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area < min_area or area > max_area:
            continue
        per = cv2.arcLength(cnt, True)
        if per == 0:
            continue
        circ = 4 * math.pi * area / (per * per)
        if circ < circularity_thresh:
            continue
        x, y, w, h = cv2.boundingRect(cnt)
        ar = w/h if h>0 else 0
        if ar < 0.7 or ar > 1.3:
            continue
        boxes.append((x, y, x+w, y+h))
    return boxes


def merge_close_boxes(rects, gap=20):
    """
    Merge rectangles in `rects` (x1,y1,x2,y2) if they overlap or are within `gap` pixels.
    Returns a list of merged rectangles.
    """
    merged = []
    # initial pass
    for r in rects:
        x1, y1, x2, y2 = r
        added = False
        for i, m in enumerate(merged):
            mx1, my1, mx2, my2 = m
            if (x1 <= mx2 + gap and x2 >= mx1 - gap and
                y1 <= my2 + gap and y2 >= my1 - gap):
                merged[i] = (
                    min(mx1, x1), min(my1, y1),
                    max(mx2, x2), max(my2, y2)
                )
                added = True
                break
        if not added:
            merged.append((x1, y1, x2, y2))
    # iterative merge until stable
    changed = True
    while changed:
        changed = False
        new = []
        for r in merged:
            x1, y1, x2, y2 = r
            placed = False
            for i, m in enumerate(new):
                mx1, my1, mx2, my2 = m
                if (x1 <= mx2 + gap and x2 >= mx1 - gap and
                    y1 <= my2 + gap and y2 >= my1 - gap):
                    new[i] = (
                        min(mx1, x1), min(my1, y1),
                        max(mx2, x2), max(my2, y2)
                    )
                    changed = True
                    placed = True
                    break
            if not placed:
                new.append(r)
        merged = new
    return merged


def draw_ocr_results_svg(results, svg_filename,
                         image_width=4096, image_height=4096,
                         merge_gap=20):
    """
    Draw merged bounding boxes for words & bullets that are close.
    """
    # collect all bounding rects
    rects = []
    for coords, _, _ in results:
        xs = [pt[0] for pt in coords]
        ys = [pt[1] for pt in coords]
        rects.append((min(xs), min(ys), max(xs), max(ys)))
    # include bullet_results as already rects
    # merge
    merged = merge_close_boxes(rects, gap=merge_gap)
    # svg output
    lines = [
        f'<svg width="{image_width}" height="{image_height}" xmlns="http://www.w3.org/2000/svg">',
        '<style>rect{fill:black;stroke:none;}</style>'
    ]
    for x1, y1, x2, y2 in merged:
        w = x2 - x1
        h = y2 - y1
        lines.append(f'<rect x="{x1}" y="{y1}" width="{w}" height="{h}"/>')
    lines.append('</svg>')
    with open(svg_filename, 'w', encoding='utf-8') as f:
        f.write("\n".join(lines))
    print(f"Saved SVG overlay to: {svg_filename}")


def main():
    input_dir = Path("images/original")
    output_dir = Path("images/mask")
    output_dir.mkdir(parents=True, exist_ok=True)

    reader = easyocr.Reader(['en'], gpu=False)
    exts = {'.png', '.webp'}
    images = [p for p in input_dir.iterdir() if p.suffix.lower() in exts]
    if not images:
        print(f"No supported images in {input_dir}")
        return

    for p in images:
        print(f"Processing: {p.name}")
        img_bgr = composite_onto_black(p, 4096, 4096)
        img_rgb = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2RGB)
        word_results = reader.readtext(img_rgb)
        bullet_boxes = detect_bullets(img_bgr)
        bullet_results = [( [(x1,y1),(x2,y1),(x2,y2),(x1,y2)], '•', 1.0 )
                          for x1,y1,x2,y2 in bullet_boxes]
        results = word_results + bullet_results
        if not results:
            print(f"No detections in {p.name}")
            continue
        print(f"  Words: {len(word_results)}, bullets: {len(bullet_boxes)}")
        svg_file = output_dir / f"{p.stem}.svg"
        draw_ocr_results_svg(results, str(svg_file), 4096, 4096, merge_gap=20)

if __name__ == '__main__':
    main()