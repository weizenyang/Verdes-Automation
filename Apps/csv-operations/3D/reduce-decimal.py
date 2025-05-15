#!/usr/bin/env python3
"""
round_csv_decimals.py – Round all numeric values in CSV files to 2 decimals
(only CSVs located directly in the given directory).
"""
from pathlib import Path
import argparse
import pandas as pd
import numpy as np


def round_numeric_columns(df: pd.DataFrame) -> pd.DataFrame:
    numeric_cols = df.select_dtypes(include=[np.number]).columns
    df[numeric_cols] = df[numeric_cols].round(2)
    return df


def process_file(csv_path: Path, out_dir: Path | None = None) -> None:
    df = pd.read_csv(csv_path)
    df = round_numeric_columns(df)
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)
        df.to_csv(out_dir / csv_path.name, index=False)
    else:
        df.to_csv(csv_path, index=False)


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Round numeric values in every CSV located in the specified directory "
                    "(non-recursive) to two decimal places.")
    parser.add_argument("directory",
                        help="Directory containing CSV files (non-recursive).")
    parser.add_argument("-o", "--output",
                        help="Optional output directory for cleaned copies. "
                             "If omitted, original files are overwritten.")
    args = parser.parse_args()

    root = Path(args.directory).expanduser().resolve()
    out_dir = Path(args.output).expanduser().resolve() if args.output else None

    # NON-RECURSIVE: glob instead of rglob
    for csv_file in root.glob("*.csv"):
        try:
            process_file(csv_file, out_dir)
            print(f"✔ Rounded {csv_file.name}")
        except Exception as exc:
            print(f"✘ Skipped {csv_file}: {exc}")


if __name__ == "__main__":
    main()
