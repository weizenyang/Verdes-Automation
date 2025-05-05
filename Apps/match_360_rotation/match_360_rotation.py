#!/usr/bin/env python3
import cv2
import numpy as np
import os
import sys
import csv
from concurrent.futures import ProcessPoolExecutor

# Globals for worker processes
CURRENT_ROOT = None
TARGET_CACHE = {}


def safe_imread(path):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Could not load image at '{path}'.")
    print(f"[LOG] Loaded image '{path}' (shape={img.shape})")
    return img


def estimate_yaw_and_confidence(current_img, raw_target_edges,
                                edge_thresh=(50,150)):
    gray_cur = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)
    raw_cur  = cv2.Canny(gray_cur, *edge_thresh)
    shift, _ = cv2.phaseCorrelate(raw_cur.astype(np.float32),
                                  raw_target_edges.astype(np.float32))
    dx        = shift[0]
    shift_pix = int(round(dx))
    yaw_deg   = (dx / raw_cur.shape[1]) * 360.0
    edges_aligned = np.roll(raw_cur, shift_pix, axis=1)
    cur_aligned   = np.roll(current_img, shift_pix, axis=1)
    return shift_pix, yaw_deg, raw_cur, edges_aligned, cur_aligned


def preprocess_targets(target_root, edge_thresh=(50,150)):
    print(f"[LOG] Caching target edges from '{target_root}'")
    cache = {}
    for dirpath, _, files in os.walk(target_root):
        for f in files:
            if f.lower().endswith(('.jpg', '.jpeg', '.png')):
                path = os.path.join(dirpath, f)
                img = cv2.imread(path)
                if img is None:
                    continue
                gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
                cache[path] = cv2.Canny(gray, *edge_thresh)
    print(f"[LOG] Cached {len(cache)} target images.")
    return cache


def init_worker(cache, current_root):
    global TARGET_CACHE, CURRENT_ROOT
    TARGET_CACHE = cache
    CURRENT_ROOT = current_root


def worker(args):
    cur_path, tgt_path, export_folder = args
    print(f"[LOG] Processing: current='{cur_path}' matched to target='{tgt_path}'")
    cur_img = safe_imread(cur_path)
    raw_tgt = TARGET_CACHE[tgt_path]
    shift_pix, yaw, raw_cur, edges_aligned, cur_aligned = \
        estimate_yaw_and_confidence(cur_img, raw_tgt)
    rel_dir = os.path.relpath(os.path.dirname(cur_path), CURRENT_ROOT)
    out_dir = os.path.join(export_folder, rel_dir)
    os.makedirs(out_dir, exist_ok=True)
    base = os.path.splitext(os.path.basename(cur_path))[0]
    out_file = os.path.join(out_dir, f"{base}.jpg")
    cv2.imwrite(out_file, cur_aligned, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
    print(f"[LOG] Saved aligned image to '{out_file}' (yaw={yaw:.1f}°, shift={shift_pix}px)")
    return cur_path, shift_pix, yaw


def main():
    if len(sys.argv) != 4:
        print("Usage: match_360_rotation.py <current_root> <target_root> <export_folder>", file=sys.stderr)
        sys.exit(1)
    current_root, target_root, export_folder = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(export_folder, exist_ok=True)

    print(f"[LOG] Starting: current_root='{current_root}', target_root='{target_root}', export_folder='{export_folder}'")

    # Cache target edges once
    target_cache = preprocess_targets(target_root)
    target_list  = list(target_cache.keys())

    # Build matching pairs
    pairs = []
    for dirpath, _, files in os.walk(current_root):
        for f in files:
            if not f.lower().endswith(('.jpg', '.jpeg', '.png')):
                continue
            cur_fp    = os.path.join(dirpath, f)
            cur_base  = os.path.splitext(f)[0]
            for tgt_fp in target_list:
                tgt_base = os.path.splitext(os.path.basename(tgt_fp))[0]
                if tgt_base in cur_base:
                    pairs.append((cur_fp, tgt_fp, export_folder))
                    break

    print(f"[LOG] Found {len(pairs)} matching pairs:")
    for cur_fp, tgt_fp, _ in pairs:
        print(f"  [PAIR] {cur_fp} → {tgt_fp}")

    # Generate timestamped CSV filename for logging rotations
    from datetime import datetime
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    csv_name = f"LOG_{timestamp}.csv"
    csv_path = os.path.join(export_folder, csv_name)
    # Open CSV for logging rotations
    with open(csv_path, 'w', newline='') as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(['name', 'pixels', 'angle'])

        # Process in parallel (max 5 workers)
        with ProcessPoolExecutor(max_workers=5,
                                  initializer=init_worker,
                                  initargs=(target_cache, current_root)) as executor:
            for cur_path, shift_pix, yaw in executor.map(worker, pairs):
                writer.writerow([os.path.basename(cur_path), shift_pix, f"{yaw:.2f}"])
                print(f"[LOG] Logged '{os.path.basename(cur_path)}': pixels={shift_pix}, angle={yaw:.2f}°")

    print(f"[LOG] Rotation log saved to '{csv_path}'")

if __name__ == '__main__':
    main()
