# main.py
import os
import json
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import tkinter.scrolledtext as scrolledtext
from PIL import Image
from actions import process_layer  # Import our layer processing function

# Global list to hold layer configuration dictionaries.
layer_configs = []

def add_layer_config():
    """
    Opens a small dialog (Toplevel window) for the user to add a layer.
    The user selects an image, chooses an action, and enters any parameters (as JSON).
    """
    layer_window = tk.Toplevel(root)
    layer_window.title("Configure Layer")

    tk.Label(layer_window, text="Layer Source Image Path:").grid(row=0, column=0, padx=5, pady=5)
    src_entry = tk.Entry(layer_window, width=50)
    src_entry.grid(row=0, column=1, padx=5, pady=5)
    
    def browse_image():
        path = filedialog.askopenfilename(title="Select Layer Image", filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
        if path:
            src_entry.delete(0, tk.END)
            src_entry.insert(0, path)
    ttk.Button(layer_window, text="Browse", command=browse_image).grid(row=0, column=2, padx=5, pady=5)
    
    tk.Label(layer_window, text="Select Action:").grid(row=1, column=0, padx=5, pady=5)
    # For simplicity, list a few actions. (You can extend this list as registered in actions.py.)
    action_options = ["apply_opacity", "blend_normal", "blend_screen", "blend_multiply"]
    action_var = tk.StringVar(value=action_options[0])
    action_combo = ttk.Combobox(layer_window, textvariable=action_var, values=action_options, state="readonly")
    action_combo.grid(row=1, column=1, padx=5, pady=5)
    
    tk.Label(layer_window, text="Parameters (JSON):").grid(row=2, column=0, padx=5, pady=5)
    params_entry = tk.Entry(layer_window, width=50)
    params_entry.grid(row=2, column=1, padx=5, pady=5)
    params_entry.insert(0, "{}")
    
    def save_layer():
        src = src_entry.get().strip()
        if not src:
            messagebox.showerror("Error", "Please enter an image path.")
            return
        try:
            params = json.loads(params_entry.get().strip())
        except Exception as e:
            messagebox.showerror("Error", "Parameters must be valid JSON.")
            return
        # Save a layer configuration that consists of the source path and one action.
        config = {
            "source": src,
            "actions": [
                {
                    "name": action_var.get(),
                    "params": params
                }
            ]
        }
        layer_configs.append(config)
        layers_list.insert(tk.END, f"Layer: {os.path.basename(src)}, Action: {action_var.get()}, Params: {params}")
        layer_window.destroy()
    
    ttk.Button(layer_window, text="Save Layer", command=save_layer).grid(row=3, column=1, pady=10)

def remove_last_layer():
    """
    Removes the last configured layer.
    """
    if layer_configs:
        layer_configs.pop()
        layers_list.delete(tk.END)

def compose_images():
    """
    Composes all layers over a base image.
    The user selects a base image, and then each layer (as defined by its configuration)
    is processed and composited on top (using standard alpha composition).
    """
    if not layer_configs:
        messagebox.showinfo("Info", "No layers configured.")
        return
    base_path = filedialog.askopenfilename(title="Select Base Image", filetypes=[("Image Files", "*.png;*.jpg;*.jpeg")])
    if not base_path:
        return
    base_img = Image.open(base_path).convert("RGBA")
    composite = base_img.copy()
    log_text.delete("1.0", tk.END)
    log_text.insert(tk.END, "Starting composition...\n")
    
    for idx, config in enumerate(layer_configs):
        log_text.insert(tk.END, f"Processing Layer {idx+1}: {config['source']} with actions: {config['actions']}\n")
        try:
            layer_img = process_layer(config, base_image=composite)
            # Composite the processed layer onto the current composite using normal alpha.
            composite = Image.alpha_composite(composite, layer_img)
            log_text.insert(tk.END, f"Layer {idx+1} composited.\n")
        except Exception as e:
            log_text.insert(tk.END, f"Error processing layer {idx+1}: {str(e)}\n")
            continue
    
    export_path = filedialog.asksaveasfilename(title="Save Composite Image", defaultextension=".png", filetypes=[("PNG Image", "*.png")])
    if export_path:
        composite.save(export_path)
        log_text.insert(tk.END, f"Composite image saved to {export_path}\n")
        messagebox.showinfo("Done", f"Composite saved to {export_path}")
    else:
        log_text.insert(tk.END, "Composition finished but not saved.\n")

# Set up the main GUI.
root = tk.Tk()
root.title("Alpha Image Composer")

controls_frame = ttk.Frame(root)
controls_frame.pack(fill="x", padx=10, pady=5)

ttk.Button(controls_frame, text="Add Layer", command=add_layer_config).pack(side="left", padx=5)
ttk.Button(controls_frame, text="Remove Last Layer", command=remove_last_layer).pack(side="left", padx=5)
ttk.Button(controls_frame, text="Compose Images", command=compose_images).pack(side="left", padx=5)

# Listbox to display the current layer configurations.
layers_list = tk.Listbox(root, width=80, height=10)
layers_list.pack(padx=10, pady=10, fill="both", expand=True)

# Log window for process messages.
log_text = scrolledtext.ScrolledText(root, width=80, height=15)
log_text.pack(padx=10, pady=10, fill="both", expand=True)

root.mainloop()
