from PIL import Image

def apply_opacity(image, opacity=1.0):
    """Apply opacity to an RGBA image."""
    if image.mode != 'RGBA':
        image = image.convert('RGBA')
    r, g, b, a = image.split()
    a = a.point(lambda p: int(p * opacity))
    image.putalpha(a)
    return image
