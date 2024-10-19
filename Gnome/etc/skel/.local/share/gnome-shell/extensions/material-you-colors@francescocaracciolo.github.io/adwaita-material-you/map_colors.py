from transformers import ColorTransformer
from color_utils import ColorUtils

def map_colors(color_mapping, base_preset, scheme):
    for key in color_mapping:
        if not isinstance(color_mapping[key], list):
            if color_mapping[key]["opacity"] == 1:
                base_preset["variables"][key] = ColorTransformer.argb_to_hex(scheme[color_mapping[key]["color"]])
            else:
                argb = scheme[color_mapping[key]["color"]]
                r = str(ColorUtils.red_from_argb(argb))
                g = str(ColorUtils.green_from_argb(argb))
                b = str(ColorUtils.blue_from_argb(argb))
                rgba_str = "rgba(" + r + ", " + g + ", " + b + ", " + str(color_mapping[key]["opacity"]) + ")"
                base_preset["variables"][key] = rgba_str
        elif len(color_mapping[key])> 0:
            total_color = scheme[color_mapping[key][0]["color"]]
            for color in color_mapping[key]:
                argb = scheme[color["color"]]
                r = ColorUtils.red_from_argb(argb)
                g = ColorUtils.green_from_argb(argb)
                b = ColorUtils.blue_from_argb(argb)
                a = color["opacity"]
                added_color = ColorTransformer.rgba_to_argb(r,g,b,a)
                total_color = ColorUtils.blend_argb(total_color, added_color)
            base_preset["variables"][key] = ColorTransformer.argb_to_hex(total_color)
    return base_preset