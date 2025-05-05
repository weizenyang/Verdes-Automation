#!/usr/bin/env python3
import os
import re
import csv
import argparse

# matches tags like "0_bathroom_1", capturing:
#   group(1) = "0_bathroom"
#   group(2) = "1"
TAG_RE = re.compile(r"^(\d+_[^_]+)_(\d+)$")


def scan_max_cams(rows):
    """
    Given a list of rows (lists of strings), returns a dict:
      { prefix: max_camera_number }
    where prefix is e.g. "0_bathroom".
    """
    max_by_group = {}
    for row in rows:
        if not row:
            continue
        m = TAG_RE.match(row[0])
        if not m:
            continue
        prefix, cam = m.groups()
        cam = int(cam)
        max_by_group[prefix] = max(max_by_group.get(prefix, 0), cam)
    return max_by_group


def reverse_tags(rows, max_by_group):
    """
    Mutates rows in place, rewriting row[0]:
      old_cam → new_cam = max_by_group[prefix] + 1 - old_cam
    Returns a list of changes as (line_number, old_tag, new_tag).
    """
    changes = []
    for idx, row in enumerate(rows, start=1):
        if not row:
            continue
        m = TAG_RE.match(row[0])
        if m:
            prefix, cam = m.groups()
            cam = int(cam)
            group_max = max_by_group[prefix]
            new_cam = group_max + 1 - cam
            old_tag = row[0]
            new_tag = f"{prefix}_{new_cam}"
            if new_tag != old_tag:
                row[0] = new_tag
                changes.append((idx, old_tag, new_tag))
    return changes


def process_file(inpath, outpath):
    # read all rows
    with open(inpath, newline="", encoding="utf8") as f:
        rows = list(csv.reader(f))

    # find max cams per group
    max_by_group = scan_max_cams(rows)

    # reverse tags and capture changes
    changes = reverse_tags(rows, max_by_group)

    # print out each renamed line
    for ln, old, new in changes:
        print(f"🔄 {os.path.basename(inpath)} line {ln}: {old} → {new}")

    # write out transformed CSV
    os.makedirs(os.path.dirname(outpath), exist_ok=True)
    with open(outpath, "w", newline="", encoding="utf8") as f:
        csv.writer(f).writerows(rows)

    print(f"✅ {inpath} → {outpath}\n")


def main():
    p = argparse.ArgumentParser(
        description="Reverse camera numbering in first CSV column"
    )
    p.add_argument("input_dir",
                   help="Directory containing CSV files")
    p.add_argument("-o","--output-dir", default=None,
                   help="Where to write transformed CSVs (defaults to in-place)")
    args = p.parse_args()

    for root, _, files in os.walk(args.input_dir):
        for fn in files:
            if not fn.lower().endswith(".csv"):
                continue
            inpath = os.path.join(root, fn)
            if args.output_dir:
                os.makedirs(args.output_dir, exist_ok=True)
                outpath = os.path.join(args.output_dir, fn)
            else:
                outpath = inpath
            process_file(inpath, outpath)

if __name__ == "__main__":
    main()
