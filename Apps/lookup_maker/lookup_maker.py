import os
import csv
import re
import tkinter as tk
from tkinter import filedialog, messagebox, scrolledtext
from datetime import datetime

# --- Helper Functions ---

def get_csv_entries(csv_path):
    """
    Parse the CSV file and return a list of tuples:
    (old_value, item1, item2)
    where old_value must match the pattern:
      P-{item1}_Balcony-View_H{item2}
    """
    entries = []
    pattern = re.compile(r"^P-([A-Za-z0-9]+)_Balcony-View_H(\d{2})$")
    with open(csv_path, newline='', encoding='utf-8') as f:
        reader = csv.reader(f)
        for row in reader:
            if row:
                candidate = row[0].strip()
                m = pattern.match(candidate)
                if m:
                    item1 = m.group(1)
                    item2 = m.group(2)
                    entries.append((candidate, item1, item2))
    return entries

def search_targets_for_entry(folder, item1, item2, match_files=True, match_folders=True):
    """
    Recursively search the folder for any entry (file and/or folder) whose base name matches:
      {item2}_a_s_(.+)b_{item1}_0_balcony
    For files, an optional extension is allowed.
    Returns a list of matching base names.
    """
    matches = []
    file_regex_pattern = f"^{re.escape(item2)}_a_s_.+b_{re.escape(item1)}_0_balcony(\\.[^.]+)?$"
    folder_regex_pattern = f"^{re.escape(item2)}_a_s_.+b_{re.escape(item1)}_0_balcony$"
    file_pattern = re.compile(file_regex_pattern)
    folder_pattern = re.compile(folder_regex_pattern)
    
    for root, dirs, files in os.walk(folder):
        if match_files:
            for filename in files:
                if file_pattern.match(filename):
                    matches.append(filename)
        if match_folders:
            for d in dirs:
                if folder_pattern.match(d):
                    matches.append(d)
    return matches

def write_output_csv(output_path, rows):
    """
    Write the list of rows to the output CSV file.
    """
    with open(output_path, "w", newline='', encoding='utf-8') as f:
        writer = csv.writer(f)
        writer.writerow(["old_value", "matched_value"])
        writer.writerows(rows)

# --- GUI Functions ---

def select_csv_file():
    path = filedialog.askopenfilename(title="Select CSV File", filetypes=[("CSV Files", "*.csv")])
    if path:
        csv_entry_var.set(path)
    return path

def select_search_folder():
    folder = filedialog.askdirectory(title="Select Folder to Search")
    if folder:
        folder_entry_var.set(folder)
    return folder

def select_output_file():
    default_name = datetime.now().strftime("%Y%m%d-%H%M%S") + "-names-lookup.csv"
    path = filedialog.asksaveasfilename(title="Select Output CSV File", defaultextension=".csv",
                                        initialfile=default_name,
                                        filetypes=[("CSV Files", "*.csv")])
    if path:
        output_entry_var.set(path)
    return path

def process():
    csv_path = csv_entry_var.get().strip()
    folder = folder_entry_var.get().strip()
    output_path = output_entry_var.get().strip()
    match_files = match_files_var.get()
    match_folders = match_folders_var.get()
    
    if not csv_path:
        messagebox.showerror("Error", "Please select a CSV file.")
        return
    if not folder:
        messagebox.showerror("Error", "Please select a folder to search.")
        return
    if not output_path:
        messagebox.showerror("Error", "Please select an output file.")
        return

    log_text.delete("1.0", tk.END)
    log_text.insert(tk.END, "Parsing CSV file...\n")
    entries = get_csv_entries(csv_path)
    log_text.insert(tk.END, f"Found {len(entries)} valid entries in CSV.\n\n")

    output_rows = []
    for old_value, item1, item2 in entries:
        log_text.insert(tk.END, f"Processing entry: {old_value} (item1: {item1}, item2: {item2})\n")
        matches = search_targets_for_entry(folder, item1, item2, match_files, match_folders)
        if matches:
            for match in matches:
                # Only save the base name (last component)
                base_name = os.path.basename(match)
                log_text.insert(tk.END, f"  Matched: {base_name}\n")
                output_rows.append([old_value, base_name])
        else:
            log_text.insert(tk.END, "  No match found.\n")
        log_text.insert(tk.END, "\n")
        log_text.see(tk.END)
    
    if output_rows:
        write_output_csv(output_path, output_rows)
        messagebox.showinfo("Done", f"Found {len(output_rows)} matching entries.\nOutput saved to:\n{output_path}")
    else:
        messagebox.showinfo("Done", "No matching files or folders were found.")

# --- GUI Setup ---

root = tk.Tk()
root.title("Names Lookup Converter")

# Variables for entry fields.
csv_entry_var = tk.StringVar()
folder_entry_var = tk.StringVar()
output_entry_var = tk.StringVar()
match_files_var = tk.BooleanVar(value=True)
match_folders_var = tk.BooleanVar(value=True)

# Main frame.
frame = tk.Frame(root, padx=10, pady=10)
frame.pack(fill=tk.BOTH, expand=True)

# CSV file selection.
tk.Label(frame, text="CSV File:").grid(row=0, column=0, sticky="e")
csv_entry = tk.Entry(frame, textvariable=csv_entry_var, width=80)
csv_entry.grid(row=0, column=1, padx=5, pady=5)
tk.Button(frame, text="Browse...", command=select_csv_file).grid(row=0, column=2, padx=5, pady=5)

# Folder selection.
tk.Label(frame, text="Search Folder:").grid(row=1, column=0, sticky="e")
folder_entry = tk.Entry(frame, textvariable=folder_entry_var, width=80)
folder_entry.grid(row=1, column=1, padx=5, pady=5)
tk.Button(frame, text="Browse...", command=select_search_folder).grid(row=1, column=2, padx=5, pady=5)

# Output file selection.
tk.Label(frame, text="Output File:").grid(row=2, column=0, sticky="e")
output_entry = tk.Entry(frame, textvariable=output_entry_var, width=80)
output_entry.grid(row=2, column=1, padx=5, pady=5)
tk.Button(frame, text="Save As...", command=select_output_file).grid(row=2, column=2, padx=5, pady=5)

# Checkboxes for match options.
tk.Label(frame, text="Match Options:").grid(row=3, column=0, sticky="e")
match_files_cb = tk.Checkbutton(frame, text="Match Files", variable=match_files_var)
match_files_cb.grid(row=3, column=1, sticky="w")
match_folders_cb = tk.Checkbutton(frame, text="Match Folders", variable=match_folders_var)
match_folders_cb.grid(row=3, column=1, padx=120, sticky="w")

# Process button.
process_btn = tk.Button(root, text="Process", command=process, padx=10, pady=5)
process_btn.pack(pady=10)

# Log window.
log_text = scrolledtext.ScrolledText(root, width=100, height=20)
log_text.pack(padx=10, pady=10)

root.mainloop()
