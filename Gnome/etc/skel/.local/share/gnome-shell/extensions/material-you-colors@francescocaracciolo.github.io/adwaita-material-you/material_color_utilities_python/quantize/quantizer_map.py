from ..utils.color_utils import *
from collections import OrderedDict

# /**
#  * Quantizes an image into a map, with keys of ARGB colors, and values of the
#  * number of times that color appears in the image.
#  */
# // libmonet is designed to have a consistent API across platforms
# // and modular components that can be moved around easily. Using a class as a
# // namespace facilitates this.
# //
# // tslint:disable-next-line:class-as-namespace
class QuantizerMap:
    # /**
    #  * @param pixels Colors in ARGB format.
    #  * @return A Map with keys of ARGB colors, and values of the number of times
    #  *     the color appears in the image.
    #  */
    @staticmethod
    def quantize(pixels):
        countByColor = OrderedDict()
        for i in range(len(pixels)):
            pixel = pixels[i]
            alpha = alphaFromArgb(pixel)
            if (alpha < 255):
                continue
            countByColor[pixel] = (countByColor[pixel] if pixel in countByColor.keys() else 0) + 1
        return countByColor
