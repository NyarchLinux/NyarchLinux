class ColorUtils:
    @staticmethod
    def red_from_argb(argb: int) -> int:
        return (argb >> 16) & 0xFF
    @staticmethod

    def green_from_argb(argb: int) -> int:
        return (argb >> 8) & 0xFF

    @staticmethod
    def blue_from_argb(argb: int) -> int:
        return argb & 0xFF

    def rgba_arr_from_argb(argb: int) -> list[int]:
        return [
            (argb >> 16) & 0xFF,  # Rosso
            (argb >> 8) & 0xFF,  # Verde
            argb & 0xFF,         # Blu
            (argb >> 24) & 0xFF,  # Alpha
        ]
    @staticmethod
    def argb_from_rgb(red: int, green: int, blue: int) -> int:
        return (0xFF << 24) | (red << 16) | (green << 8) | blue

    @staticmethod
    def blend_argb(base: int, added: int) -> int:
        base_red = (base >> 16) & 0xff
        base_green = (base >> 8) & 0xff
        base_blue = base & 0xff
        base_alpha = (base >> 24) & 0xff

        added_red = (added >> 16) & 0xff
        added_green = (added >> 8) & 0xff
        added_blue = added & 0xff
        added_alpha = (added >> 24) & 0xff

        result_alpha = added_alpha + (base_alpha * (255 - added_alpha) // 255)
        result_red = ((added_red * added_alpha) // 255) + ((base_red * base_alpha * (255 - added_alpha)) // (255 * 255))
        result_green = ((added_green * added_alpha) // 255) + ((base_green * base_alpha * (255 - added_alpha)) // (255 * 255))
        result_blue = ((added_blue * added_alpha) // 255) + ((base_blue * base_alpha * (255 - added_alpha)) // (255 * 255))

        return (result_alpha << 24) | (result_red << 16) | (result_green << 8) | result_blue