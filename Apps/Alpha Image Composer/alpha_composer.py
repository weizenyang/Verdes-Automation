import os
import json
import threading
import tkinter as tk
from tkinter import ttk, filedialog, messagebox
import tkinter.scrolledtext as scrolledtext
from PIL import Image, ImageChops
import numpy as np

# ---------------- Global Stop Event ----------------
stop_event = threading.Event()

# ---------------- Helper Functions ----------------

def set_opacity(im, opacity):
    """Applies an opacity factor to an RGBA image."""
    if im.mode != 'RGBA':
        im = im.convert('RGBA')
    r, g, b, a = im.split()
    a = a.point(lambda p: int(p * opacity))
    im.putalpha(a)
    return im

def adjust_gamma(im, gamma):
    """Adjusts the gamma of the image."""
    if gamma == 1.0:
        return im
    arr = np.array(im).astype(np.float32)/255.0
    invGamma = 1.0/gamma
    adjusted = np.power(arr, invGamma)
    adjusted = np.clip(adjusted*255, 0, 255).astype(np.uint8)
    return Image.fromarray(adjusted, mode="RGBA")

def apply_transformations(im, transformations):
    """
    Applies a list of transformation dictionaries to an image.
    Each dict should have keys:
       - "match": transformation only applies if this equals (case-insensitively) the layer name.
       - "action": one of "rotate", "flip", "roll"
       - "params": a dict of parameters (collected from the UI fields).
    Transformations are applied in order.
    """
    for t in transformations:
        action = t.get("action", "").lower()
        params = t.get("params", {})
        if action == "rotate":
            angle = float(params.get("angle", 0))
            im = im.rotate(angle, expand=False)
        elif action == "flip":
            direction = params.get("direction", "horizontal").lower()
            if direction == "horizontal":
                im = im.transpose(Image.FLIP_LEFT_RIGHT)
            elif direction == "vertical":
                im = im.transpose(Image.FLIP_TOP_BOTTOM)
        elif action == "roll":
            x_offset = int(params.get("x_offset", 0))
            y_offset = int(params.get("y_offset", 0))
            arr = np.array(im)
            arr = np.roll(arr, shift=x_offset, axis=1)
            arr = np.roll(arr, shift=y_offset, axis=0)
            im = Image.fromarray(arr, mode="RGBA")
    return im

# (Remaining helper functions remain unchanged: build_exact_dict, build_mapping, etc.)

def build_exact_dict(folder, constant):
    d = {}
    constant = constant.lower()
    for root_dir, dirs, files in os.walk(folder):
        for file in files:
            if file.lower().endswith((".jpg", ".jpeg", ".png")):
                base, _ = os.path.splitext(file)
                base_lower = base.lower()
                if constant and base_lower.endswith(constant):
                    key = base_lower[:-len(constant)]
                    d[key] = os.path.join(root_dir, file)
    return d

def build_mapping(folder, constant):
    mapping = {}
    constant = constant.lower()
    for root, dirs, files in os.walk(folder):
        for file in files:
            if file.lower().endswith((".jpg", ".jpeg", ".png")):
                base, _ = os.path.splitext(file)
                base_lower = base.lower()
                if constant and base_lower.endswith(constant):
                    key = base_lower[:-len(constant)]
                else:
                    key = base_lower
                mapping[key] = os.path.join(root, file)
    return mapping

def find_best_match(parent_key, mapping):
    best_path = None
    best_length = 0
    for key, path in mapping.items():
        if key in parent_key and len(key)>best_length:
            best_path = path
            best_length = len(key)
    return best_path

def apply_alpha_override(main_image, alpha_image, opacity):
    if main_image.size != alpha_image.size:
        alpha_image = alpha_image.resize(main_image.size, Image.LANCZOS)
    new_alpha = alpha_image.point(lambda p: int(p * opacity))
    main_image.putalpha(new_alpha)
    return main_image

def get_default_alpha(width, height):
    return Image.new('L', (width, height), 255)

def get_default_bottom(width, height):
    return Image.new('RGBA', (width, height), (255,255,255,255))

def blend_images(base, layer, blend_mode):
    if blend_mode.lower()=="normal":
        return Image.alpha_composite(base, layer)
    else:
        base_arr = np.array(base).astype(np.float32)/255.0
        layer_arr = np.array(layer).astype(np.float32)/255.0
        base_alpha = base_arr[...,3:4]
        layer_alpha = layer_arr[...,3:4]
        base_rgb = base_arr[..., :3]*base_alpha
        layer_rgb = layer_arr[..., :3]*layer_alpha
        if blend_mode.lower()=="screen":
            screen_rgb = 1.0-(1.0-base_rgb)*(1.0-layer_rgb)
            blended_rgb = base_rgb + (screen_rgb-base_rgb)*layer_alpha
        elif blend_mode.lower()=="multiply":
            blended_rgb = base_rgb * layer_rgb
        elif blend_mode.lower()=="add":
            blended_rgb = np.clip(base_rgb+layer_rgb, 0,1)
        elif blend_mode.lower()=="subtract":
            blended_rgb = np.clip(base_rgb-layer_rgb, 0,1)
        else:
            blended_rgb = base_rgb
        blended_alpha = layer_alpha+base_alpha*(1.0-layer_alpha)
        with np.errstate(divide='ignore', invalid='ignore'):
            out_rgb = np.where(blended_alpha==0, 0, blended_rgb/blended_alpha)
        final_arr = np.concatenate([out_rgb, blended_alpha],axis=-1)
        final_arr = (np.clip(final_arr,0,1)*255).astype(np.uint8)
        return Image.fromarray(final_arr, mode="RGBA")

# ---------------- Transformation Editor (Inline) ----------------

def update_transformation_params(tr_widgets):
    """
    Updates the parameter fields in the transformation row based on the selected action.
    Clears any existing parameter widgets and creates new ones.
    tr_widgets is a dict that has keys:
        "param_frame": the Frame to put parameter widgets into,
        "param_vars": a dict where we'll store the parameter variables.
    """
    for widget in tr_widgets["param_frame"].winfo_children():
        widget.destroy()
    tr_widgets["param_vars"] = {}
    action = tr_widgets["action_var"].get().lower()
    if action == "rotate":
        # Create a label and entry for angle.
        tk.Label(tr_widgets["param_frame"], text="Angle:").grid(row=0, column=0, padx=2, pady=2)
        angle_var = tk.StringVar(value="0")
        tk.Entry(tr_widgets["param_frame"], textvariable=angle_var, width=6).grid(row=0, column=1, padx=2, pady=2)
        tr_widgets["param_vars"]["angle"] = angle_var
    elif action == "flip":
        # Create a label and combobox for direction.
        tk.Label(tr_widgets["param_frame"], text="Direction:").grid(row=0, column=0, padx=2, pady=2)
        dir_var = tk.StringVar(value="horizontal")
        ttk.Combobox(tr_widgets["param_frame"], textvariable=dir_var, values=["horizontal", "vertical"], state="readonly", width=8).grid(row=0, column=1, padx=2, pady=2)
        tr_widgets["param_vars"]["direction"] = dir_var
    elif action == "roll":
        # Create labels and entries for x_offset and y_offset.
        tk.Label(tr_widgets["param_frame"], text="X Offset:").grid(row=0, column=0, padx=2, pady=2)
        x_var = tk.StringVar(value="0")
        tk.Entry(tr_widgets["param_frame"], textvariable=x_var, width=6).grid(row=0, column=1, padx=2, pady=2)
        tk.Label(tr_widgets["param_frame"], text="Y Offset:").grid(row=0, column=2, padx=2, pady=2)
        y_var = tk.StringVar(value="0")
        tk.Entry(tr_widgets["param_frame"], textvariable=y_var, width=6).grid(row=0, column=3, padx=2, pady=2)
        tr_widgets["param_vars"]["x_offset"] = x_var
        tr_widgets["param_vars"]["y_offset"] = y_var

def add_transformation_row(layer_row, default=None):
    """
    Adds a new transformation row in the layer's transformation_frame.
    Each transformation row includes:
      - A "Match" field,
      - An "Action" combobox,
      - A parameters frame (populated based on action),
      - And a Remove button.
    """
    parent_frame = layer_row["transformation_frame"]
    tr_frame = tk.Frame(parent_frame)
    tr_frame.pack(fill="x", pady=2)
    
    # Match field: default to the layer's name if not specified.
    match_var = tk.StringVar(value=(default.get("match", layer_row["name_entry"].get()) if default else layer_row["name_entry"].get()))
    tk.Label(tr_frame, text="Match:").pack(side="left", padx=2)
    match_entry = tk.Entry(tr_frame, textvariable=match_var, width=10)
    match_entry.pack(side="left", padx=2)
    
    # Action combobox.
    action_var = tk.StringVar(value=(default.get("action", "rotate") if default else "rotate"))
    action_cb = ttk.Combobox(tr_frame, textvariable=action_var, values=["rotate", "flip", "roll"], state="readonly", width=8)
    action_cb.pack(side="left", padx=2)
    
    # Parameter frame to hold dynamic parameter fields.
    param_frame = tk.Frame(tr_frame)
    param_frame.pack(side="left", padx=2)
    # Prepare an empty parameter variable dict.
    param_vars = {}
    # Create a dictionary for this transformation row:
    tr_widgets = {
        "frame": tr_frame,
        "match_var": match_var,
        "action_var": action_var,
        "param_frame": param_frame,
        "param_vars": param_vars
    }
    # Bind action changes.
    def on_action_change(event):
        update_transformation_params(tr_widgets)
    action_cb.bind("<<ComboboxSelected>>", on_action_change)
    # Initialize parameter fields.
    update_transformation_params(tr_widgets)
    
    # Remove button.
    remove_btn = tk.Button(tr_frame, text="-", command=lambda: remove_transformation_row(layer_row, tr_widgets))
    remove_btn.pack(side="left", padx=2)
    
    # Append this transformation row to the layer_row's transformation_rows list.
    if "transformation_rows" not in layer_row:
        layer_row["transformation_rows"] = []
    layer_row["transformation_rows"].append(tr_widgets)

def remove_transformation_row(layer_row, tr_widgets):
    """Removes a transformation row from a layer's transformation list."""
    if "transformation_rows" in layer_row:
        layer_row["transformation_rows"].remove(tr_widgets)
    tr_widgets["frame"].destroy()

# ---------------- Dynamic Layer GUI Management ----------------
# (This section now creates an inline transformation editor as part of each layer row.)

layer_rows = []  # Global list to store each layer's widgets

def add_layer():
    row = len(layer_rows) + 1
    frame = layers_frame
    # Create all your variables as before...
    name_var = tk.StringVar(value=f"Layer {row}")
    main_const_var = tk.StringVar(value="Custom...")
    main_mode_var = tk.StringVar(value="Child")
    main_opacity_var = tk.StringVar(value="1.0")
    use_alpha_var = tk.BooleanVar(value=False)
    alpha_const_var = tk.StringVar(value="")
    alpha_mode_var = tk.StringVar(value="Child")
    alpha_opacity_var = tk.StringVar(value="1.0")
    blend_mode_var = tk.StringVar(value="Normal")
    gamma_var = tk.StringVar(value="1.0")
    
    # Create a dedicated transformation area.
    transformation_frame = tk.Frame(frame, borderwidth=1, relief="sunken")
    
    # Create your regular widgets...
    name_entry = tk.Entry(frame, textvariable=name_var, width=12)
    main_const_entry = tk.Entry(frame, textvariable=main_const_var, width=12)
    main_mode_combobox = ttk.Combobox(frame, textvariable=main_mode_var, values=["Parent", "Child", "Exact"], state="readonly", width=8)
    main_opacity_entry = tk.Entry(frame, textvariable=main_opacity_var, width=5)
    use_alpha_check = tk.Checkbutton(frame, text="Use Alpha", variable=use_alpha_var)
    alpha_const_entry = tk.Entry(frame, textvariable=alpha_const_var, width=12)
    alpha_mode_combobox = ttk.Combobox(frame, textvariable=alpha_mode_var, values=["Parent", "Child", "Exact"], state="readonly", width=8)
    alpha_opacity_entry = tk.Entry(frame, textvariable=alpha_opacity_var, width=5)
    blend_mode_combobox = ttk.Combobox(frame, textvariable=blend_mode_var, values=["Normal", "Multiply", "Screen", "Add", "Subtract"], state="readonly", width=10)
    gamma_entry = tk.Entry(frame, textvariable=gamma_var, width=8)
    
    main_mode_combobox.bind("<<ComboboxSelected>>", on_dynamic_mode_change)
    
    # Position the widgets in the grid
    name_entry.grid(row=row, column=0, padx=2, pady=2)
    main_const_entry.grid(row=row, column=1, padx=2, pady=2)
    main_mode_combobox.grid(row=row, column=2, padx=2, pady=2)
    main_opacity_entry.grid(row=row, column=3, padx=2, pady=2)
    use_alpha_check.grid(row=row, column=4, padx=2, pady=2)
    alpha_const_entry.grid(row=row, column=5, padx=2, pady=2)
    alpha_mode_combobox.grid(row=row, column=6, padx=2, pady=2)
    alpha_opacity_entry.grid(row=row, column=7, padx=2, pady=2)
    blend_mode_combobox.grid(row=row, column=8, padx=2, pady=2)
    gamma_entry.grid(row=row, column=9, padx=2, pady=2)
    
    # For the transformation area, here we just pack it into column 10.
    transformation_frame.grid(row=row, column=10, padx=2, pady=2, sticky="nsew")
    # Plus button inside transformation area: use the local variable "layer_row" (see below).
    
    # Create a local dictionary that represents this layer row:
    layer_row = {
        "name_entry": name_entry,
        "main_const_entry": main_const_entry,
        "main_mode_combobox": main_mode_combobox,
        "main_opacity_entry": main_opacity_entry,
        "use_alpha_var": use_alpha_var,
        "alpha_const_entry": alpha_const_entry,
        "alpha_mode_combobox": alpha_mode_combobox,
        "alpha_opacity_entry": alpha_opacity_entry,
        "blend_mode_combobox": blend_mode_combobox,
        "gamma_var": gamma_var,
        "transformation_frame": transformation_frame,
        "transformation_rows": []
    }
    # Create the plus button in the transformation area and bind it to add transformation rows to THIS layer.
    plus_btn = tk.Button(transformation_frame, text="+", command=lambda: add_transformation_row(layer_row))
    plus_btn.pack(side="bottom", anchor="e")
    
    layer_rows.append(layer_row)


def remove_last_layer():
    if layer_rows:
        row_widgets = layer_rows.pop()
        for widget in row_widgets.values():
            if hasattr(widget, "destroy"):
                widget.destroy()

def on_dynamic_mode_change(event):
    changed = event.widget
    if changed.get().lower() == "parent":
        for row in layer_rows:
            mode_w = row["main_mode_combobox"]
            if mode_w is not changed and mode_w.get().lower() == "parent":
                mode_w.set("Child")

def get_layers_config():
    config = []
    for row in layer_rows:
        trans_list = []
        for tr in row.get("transformation_rows", []):
            trans_list.append({
                "match": tr["match_var"].get(),
                "action": tr["action_var"].get(),
                "params": {k: v.get() for k, v in tr["param_vars"].items()}
            })
        config.append({
            "name": row["name_entry"].get().strip(),
            "main_constant": row["main_const_entry"].get().strip(),
            "main_mode": row["main_mode_combobox"].get().strip(),
            "main_opacity": row["main_opacity_entry"].get().strip(),
            "use_alpha": row["use_alpha_var"].get(),
            "alpha_constant": row["alpha_const_entry"].get().strip(),
            "alpha_mode": row["alpha_mode_combobox"].get().strip(),
            "alpha_opacity": row["alpha_opacity_entry"].get().strip(),
            "blend_mode": row["blend_mode_combobox"].get().strip(),
            "gamma": row["gamma_var"].get().strip(),
            "transformations": trans_list
        })
    return config

def export_config():
    config = get_layers_config()
    file_path = filedialog.asksaveasfilename(title="Save Config", defaultextension=".json",
                                             filetypes=[("JSON Files", "*.json")])
    if file_path:
        with open(file_path, "w") as f:
            json.dump(config, f, indent=4)
        messagebox.showinfo("Export Config", f"Configuration saved to {file_path}")

def load_config():
    global layer_rows
    file_path = filedialog.askopenfilename(title="Load Config", filetypes=[("JSON Files", "*.json")])
    if file_path:
        try:
            with open(file_path, "r") as f:
                config = json.load(f)
            for row in layer_rows:
                for widget in row.values():
                    if hasattr(widget, "destroy"):
                        widget.destroy()
            layer_rows = []
            for layer in config:
                add_layer()
                row = layer_rows[-1]
                row["name_entry"].delete(0, tk.END); row["name_entry"].insert(0, layer.get("name", ""))
                row["main_const_entry"].delete(0, tk.END); row["main_const_entry"].insert(0, layer.get("main_constant", ""))
                row["main_mode_combobox"].set(layer.get("main_mode", "Child"))
                row["main_opacity_entry"].delete(0, tk.END); row["main_opacity_entry"].insert(0, layer.get("main_opacity", "1.0"))
                row["use_alpha_var"].set(layer.get("use_alpha", False))
                row["alpha_const_entry"].delete(0, tk.END); row["alpha_const_entry"].insert(0, layer.get("alpha_constant", ""))
                row["alpha_mode_combobox"].set(layer.get("alpha_mode", "Child"))
                row["alpha_opacity_entry"].delete(0, tk.END); row["alpha_opacity_entry"].insert(0, layer.get("alpha_opacity", "1.0"))
                row["blend_mode_combobox"].set(layer.get("blend_mode", "Normal"))
                row["gamma_var"].set(layer.get("gamma", "1.0"))
                # Rebuild transformation rows.
                row["transformation_rows"] = []
                for trans in layer.get("transformations", []):
                    add_transformation_row(row, default=trans)
            messagebox.showinfo("Load Config", "Configuration loaded successfully.")
        except Exception as e:
            messagebox.showerror("Load Config", f"Error loading configuration: {e}")

# ---------------- Folder Browsing ----------------

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

# ---------------- Export Options Widgets will use variables created after root ----------------
# ---------------- Thread-Safe Logging ----------------

def log_message(msg):
    root.after(0, lambda: log_text.insert(tk.END, msg + "\n"))

# ---------------- Multithreaded Processing ----------------

def process_images_worker(params):
    folder = params["folder"]
    export_folder = params["export_folder"]
    target_width = params["target_width"]
    target_height = params["target_height"]
    layers_config = params["layers_config"]
    output_format = params["output_format"]
    quality = params["quality"]
    append_suffix = params["append_suffix"]
    suffix_value = params["suffix_value"]

    try:
        os.makedirs(export_folder, exist_ok=True)
        log_message("Building layer dictionaries...")

        parent_layer = [layer for layer in layers_config if layer["main_mode"].lower()=="parent"][0]
        parent_dict = build_exact_dict(folder, parent_layer["main_constant"])
        if not parent_dict:
            root.after(0, lambda: messagebox.showerror("Error", "No images found for parent layer."))
            return
        log_message(f"Found {len(parent_dict)} parent image(s) from layer '{parent_layer['name']}'.")
        log_message(f"Parent keys: {', '.join(parent_dict.keys())}\n")

        main_layer_dicts = []
        for layer in layers_config:
            mode = layer["main_mode"].lower()
            const = layer["main_constant"]
            if mode=="parent":
                main_layer_dicts.append(parent_dict)
            elif mode=="exact":
                d = build_exact_dict(folder, const)
                main_layer_dicts.append(d)
            elif mode=="child":
                mapping = build_mapping(folder, const)
                d = {}
                for pkey in parent_dict.keys():
                    match = find_best_match(pkey, mapping)
                    if match:
                        d[pkey] = match
                main_layer_dicts.append(d)
            else:
                root.after(0, lambda: messagebox.showerror("Error", f"Invalid main mode for layer '{layer['name']}'."))
                return

        alpha_override_maps = []
        for layer in layers_config:
            if layer["use_alpha"]:
                a_mode = layer["alpha_mode"].lower()
                a_const = layer["alpha_constant"]
                if a_mode in ("parent","exact"):
                    a_map = build_exact_dict(folder, a_const)
                elif a_mode=="child":
                    a_map = build_mapping(folder, a_const)
                else:
                    root.after(0, lambda: messagebox.showerror("Error", f"Invalid alpha mode for layer '{layer['name']}'."))
                    return
                alpha_override_maps.append(a_map)
            else:
                alpha_override_maps.append(None)

        common_keys = set(parent_dict.keys())
        for d in main_layer_dicts:
            common_keys = common_keys & set(d.keys())
        log_message(f"Processing composite for {len(common_keys)} key(s) (intersection across all layers).\n")
        if not common_keys:
            root.after(0, lambda: messagebox.showinfo("Info", "No composite entries found where all layers are available."))
            return

        for key in common_keys:
            if stop_event.is_set():
                log_message("Processing stopped by user.")
                return
            try:
                composite_img = None
                log_message(f"Processing composite for key: '{key}'")
                for idx, layer in enumerate(layers_config):
                    img_path = main_layer_dicts[idx].get(key)
                    if not img_path:
                        raise Exception(f"Missing main image for layer '{layer['name']}' (key: {key}).")
                    log_message(f"  Layer '{layer['name']}' main image: {img_path}")
                    img = Image.open(img_path).convert("RGBA")
                    if img.size != (target_width, target_height):
                        img = img.resize((target_width, target_height), Image.LANCZOS)
                        log_message(f"    Resized image to {target_width}x{target_height}.")
                    trans_list = layer.get("transformations", [])
                    filtered_trans = [t for t in trans_list if t.get("match", "").lower()==layer["name"].lower()]
                    if filtered_trans:
                        img = apply_transformations(img, filtered_trans)
                        log_message(f"    Applied transformations: {filtered_trans}")
                    m_opacity = float(layer["main_opacity"])
                    img = set_opacity(img, m_opacity)
                    
                    if layer["use_alpha"]:
                        alpha_map = alpha_override_maps[idx]
                        override_path = None
                        if layer["alpha_mode"].lower()=="child":
                            override_path = find_best_match(key, alpha_map)
                        elif layer["alpha_mode"].lower() in ("exact", "parent"):
                            override_path = alpha_map.get(key) if key in alpha_map else None
                        if override_path:
                            log_message(f"    Alpha override image: {override_path}")
                            a_img = Image.open(override_path).convert("L")
                            if a_img.size != (target_width, target_height):
                                a_img = a_img.resize((target_width, target_height), Image.LANCZOS)
                            a_opacity = float(layer["alpha_opacity"])
                            img = apply_alpha_override(img, a_img, a_opacity)
                        else:
                            log_message("    No alpha override image found; using main alpha.")
                    
                    try:
                        layer_gamma = float(layer.get("gamma", "1.0"))
                    except:
                        layer_gamma = 1.0
                    if layer_gamma != 1.0:
                        img = adjust_gamma(img, layer_gamma)
                        log_message(f"    Applied gamma correction: {layer_gamma}")
                    
                    blend_mode = layer["blend_mode"].lower()
                    if composite_img is None:
                        composite_img = img
                    else:
                        composite_img = blend_images(composite_img, img, blend_mode)
                if append_suffix:
                    filename = key + suffix_value
                else:
                    filename = key
                if output_format.lower()=="jpg":
                    ext = ".jpg"
                    composite_to_save = composite_img.convert("RGB")
                else:
                    ext = ".png"
                    compress_level = max(0, min(9, int((100-quality)/10)))
                    composite_to_save = composite_img
                if preserve_structure_var.get():
                    parent_path = parent_dict[key]
                    rel_path = os.path.relpath(parent_path, folder)
                    rel_dir = os.path.dirname(rel_path)
                    final_export_folder = os.path.join(export_folder, rel_dir)
                    os.makedirs(final_export_folder, exist_ok=True)
                    output_path = os.path.join(final_export_folder, f"{filename}{ext}")
                else:
                    output_path = os.path.join(export_folder, f"{filename}{ext}")
                if output_format.lower()=="jpg":
                    composite_to_save.save(output_path, quality=quality)
                else:
                    composite_to_save.save(output_path, compress_level=compress_level)
                log_message(f"Composite for key '{key}' saved to: {output_path}\n")
            except Exception as e:
                log_message(f"Error processing key '{key}': {e}\n")
        root.after(0, lambda: messagebox.showinfo("Done", f"Processed composites for {len(common_keys)} key(s).\nOutput saved in:\n{export_folder}"))
    except Exception as e:
        root.after(0, lambda e=e: messagebox.showerror("Error", str(e)))

def start_processing():
    stop_event.clear()
    log_text.delete("1.0", tk.END)
    folder = folder_path_entry.get().strip()
    if not folder:
        messagebox.showerror("Error", "Please select a source folder.")
        return
    export_folder = export_folder_entry.get().strip()
    if not export_folder:
        export_folder = os.path.join(folder, "output")
    try:
        target_width = int(target_width_entry.get().strip())
        target_height = int(target_height_entry.get().strip())
    except ValueError:
        messagebox.showerror("Error", "Target width and height must be integers.")
        return
    layers_config = get_layers_config()
    if not layers_config:
        messagebox.showerror("Error", "No layer configuration available.")
        return
    for layer in layers_config:
        try:
            op = float(layer["main_opacity"])
            if not (0.0<=op<=1.0):
                raise ValueError
            if layer["use_alpha"]:
                aop = float(layer["alpha_opacity"])
                if not (0.0<=aop<=1.0):
                    raise ValueError
        except:
            messagebox.showerror("Error", f"Opacity values for layer '{layer['name']}' must be numbers between 0 and 1.")
            return
    parent_layers = [layer for layer in layers_config if layer["main_mode"].lower()=="parent"]
    if len(parent_layers)!=1:
        messagebox.showerror("Error", "There must be exactly one layer set to 'Parent'.")
        return
    output_format = output_format_var.get()
    quality = int(quality_var.get())
    append_suffix = append_suffix_var.get()
    suffix_value = suffix_var.get()

    params = {
        "folder": folder,
        "export_folder": export_folder,
        "target_width": target_width,
        "target_height": target_height,
        "layers_config": layers_config,
        "output_format": output_format,
        "quality": quality,
        "append_suffix": append_suffix,
        "suffix_value": suffix_value
    }
    threading.Thread(target=process_images_worker, args=(params,), daemon=True).start()

def stop_processing():
    stop_event.set()
    log_message("Stop signal issued by user.")

# ---------------- GUI Layout ----------------

root = tk.Tk()
root.title("Unlimited Layers Image Composer")
style = ttk.Style(root)
style.theme_use("clam")

# Folders Frame
folders_frame = ttk.LabelFrame(root, text="Folders")
folders_frame.grid(row=0, column=0, columnspan=3, padx=10, pady=10, sticky="ew")
folder_label = ttk.Label(folders_frame, text="Source Folder:")
folder_label.grid(row=0, column=0, padx=5, pady=5, sticky="e")
folder_path_entry = ttk.Entry(folders_frame, width=50)
folder_path_entry.grid(row=0, column=1, padx=5, pady=5, sticky="ew")
browse_button = ttk.Button(folders_frame, text="Browse...", command=browse_folder)
browse_button.grid(row=0, column=2, padx=5, pady=5)
export_label = ttk.Label(folders_frame, text="Export Folder:")
export_label.grid(row=1, column=0, padx=5, pady=5, sticky="e")
export_folder_entry = ttk.Entry(folders_frame, width=50)
export_folder_entry.grid(row=1, column=1, padx=5, pady=5, sticky="ew")
export_browse_button = ttk.Button(folders_frame, text="Browse...", command=browse_export_folder)
export_browse_button.grid(row=1, column=2, padx=5, pady=5)

# Target Dimensions Frame
dim_frame = ttk.LabelFrame(root, text="Target Dimensions")
dim_frame.grid(row=1, column=0, columnspan=3, padx=10, pady=5, sticky="ew")
target_width_label = ttk.Label(dim_frame, text="Width:")
target_width_label.grid(row=0, column=0, padx=5, pady=5, sticky="e")
target_width_entry = ttk.Entry(dim_frame, width=10)
target_width_entry.grid(row=0, column=1, padx=5, pady=5, sticky="w")
target_width_entry.insert(0, "4096")
target_height_label = ttk.Label(dim_frame, text="Height:")
target_height_label.grid(row=0, column=2, padx=5, pady=5, sticky="e")
target_height_entry = ttk.Entry(dim_frame, width=10)
target_height_entry.grid(row=0, column=3, padx=5, pady=5, sticky="w")
target_height_entry.insert(0, "2048")

# Options Frame
options_frame = ttk.LabelFrame(root, text="Options")
options_frame.grid(row=2, column=0, columnspan=3, padx=10, pady=5, sticky="ew")
preserve_structure_var = tk.BooleanVar()
preserve_structure_check = ttk.Checkbutton(options_frame, text="Preserve Parent Image Directory Structure", variable=preserve_structure_var)
preserve_structure_check.grid(row=0, column=0, padx=5, pady=5, sticky="w")
output_format_var = tk.StringVar(master=root, value="jpg")
output_format_label = ttk.Label(options_frame, text="Export Format:")
output_format_label.grid(row=0, column=1, padx=5, pady=5, sticky="w")
output_format_combo = ttk.Combobox(options_frame, textvariable=output_format_var, values=["jpg", "png"], state="readonly", width=5)
output_format_combo.grid(row=0, column=2, padx=5, pady=5, sticky="w")
quality_var = tk.IntVar(master=root, value=80)
quality_label = ttk.Label(options_frame, text="Quality:")
quality_label.grid(row=0, column=3, padx=5, pady=5, sticky="w")
quality_scale = ttk.Scale(options_frame, from_=0, to=100, orient="horizontal", variable=quality_var)
quality_scale.grid(row=0, column=4, padx=5, pady=5, sticky="w")
quality_entry = ttk.Entry(options_frame, textvariable=quality_var, width=5)
quality_entry.grid(row=0, column=5, padx=5, pady=5, sticky="w")
append_suffix_var = tk.BooleanVar(master=root, value=True)
suffix_var = tk.StringVar(master=root, value="_composited")
suffix_check = ttk.Checkbutton(options_frame, text="Append Suffix", variable=append_suffix_var)
suffix_check.grid(row=1, column=1, padx=5, pady=5, sticky="w")
suffix_entry = ttk.Entry(options_frame, textvariable=suffix_var, width=15)
suffix_entry.grid(row=1, column=2, padx=5, pady=5, sticky="w")

# Layers Configuration Frame
layers_lf = ttk.LabelFrame(root, text="Layers Configuration")
# Ensure it expands with the window.
layers_lf.grid(row=3, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")
# Set weights so the frame grows.
layers_lf.columnconfigure(0, weight=1)
layers_lf.rowconfigure(0, weight=1)
layers_canvas = tk.Canvas(layers_lf, width=1150, height=200)
layers_canvas.grid(row=0, column=0, sticky="nsew")
# Configure canvas to expand within its container.
layers_canvas.columnconfigure(0, weight=1)
layers_canvas.rowconfigure(0, weight=1)

def _on_mousewheel(event):
    layers_canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

# Bind the mousewheel event to the canvas.
layers_canvas.bind_all("<MouseWheel>", _on_mousewheel)

layers_scrollbar = ttk.Scrollbar(layers_lf, orient="vertical", command=layers_canvas.yview)
layers_scrollbar.grid(row=0, column=1, sticky="ns", padx=5, pady=5)
layers_canvas.configure(yscrollcommand=layers_scrollbar.set)
layers_frame = tk.Frame(layers_canvas)
layers_canvas.create_window((0,0), window=layers_frame, anchor="nw")
def on_configure(event):
    layers_canvas.configure(scrollregion=layers_canvas.bbox("all"))
layers_frame.bind("<Configure>", on_configure)
headers = ["Name", "Main Const", "Main Mode", "M. Opac", "Use Alpha", "Alpha Const", "Alpha Mode", "A. Opac", "Blend Mode", "Gamma", "Transforms"]
for col, header in enumerate(headers):
    hdr = ttk.Label(layers_frame, text=header, relief="groove")
    hdr.grid(row=0, column=col, padx=2, pady=2, sticky="ew")
add_layer()
if layer_rows:
    layer_rows[0]["main_mode_combobox"].set("Parent")

# Buttons for layer configuration management
buttons_frame = ttk.Frame(root)
buttons_frame.grid(row=4, column=0, columnspan=3, padx=10, pady=5, sticky="ew")
add_layer_button = ttk.Button(buttons_frame, text="Add Layer", command=add_layer)
add_layer_button.grid(row=0, column=0, padx=5, pady=5)
remove_layer_button = ttk.Button(buttons_frame, text="Remove Last Layer", command=remove_last_layer)
remove_layer_button.grid(row=0, column=1, padx=5, pady=5)
save_config_button = ttk.Button(buttons_frame, text="Save Config", command=export_config)
save_config_button.grid(row=0, column=2, padx=5, pady=5)
load_config_button = ttk.Button(buttons_frame, text="Load Config", command=load_config)
load_config_button.grid(row=0, column=3, padx=5, pady=5)

# Process and Stop Buttons, Log Window
process_button = ttk.Button(root, text="Process", command=start_processing)
process_button.grid(row=5, column=0, padx=10, pady=10)
stop_button = ttk.Button(root, text="Stop", command=stop_processing)
stop_button.grid(row=5, column=1, padx=10, pady=10)
log_text = scrolledtext.ScrolledText(root, width=100, height=15)
log_text.grid(row=6, column=0, columnspan=3, padx=10, pady=10, sticky="nsew")
root.columnconfigure(0, weight=1)
root.columnconfigure(1, weight=1)
root.columnconfigure(2, weight=1)
root.rowconfigure(6, weight=1)
root.mainloop()
