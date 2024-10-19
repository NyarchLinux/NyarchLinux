from typing import Tuple


class ClosestFolderColorDomain:
    """Class to find the best papirus folder accent for your theme"""

    @staticmethod
    def hex_to_rgb(hex_color):
        hex_color = hex_color.lstrip("#")
        return tuple(int(hex_color[i : i + 2], 16) for i in (0, 2, 4))

    @staticmethod
    def get_color_distance(color1: Tuple[int, int, int], color2: Tuple[int, int, int]):
        r1, g1, b1 = color1
        r2, g2, b2 = color2
        return ((r1 - r2) ** 2) + ((g1 - g2) ** 2) + ((b1 - b2) ** 2)

    @classmethod
    def get_closest_color(cls, hex_color: str):
        """Get the closest papirus folder accent color for a given hex color"""

        color_mapping = {
            "adwaita": "#93C0EA",
            "black": "#4F4F4F",
            "blue": "#5294E2",
            "bluegrey": "#5294E2",
            "brown": "#AE8E6C",
            "cyan": "#AE8E6C",
            "green": "#87B158",
            "grey": "#8E8E8E",
            "orange": "#EE923A",
            "pink": "#EE923A",
            "magenta": "#CA71DF",
            "indigo": "#5C6BC0",
            "nordic": "#82ABAA",
            "palebrown": "#D1BFAE",
            "red": "#E25252",
            "teal": "#16A085",
            "white": "#E4E4E4",
            "violet": "#EE82EE",
            "yellow": "#F9BD30",
        }

        target_color = cls.hex_to_rgb(hex_color)
        closest_color = None
        min_distance = float("inf")

        for color_name, color_hex in color_mapping.items():
            color_rgb = cls.hex_to_rgb(color_hex)
            distance = cls.get_color_distance(target_color, color_rgb)
            if distance < min_distance:
                min_distance = distance
                closest_color = color_name

        return closest_color or "grey"
