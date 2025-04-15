import os
import csv
import shutil

def load_keywords(csv_path):
    """Load keywords from a CSV file (one per row)."""
    keywords = []
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if row:
                kw = row[0].strip()
                if kw:
                    keywords.append(kw)
    return keywords

def classify_folders(source_dir, keywords):
    """
    Scans the source directory for subfolders.
    If a folder's name (in lowercase) contains any of the keywords (lowercased)
    as a substring, the folder is moved to "Flipped"; otherwise, to "Non Flipped".
    """
    flipped_dir = os.path.join(source_dir, "Flipped")
    non_flipped_dir = os.path.join(source_dir, "Non Flipped")
    os.makedirs(flipped_dir, exist_ok=True)
    os.makedirs(non_flipped_dir, exist_ok=True)

    for entry in os.listdir(source_dir):
        full_path = os.path.join(source_dir, entry)
        # Only process directories and skip our destination folders.
        if os.path.isdir(full_path) and entry not in ["Flipped", "Non Flipped"]:
            folder_lower = entry.lower()
            if any(kw.lower() in folder_lower for kw in keywords):
                destination = os.path.join(flipped_dir, entry)
                print(f"Folder '{entry}' matches a keyword; moving to 'Flipped'")
            else:
                destination = os.path.join(non_flipped_dir, entry)
                print(f"Folder '{entry}' does not match; moving to 'Non Flipped'")
            shutil.move(full_path, destination)

if __name__ == "__main__":
    # Set your paths here as strings:
    csv_path = r"C:/Users/EWei/Documents/GitHub/Verdes-Automation/Apps/extract_flip/bf_files.csv"         # CSV file with keywords (one per row)
    # source_dir = r"/hera/Projects/xxxx_Aldar_LSQ_Woolwich/Renders/RAW_Images/_RenderOutputFolder/Final Apartment Interior Tours/Merged/For Flipped Apartments/Output/woolwichtower"
    source_dir = r"//hera/Projects/xxxx_Aldar_LSQ_Woolwich/Renders/RAW_Images/250409 Composited Images/Flipped/woolwichtower"
    

    # Load keywords.
    keywords = load_keywords(csv_path)
    if not keywords:
        print("No keywords found in the CSV.")
        exit(1)

    classify_folders(source_dir, keywords)
    print("Folders have been classified.")
