from color_utils import ColorUtils
from material_color_utilities_python import *
import json, os
import map_colors
import argparse
from materialyoucolor.scheme import Scheme

MU_BACKEND = True
def main():
    parser = argparse.ArgumentParser()
    print(os.getcwd())
    parser.add_argument("scheme", help="Color scheme, light or dark", type=str)

    # Optional arguments
    parser.add_argument("-c", "--color", help="Hex code of the color to base the theme on", type=str)
    parser.add_argument("-w", "--wallpaper", help="Path of the wallpaper to base the theme on", type=str)
    parser.add_argument("-o", "--output", help="Choose the output file")
    parser.add_argument("-a", "--apply", action="store_true", help="Apply the theme after it is generated")
    parser.add_argument("-m", "--mappings", help="Color mappings file")
    parser.add_argument("-V", "--variant", help="Variant of the theme, with predefined color_mappings can be defualt, vibrant, expressive, fruit salad, muted")

    args = parser.parse_args()
    scheme = parser.parse_args()
    if args.color:
        color = args.color
        argb = argbFromHex(color) 
    elif args.wallpaper:
        img = Image.open(args.wallpaper)
        argb = sourceColorFromImage(img)
    else:
        print("Error: at least one argument between color and wallpaper must be specified")
        exit(-1)
    
    if MU_BACKEND:
        sch = Scheme.dark(argb).__dict__["props"]
        generated = {}
        for key, color in sch.items():
            generated[key] = ColorUtils.argb_from_argb_arr(color[0], color[1], color[2], color[3])
        theme = generated
    else:
        theme = themeFromSourceColor(argb)
    scheme = args.scheme
    variant = args.variant if args.variant else "default"

    cmfile = os.path.expanduser(args.mappings) if args.mappings else os.path.join(os.path.dirname(os.path.abspath(__file__)), "color_mappings.json")
    bpfile = os.path.join(os.path.dirname(os.path.abspath(__file__)), "base_presets.json")
    
    # Handle erorrs
    if args.scheme not in ["dark", "light"]:
        print("Color scheme must be dark or light")
        exit(-1)
    
    f = open(bpfile, "r")
    base_presets = json.loads(f.read())
    f.close()
    try:
        f = open(cmfile, "r")
        color_mappings = json.loads(f.read())
        f.close()
    except Exception as e:
        print("Cannot open color mappings file")
        exit(-1)
    

    # Generate theme
    base_preset = map_colors.map_colors(color_mappings[variant][scheme], base_presets[scheme], theme["schemes"][scheme].props)
    # Generate css
    css = ""
    for key in base_preset["variables"]:
        css +=  "@define-color " + key + " " + base_preset["variables"][key] + ";\n"
    for prefix_key in base_preset["palette"]:
        for key_2 in base_preset["palette"][prefix_key]:
            css += "@define-color " + prefix_key + key_2 + " " + base_preset["palette"][prefix_key][key_2] + ";\n"

    if args.output:
        f = open(os.path.expanduser(args.output), "w+")
        f.write(css)
        f.close()
        print("Theme saved to file")
    if args.apply:
        f = open(os.path.expanduser("~/.config/gtk-4.0/gtk.css"), "w+")
        f.write(css)
        f.close()
        f = open(os.path.expanduser("~/.config/gtk-3.0/gtk.css"), "w+")
        f.write(css)
        f.close()
        print("Theme applied")

if __name__ == "__main__":
    main()
