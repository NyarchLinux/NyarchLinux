from transformers import ColorTransformer

from ..blend.blend import *
from ..palettes.core_palette import *
from ..scheme.scheme import *
from .image_utils import *
from .string_utils import *


# /**
#  * Generate custom color group from source and target color
#  *
#  * @param source Source color
#  * @param color Custom color
#  * @return Custom color group
#  *
#  * @link https://m3.material.io/styles/color/the-color-system/color-roles
#  */
# NOTE: Changes made to output format to be Dictionary
def customColor(source, color):
    value = color["value"]
    from_v = value
    to = source
    if color["blend"]:
        value = Blend.harmonize(from_v, to)
    palette = CorePalette.of(value)
    tones = palette.a1
    return {
        "color": color,
        "value": value,
        "light": {
            "color": tones.tone(40),
            "onColor": tones.tone(100),
            "colorContainer": tones.tone(90),
            "onColorContainer": tones.tone(10),
        },
        "dark": {
            "color": tones.tone(80),
            "onColor": tones.tone(20),
            "colorContainer": tones.tone(30),
            "onColorContainer": tones.tone(90),
        },
    }


# /**
#  * Generate a theme from a source color
#  *
#  * @param source Source color
#  * @param customColors Array of custom colors
#  * @return Theme object
#  */
# NOTE: Changes made to output format to be Dictionary
def themeFromSourceColor(source: int, customColors=[]):
    palette = CorePalette.of(source)
    return {
        "source": source,
        "schemes": {
            "light": Scheme.light(source),
            "dark": Scheme.dark(source),
        },
        "palettes": {
            "primary": palette.a1,
            "secondary": palette.a2,
            "tertiary": palette.a3,
            "neutral": palette.n1,
            "neutralVariant": palette.n2,
            "error": palette.error,
        },
        "customColors": [customColor(source, c) for c in customColors],
    }


# /**
#  * Generate a theme from an image source
#  *
#  * @param image Image element
#  * @param customColors Array of custom colors
#  * @return Theme object
#  */
def themeFromImage(image, customColors=[]):
    colors = topColorsFromImage(image)
    return themeFromSourceColor(colors[0], customColors), [
        ColorTransformer.argb_to_hex(color) for color in colors
    ]


# Not really applicable to python CLI
# # /**
# #  * Apply a theme to an element
# #  *
# #  * @param theme Theme object
# #  * @param options Options
# #  */
# export function applyTheme(theme, options) {
#     var _a;
#     const target = (options === null || options === void 0 ? void 0 : options.target) || document.body;
#     const isDark = (_a = options === null || options === void 0 ? void 0 : options.dark) !== null && _a !== void 0 ? _a : false;
#     const scheme = isDark ? theme.schemes.dark : theme.schemes.light;
#     for (const [key, value] of Object.entries(scheme.toJSON())) {
#         const token = key.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
#         const color = hexFromArgb(value);
#         target.style.setProperty(`--md-sys-color-${token}`, color);
#     }
# }
# //# sourceMappingURL=theme_utils.js.map
