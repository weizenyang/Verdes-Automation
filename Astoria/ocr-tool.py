import cv2
import numpy as np
import easyocr
import os
from pathlib import Path
from PIL import Image  # used as a fallback for image loading
import math

def composite_onto_black(foreground_path, bg_width=4096, bg_height=4096):
    """
    Composites a foreground (PNG or WEBP) onto a black background
    of size bg_width x bg_height, then returns the composited image.
    Supports images with or without an alpha channel.
    """
    # 1) Create a blank black background
    background = np.zeros((bg_height, bg_width, 3), dtype=np.uint8)  # BGR

    # 2) Read the foreground (try OpenCV first)
    foreground = cv2.imread(str(foreground_path), cv2.IMREAD_UNCHANGED)
    if foreground is None:
        # Fallback: use Pillow
        try:
            with Image.open(str(foreground_path)) as pil_img:
                # Convert to RGBA to ensure alpha channel exists
                pil_img = pil_img.convert("RGBA")
                foreground = np.array(pil_img)
                # Convert from RGBA (PIL) to BGRA (OpenCV)
                foreground = cv2.cvtColor(foreground, cv2.COLOR_RGBA2BGRA)
        except Exception as e:
            raise FileNotFoundError(f"Could not load {foreground_path}: {e}")

    rows, cols, channels = foreground.shape

    # 3) If the image has only 3 channels, add a fully opaque alpha channel
    if channels == 3:
        alpha_channel = np.ones((rows, cols), dtype=np.uint8) * 255
        foreground = np.dstack([foreground, alpha_channel])
        channels = 4

    # 4) Center the foreground on the background
    x_offset = (bg_width  - cols) // 2
    y_offset = (bg_height - rows) // 2

    # 5) Split foreground into B, G, R, A
    b, g, r, a = cv2.split(foreground)
    foreground_rgb = cv2.merge((b, g, r))

    # 6) Extract the ROI from the background
    roi = background[y_offset:y_offset+rows, x_offset:x_offset+cols]

    # 7) Convert alpha to [0,1] range
    alpha_mask = a.astype(float) / 255.0
    alpha_mask_3 = cv2.merge((alpha_mask, alpha_mask, alpha_mask))

    # 8) Convert both ROI and foreground to float for alpha blending
    roi_float = roi.astype(float)
    foreground_float = foreground_rgb.astype(float)

    # 9) Alpha-blend: blended = alpha*fg + (1-alpha)*bg
    blended = alpha_mask_3 * foreground_float + (1 - alpha_mask_3) * roi_float
    blended = blended.astype(np.uint8)

    # 10) Place blended region back into background
    background[y_offset:y_offset+rows, x_offset:x_offset+cols] = blended

    return background

def draw_ocr_results_svg(results, svg_filename, image_width=4096, image_height=4096):
    """
    Generates an SVG file (image_width x image_height) with
    merged bounding-box rectangles for each cluster of nearby text regions.
    Each rectangle contains:
      - data-name: the concatenated detected text
      - data-rotation: fixed at 180 (upright)
    """
    # Start the SVG content
    svg_lines = [
        f'<svg width="{image_width}" height="{image_height}" xmlns="http://www.w3.org/2000/svg">',
        '<style> rect { fill: black; stroke: none; } </style>'
    ]

    # 0) Build raw boxes
    raw_boxes = []
    for coords, text, _ in results:
        xs = [pt[0] for pt in coords]
        ys = [pt[1] for pt in coords]
        raw_boxes.append({
            'x0': min(xs), 'y0': min(ys),
            'x1': max(xs), 'y1': max(ys),
            'text': text
        })

    # 1) Merge any boxes within threshold of each other
    thresh = 20
    merged = []
    for box in raw_boxes:
        x0,y0,x1,y1,txt = box['x0'],box['y0'],box['x1'],box['y1'],box['text']
        did_merge = False
        for m in merged:
            # if overlap or within thresh in either dimension
            if not (x1 < m['x0']-thresh or x0 > m['x1']+thresh or
                    y1 < m['y0']-thresh or y0 > m['y1']+thresh):
                # union their extents
                m['x0'], m['y0'] = min(m['x0'], x0), min(m['y0'], y0)
                m['x1'], m['y1'] = max(m['x1'], x1), max(m['y1'], y1)
                m['text'] += " " + txt
                did_merge = True
                break
        if not did_merge:
            merged.append({'x0':x0,'y0':y0,'x1':x1,'y1':y1,'text':txt})

    # 2) Emit SVG rects for merged boxes
    for m in merged:
        x_min, y_min = m['x0'], m['y0']
        width  = m['x1'] - m['x0']
        height = m['y1'] - m['y0']
        rect_tag = (
            f'<rect x="{x_min}" y="{y_min}" width="{width}" height="{height}" '
            f'data-name="{m["text"]}" data-rotation="180" />'
        )
        svg_lines.append(rect_tag)

    svg_lines.append('</svg>')

    # Write out the SVG
    with open(svg_filename, "w", encoding="utf-8") as f:
        f.write("\n".join(svg_lines))

    print(f"Saved SVG overlay to: {svg_filename}")


def main():
    input_dir = Path("DIMS/original")
    output_dir = Path("DIMS/mask")
    output_dir.mkdir(exist_ok=True)

    # Initialize EasyOCR (set gpu=False if GPU support is not available on your Mac)
    reader = easyocr.Reader(['en'], gpu=True)

    # Process every PNG and WEBP file in the input_images folder
    supported_exts = {'.png', '.webp'}
    images = [p for p in input_dir.iterdir() if p.suffix.lower() in supported_exts]
    if not images:
        print(f"No supported images found in {input_dir}. Supported formats: {supported_exts}")
        return

    for image_path in images:
        print(f"\nProcessing: {image_path.name}")

        try:
            # Composite onto 4096x4096 black background
            composited_4096 = composite_onto_black(image_path, 4096, 4096)

            # Also resize to 1500x1500
            composited_1500 = cv2.resize(composited_4096, (1500, 1500), interpolation=cv2.INTER_AREA)

            # Save outputs (uncomment if you want to save the processed images)
            # output_4096_path = output_dir / f"{image_path.stem}_4096.png"
            # output_1500_path = output_dir / f"{image_path.stem}_1500.png"
            # cv2.imwrite(str(output_4096_path), composited_4096)
            # cv2.imwrite(str(output_1500_path), composited_1500)
            # print(f"  Saved 4096 -> {output_4096_path}")
            # print(f"  Saved 1500 -> {output_1500_path}")

            # OCR the 4096 image
            results = reader.readtext(composited_4096)
            print("  OCR Results:")
            for det in results:
                box, text, conf = det
                print(f"    {text} (conf={conf:.2f})")

            # Create an SVG overlay with bounding boxes and data attributes
            svg_path = output_dir / f"{image_path.stem}.svg"
            draw_ocr_results_svg(
                results=results,
                svg_filename=str(svg_path),
                image_width=4096,
                image_height=4096
            )

        except Exception as e:
            print(f"Error processing {image_path.name}: {e}")

if __name__ == "__main__":
    main()
