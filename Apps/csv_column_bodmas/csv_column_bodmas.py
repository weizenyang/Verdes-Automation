#!/usr/bin/env python3
import os
import argparse
import csv
import sys


def transform_value(x, expr):
    """
    Safely evaluate the user-supplied expression, using 'x' as the
    placeholder for the original value. E.g. expr="x*2+5" will double
    then add 5.
    """
    return eval(expr, {"__builtins__": None}, {"x": x})


def process_csv_file(filepath, col_args, expr, output_dir, header):
    # read everything
    with open(filepath, newline="", encoding="utf8") as f:
        rows = list(csv.reader(f))

    if not rows:
        print(f"⚠️  Skipping empty file {filepath}")
        return

    # determine column indices
    if header:
        header_row = rows[0]
    else:
        header_row = None

    col_idxs = []
    for col_arg in col_args:
        if col_arg.isdigit():
            col_idxs.append(int(col_arg))
        else:
            if not header:
                print(f"❌ Cannot use column name '{col_arg}' without --header", file=sys.stderr)
                return
            try:
                col_idxs.append(header_row.index(col_arg))
            except ValueError:
                print(f"❌ Column '{col_arg}' not found in {filepath}", file=sys.stderr)
                return

    # split header vs data
    if header:
        out_rows = [rows[0]]
        data_rows = rows[1:]
    else:
        out_rows = []
        data_rows = rows

    # apply transform to each data row
    for row in data_rows:
        for col_idx in col_idxs:
            if col_idx < len(row):
                try:
                    x = float(row[col_idx])
                    row[col_idx] = str(transform_value(x, expr))
                except Exception as e:
                    print(f"❌ Error in {filepath}, row {row}, col {col_idx}: {e}", file=sys.stderr)
        out_rows.append(row)

    # write back (in‐place or to output_dir)
    target_dir = output_dir or os.path.dirname(filepath)
    os.makedirs(target_dir, exist_ok=True)
    out_path = os.path.join(target_dir, os.path.basename(filepath))
    with open(out_path, "w", newline="", encoding="utf8") as f:
        csv.writer(f).writerows(out_rows)

    print(f"✅  {filepath} → {out_path}")


def main():
    p = argparse.ArgumentParser(
        description="Batch-apply an arithmetic expression to one or more columns in all CSVs"
    )
    p.add_argument("input_dir", help="Directory containing CSV files")
    p.add_argument("columns", nargs="+",
                   help="Zero-based indices or column names (with --header)")
    p.add_argument("expr",
                   help="Expression to apply, using 'x' for the cell value, e.g. \"x*2+5\"")
    p.add_argument("-o", "--output-dir", default="",
                   help="If set, writes modified files there; otherwise overwrites in place")
    p.add_argument("--header", action="store_true",
                   help="Treat the first row as a header (so it's skipped and column names allowed)")
    args = p.parse_args()

    for root, _, files in os.walk(args.input_dir):
        for fn in files:
            if fn.lower().endswith(".csv"):
                process_csv_file(
                    os.path.join(root, fn),
                    args.columns,
                    args.expr,
                    args.output_dir,
                    args.header
                )

if __name__ == "__main__":
    main()
