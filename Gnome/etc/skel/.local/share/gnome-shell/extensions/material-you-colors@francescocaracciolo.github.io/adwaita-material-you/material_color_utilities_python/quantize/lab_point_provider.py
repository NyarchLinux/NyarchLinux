from ..utils.color_utils import *

# /**
#  * Provides conversions needed for K-Means quantization. Converting input to
#  * points, and converting the final state of the K-Means algorithm to colors.
#  */
class LabPointProvider:
    # /**
    #  * Convert a color represented in ARGB to a 3-element array of L*a*b*
    #  * coordinates of the color.
    #  */
    def fromInt(self, argb):
        return labFromArgb(argb)

    # /**
    #  * Convert a 3-element array to a color represented in ARGB.
    #  */
    def toInt(self, point):
        return argbFromLab(point[0], point[1], point[2])

    # /**
    #  * Standard CIE 1976 delta E formula also takes the square root, unneeded
    #  * here. This method is used by quantization algorithms to compare distance,
    #  * and the relative ordering is the same, with or without a square root.
    #  *
    #  * This relatively minor optimization is helpful because this method is
    #  * called at least once for each pixel in an image.
    #  */
    # Renamed "from" to "from_v", from is reserved in Python
    def distance(self, from_v, to):
        dL = from_v[0] - to[0]
        dA = from_v[1] - to[1]
        dB = from_v[2] - to[2]
        return dL * dL + dA * dA + dB * dB
