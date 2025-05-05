import cv2
import numpy as np
import os
import sys

def safe_imread(path):
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(f"Could not load image at '{path}'. Check that the file exists and the path is correct.")
    return img

def estimate_yaw_and_confidence(current_img, target_img,
                                edge_thresh=(50,150),
                                overlap_metric='iou'):
    """
    Estimate yaw offset between two equirectangular images,
    compute an overlap confidence, and return edge maps aligned to the target frame.
    """
    # Convert to grayscale
    gray_current = cv2.cvtColor(current_img, cv2.COLOR_BGR2GRAY)
    gray_target = cv2.cvtColor(target_img, cv2.COLOR_BGR2GRAY)

    # Detect edges
    raw_current = cv2.Canny(gray_current, *edge_thresh)
    raw_target = cv2.Canny(gray_target, *edge_thresh)

    # Phase correlation to find horizontal shift (pixels)
    f_current = raw_current.astype(np.float32)
    f_target = raw_target.astype(np.float32)
    shift, _ = cv2.phaseCorrelate(f_current, f_target)
    dx = shift[0]
    shift_pix = int(round(dx))
    yaw_deg = (dx / gray_current.shape[1]) * 360.0

    # Roll current image & edges into target frame
    aligned_edges = np.roll(raw_current, shift_pix, axis=1)
    aligned_current_img = np.roll(current_img, shift_pix, axis=1)

    # Edge maps for comparison: target is reference
    b_ref = (raw_target > 0).astype(np.uint8)
    b_aligned = (aligned_edges > 0).astype(np.uint8)

    # Compute overlap confidence
    intersection = np.logical_and(b_ref, b_aligned).sum()
    union = np.logical_or(b_ref, b_aligned).sum()
    total_ref = b_ref.sum()
    if overlap_metric == 'iou':
        confidence = intersection / union if union > 0 else 0.0
    else:  # precision
        confidence = intersection / total_ref if total_ref > 0 else 0.0

    return yaw_deg, confidence, shift_pix, raw_current, raw_target, aligned_edges, aligned_current_img

if __name__ == '__main__':
    # Paths for current and target images
    current_path = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/Apps/match_360_rotation/current.jpg'
    target_path = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/Apps/match_360_rotation/target.png'

    try:
        current_img = safe_imread(current_path)
        target_img = safe_imread(target_path)
    except FileNotFoundError as e:
        print(e, file=sys.stderr)
        sys.exit(1)

    # Estimate yaw and get aligned maps
    yaw, conf, pix, edges_current, edges_target, edges_aligned, current_aligned = \
        estimate_yaw_and_confidence(
            current_img, target_img,
            edge_thresh=(50,150),
            overlap_metric='precision'
        )

    print(f"Yaw offset: {yaw:.2f}°, Confidence: {conf:.2%}")

    # Save outputs next to this script
    script_dir = os.path.dirname(os.path.abspath(__file__))
    base_current = os.path.splitext(os.path.basename(current_path))[0]
    base_target = os.path.splitext(os.path.basename(target_path))[0]

    cv2.imwrite(os.path.join(script_dir, f"{base_current}_edges.png"), edges_current)
    cv2.imwrite(os.path.join(script_dir, f"{base_target}_edges.png"), edges_target)
    cv2.imwrite(os.path.join(script_dir, f"{base_current}_edges_aligned.png"), edges_aligned)
    cv2.imwrite(os.path.join(script_dir, f"{base_current}_aligned_to_target.png"), current_aligned)

    print("Saved:")
    print(f" • {base_current}_edges.png")
    print(f" • {base_target}_edges.png")
    print(f" • {base_current}_edges_aligned.png")
    print(f" • {base_current}_aligned_to_target.png")
