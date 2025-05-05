#!/usr/bin/env python3
import os
import csv
import argparse

# ─── CONFIGURABLE INDICES ─────────────────────────────────────────────────────
# CSV format: [0]=name, [1]=pos_x, [2]=pos_y, [3]=pos_z,
#             [4]=rot_x(pitch), [5]=rot_y(yaw), [6]=rot_z(roll)
POS_IDX = {'x': 1, 'y': 2, 'z': 3}
YAW_IDX = 6


def process_csv_file(filepath, output_dir, scale_axis=None):
    """
    Read input CSV, optionally scale one axis by -1 and update yaw = (180 - yaw)%360,
    then write to output CSV.
    """
    # Read all rows
    with open(filepath, newline='', encoding='utf8') as f:
        rows = list(csv.reader(f))
    if not rows:
        print(f"⚠️ Skipping empty file {filepath}")
        return

    # Process rows
    out_rows = []
    for row in rows:
        # If scaling axis, negate that position and update yaw
        if scale_axis:
            # negate position
            p_idx = POS_IDX.get(scale_axis)
            if p_idx is not None and p_idx < len(row):
                try:
                    row[p_idx] = str(-float(row[p_idx]))
                except ValueError:
                    pass
            # update yaw
            if YAW_IDX < len(row):
                try:
                    yaw = float(row[YAW_IDX])
                    row[YAW_IDX] = str((180 - yaw) % 360)
                except ValueError:
                    pass
        out_rows.append(row)

    # Write output
    target_dir = output_dir or os.path.dirname(filepath)
    os.makedirs(target_dir, exist_ok=True)
    out_path = os.path.join(target_dir, os.path.basename(filepath))
    with open(out_path, 'w', newline='', encoding='utf8') as f:
        csv.writer(f).writerows(out_rows)
    print(f"✅ {os.path.basename(filepath)} → {out_path}")


def main():
    p = argparse.ArgumentParser(
        description="Negate one axis and adjust yaw for all CSVs in a directory"
    )
    p.add_argument('input_dir', help='Directory containing CSV files')
    p.add_argument('-o','--output-dir', default='',
                   help='Where to write transformed CSVs (default: overwrite)')
    p.add_argument('--scale-axis', choices=['x','y','z'],
                   help='If set, negates the given position axis and flips yaw')
    args = p.parse_args()

    for root, _, files in os.walk(args.input_dir):
        for fn in files:
            if fn.lower().endswith('.csv'):
                process_csv_file(
                    os.path.join(root, fn),
                    args.output_dir,
                    args.scale_axis
                )

if __name__ == '__main__':
    main()
