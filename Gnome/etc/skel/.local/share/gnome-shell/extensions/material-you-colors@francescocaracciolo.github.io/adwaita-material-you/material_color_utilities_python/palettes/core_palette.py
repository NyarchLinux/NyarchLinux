from ..hct.hct import *
from ..palettes.tonal_palette import *


# /**
#  * An intermediate concept between the key color for a UI theme, and a full
#  * color scheme. 5 sets of tones are generated, all except one use the same hue
#  * as the key color, and all vary in chroma.
#  */
class CorePalette:
    def __init__(self, argb: int):
        hct = Hct.fromInt(argb)
        hue = hct.hue
        self.a1 = TonalPalette.fromHueAndChroma(hue, max(32, hct.chroma))
        self.a2 = TonalPalette.fromHueAndChroma(hue, 16)
        self.a3 = TonalPalette.fromHueAndChroma(hue + 60, 24)
        self.n1 = TonalPalette.fromHueAndChroma(hue, 4)
        self.n2 = TonalPalette.fromHueAndChroma(hue, 8)
        self.error = TonalPalette.fromHueAndChroma(25, 84)

    # /**
    #  * @param argb ARGB representation of a color
    #  */
    @staticmethod
    def of(argb: int):
        return CorePalette(argb)
