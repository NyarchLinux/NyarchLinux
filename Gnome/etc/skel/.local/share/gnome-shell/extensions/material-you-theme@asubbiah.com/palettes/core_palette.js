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

import {Hct} from "../hct/hct.js";
import {TonalPalette} from "../palettes/tonal_palette.js";
const errorColor = new TonalPalette(25, 84);

/**
 * An intermediate concept between the key color for a UI theme, and a full
 * color scheme. 5 sets of tones are generated, all except one use the same hue
 * as the key color, and all vary in chroma.
 */
export var CorePalette = class CorePalette {
    constructor(argb) {
        const hct = Hct.fromInt(argb);
        const hue = hct.hue;
        this.a1 = new TonalPalette(hue, Math.max(48, hct.chroma));
        this.a2 = new TonalPalette(hue, 16);
        this.a3 = new TonalPalette(hue + 60, 24);
        this.n1 = new TonalPalette(hue, 4);
        this.n2 = new TonalPalette(hue, 8);
        this.error = errorColor;
    }
}
//# sourceMappingURL=core_palette.js.map