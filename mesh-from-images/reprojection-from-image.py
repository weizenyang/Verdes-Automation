import argparse
import os
import cv2
import numpy as np
import torch

def get_depth_map(image_path):
    """
    Load an equirectangular image and compute a depth map using MiDaS.
    The resulting depth map is normalized between 0 and 1 and then inverted.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"Could not read image: {image_path}")
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    
    model = torch.hub.load("intel-isl/MiDaS", "MiDaS_small")
    model.eval()
    
    transform = torch.hub.load("intel-isl/MiDaS", "transforms").small_transform
    input_batch = transform(img)
    
    with torch.no_grad():
        prediction = model(input_batch)
        prediction = torch.nn.functional.interpolate(
            prediction.unsqueeze(1),
            size=img.shape[:2],
            mode="bicubic",
            align_corners=False,
        ).squeeze()
    
    depth_map = prediction.cpu().numpy()
    # Normalize the depth map to [0, 1]
    depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())
    # Invert the depth map so that near becomes far and far becomes near
    depth_map = 1.0 - depth_map
    return depth_map

def sample_depth(depth_map, u, v):
    """
    Bilinearly interpolate the depth map at continuous coordinates (u, v) in [0,1].
    """
    H, W = depth_map.shape
    x = u * (W - 1)
    y = v * (H - 1)
    x0 = int(np.floor(x))
    y0 = int(np.floor(y))
    x1 = min(x0 + 1, W - 1)
    y1 = min(y0 + 1, H - 1)
    dx = x - x0
    dy = y - y0
    d00 = depth_map[y0, x0]
    d10 = depth_map[y0, x1]
    d01 = depth_map[y1, x0]
    d11 = depth_map[y1, x1]
    depth_val = (d00 * (1 - dx) * (1 - dy) +
                 d10 * dx * (1 - dy) +
                 d01 * (1 - dx) * dy +
                 d11 * dx * dy)
    return depth_val

def generate_projected_mesh(depth_map, lat_steps, lon_steps, scale, pole_factor=1.0):
    """
    Create a mesh by reprojecting each pixel of an equirectangular image into 3D space.
    
    Each vertex is computed from:
      - u, v: normalized pixel coordinates (u in [0,1], v in [0,1])
      - φ = 2π * u
      - θ = π * v
      - The (inverted) depth value (sampled using bilinear interpolation) is used to compute a radial distance:
           r = depth_value * scale * scaling
        where scaling = 1 + pole_factor * (1 - sin(θ))
      - (x, y, z) = (r * sin(θ) * cos(φ), r * sin(θ) * sin(φ), r * cos(θ))
    
    UV coordinates are set so that the inverted depth map image can be used as a texture.
    """
    vertices = []
    uvs = []
    grid = []
    for i in range(lat_steps + 1):
        row = []
        # v is the vertical normalized coordinate; v=0 is top (θ=0), v=1 is bottom (θ=π)
        v_coord = i / lat_steps
        theta = np.pi * v_coord
        for j in range(lon_steps):
            u_coord = j / lon_steps
            phi = 2 * np.pi * u_coord

            # Flip v (i.e., use 1 - v_coord) to match typical equirectangular orientation.
            d = sample_depth(depth_map, u_coord, 1 - v_coord)
            # Compute scaling based on the polar angle.
            scaling = 1 + pole_factor * (1 - np.sin(theta))
            # Use the inverted depth value as the radial distance (scaled)
            r = d * scale * scaling

            # Spherical-to-Cartesian conversion.
            x = r * np.sin(theta) * np.cos(phi)
            y = r * np.sin(theta) * np.sin(phi)
            z = r * np.cos(theta)
            vertex = (x, y, z)
            index = len(vertices)
            vertices.append(vertex)
            # Save UV coordinates (flip v so that the texture maps correctly)
            uvs.append((u_coord, 1 - v_coord))
            row.append(index)
        grid.append(row)

    faces = []
    for i in range(lat_steps):
        for j in range(lon_steps):
            j_next = (j + 1) % lon_steps
            v00 = grid[i][j]
            v01 = grid[i][j_next]
            v10 = grid[i+1][j]
            v11 = grid[i+1][j_next]
            faces.append((v00, v01, v10))
            faces.append((v01, v11, v10))
    
    return vertices, uvs, faces

def save_obj(obj_filename, vertices, uvs, faces, mtl_filename=None):
    """
    Save the mesh as an OBJ file with texture coordinates.
    If an mtl_filename is provided, reference it in the OBJ file.
    """
    with open(obj_filename, 'w') as f:
        if mtl_filename:
            f.write(f"mtllib {os.path.basename(mtl_filename)}\n")
            f.write("usemtl material_0\n")
        for v in vertices:
            f.write("v {:.6f} {:.6f} {:.6f}\n".format(v[0], v[1], v[2]))
        for uv in uvs:
            f.write("vt {:.6f} {:.6f}\n".format(uv[0], uv[1]))
        for face in faces:
            # OBJ file indices are 1-indexed.
            f.write("f {0}/{0} {1}/{1} {2}/{2}\n".format(face[0]+1, face[1]+1, face[2]+1))

def save_mtl(mtl_filename, texture_filename):
    """
    Save an MTL file that references the texture image.
    """
    with open(mtl_filename, 'w') as f:
        f.write("newmtl material_0\n")
        f.write("Ka 1.000 1.000 1.000\n")
        f.write("Kd 1.000 1.000 1.000\n")
        f.write("Ks 0.000 0.000 0.000\n")
        f.write("d 1.0\n")
        f.write("illum 2\n")
        f.write(f"map_Kd {os.path.basename(texture_filename)}\n")

def main():
    parser = argparse.ArgumentParser(
        description="Generate a 3D mesh by projecting an equirectangular image using its depth map. "
                    "The depth map is obtained from MiDaS, normalized, inverted, and then each pixel is reprojected "
                    "into 3D space using spherical coordinates. A pole factor scales the radial distance near the poles. "
                    "The resulting model uses the inverted depth map as its texture."
    )
    parser.add_argument("image", type=str, help="Path to the equirectangular image file (used to generate depth)")
    parser.add_argument("--output", type=str, default="projected_mesh.obj", help="Output OBJ filename")
    parser.add_argument("--lat_steps", type=int, default=200, help="Number of latitude steps (vertical resolution)")
    parser.add_argument("--lon_steps", type=int, default=400, help="Number of longitude steps (horizontal resolution)")
    parser.add_argument("--scale", type=float, default=10.0, help="Scale factor to convert normalized depth to 3D distance")
    parser.add_argument("--pole_factor", type=float, default=1.0, help="Additional scaling factor for displacement at the poles")
    parser.add_argument("--depth_output", type=str, default=None, help="Optional filename to save the inverted depth map image (e.g., depth_map.png). This image will be used as the texture.")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        raise FileNotFoundError(f"Image file not found: {args.image}")

    print("Generating depth map from image...")
    depth_map = get_depth_map(args.image)
    depth_img = (depth_map * 255).astype(np.uint8)
    
    if not args.depth_output:
        args.depth_output = "depth_map.png"
        print(f"No depth_output specified. Using default: {args.depth_output}")
    
    print(f"Saving inverted depth map to {args.depth_output}...")
    cv2.imwrite(args.depth_output, depth_img)

    print("Generating projected mesh from inverted depth map with pole factor...")
    vertices, uvs, faces = generate_projected_mesh(depth_map, args.lat_steps, args.lon_steps, args.scale, args.pole_factor)

    obj_base, _ = os.path.splitext(args.output)
    mtl_filename = obj_base + ".mtl"

    print(f"Saving MTL file to {mtl_filename} (texture: {args.depth_output})...")
    save_mtl(mtl_filename, args.depth_output)

    print(f"Saving OBJ file to {args.output}...")
    save_obj(args.output, vertices, uvs, faces, mtl_filename)
    print("Mesh generation complete.")

if __name__ == '__main__':
    main()
