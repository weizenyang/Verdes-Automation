#!/usr/bin/env python3
"""
Script to group files and directories in a directory into subfolders based on their name segments.

Usage:
    python group_by_indices.py /path/to/dir 1 [2 3 ...]

Given a directory and one or more 1-based indices, this script will:
  1. Iterate over items (files and folders) at the top level of the given directory.
  2. For each item, split its base name (without extension for files) on its primary separator (hyphen or underscore).
  3. Extract the specified segment(s) by index and rejoin them with the same separator.
  4. Create a folder named after this joined key (if it doesn't exist).
  5. Move the item into that folder.

Example:
  # Group by the first segment (e.g., "willow-06-01.txt" -> folder "willow")
  python group_by_indices.py . 1

  # Group by the first and second segments ("willow-06-01/" -> "willow-06")
  python group_by_indices.py . 1 2
"""
import os
import shutil
import argparse


def detect_separator(name: str) -> str:
    """Detect the primary separator in the filename or folder name: hyphen or underscore."""
    for ch in name:
        if ch in ('-', '_'):
            return ch
    # Default to underscore if none found
    return '_'


def group_by_indices(root_dir: str, indices: list[int]) -> None:
    """
    Group files and directories in `root_dir` into subdirectories keyed by selected name segments.
    `indices` are 1-based positions into the list of segments obtained by splitting on the primary separator.
    """
    # Ensure indices are unique and sorted
    indices = sorted(set(indices))

    with os.scandir(root_dir) as it:
        for entry in it:
            # Process both files and directories
            if not (entry.is_file() or entry.is_dir()):
                continue

            name = entry.name
            # Split off extension for files
            base_name, ext = os.path.splitext(name) if entry.is_file() else (name, '')
            sep = detect_separator(base_name)
            segments = base_name.split(sep)

            try:
                # Extract and rejoin segments preserving original separator
                key_parts = [segments[i - 1] for i in indices]
            except IndexError:
                print(f"Skipping '{name}': not enough segments for indices {indices}")
                continue

            folder_name = sep.join(key_parts)
            target_dir = os.path.join(root_dir, folder_name)
            os.makedirs(target_dir, exist_ok=True)

            src = entry.path
            dst = os.path.join(target_dir, name)
            try:
                shutil.move(src, dst)
                print(f"Moved '{name}' -> '{folder_name}/'")
            except Exception as e:
                print(f"Error moving '{name}': {e}")


def main():
    parser = argparse.ArgumentParser(
        description="Group files and folders in a directory into subfolders based on name segments."
    )
    parser.add_argument(
        'root_dir',
        help='Directory containing items to be grouped'
    )
    parser.add_argument(
        'indices',
        metavar='N',
        type=int,
        nargs='+',
        help='1-based indices of the name segments to form the folder name'
    )
    args = parser.parse_args()

    if not os.path.isdir(args.root_dir):
        print(f"Error: '{args.root_dir}' is not a valid directory.")
        exit(1)

    group_by_indices(args.root_dir, args.indices)

if __name__ == '__main__':
    main()
