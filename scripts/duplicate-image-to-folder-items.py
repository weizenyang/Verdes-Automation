import os
from PIL import Image

def duplicate_image_across_directory(directory, image_file):
    # List all files in the directory
    files = os.listdir(directory)
    print("Found files:")
    for f in files:
        print(f)
    
    # Open the source image once.
    img = Image.open(image_file).convert("RGB")
    
    # For each file in the directory, if it's a file, save the source image as a JPEG with quality 80.
    for f in files:
        file_path = os.path.join(directory, f)
        if os.path.isfile(file_path):
            # Save as JPEG with quality=80 (this will overwrite the file).
            img.save(file_path, format="JPEG", quality=80)
            print(f"Replaced {file_path} with quality 80 JPEG of {image_file}")

# Example usage:
directory = '\\\\hera\\Projects\\xxxx_Aldar_LSQ_Woolwich\\Renders\\RAW_Images\\250403_Backplates\\woolwichtower\\woolwichtower-10-01'
image_file = 'C:\\Users\\EWei\\Downloads\\10_101_moved.png'
duplicate_image_across_directory(directory, image_file)
