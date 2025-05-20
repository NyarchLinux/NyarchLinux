/* DING: Desktop Icons New Generation for GNOME Shell
 *
 * Copyright (C) 2024 Sergio Costas (rastersoft@gmail.com)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, version 3 of the License.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */

'use strict';

var SignalManager = class {
    constructor() {
        this._signal_list = [];
    }

    connectSignal(obj, signal_name, cb, {destroyCb, after}={destroyCb:null, after: false}) {
        if (after)
            var signal_id = obj.connect_after(signal_name, cb);
        else
            var signal_id = obj.connect(signal_name, cb);
        let handler = {
            signal_id,
            obj,
            destroyCb
        }
        this._signal_list.push(handler);
        return handler;
    }

    disconnectAllSignals() {
        this._signal_list.forEach((item) => {
            item.obj.disconnect(item.signal_id);
            if (item.destroyCb)
                item.destroyCb();
        });
        this._signal_list = [];
    }

    disconnectSignal(handler) {
        const idx = this._signal_list.indexOf(handler);
        if (idx == -1)
            return;
        delete this._signal_list[idx];
        handler.obj.disconnect(handler.signal_id);
        if (handler.destroyCb)
            handler.destroyCb();
    }
}
