import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
from PIL import Image

def browse_folder():
    folder = filedialog.askdirectory()
    if folder:
        folder_path_entry.delete(0, tk.END)
        folder_path_entry.insert(0, folder)

def process_images():
    folder = folder_path_entry.get().strip()
    if not folder:
        messagebox.showerror("Error", "Please select a folder.")
        return

    # Get the constants from the comboboxes (allowing custom entry)
    top_const = top_const_combobox.get().strip()
    alpha_const = alpha_const_combobox.get().strip()
    bottom_const = bottom_const_combobox.get().strip()

    # Dictionaries to hold images keyed by the variable part of the filename.
    top_dict = {}
    alpha_dict = {}
    bottom_dict = {}

    # Walk through all subfolders and files
    for root, dirs, files in os.walk(folder):
        for file in files:
            # Process only common image files
            if file.lower().endswith((".jpg", ".jpeg", ".png")):
                full_path = os.path.join(root, file)
                base, ext = os.path.splitext(file)
                
                # Check if the base ends with the top constant
                if top_const and base.endswith(top_const):
                    var_part = base[:-len(top_const)]
                    top_dict[var_part] = full_path
                # Check for alpha images
                if alpha_const and base.endswith(alpha_const):
                    var_part = base[:-len(alpha_const)]
                    alpha_dict[var_part] = full_path
                # Check for bottom images
                if bottom_const and base.endswith(bottom_const):
                    var_part = base[:-len(bottom_const)]
                    bottom_dict[var_part] = full_path

    # Find variable parts that appear in all three dictionaries.
    common_keys = set(top_dict.keys()) & set(alpha_dict.keys()) & set(bottom_dict.keys())
    if not common_keys:
        messagebox.showinfo("Info", "No matching image sets were found.")
        return

    output_folder = os.path.join(folder, "output")
    os.makedirs(output_folder, exist_ok=True)

    for key in common_keys:
        try:
            # Open images and convert modes appropriately
            top_img = Image.open(top_dict[key]).convert("RGBA")
            alpha_img = Image.open(alpha_dict[key]).convert("L")
            bottom_img = Image.open(bottom_dict[key]).convert("RGBA")
            
            # Composite top image over bottom image using the alpha image as mask.
            composite_img = Image.composite(top_img, bottom_img, alpha_img)
            output_path = os.path.join(output_folder, f"{key}_composited.jpg")
            composite_img.save(output_path)
        except Exception as e:
            print(f"Error processing set '{key}': {e}")

    messagebox.showinfo("Done", f"Processed {len(common_keys)} image set(s). Output saved in:\n{output_folder}")

# Create the main Tkinter window
root = tk.Tk()
root.title("Image Composer")

# Folder Path Field
folder_label = tk.Label(root, text="Folder Path:")
folder_label.grid(row=0, column=0, padx=5, pady=5, sticky="e")
folder_path_entry = tk.Entry(root, width=50)
folder_path_entry.grid(row=0, column=1, padx=5, pady=5)
browse_button = tk.Button(root, text="Browse", command=browse_folder)
browse_button.grid(row=0, column=2, padx=5, pady=5)

# Top Image Constant Field (dropdown with custom entry allowed)
top_const_label = tk.Label(root, text="Top Image Constant:")
top_const_label.grid(row=1, column=0, padx=5, pady=5, sticky="e")
top_options = [".RGB_color", ".Top", "Custom..."]
top_const_combobox = ttk.Combobox(root, values=top_options)
top_const_combobox.set(".RGB_color")  # default value
top_const_combobox.grid(row=1, column=1, padx=5, pady=5, sticky="w")

# Alpha Image Constant Field (default value set to ".Alpha")
alpha_const_label = tk.Label(root, text="Alpha Image Constant:")
alpha_const_label.grid(row=2, column=0, padx=5, pady=5, sticky="e")
alpha_options = [".Alpha", "Custom..."]
alpha_const_combobox = ttk.Combobox(root, values=alpha_options)
alpha_const_combobox.set(".Alpha")  # default value
alpha_const_combobox.grid(row=2, column=1, padx=5, pady=5, sticky="w")

# Bottom Image Constant Field (dropdown with custom entry allowed)
bottom_const_label = tk.Label(root, text="Bottom Image Constant:")
bottom_const_label.grid(row=3, column=0, padx=5, pady=5, sticky="e")
bottom_options = [".Bottom", "Custom..."]
bottom_const_combobox = ttk.Combobox(root, values=bottom_options)
bottom_const_combobox.set(".Bottom")  # default value
bottom_const_combobox.grid(row=3, column=1, padx=5, pady=5, sticky="w")

# Process Button
process_button = tk.Button(root, text="Process", command=process_images)
process_button.grid(row=4, column=1, padx=5, pady=10)

root.mainloop()
