/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {QuantizerCelebi} from "../quantize/quantizer_celebi.js";
import {Score} from "../score/score.js";
import * as color_utils from "./color_utils.js";
import GLib from 'gi://GLib';
import Gio from 'gi://GLib';

export function createPixelArray(pixels, quality) {
    const pixelArray = [];

    for (let i = 0, offset, r, g, b, a; i < pixels.length; i += quality) {
        offset = i * 4;
        r = pixels[offset + 0];
        g = pixels[offset + 1];
        b = pixels[offset + 2];
        a = pixels[offset + 3];

        // If pixel is mostly opaque and not white
        if (typeof a === 'undefined' || a >= 125) {
            if (!(r > 250 && g > 250 && b > 250)) {
                pixelArray.push(color_utils.argbFromRgb(r, g, b));
            }
        }
    }
    return pixelArray;
}

/**
 * Get the source color from an image.
 *
 * @param image The image element
 * @return Source color - the color most suitable for creating a UI theme
 */
export function sourceColorFromImage(image) {
    // Convert Image data to Pixel Array
    const image_pixels = image.get_pixels();
    const pixels = createPixelArray(image_pixels, 8);

    // Convert Pixels to Material Colors
    const result = QuantizerCelebi.quantize(pixels, 128);
    return Score.score(result);
}
//# sourceMappingURL=image_utils.js.map