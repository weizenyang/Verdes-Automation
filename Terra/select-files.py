import os
import csv
from PIL import Image

# ─── CONFIG ────────────────────────────────────────────────────────────────────
INPUT_ROOT  = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/Terra/Floorplans/output'    # e.g. '/mnt/data/images'
OUTPUT_ROOT = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/Terra/Floorplans/selected_output'    # e.g. '/mnt/data/selected'
CSV_PATH    = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/Terra/selection.csv'
# List any extensions your images might have here:
EXTENSIONS = ['.png', '.jpg', '.jpeg', '.bmp', '.gif']
# ──────────────────────────────────────────────────────────────────────────────

def load_mapping(csv_path):
    mapping = []
    with open(csv_path, newline='') as f:
        for row in csv.reader(f):
            if len(row) < 2: continue
            name_sub, folder = row[0].strip(), row[1].strip()
            if name_sub and folder:
                mapping.append((name_sub, folder))
    mapping.sort(key=lambda x: len(x[0]), reverse=True)
    return mapping

def resize_to_max(img, max_px):
    w, h = img.size
    if max(w, h) <= max_px:
        return img
    if w > h:
        new_w = max_px
        new_h = round(h * max_px / w)
    else:
        new_h = max_px
        new_w = round(w * max_px / h)
    return img.resize((new_w, new_h), Image.LANCZOS)

def find_and_convert(name_sub, folder):
    src_dir = os.path.join(INPUT_ROOT, folder)
    dst_dir = os.path.join(OUTPUT_ROOT, folder)
    os.makedirs(dst_dir, exist_ok=True)
    os.makedirs(OUTPUT_ROOT, exist_ok=True)

    base_sub = name_sub.replace('bf', 'b', 1) if 'bf' in name_sub else name_sub
    found = False

    for fname in os.listdir(src_dir):
        stem, ext = os.path.splitext(fname)
        if ext.lower() in EXTENSIONS and base_sub in stem:
            src_path = os.path.join(src_dir, fname)
            out_name = stem.replace(base_sub, name_sub) + '.webp'
            dst_path = os.path.join(dst_dir, out_name)
            root_path = os.path.join(OUTPUT_ROOT, out_name)

            with Image.open(src_path) as im:
                im = im.convert('RGBA')
                im = resize_to_max(im, 4096)
                # save into sub-folder
                im.save(dst_path, format='WEBP', quality=80)
                # simultaneously save the same file into the root
                im.save(root_path, format='WEBP', quality=80)

            print(f"Converted {src_path!r} → {dst_path!r}")
            print(f"Also wrote root copy → {root_path!r}")
            found = True

    if not found:
        print(f"⚠️  No match for substring {base_sub!r} in {src_dir!r}")

def main():
    mapping = load_mapping(CSV_PATH)
    for name_sub, folder in mapping:
        find_and_convert(name_sub, folder)

if __name__ == '__main__':
    main()