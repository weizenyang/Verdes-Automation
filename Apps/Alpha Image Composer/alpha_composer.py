import os
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import tkinter.scrolledtext as scrolledtext
from PIL import Image

def browse_folder():
    folder = filedialog.askdirectory(title="Select Source Folder")
    if folder:
        folder_path_entry.delete(0, tk.END)
        folder_path_entry.insert(0, folder)

def browse_export_folder():
    folder = filedialog.askdirectory(title="Select Export Folder")
    if folder:
        export_folder_entry.delete(0, tk.END)
        export_folder_entry.insert(0, folder)

def process_images():
    log_text.delete("1.0", tk.END)  # Clear previous log
    folder = folder_path_entry.get().strip()
    if not folder:
        messagebox.showerror("Error", "Please select a source folder.")
        return

    # Get the constants from the comboboxes and convert them to lowercase.
    top_const = top_const_combobox.get().strip().lower()
    alpha_const = alpha_const_combobox.get().strip().lower()
    bottom_const = bottom_const_combobox.get().strip().lower()

    # Get target width and height.
    target_width_str = target_width_entry.get().strip()
    target_height_str = target_height_entry.get().strip()
    try:
        target_width = int(target_width_str)
        target_height = int(target_height_str)
    except ValueError:
        messagebox.showerror("Error", "Target width and height must be integers.")
        return

    # Get export folder.
    export_folder = export_folder_entry.get().strip()
    if not export_folder:
        # Default to creating an "output" subfolder in the source folder.
        export_folder = os.path.join(folder, "output")
    os.makedirs(export_folder, exist_ok=True)

    # Dictionaries to hold images keyed by the variable part of the filename (in lowercase).
    top_dict = {}
    alpha_dict = {}
    bottom_dict = {}

    log_text.insert(tk.END, "Scanning source folder for images...\n")
    # Walk through all subfolders and files.
    for root_dir, dirs, files in os.walk(folder):
        for file in files:
            if file.lower().endswith((".jpg", ".jpeg", ".png")):
                full_path = os.path.join(root_dir, file)
                base, ext = os.path.splitext(file)
                base_lower = base.lower()
                
                if top_const and base_lower.endswith(top_const):
                    var_part = base_lower[:-len(top_const)]
                    top_dict[var_part] = full_path
                if alpha_const and base_lower.endswith(alpha_const):
                    var_part = base_lower[:-len(alpha_const)]
                    alpha_dict[var_part] = full_path
                if bottom_const and base_lower.endswith(bottom_const):
                    var_part = base_lower[:-len(bottom_const)]
                    bottom_dict[var_part] = full_path

    # Find variable parts that appear in all three dictionaries.
    common_keys = set(top_dict.keys()) & set(alpha_dict.keys()) & set(bottom_dict.keys())
    if not common_keys:
        messagebox.showinfo("Info", "No matching image sets were found.")
        log_text.insert(tk.END, "No matching image sets were found.\n")
        return

    log_text.insert(tk.END, f"Found {len(common_keys)} matching image set(s).\n\n")
    for key in common_keys:
        try:
            log_text.insert(tk.END, f"Processing set '{key}':\n")
            log_text.insert(tk.END, f"  Top image:    {top_dict[key]}\n")
            log_text.insert(tk.END, f"  Alpha image:  {alpha_dict[key]}\n")
            log_text.insert(tk.END, f"  Bottom image: {bottom_dict[key]}\n")
            
            # Open and convert images.
            top_img = Image.open(top_dict[key]).convert("RGBA")
            alpha_img = Image.open(alpha_dict[key]).convert("L")
            bottom_img = Image.open(bottom_dict[key]).convert("RGBA")
            
            # Check each image's size; if it does not match target, resize it.
            if top_img.size != (target_width, target_height):
                top_img = top_img.resize((target_width, target_height), Image.LANCZOS)
                log_text.insert(tk.END, "    Resized top image.\n")
            if alpha_img.size != (target_width, target_height):
                alpha_img = alpha_img.resize((target_width, target_height), Image.LANCZOS)
                log_text.insert(tk.END, "    Resized alpha image.\n")
            if bottom_img.size != (target_width, target_height):
                bottom_img = bottom_img.resize((target_width, target_height), Image.LANCZOS)
                log_text.insert(tk.END, "    Resized bottom image.\n")
            
            # Composite top image over bottom image using the alpha image as mask.
            composite_img = Image.composite(top_img, bottom_img, alpha_img)
            
            # Save as an uncompressed PNG in the export folder.
            output_path = os.path.join(export_folder, f"{key}_composited.png")
            composite_img.save(output_path, compress_level=0)
            
            log_text.insert(tk.END, f"  Composed image saved to: {output_path}\n\n")
        except Exception as e:
            log_text.insert(tk.END, f"Error processing set '{key}': {e}\n\n")
    messagebox.showinfo("Done", f"Processed {len(common_keys)} image set(s).\nOutput saved in:\n{export_folder}")

# Set up the main GUI window.
root = tk.Tk()
root.title("Image Composer")

# Row 0: Source Folder Selection.
folder_label = tk.Label(root, text="Source Folder:")
folder_label.grid(row=0, column=0, padx=5, pady=5, sticky="e")
folder_path_entry = tk.Entry(root, width=50)
folder_path_entry.grid(row=0, column=1, padx=5, pady=5)
browse_button = tk.Button(root, text="Browse...", command=browse_folder)
browse_button.grid(row=0, column=2, padx=5, pady=5)

# Row 1: Export Folder Selection.
export_label = tk.Label(root, text="Export Folder:")
export_label.grid(row=1, column=0, padx=5, pady=5, sticky="e")
export_folder_entry = tk.Entry(root, width=50)
export_folder_entry.grid(row=1, column=1, padx=5, pady=5)
export_browse_button = tk.Button(root, text="Browse...", command=browse_export_folder)
export_browse_button.grid(row=1, column=2, padx=5, pady=5)

# Row 2: Top Image Constant Field.
top_const_label = tk.Label(root, text="Top Image Constant:")
top_const_label.grid(row=2, column=0, padx=5, pady=5, sticky="e")
top_const_combobox = ttk.Combobox(root, values=[".rgb_color", ".top", "Custom..."])
top_const_combobox.set(".rgb_color")
top_const_combobox.grid(row=2, column=1, padx=5, pady=5, sticky="w")

# Row 3: Alpha Image Constant Field.
alpha_const_label = tk.Label(root, text="Alpha Image Constant:")
alpha_const_label.grid(row=3, column=0, padx=5, pady=5, sticky="e")
alpha_const_combobox = ttk.Combobox(root, values=[".alpha", "Custom..."])
alpha_const_combobox.set(".alpha")
alpha_const_combobox.grid(row=3, column=1, padx=5, pady=5, sticky="w")

# Row 4: Bottom Image Constant Field.
bottom_const_label = tk.Label(root, text="Bottom Image Constant:")
bottom_const_label.grid(row=4, column=0, padx=5, pady=5, sticky="e")
bottom_const_combobox = ttk.Combobox(root, values=[".bottom", "Custom..."])
bottom_const_combobox.set(".bottom")
bottom_const_combobox.grid(row=4, column=1, padx=5, pady=5, sticky="w")

# Row 5: Target Width and Height Fields.
target_width_label = tk.Label(root, text="Target Width:")
target_width_label.grid(row=5, column=0, padx=5, pady=5, sticky="e")
target_width_entry = tk.Entry(root, width=10)
target_width_entry.grid(row=5, column=1, padx=5, pady=5, sticky="w")
target_width_entry.insert(0, "4096")  # Default width

target_height_label = tk.Label(root, text="Target Height:")
target_height_label.grid(row=5, column=2, padx=5, pady=5, sticky="e")
target_height_entry = tk.Entry(root, width=10)
target_height_entry.grid(row=5, column=3, padx=5, pady=5, sticky="w")
target_height_entry.insert(0, "2048")  # Default height

# Row 6: Process Button.
process_button = tk.Button(root, text="Process", command=process_images)
process_button.grid(row=6, column=1, padx=5, pady=10)

# Row 7: Log Window (Scrolled Text).
log_text = scrolledtext.ScrolledText(root, width=80, height=20)
log_text.grid(row=7, column=0, columnspan=4, padx=10, pady=10)

root.mainloop()
