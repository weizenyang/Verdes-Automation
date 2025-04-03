import os
import shutil
import tkinter as tk
from tkinter import filedialog, scrolledtext, messagebox

class FileMoverApp:
    
    def __init__(self, root):
        self.root = root
        self.root.title("File Mover Utility")
        self.root.geometry("600x400")
        
        # Label
        self.label = tk.Label(root, text="Select a folder to process:", font=("Arial", 12))
        self.label.pack(pady=10)
        
        # Folder selection button
        self.select_button = tk.Button(root, text="Select Folder", command=self.select_directory, font=("Arial", 10))
        self.select_button.pack(pady=5)
        
        # Display selected folder
        self.folder_label = tk.Label(root, text="No folder selected", fg="gray", font=("Arial", 10))
        self.folder_label.pack()
        
        # Start Process button
        self.start_button = tk.Button(root, text="Start Process", command=self.process_directory, font=("Arial", 10), state=tk.DISABLED)
        self.start_button.pack(pady=10)
        
        # Scrolled Text box for logs
        self.log_box = scrolledtext.ScrolledText(root, width=70, height=15, wrap=tk.WORD, font=("Arial", 10))
        self.log_box.pack(pady=10)
        
        # Close button
        self.close_button = tk.Button(root, text="Close", command=root.quit, font=("Arial", 10))
        self.close_button.pack(pady=5)
        
        self.base_dir = None

    def log(self, message):
        """Logs messages to the text area."""
        self.log_box.insert(tk.END, message + "\n")
        self.log_box.yview(tk.END)

    def select_directory(self):
        """Opens a file dialog to select the base directory."""
        self.base_dir = filedialog.askdirectory(title="Select Target Folder")
        
        if self.base_dir:
            self.folder_label.config(text=f"Selected: {self.base_dir}", fg="black")
            self.start_button.config(state=tk.NORMAL)
        else:
            self.folder_label.config(text="No folder selected", fg="gray")
            self.start_button.config(state=tk.DISABLED)

    def process_directory(self):
        """Processes the selected directory and moves files accordingly."""
        if not self.base_dir:
            messagebox.showerror("Error", "No folder selected!")
            return
        
        self.log(f"Processing folder: {self.base_dir}")
        
        for folder in os.listdir(self.base_dir):
            folder_path = os.path.join(self.base_dir, folder)
            if os.path.isdir(folder_path):
                folder_list = os.listdir(folder_path)

                # Move up contents if only one subfolder and it’s named "360" or "360s"
                if len(folder_list) < 2 and ("360" in folder_list or "360s" in folder_list):
                    self.log(f"Moving contents of: {folder}")
                    move_contents_up(os.path.join(folder_path, folder_list[0]), self)

                # If folder has multiple subfolders and no "360" or "360s"
                elif len(folder_list) > 1 and "360" not in folder_list and "360s" not in folder_list:
                    for subfolder in folder_list:
                        subfolder_path = os.path.join(folder_path, subfolder)
                        if os.path.isdir(subfolder_path):
                            for subsubfolder in os.listdir(subfolder_path):
                                if subsubfolder.lower().startswith("v"):
                                    self.log(f"Moving contents of: {subsubfolder}")
                                    move_contents_up(os.path.join(subfolder_path, subsubfolder), self)

        self.log("✅ Process Completed!")
        messagebox.showinfo("Success", "File processing completed!")

def move_contents_up(directory, app):
    """Moves all files from the subfolder to its parent directory and removes the empty folder."""
    parent_dir = os.path.dirname(directory)

    if not os.path.exists(directory):
        app.log(f"⚠ Directory does not exist: {directory}")
        return

    for entry in os.listdir(directory):
        source = os.path.join(directory, entry)
        target = os.path.join(parent_dir, entry)

        # If file exists, rename it
        if os.path.exists(target):
            base, ext = os.path.splitext(entry)
            counter = 1
            while os.path.exists(os.path.join(parent_dir, f"{base}_{counter}{ext}")):
                counter += 1
            target = os.path.join(parent_dir, f"{base}_{counter}{ext}")

        shutil.move(source, target)
        app.log(f"📦 Moved: {source} -> {target}")

    try:
        os.rmdir(directory)
        app.log(f"🗑 Removed empty directory: {directory}")
    except OSError:
        pass

if __name__ == "__main__":
    root = tk.Tk()
    app = FileMoverApp(root)
    root.mainloop()
