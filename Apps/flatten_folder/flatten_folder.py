#!/usr/bin/env python3
import os
import sys
import shutil

def flatten_folder(src_dir):
    """
    Recursively walk through src_dir and copy every file into a flat directory:
    {parent_of_src}/{name_of_src}_flat
    """
    if not os.path.isdir(src_dir):
        print(f"Error: “{src_dir}” is not a directory.")
        sys.exit(1)

    base_parent = os.path.dirname(src_dir)
    base_name = os.path.basename(src_dir)
    flat_dir = os.path.join(base_parent, f"{base_name}_flat")
    os.makedirs(flat_dir, exist_ok=True)

    for root, dirs, files in os.walk(src_dir):
        for fname in files:
            src_path = os.path.join(root, fname)
            dst_fname = fname
            dst_path = os.path.join(flat_dir, dst_fname)

            # If collision, append _1, _2, ... before the extension
            count = 1
            name, ext = os.path.splitext(fname)
            while os.path.exists(dst_path):
                dst_fname = f"{name}_{count}{ext}"
                dst_path = os.path.join(flat_dir, dst_fname)
                count += 1

            shutil.copy2(src_path, dst_path)
            print(f"Copied: {src_path} → {dst_path}")

    print(f"\nFlattening complete: all files in “{src_dir}” are now in “{flat_dir}”")

def main():
    if len(sys.argv) != 2:
        print(f"Usage: {sys.argv[0]} <source_directory>")
        sys.exit(1)
    flatten_folder(sys.argv[1])

if __name__ == "__main__":
    main()
