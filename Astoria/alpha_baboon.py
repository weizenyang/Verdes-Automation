import os
import tkinter as tk
from tkinter import filedialog, messagebox
from PIL import Image, ImageChops

def save_fields(alpha_folder, masks_folder, output_folder, overlay_percentage, luminance_range):
    """Save the current field values into a text file."""
    config_file = "config.txt"
    try:
        with open(config_file, "w") as f:
            f.write(f"ALPHA Folder: {alpha_folder}\n")
            f.write(f"MASKS Folder: {masks_folder}\n")
            f.write(f"Output Folder: {output_folder}\n")
            f.write(f"Overlay Percentage: {overlay_percentage}\n")
            f.write(f"Luminance Range: {luminance_range}\n")
        print("Configuration saved to", config_file)
    except Exception as e:
        print("Failed to save configuration:", e)

def load_fields():
    """Load saved field values from 'config.txt' if it exists."""
    config_file = "config.txt"
    if os.path.exists(config_file):
        try:
            with open(config_file, "r") as f:
                lines = f.readlines()
            for line in lines:
                if line.startswith("ALPHA Folder:"):
                    alpha_value = line[len("ALPHA Folder:"):].strip()
                    alpha_entry.delete(0, tk.END)
                    alpha_entry.insert(0, alpha_value)
                elif line.startswith("MASKS Folder:"):
                    masks_value = line[len("MASKS Folder:"):].strip()
                    masks_entry.delete(0, tk.END)
                    masks_entry.insert(0, masks_value)
                elif line.startswith("Output Folder:"):
                    output_value = line[len("Output Folder:"):].strip()
                    output_entry.delete(0, tk.END)
                    output_entry.insert(0, output_value)
                elif line.startswith("Overlay Percentage:"):
                    percentage_value = line[len("Overlay Percentage:"):].strip()
                    percentage_entry.delete(0, tk.END)
                    percentage_entry.insert(0, percentage_value)
                elif line.startswith("Luminance Range:"):
                    lum_range_value = line[len("Luminance Range:"):].strip()
                    lum_range_entry.delete(0, tk.END)
                    lum_range_entry.insert(0, lum_range_value)
            print("Configuration loaded from", config_file)
        except Exception as e:
            print("Failed to load configuration:", e)

def process_images(alpha_folder, masks_folder, overlay_percentage, output_folder, luminance_range):
    """
    Process image files from the MASKS folder.
    
    For each file in MASKS ending with "Object_Mask.png":
    
    - If an ALPHA folder is provided:
         Look for a corresponding ALPHA image (base+"Alpha.png").
         Scale the mask (preserving absolute black) by the overlay percentage and add it to the original ALPHA image.
         Then, merge the resulting L-channel into an RGB image.
         
    - If no ALPHA folder is provided:
         Determine the minimum luminance value in the mask.
         Set a threshold = (min_val + luminance_range).
         For each pixel, if its luminance is ≤ threshold, output 0 (black); otherwise output white scaled by the overlay percentage.
         Merge the processed values into an RGB image.
    
    The processed image is saved in the OUTPUT folder using the ALPHA naming scheme (base + "Alpha.png").
    """
    os.makedirs(output_folder, exist_ok=True)
    processed_count = 0

    for mask_filename in os.listdir(masks_folder):
        if mask_filename.endswith("Object_Mask.png"):
            base = mask_filename[:-len("Object_Mask.png")]
            output_filename = base + "Alpha.png"
            mask_path = os.path.join(masks_folder, mask_filename)
            
            try:
                object_mask = Image.open(mask_path).convert("L")
            except Exception as e:
                print(f"Error opening mask image for base {base}: {e}")
                continue

            if alpha_folder:
                alpha_filename = base + "Alpha.png"
                alpha_path = os.path.join(alpha_folder, alpha_filename)
                if not os.path.exists(alpha_path):
                    print(f"Alpha image not found for base: {base}")
                    continue
                try:
                    original_alpha = Image.open(alpha_path).convert("L")
                except Exception as e:
                    print(f"Error opening alpha image for base {base}: {e}")
                    continue
                # For pixels that are absolute black, keep them at 0; otherwise scale by overlay percentage.
                scaled_mask = object_mask.point(lambda p: 0 if p == 0 else int(p * (overlay_percentage / 100)))
                new_channel = ImageChops.add(original_alpha, scaled_mask)
            else:
                # Process only the MASKS file.
                min_val, _ = object_mask.getextrema()
                threshold = min_val + luminance_range
                # For each pixel, if its value is less than or equal to the threshold, output 0 (black).
                # Otherwise, output white scaled by overlay percentage.
                new_channel = object_mask.point(lambda p: 0 if p <= threshold else int(255 * (overlay_percentage / 100)))
            
            # Instead of using the alpha channel, merge the processed channel into R, G, and B.
            final_img = Image.merge("RGB", (new_channel, new_channel, new_channel))
            final_img.save(os.path.join(output_folder, output_filename))
            print(f"Processed {output_filename}")
            processed_count += 1

    messagebox.showinfo("Processing Complete",
                        f"Processed {processed_count} image(s).\nOutput saved in:\n{output_folder}")

def browse_folder(entry_field, title):
    """Open a directory selection dialog and update the given entry field."""
    folder = filedialog.askdirectory(title=title)
    if folder:
        entry_field.delete(0, tk.END)
        entry_field.insert(0, folder)

def start_processing():
    alpha_folder = alpha_entry.get().strip()  # ALPHA folder is optional.
    masks_folder = masks_entry.get().strip()
    output_folder = output_entry.get().strip()
    
    if not masks_folder or not output_folder:
        messagebox.showerror("Error", "Please select the MASKS and OUTPUT folders.")
        return

    try:
        percentage = float(percentage_entry.get())
        if not (0 <= percentage <= 100):
            raise ValueError
    except ValueError:
        messagebox.showerror("Error", "Please enter a valid overlay percentage between 0 and 100.")
        return

    try:
        lum_range = float(lum_range_entry.get())
        if lum_range < 0:
            raise ValueError
    except ValueError:
        messagebox.showerror("Error", "Please enter a valid non-negative luminance range.")
        return

    save_fields(alpha_folder, masks_folder, output_folder, percentage, lum_range)
    process_images(alpha_folder, masks_folder, percentage, output_folder, lum_range)

# ===== Create GUI =====
root = tk.Tk()
root.title("Unreal Mask Combiner")
root.geometry("600x300")  # Adjusted window size to accommodate the extra field

# Configure grid columns to be responsive
root.grid_columnconfigure(0, weight=0)
root.grid_columnconfigure(1, weight=1)
root.grid_columnconfigure(2, weight=0)

# ALPHA Folder field (optional)
tk.Label(root, text="ALPHA Folder Path (Optional):").grid(row=0, column=0, padx=5, pady=5, sticky='w')
alpha_entry = tk.Entry(root, width=50)
alpha_entry.grid(row=0, column=1, padx=5, pady=5, sticky='ew')
tk.Button(root, text="Browse", command=lambda: browse_folder(alpha_entry, "Select ALPHA Folder")).grid(row=0, column=2, padx=5, pady=5)

# MASKS Folder field
tk.Label(root, text="MASKS Folder Path:").grid(row=1, column=0, padx=5, pady=5, sticky='w')
masks_entry = tk.Entry(root, width=50)
masks_entry.grid(row=1, column=1, padx=5, pady=5, sticky='ew')
tk.Button(root, text="Browse", command=lambda: browse_folder(masks_entry, "Select MASKS Folder")).grid(row=1, column=2, padx=5, pady=5)

# Output Folder field
tk.Label(root, text="Output Folder Path:").grid(row=2, column=0, padx=5, pady=5, sticky='w')
output_entry = tk.Entry(root, width=50)
output_entry.grid(row=2, column=1, padx=5, pady=5, sticky='ew')
tk.Button(root, text="Browse", command=lambda: browse_folder(output_entry, "Select Output Folder")).grid(row=2, column=2, padx=5, pady=5)

# Overlay Percentage field
tk.Label(root, text="Overlay Percentage (0-100):").grid(row=3, column=0, padx=5, pady=5, sticky='w')
percentage_entry = tk.Entry(root, width=10)
percentage_entry.insert(0, "50")
percentage_entry.grid(row=3, column=1, padx=5, pady=5, sticky='w')

# Luminance Range field (used when no ALPHA folder is provided)
tk.Label(root, text="Luminance Range:").grid(row=4, column=0, padx=5, pady=5, sticky='w')
lum_range_entry = tk.Entry(root, width=10)
lum_range_entry.insert(0, "10")
lum_range_entry.grid(row=4, column=1, padx=5, pady=5, sticky='w')

# Process button spanning all columns
tk.Button(root, text="Process Image Pairs", command=start_processing).grid(row=5, column=0, columnspan=3, padx=5, pady=20, sticky='ew')

# Load saved fields if config.txt exists
load_fields()

root.mainloop()
