import argparse
import os
import cv2
import numpy as np
import torch

def get_depth_map(image_path):
    """
    Load an equirectangular image and compute a depth map using MiDaS.
    The resulting depth map is normalized between 0 and 1.
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
    depth_map = (depth_map - depth_map.min()) / (depth_map.max() - depth_map.min())
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

def generate_sphere_mesh(radius, lat_steps, lon_steps, depth_map, displacement_strength, hole_threshold=0.8, pole_factor=1.0):
    """
    Create a UV sphere mesh whose vertices are displaced based on a depth map.
    For vertices where the depth value is small (below the hole_threshold),
    the displacement is subtracted (inward), creating a hole effect.
    For vertices with depth values equal to or above the threshold, the displacement is added.
    
    A scaling factor based on the polar angle is applied to enhance displacement near the poles.
    Returns vertices, UV coordinates, and faces.
    UVs are computed from spherical coordinates:
      u = phi / (2*pi)
      v = theta / pi (flipped vertically to match typical texture orientation)
    """
    vertices = []
    uvs = []
    grid = []
    H, W = depth_map.shape

    for i in range(lat_steps + 1):
        row = []
        theta = np.pi * i / lat_steps  # theta in [0, pi]
        for j in range(lon_steps):
            phi = 2 * np.pi * j / lon_steps  # phi in [0, 2pi]

            # Standard spherical coordinates on unit sphere.
            x = np.sin(theta) * np.cos(phi)
            y = np.sin(theta) * np.sin(phi)
            z = np.cos(theta)
            
            # Compute UV coordinates.
            u = phi / (2 * np.pi)
            v = theta / np.pi
            uv = (u, 1 - v)
            
            # Use bilinear interpolation for an accurate depth sample.
            d = sample_depth(depth_map, u, v)
            
            # Compute scaling based on the polar angle.
            scaling = 1 + pole_factor * (1 - np.sin(theta))
            
            # Invert displacement for small depth values:
            if d < hole_threshold:
                displaced_radius = radius - d * displacement_strength * scaling
            else:
                displaced_radius = radius + d * displacement_strength * scaling

            vertex = (displaced_radius * x,
                      displaced_radius * y,
                      displaced_radius * z)
            index = len(vertices)
            vertices.append(vertex)
            uvs.append(uv)
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
            f.write("f {0}/{0} {1}/{1} {2}/{2}\n".format(face[0] + 1, face[1] + 1, face[2] + 1))

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
        description="Generate a depth map from an equirectangular image, displace a sphere's vertices based on the depth map, and apply the image as a texture. For vertices with small depth values (below the threshold), the displacement is subtracted. Depth values are sampled using bilinear interpolation for improved accuracy."
    )
    parser.add_argument("image", type=str, help="Path to the equirectangular image file")
    parser.add_argument("--output", type=str, default="displaced_sphere.obj", help="Output OBJ filename")
    parser.add_argument("--radius", type=float, default=1.0, help="Base radius of the sphere")
    parser.add_argument("--lat_steps", type=int, default=100, help="Number of latitude steps")
    parser.add_argument("--lon_steps", type=int, default=200, help="Number of longitude steps")
    parser.add_argument("--strength", type=float, default=0.2, help="Displacement strength factor")
    parser.add_argument("--hole_threshold", type=float, default=0.8, help="Depth threshold (0 to 1) below which displacement is subtracted")
    parser.add_argument("--pole_factor", type=float, default=1.0, help="Additional scaling factor for displacement at the poles (ceiling/floor)")
    parser.add_argument("--depth_output", type=str, default=None, help="Optional filename to save the depth map image (e.g., depth_map.png)")
    args = parser.parse_args()

    if not os.path.exists(args.image):
        raise FileNotFoundError(f"Image file not found: {args.image}")

    print("Generating depth map from image...")
    depth_map = get_depth_map(args.image)

    if args.depth_output:
        print(f"Saving depth map to {args.depth_output}...")
        depth_img = (depth_map * 255).astype(np.uint8)
        cv2.imwrite(args.depth_output, depth_img)

    print("Generating sphere mesh with improved depth detection...")
    vertices, uvs, faces = generate_sphere_mesh(
        args.radius, args.lat_steps, args.lon_steps,
        depth_map, args.strength, args.hole_threshold, args.pole_factor
    )

    # Apply a 180° rotation about the X-axis using an explicit rotation matrix.
    R = np.array([[1, 0, 0],
                  [0, -1, 0],
                  [0, 0, -1]])
    vertices = [tuple(R @ np.array(v)) for v in vertices]

    obj_base, _ = os.path.splitext(args.output)
    mtl_filename = obj_base + ".mtl"

    print(f"Saving MTL file to {mtl_filename}...")
    save_mtl(mtl_filename, args.image)

    print(f"Saving OBJ file to {args.output}...")
    save_obj(args.output, vertices, uvs, faces, mtl_filename)
    print("Mesh generation complete.")

if __name__ == '__main__':
    main()
