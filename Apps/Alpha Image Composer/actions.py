# actions.py
from PIL import Image
import blend_functions

def apply_opacity(image, opacity=1.0):
    """
    Applies an opacity factor to the image.
    """
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    r, g, b, a = image.split()
    # Multiply alpha channel by the opacity value.
    a = a.point(lambda p: int(p * opacity))
    image.putalpha(a)
    return image

# Register actions in a dictionary.
# Blend functions require a base image (passed during processing), so their signature is different.
ACTIONS = {
    "apply_opacity": apply_opacity,
    "blend_normal": blend_functions.blend_normal,
    "blend_screen": blend_functions.blend_screen,
    "blend_multiply": blend_functions.blend_multiply
}

def process_layer(layer_config, base_image=None):
    """
    Processes a layer image based on a configuration dictionary.
    The layer configuration should be a dictionary like:
    
        {
           "source": "path/to/layer_image.png",
           "actions": [
               {"name": "apply_opacity", "params": {"opacity": 0.8}},
               {"name": "blend_screen", "params": {}}
           ]
        }
    
    For blend actions (those whose name starts with "blend") the base_image is passed to the action function.
    """
    image = Image.open(layer_config["source"]).convert("RGBA")
    for act in layer_config.get("actions", []):
        action_name = act["name"]
        params = act.get("params", {})
        func = ACTIONS.get(action_name)
        if func is None:
            raise ValueError(f"Action '{action_name}' not registered.")
        # If the action is a blend action and a base image is provided, then call it with both images.
        if action_name.startswith("blend") and base_image is not None:
            image = func(base_image, image, **params)
        else:
            image = func(image, **params)
    return image
