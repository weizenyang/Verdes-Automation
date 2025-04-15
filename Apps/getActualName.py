import os
import csv

# Set your input directory path here
INPUT_DIRECTORY = "\\\\hera\\projects\\xxxx_Aldar_LSQ_Woolwich\\Renders\\RAW_Images\\250409 Composited Images\\Flipped\\woolwichtower"

# Set your desired output CSV file path
OUTPUT_CSV = "output.csv"

def process_directory(root_dir, output_csv):
    """
    Traverses the root_dir recursively, and for each subfolder that contains image files,
    processes the first image (alphabetically) to extract tokens and convert the name.

    Extraction steps:
      - Splits the image's filename (without extension) by underscores.
      - Joins the first 9 tokens (separated by underscores) for CSV output.
      - Extracts token 7 (index 6) and capitalizes its first letter.
      - Checks token 6 (index 5) for an "f": if found (case-insensitive), token6 becomes "f"; otherwise it becomes an empty string.
      - Splits the parent subfolder’s name by hyphen ("-") and extracts the second element (index 1).
      - Constructs a converted name in the format:
            P-{token7 (capitalized)}{token6}_Balcony-View_H{subfolder second token}

    Each row in the CSV is:
          {first 9 tokens joined with "_"},{converted name}
    """
    csv_rows = []

    # Walk through the directory recursively
    for current_root, subdirs, files in os.walk(root_dir):
        # Optionally skip files directly under the root directory
        if current_root == root_dir:
            continue

        # Filter for image files (adjust extensions if needed)
        image_files = [f for f in files if f.lower().endswith(('.jpg', '.jpeg', '.png', '.bmp', '.gif'))]
        if not image_files:
            continue  # No image files found in this folder

        # Sort and pick the first image file (alphabetical)
        image_files.sort()
        first_image = image_files[0]

        # Remove extension and split filename by underscore
        image_name_no_ext = os.path.splitext(first_image)[0]
        tokens = image_name_no_ext.split("_")

        # Ensure there are at least 9 tokens
        if len(tokens) < 9:
            print(f"Skipping file '{first_image}' in folder '{current_root}': Not enough tokens")
            continue

        # Get the first 9 tokens for CSV output
        first9 = "_".join(tokens[:9])

        # Extract token 7 (index 6), and token 6 (index 5) with "f" check:
        token7 = tokens[6].capitalize()
        token6 = "f" if "f" in tokens[5].lower() else ""

        # For the parent subfolder, split the folder name using '-' and extract the second element (index 1)
        subfolder_name = os.path.basename(current_root)
        subfolder_tokens = subfolder_name.split("-")
        if len(subfolder_tokens) < 2:
            print(f"Skipping folder '{subfolder_name}': Not enough tokens in folder name after splitting with '-'")
            continue
        subfolder_second = subfolder_tokens[1]

        # Construct the converted name
        converted_name = f"P-{token7}{token6}_Balcony-View_H{subfolder_second}"

        # Append the result to CSV rows
        csv_rows.append([converted_name,first9])
        print(f"Processed: {first9} -> {converted_name}")

    # Write the output CSV (headless, no header row)
    with open(output_csv, "w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerows(csv_rows)
    print(f"Processing complete. {len(csv_rows)} records written to '{output_csv}'.")

if __name__ == "__main__":
    process_directory(INPUT_DIRECTORY, OUTPUT_CSV)
