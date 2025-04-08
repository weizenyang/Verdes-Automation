import os
import re
import shutil
import csv
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext

# --- Tooltip helper class ---
class CreateToolTip(object):
    """
    Create a tooltip for a given widget.
    """
    def __init__(self, widget, text='widget info'):
        self.widget = widget
        self.text = text
        self.widget.bind("<Enter>", self.enter)
        self.widget.bind("<Leave>", self.close)
        self.tw = None

    def enter(self, event=None):
        x, y, cx, cy = self.widget.bbox("insert")
        x += self.widget.winfo_rootx() + 25
        y += self.widget.winfo_rooty() + 20
        self.tw = tk.Toplevel(self.widget)
        self.tw.wm_overrideredirect(True)
        self.tw.wm_geometry("+%d+%d" % (x, y))
        label = tk.Label(self.tw, text=self.text, justify='left',
                         background="#ffffe0", relief='solid', borderwidth=1,
                         font=("tahoma", "8", "normal"))
        label.pack(ipadx=1)

    def close(self, event=None):
        if self.tw:
            self.tw.destroy()

# --- Global variables ---
selected_files = []
selected_folder = ""
mapping = {}
mapping_file_path = ""

# --- GUI update functions for selection info ---
def update_mapping_entry():
    mapping_var.set(mapping_file_path)

def update_folder_entry():
    folder_var.set(selected_folder)

def update_files_text():
    selected_files_text.config(state=tk.NORMAL)
    selected_files_text.delete("1.0", tk.END)
    if selected_files:
        for f in selected_files:
            selected_files_text.insert(tk.END, f + "\n")
    selected_files_text.config(state=tk.DISABLED)

# --- Selection functions ---
def select_mapping():
    global mapping, mapping_file_path
    mapping_file_path = filedialog.askopenfilename(
        title="Select Mapping CSV", 
        filetypes=[("CSV Files", "*.csv")]
    )
    if not mapping_file_path:
        return
    mapping.clear()
    try:
        with open(mapping_file_path, newline='', encoding='utf-8') as csvfile:
            reader = csv.reader(csvfile)
            for row in reader:
                if len(row) >= 2:
                    orig = row[0].strip()
                    newname = row[1].strip()
                    mapping[orig] = newname
        log_text.insert(tk.END, f"Loaded mapping from: {mapping_file_path}\n")
        update_mapping_entry()
    except Exception as e:
        messagebox.showerror("Error", f"Failed to load mapping CSV:\n{e}")

def select_files():
    global selected_files
    files = filedialog.askopenfilenames(
        title="Select Files to Rename", 
        filetypes=[("All Files", "*.*")]
    )
    if files:
        selected_files = list(files)
        log_text.insert(tk.END, f"Selected {len(selected_files)} file(s) for renaming\n")
        update_files_text()

def select_folder():
    global selected_folder
    folder = filedialog.askdirectory(title="Select Folder to Rename")
    if folder:
        selected_folder = folder
        log_text.insert(tk.END, f"Selected folder: {selected_folder}\n")
        update_folder_entry()

# --- Renaming function ---
def get_new_name(base_name, ext=""):
    """
    For each key in the mapping, if it is found in the base_name then replace it with its new value.
    If the "Ignore Case" option is enabled, the replacement is performed case-insensitively.
    Returns new_name+ext if at least one replacement occurs; otherwise, returns None.
    """
    ignore = ignore_case_var.get()
    new_name = base_name
    mapping_found = False
    for key, new_sub in mapping.items():
        if ignore:
            pattern = re.compile(re.escape(key), re.IGNORECASE)
            if pattern.search(new_name):
                new_name = pattern.sub(new_sub, new_name)
                mapping_found = True
        else:
            if key in new_name:
                new_name = new_name.replace(key, new_sub)
                mapping_found = True
    if mapping_found:
        return new_name + ext
    else:
        return None

def process_file(file_path):
    if not os.path.isfile(file_path):
        log_text.insert(tk.END, f"File not found: {file_path}\n")
        return False
    folder = os.path.dirname(file_path)
    base_name_with_ext = os.path.basename(file_path)
    base_name, ext = os.path.splitext(base_name_with_ext)
    new_name = get_new_name(base_name, ext)
    if new_name:
        new_path = os.path.join(folder, new_name)
        backup_folder = os.path.join(folder, "pre-renamed")
        os.makedirs(backup_folder, exist_ok=True)
        backup_path = os.path.join(backup_folder, base_name_with_ext)
        try:
            shutil.move(file_path, backup_path)
            shutil.copy2(backup_path, new_path)
            log_text.insert(tk.END, f"Renamed file '{base_name_with_ext}' to '{new_name}'\n")
            return True
        except Exception as e:
            log_text.insert(tk.END, f"Error processing file {file_path}: {e}\n")
            return False
    else:
        log_text.insert(tk.END, f"No mapping substring found in file: {file_path}\n")
        return False

def process_folder(folder):
    processed_count = 0
    for root, dirs, files in os.walk(folder, topdown=False):
        for file in files:
            file_path = os.path.join(root, file)
            if process_file(file_path):
                processed_count += 1
        for d in dirs:
            old_dir_path = os.path.join(root, d)
            new_dir_name = get_new_name(d, "")
            if new_dir_name and new_dir_name != d:
                new_dir_path = os.path.join(root, new_dir_name)
                try:
                    os.rename(old_dir_path, new_dir_path)
                    log_text.insert(tk.END, f"Renamed folder '{d}' to '{new_dir_name}'\n")
                except Exception as e:
                    log_text.insert(tk.END, f"Error renaming folder {old_dir_path}: {e}\n")
    return processed_count

def process_targets():
    if not mapping:
        messagebox.showerror("Error", "No mapping loaded. Please select a mapping CSV file.")
        return
    total_processed = 0
    if selected_files:
        for file_path in selected_files:
            if process_file(file_path):
                total_processed += 1
    if selected_folder:
        count = process_folder(selected_folder)
        total_processed += count
    if total_processed == 0:
        messagebox.showinfo("Done", "No files or folders were processed. Check log for details.")
    else:
        messagebox.showinfo("Done", f"Processed {total_processed} item(s). Check log for details.")

# --- GUI setup ---
root = tk.Tk()
root.title("File Renamer with CSV Mapping (Substring Replacement)")

# Frame for displaying current selections.
info_frame = tk.Frame(root)
info_frame.pack(padx=10, pady=5, fill=tk.X)

# Mapping CSV display.
tk.Label(info_frame, text="Mapping CSV:").grid(row=0, column=0, sticky="e")
mapping_var = tk.StringVar()
mapping_entry = tk.Entry(info_frame, textvariable=mapping_var, width=80, state="readonly")
mapping_entry.grid(row=0, column=1, padx=5, pady=2)
CreateToolTip(mapping_entry, "Path to the selected CSV file containing mapping data.")

# Selected folder display.
tk.Label(info_frame, text="Selected Folder:").grid(row=1, column=0, sticky="e")
folder_var = tk.StringVar()
folder_entry = tk.Entry(info_frame, textvariable=folder_var, width=80, state="readonly")
folder_entry.grid(row=1, column=1, padx=5, pady=2)
CreateToolTip(folder_entry, "Path to the selected folder that will be processed recursively.")

# Selected files display.
tk.Label(info_frame, text="Selected Files:").grid(row=2, column=0, sticky="ne")
selected_files_text = scrolledtext.ScrolledText(info_frame, width=60, height=5, state=tk.DISABLED)
selected_files_text.grid(row=2, column=1, padx=5, pady=2)
CreateToolTip(selected_files_text, "List of individual file paths selected for renaming.")

# Frame for control buttons.
button_frame = tk.Frame(root)
button_frame.pack(padx=10, pady=10)

btn_mapping = tk.Button(button_frame, text="Select Mapping CSV", command=select_mapping)
btn_mapping.grid(row=0, column=0, padx=5, pady=5)

btn_files = tk.Button(button_frame, text="Select Files", command=select_files)
btn_files.grid(row=0, column=1, padx=5, pady=5)

btn_folder = tk.Button(button_frame, text="Select Folder", command=select_folder)
btn_folder.grid(row=0, column=2, padx=5, pady=5)

btn_process = tk.Button(button_frame, text="Process", command=process_targets)
btn_process.grid(row=0, column=3, padx=5, pady=5)

# New: Ignore Case checkbox.
ignore_case_var = tk.BooleanVar(value=True)
ignore_case_cb = tk.Checkbutton(root, text="Ignore Case", variable=ignore_case_var)
ignore_case_cb.pack(anchor="w", padx=10, pady=5)

# Log window for operation details.
log_text = scrolledtext.ScrolledText(root, width=100, height=30)
log_text.pack(padx=10, pady=10)

root.mainloop()
