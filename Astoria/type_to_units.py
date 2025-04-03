import os
import sys
import shutil
import logging
import pandas as pd
from PIL import Image, ImageOps

# Set up logging (adjust level if needed)
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

def load_csv_mapping(csv_path):
    """
    Loads the CSV file which should have the columns:
      - UnitTypeDev: substring to look for in file names.
      - UnitName: the unit name for output (to be transformed).
      - Mirrored: if "Flipped", then the image will be processed accordingly.
      
    Instead of a single mapping per UnitTypeDev, this function returns a dictionary 
    mapping each UnitTypeDev to a list of (UnitName, Mirrored) tuples.
    """
    mapping = {}
    try:
        df = pd.read_csv(csv_path)
        logging.info("CSV loaded successfully.")
        expected = ["UnitTypeDev", "UnitName", "Mirrored"]
        for col in expected:
            if col not in df.columns:
                raise KeyError(f"Expected column '{col}' not found. Found columns: {list(df.columns)}")
        for idx, row in df.iterrows():
            key = str(row["UnitTypeDev"]).strip()
            unit_name = str(row["UnitName"]).strip()
            mirrored = str(row["Mirrored"]).strip()  # e.g., "Flipped" or "Normal"
            if key not in mapping:
                mapping[key] = []
            mapping[key].append((unit_name, mirrored))
            logging.debug(f"Mapping added: {key} -> ({unit_name}, {mirrored})")
        return mapping
    except Exception as e:
        logging.error(f"Error loading CSV mapping file: {e}")
        return {}

def transform_unit_name(unit_name):
    """
    Transforms a unit name:
      - Example: "b1-101" becomes "b1-01-01"
      - Example: "b1-1001" becomes "b1-10-01"
    If the unit name does not match the expected format, returns it unchanged.
    """
    parts = unit_name.split('-')
    if len(parts) != 2:
        logging.warning(f"Unit name '{unit_name}' does not match expected format.")
        return unit_name
    prefix, number = parts
    if len(number) == 3:
        transformed = f"{prefix}-{number[0].zfill(2)}-{number[1:]}"
        logging.debug(f"Transformed {unit_name} -> {transformed}")
        return transformed
    elif len(number) == 4:
        transformed = f"{prefix}-{number[:2]}-{number[2:]}"
        logging.debug(f"Transformed {unit_name} -> {transformed}")
        return transformed
    else:
        logging.warning(f"Unit name '{unit_name}' has unexpected number length.")
        return unit_name

def process_file_for_unit(file_path, unit_folder, transformed_unit, mirrored):
    """
    Processes an individual file for one unit mapping.
    If mirrored is "Flipped":
      - Splits the base name by underscores.
      - Appends an "f" to the 3rd token (if present) and flips the image horizontally.
    Otherwise, simply copies the file.
    
    The new file name is prepended with "image-360_{transformed_unit}".
    The new filename is then converted to all lowercase.
    """
    filename = os.path.basename(file_path)
    valid_exts = ['.jpg', '.jpeg', '.png', '.bmp', '.gif']
    base, ext = os.path.splitext(filename)
    if ext.lower() not in valid_exts:
        logging.debug(f"Skipping file (invalid extension): {filename}")
        return

    prefix = f"image-360_{transformed_unit}"
    
    if mirrored.lower() == "flipped":
        parts = base.split('_')
        if len(parts) >= 3:
            parts[2] = parts[2] + "f"
            new_suffix = "_".join(parts)
        else:
            new_suffix = base + "f"
        new_filename = f"{prefix}_{new_suffix}{ext}"
    else:
        new_filename = f"{prefix}_{filename}"
    
    # Convert the new filename to all lowercase
    new_filename = new_filename.lower()
    new_file_path = os.path.join(unit_folder, new_filename)
    
    if mirrored.lower() == "flipped":
        try:
            img = Image.open(file_path)
            flipped_img = ImageOps.mirror(img)
            flipped_img.save(new_file_path)
            logging.info(f"Processed flipped image: {new_file_path}")
        except Exception as e:
            logging.error(f"Error processing flipped image {filename}: {e}")
    else:
        try:
            shutil.copy2(file_path, new_file_path)
            logging.info(f"Copied image: {new_file_path}")
        except Exception as e:
            logging.error(f"Error copying image {filename}: {e}")

def process_mapping(mapping, source_dir, dest_dir):
    """
    For each UnitTypeDev in the mapping and for each (UnitName, Mirrored) pair:
      - Recursively searches the source directory for files whose names contain the UnitTypeDev substring.
      - Processes each matching file by creating (if necessary) a destination subfolder based on the transformed UnitName.
    """
    for unit_type_dev, unit_list in mapping.items():
        logging.info(f"Processing UnitTypeDev: '{unit_type_dev}' with {len(unit_list)} mapping entries")
        for unit_name, mirrored in unit_list:
            logging.info(f"  Mapping entry: UnitName='{unit_name}', Mirrored='{mirrored}'")
            transformed_unit = transform_unit_name(unit_name)
            unit_folder = os.path.join(dest_dir, transformed_unit.lower())
            os.makedirs(unit_folder, exist_ok=True)
            logging.debug(f"  Destination folder for unit '{transformed_unit}': {unit_folder}")

            # Recursively search for files that contain the UnitTypeDev substring.
            for root, dirs, files in os.walk(source_dir):
                for file in files:
                    if unit_type_dev in file:
                        full_path = os.path.join(root, file)
                        logging.info(f"    Found file '{full_path}' matching UnitTypeDev '{unit_type_dev}'")
                        process_file_for_unit(full_path, unit_folder, transformed_unit, mirrored)

def main(source_dir, dest_dir, csv_path):
    logging.info("Starting processing.")
    mapping = load_csv_mapping(csv_path)
    if not mapping:
        logging.error("CSV mapping could not be loaded. Exiting.")
        return
    process_mapping(mapping, source_dir, dest_dir)
    logging.info("Processing complete.")

if __name__ == "__main__":
    if len(sys.argv) < 4:
        print("Usage: python script.py <source_directory> <destination_directory> <csv_file>")
        sys.exit(1)
    source_directory = sys.argv[1]
    destination_directory = sys.argv[2]
    csv_file = sys.argv[3]
    main(source_directory, destination_directory, csv_file)
