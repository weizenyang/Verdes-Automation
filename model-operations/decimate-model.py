import bpy
import os
import math

# -----------------------------
# Configuration: adjust these paths
# -----------------------------
input_dir = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/model-operations/output'    # Directory containing GLB files
output_dir = '/Users/weizenyang/Documents/GitHub/Verdes-Automation/model-operations/decimated'    # Directory to save processed GLB files
max_polys = 10000000  # Maximum polygon count used for scaling decimation intensity
min_keep = 0.05       # Minimum ratio to keep (i.e. never simplify below 5% of original vertices)

# Ensure the output directory exists.
if not os.path.exists(output_dir):
    os.makedirs(output_dir)

# -----------------------------
# Utility: Compute decimation ratio based on polygon count.
# Uses a logarithmic scale so that:
#  - For low-poly meshes (near 0 polys) the ratio is ~1 (little simplification)
#  - For meshes with ~max_polys, the ratio approaches min_keep
# -----------------------------
def compute_decimation_ratio(poly_count, min_keep, max_polys):
    if poly_count <= 0:
        return 1.0
    ratio = 1 - math.log(poly_count + 1) / math.log(max_polys + 1)
    target_ratio = min_keep + (1 - min_keep) * ratio
    return target_ratio

# -----------------------------
# Process each GLB file in the input directory.
# -----------------------------
for filename in os.listdir(input_dir):
    if filename.lower().endswith('.glb'):
        input_filepath = os.path.join(input_dir, filename)
        output_filepath = os.path.join(output_dir, filename)
        
        print(f"\nProcessing file: {input_filepath}")
        
        # Clear the current scene.
        bpy.ops.wm.read_factory_settings(use_empty=True)
        
        # Import the GLB file.
        print(f"Importing GLB from {input_filepath}")
        bpy.ops.import_scene.gltf(filepath=input_filepath)
        
        # Get the imported scene.
        scene = bpy.context.scene
        
        # Process each mesh object in the scene.
        decimated_meshes = 0
        for obj in scene.objects:
            if obj.type == 'MESH':
                poly_count = len(obj.data.polygons)
                print(f"Object '{obj.name}' has {poly_count} polygons.")
                
                # Compute decimation ratio for this mesh.
                decimation_ratio = compute_decimation_ratio(poly_count, min_keep, max_polys)
                print(f"  Applying decimation modifier with ratio: {decimation_ratio:.4f}")
                
                # Add a decimation modifier.
                decimate_mod = obj.modifiers.new(name='Decimate', type='DECIMATE')
                decimate_mod.ratio = decimation_ratio
                
                # Set the object as active and apply the modifier.
                bpy.context.view_layer.objects.active = obj
                try:
                    bpy.ops.object.modifier_apply(modifier=decimate_mod.name)
                    decimated_meshes += 1
                except Exception as e:
                    print(f"  Error applying decimation for {obj.name}: {e}")
        
        print(f"Decimation applied to {decimated_meshes} mesh(es).")
        
        # Export the modified scene as a new GLB file.
        # Export options:
        #  - export_animations: False (no animations)
        #  - export_skins: False (no skinning)
        #  - export_morph: False (no shape keys / morph targets)
        #  - export_draco_mesh_compression_enable: True (enable Draco compression)
        print(f"Exporting decimated GLB to {output_filepath}")
        bpy.ops.export_scene.gltf(
            filepath=output_filepath,
            export_format='GLB',
            export_animations=False,
            export_skins=False,
            export_morph=False,
            export_draco_mesh_compression_enable=True,
            export_draco_mesh_compression_level=6  # Adjust compression level if needed
        )
        print("Export completed!")
