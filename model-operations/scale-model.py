import bpy
import os

# -----------------------------
# Configuration: update these paths
# -----------------------------
input_dir = r'P:\xxxx_Aldar_Waldorf_Astoria\_Out\For_The_App\model_360-collision_property_variation\compressed\input'
output_dir = r'P:\xxxx_Aldar_Waldorf_Astoria\_Out\For_The_App\model_360-collision_property_variation\compressed\output'

# Ensure the output directory exists.
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# -----------------------------
# Utility: get a valid override context with an active object, window, area, and region.
# -----------------------------
def get_override_context():
    # Try to find a VIEW_3D area with a WINDOW region.
    for window in bpy.context.window_manager.windows:
        screen = window.screen
        for area in screen.areas:
            if area.type == 'VIEW_3D':
                for region in area.regions:
                    if region.type == 'WINDOW':
                        # Use the first object in the scene as active.
                        active_obj = bpy.context.scene.objects[0] if bpy.context.scene.objects else None
                        override = {
                            'window': window,
                            'screen': screen,
                            'area': area,
                            'region': region,
                            'active_object': active_obj,
                        }
                        return override
    return None

# -----------------------------
# Process each GLB file in the input directory.
# -----------------------------
for filename in os.listdir(input_dir):
    if filename.lower().endswith('.glb'):
        input_filepath = os.path.join(input_dir, filename)
        output_filepath = os.path.join(output_dir, filename)
        
        print(f"\nProcessing file: {input_filepath}")
        
        # Reset the scene.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        
        # Import the GLB file.
        bpy.ops.import_scene.gltf(filepath=input_filepath)
        print("Import finished.")
        
        # Ensure there's at least one object in the scene.
        if not bpy.context.scene.objects:
            print(f"No objects found in scene for {filename}, skipping.")
            continue
        
        # Set the first object as active.
        bpy.context.view_layer.objects.active = bpy.context.scene.objects[0]
        
        # Obtain an override context.
        override = get_override_context()
        if override is None:
            # If not found, use a basic copy of the current context.
            override = bpy.context.copy()
            override['active_object'] = bpy.context.scene.objects[0]
            print("No VIEW_3D context override found, using default context copy.")
        else:
            print("Override context found.")
        
        # Use the recommended temporary override (Blender 3.6+).
        try:
            with bpy.context.temp_override(**override):
                bpy.ops.export_scene.gltf(
                    filepath=output_filepath,
                    export_format='GLB',
                    export_animations=False,      # Exclude animations
                    export_skins=False,           # Exclude skinning data
                    export_morph=False,           # Exclude shape keys / morph targets
                    export_draco_mesh_compression_enable=True,
                    export_draco_mesh_compression_level=6
                )
            print(f"Exported processed file to: {output_filepath}")
        except Exception as e:
            print(f"Error exporting file {filename}: {e}")

print("\nAll files have been processed.")
