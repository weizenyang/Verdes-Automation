import os
import re
import csv

def natural_key(s):
    """
    Split a string into a list of strings and integers for natural sort.
    E.g., "10_folder" becomes ["", 10, "_folder"].
    """
    return [int(text) if text.isdigit() else text.lower() for text in re.split(r'(\d+)', s)]

def collect_parent_folders(source_dir):
    """
    Recursively scans the source directory for any folder that contains at least
    one file with "bf_" in its name (case-insensitive). Returns a list of unique 
    parent folder names.
    """
    folder_set = set()
    print(f"Scanning directory: {source_dir}")
    for root, dirs, files in os.walk(source_dir):
        print(f"Scanning folder: {root}")
        if not files:
            print("  No files found in this folder.")
        for file in files:
            # Debug: print each file name
            print(f"  Found file: {file}")
            if "bf_" in file.lower():
                print(f"    Match found in file: {file}")
                folder_set.add(os.path.basename(root))
                break  # Stop after the first match in this folder
    return list(folder_set)

def export_to_csv(item_list, output_csv):
    """
    Writes the list of items to a CSV file with one column and no header.
    """
    with open(output_csv, "w", newline='', encoding="utf-8") as f:
        writer = csv.writer(f)
        for item in item_list:
            writer.writerow([item])
    print(f"Exported {len(item_list)} items to {output_csv}")

def main():
    # Set your directory here as a string.
    # Use forward slashes to avoid issues with backslashes in UNC paths.
    source_dir = "//hera/projects/xxxx_Aldar_LSQ_Woolwich/Renders/RAW_Images/_RenderOutputFolder/Final Apartment Interior Tours/Merged/Non Flipped/Output/woolwichtower"
    output_csv = "bf_files.csv"
    
    # Collect unique parent folder names that contain files with "bf_".
    folder_names = collect_parent_folders(source_dir)
    
    print("Collected folder names:", folder_names)
    
    # Sort the folder names in natural (numerically ascending) order.
    folder_names.sort(key=natural_key)
    
    # Export the sorted folder names to a headless CSV.
    export_to_csv(folder_names, output_csv)

if __name__ == "__main__":
    main()
