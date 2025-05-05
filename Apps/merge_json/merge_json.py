#!/usr/bin/env python3
import json
import argparse
import sys
from pathlib import Path

def load_json(path: Path):
    try:
        with path.open('r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"Error reading {path}: {e}", file=sys.stderr)
        sys.exit(1)

def gather_input_paths(inputs):
    paths = []
    for inp in inputs:
        p = Path(inp)
        if not p.exists():
            print(f"Input not found: {p}", file=sys.stderr)
            sys.exit(1)
        if p.is_dir():
            json_files = sorted(p.glob('*.json'))
            if not json_files:
                print(f"No JSON files found in directory: {p}", file=sys.stderr)
                sys.exit(1)
            paths.extend(json_files)
        else:
            paths.append(p)
    return paths

def merge_json_objects(objs):
    result = {}
    for obj in objs:
        if isinstance(obj, dict):
            result.update(obj)
    return result

def merge_json_arrays(arrays):
    result = []
    for arr in arrays:
        if isinstance(arr, list):
            result.extend(arr)
    return result

def main():
    parser = argparse.ArgumentParser(
        description="Merge JSON files (or all JSONs in given directories) into one.")
    parser.add_argument(
        "inputs", nargs='+',
        help="Input JSON file(s) and/or directory(ies) containing JSON files")
    parser.add_argument(
        "-o", "--output",
        help="Output JSON file path (defaults to <first_input>_merged.json)")
    args = parser.parse_args()

    # Resolve files (and directory contents) into a flat list of Paths
    files = gather_input_paths(args.inputs)

    # Determine output path
    if args.output:
        out_path = Path(args.output)
    else:
        # derive from first resolved file
        first = files[0]
        out_path = first.with_name(f"{first.stem}_merged.json")

    # Load all JSON contents
    jsons = [load_json(p) for p in files]

    # Determine merge strategy
    if all(isinstance(j, dict) for j in jsons):
        merged = merge_json_objects(jsons)
    elif all(isinstance(j, list) for j in jsons):
        merged = merge_json_arrays(jsons)
    else:
        # Mixed or other types: wrap each file’s JSON as list elements
        merged = jsons

    # Write output
    try:
        with out_path.open('w', encoding='utf-8') as f:
            json.dump(merged, f, ensure_ascii=False, indent=2)
        print(f"Merged JSON written to {out_path}")
    except Exception as e:
        print(f"Error writing {out_path}: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
