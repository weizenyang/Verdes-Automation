#!/usr/bin/env python3
"""
round_csv_decimals.py  –  Round all numeric values in CSV files to 2 decimals.

Usage
-----
# overwrite each CSV in place
python round_csv_decimals.py /path/to/csv_directory

# write cleaned copies to a separate folder
python round_csv_decimals.py /path/to/csv_directory -o /path/to/clean_copies
"""
from pathlib import Path
import argparse
import pandas as pd
import numpy as np

def round_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    """Return a copy of *df* with all numeric columns rounded to 2 dp."""
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].round(2)
    return df

def process_file(csv_path: Path, out_dir: Path | None = None) -> None:
    df = pd.read_csv(csv_path)
    df = round_numeric_columns(df)

    if out_dir:                      # write to parallel directory
        out_dir.mkdir(parents=True, exist_ok=True)
        df.to_csv(out_dir / csv_path.name, index=False)
    else:                            # overwrite in place
        df.to_csv(csv_path, index=False)

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Round every numeric value in every CSV file to 2 decimal places.")
    parser.add_argument("directory",
                        help="Root directory containing CSV files (searched recursively).")
    parser.add_argument("-o", "--output",
                        help="Optional output directory for cleaned copies. "
                             "If omitted, original files are overwritten.")
    args = parser.parse_args()

    root = Path(args.directory).expanduser().resolve()
    out_dir = Path(args.output).expanduser().resolve() if args.output else None

    for csv_file in root.rglob("*.csv"):   # recurse through sub-folders too
        try:
            process_file(csv_file, out_dir)
            print(f"✔ Rounded {csv_file.relative_to(root)}")
        except Exception as exc:
            print(f"✘ Skipped {csv_file}: {exc}")

if __name__ == "__main__":
    main()
