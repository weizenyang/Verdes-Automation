#!/usr/bin/env python3
"""
Batch-repack GLB files through Blender’s API with Draco compression,
dropping morphs/skins/animations, and optionally renaming via CSV.
Invoke via:
  blender --background --python repack_glb_with_draco.py -- --input <dir> --output <dir> [--rename-csv <file>]
"""

import os
import sys
import argparse
import csv
import bpy


def parse_args():
    argv = sys.argv
    if "--" in argv:
        argv = argv[argv.index("--") + 1:]
    else:
        argv = []

    parser = argparse.ArgumentParser(
        description="Re-export all GLB files in a folder via Blender, with DRACO, no morphs/skins/anim"
    )
    parser.add_argument(
        "--input", "-i",
        required=True,
        help="Input directory containing GLB files"
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="Output directory for processed GLBs"
    )
    parser.add_argument(
        "--rename-csv",
        help="Optional CSV mapping original base names to new (columns: old,new)"
    )
    return parser.parse_args(argv)


def load_rename_mapping(csv_path):
    mapping = {}
    try:
        with open(csv_path, newline='') as f:
            for old, new in csv.reader(f):
                if old.strip() and new.strip():
                    mapping[old.strip().lower()] = new.strip()
    except Exception as e:
        print(f"Warning: couldn’t read rename CSV: {e}")
    return mapping


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)


def convert_glb(glb_path, output_dir, rename_map):
    reset_scene()

    # import existing GLB
    try:
        bpy.ops.import_scene.gltf(filepath=glb_path)
    except Exception as e:
        print(f"Import failed {glb_path}: {e}")
        return

    base = os.path.splitext(os.path.basename(glb_path))[0]
    export_name = rename_map.get(base.lower(), base)
    out_path = os.path.join(output_dir, f"model_360-collision_{export_name}.glb")

    # export with DRACO + drop morphs/skins/anims
    try:
        bpy.ops.export_scene.gltf(
            filepath=out_path,
            export_format='GLB',
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6,
            export_morph=False,
            export_skins=False,
            export_animations=False
        )
        print(f"Repacked {glb_path} → {out_path}")
    except Exception as e:
        print(f"Export failed {glb_path}: {e}")


def main():
    args = parse_args()
    inp, outp = args.input, args.output

    if not os.path.isdir(inp):
        print(f"Input dir not found: {inp}")
        sys.exit(1)
    os.makedirs(outp, exist_ok=True)

    rename_map = {}
    if args.rename_csv:
        rename_map = load_rename_mapping(args.rename_csv)

    for root, dirs, files in os.walk(inp):
        rel = os.path.relpath(root, inp)
        tgt = os.path.join(outp, rel) if rel!="." else outp
        os.makedirs(tgt, exist_ok=True)

        for fn in files:
            if fn.lower().endswith('.glb'):
                convert_glb(os.path.join(root, fn), tgt, rename_map)


if __name__ == "__main__":
    main()
