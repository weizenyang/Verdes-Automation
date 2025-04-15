# blend_functions.py
import numpy as np
from PIL import Image, ImageChops

def blend_normal(base, overlay):
    """
    Blends two RGBA images using standard alpha composite ("normal" mode).
    Both images must be in RGBA mode and of the same size.
    """
    return Image.alpha_composite(base, overlay)

def blend_screen(base, overlay):
    """
    Blends two RGBA images using the screen blend mode.
    
    Both images are converted to numpy arrays scaled to [0,1]. Their RGB channels are
    premultiplied by the alpha channel, and then the screen blend formula is applied:
    
        screen_rgb = 1 - (1 - base_rgb) * (1 - overlay_rgb)
    
    Then the result is interpolated with the overlay's alpha and the composite alpha is 
    computed using the source-over rule. Finally, the blended result is unpremultiplied.
    """
    # Convert images to float arrays (range [0,1])
    base_arr = np.array(base).astype(np.float32) / 255.0
    overlay_arr = np.array(overlay).astype(np.float32) / 255.0

    # Extract alpha channels (shape: H x W x 1)
    base_alpha = base_arr[..., 3:4]
    overlay_alpha = overlay_arr[..., 3:4]

    # Premultiply the RGB channels.
    base_rgb = base_arr[..., :3] * base_alpha
    overlay_rgb = overlay_arr[..., :3] * overlay_alpha

    # Compute the screen blend in premultiplied space.
    screen_rgb = 1.0 - (1.0 - base_rgb) * (1.0 - overlay_rgb)
    # Interpolate using the overlay's alpha.
    blended_rgb = base_rgb + (screen_rgb - base_rgb) * overlay_alpha

    # Compute the composite alpha using the source-over formula.
    blended_alpha = overlay_alpha + base_alpha * (1.0 - overlay_alpha)

    # Unpremultiply: divide the RGB by the composite alpha (where nonzero).
    with np.errstate(divide="ignore", invalid="ignore"):
        out_rgb = np.where(blended_alpha == 0, 0, blended_rgb / blended_alpha)

    # Reassemble the RGBA image.
    final_arr = np.concatenate([out_rgb, blended_alpha], axis=-1)
    final_arr = (np.clip(final_arr, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(final_arr, mode="RGBA")

def blend_multiply(base, overlay):
    """
    Blends two RGBA images using the multiply blend mode.
    
    The images are first premultiplied, then multiplied, and finally interpolated
    according to the overlay's alpha. The composite alpha is computed using source-over,
    and the result is unpremultiplied.
    """
    base_arr = np.array(base).astype(np.float32) / 255.0
    overlay_arr = np.array(overlay).astype(np.float32) / 255.0

    base_alpha = base_arr[..., 3:4]
    overlay_alpha = overlay_arr[..., 3:4]

    base_rgb = base_arr[..., :3] * base_alpha
    overlay_rgb = overlay_arr[..., :3] * overlay_alpha

    multiplied_rgb = base_rgb * overlay_rgb
    blended_rgb = base_rgb + (multiplied_rgb - base_rgb) * overlay_alpha

    blended_alpha = overlay_alpha + base_alpha * (1.0 - overlay_alpha)

    with np.errstate(divide="ignore", invalid="ignore"):
        out_rgb = np.where(blended_alpha == 0, 0, blended_rgb / blended_alpha)

    final_arr = np.concatenate([out_rgb, blended_alpha], axis=-1)
    final_arr = (np.clip(final_arr, 0, 1) * 255).astype(np.uint8)
    return Image.fromarray(final_arr, mode="RGBA")

if __name__ == "__main__":
    # Example usage if run as a standalone script.
    base = Image.open("base.png").convert("RGBA")
    overlay = Image.open("overlay.png").convert("RGBA")
    if base.size != overlay.size:
        overlay = overlay.resize(base.size, Image.LANCZOS)
    result_normal = blend_normal(base, overlay)
    result_screen = blend_screen(base, overlay)
    result_multiply = blend_multiply(base, overlay)
    result_normal.show(title="Normal Blend")
    result_screen.show(title="Screen Blend")
    result_multiply.show(title="Multiply Blend")
