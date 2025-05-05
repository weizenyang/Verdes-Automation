#!/usr/bin/env python3
import os
import re
import csv
import json
import argparse

def load_lookup(csv_path):
    lookup = {}
    with open(csv_path, newline='') as csvfile:
        reader = csv.reader(csvfile)
        for row in reader:
            if len(row) < 2:
                continue
            code, name = row[0].strip(), row[1].strip()
            lookup[code] = name
    return lookup

def replace_in_string(s, pattern, lookup):
    # replace whole‐word occurrences of any key in lookup with its mapped name
    return pattern.sub(lambda m: lookup[m.group(0)], s)

def process_item(item, pattern, lookup):
    if isinstance(item, dict):
        new = {}
        for k, v in item.items():
            new_key = replace_in_string(k, pattern, lookup)
            new[new_key] = process_item(v, pattern, lookup)
        return new
    elif isinstance(item, list):
        return [process_item(elem, pattern, lookup) for elem in item]
    elif isinstance(item, str):
        return replace_in_string(item, pattern, lookup)
    else:
        return item

def main():
    p = argparse.ArgumentParser(
        description="In‐place rename of lookup codes in JSON keys & values"
    )
    p.add_argument("json_dir", help="Directory containing JSON files")
    p.add_argument("lookup_csv", help="CSV file of code,name mappings")
    args = p.parse_args()

    lookup = load_lookup(args.lookup_csv)
    if not lookup:
        print("No mappings found in", args.lookup_csv)
        return

    # build regex to match any code as a whole word, longest keys first
    escaped = [re.escape(k) for k in lookup.keys()]
    escaped.sort(key=len, reverse=True)
    pattern = re.compile(r'\b(' + '|'.join(escaped) + r')\b')

    for root, _, files in os.walk(args.json_dir):
        for fn in files:
            if not fn.lower().endswith(".json"):
                continue
            path = os.path.join(root, fn)
            try:
                with open(path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except Exception as e:
                print(f"❌ Failed to load {path}: {e}")
                continue

            new_data = process_item(data, pattern, lookup)
            # Only rewrite if changed
            if new_data != data:
                try:
                    with open(path, "w", encoding="utf-8") as f:
                        json.dump(new_data, f, indent=2, ensure_ascii=False)
                    print(f"✔ Updated {path}")
                except Exception as e:
                    print(f"❌ Failed to write {path}: {e}")
            else:
                print(f"— No changes in {path}")

if __name__ == "__main__":
    main()
