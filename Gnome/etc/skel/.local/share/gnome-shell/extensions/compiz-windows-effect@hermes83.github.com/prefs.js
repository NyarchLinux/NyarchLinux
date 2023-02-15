/*
 * Compiz-windows-effect for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 *
 * This file is part of the gnome-shell extension Compiz-windows-effect.
 *
 * gnome-shell extension Compiz-windows-effect is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension Compiz-windows-effect is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension Compiz-windows-effect.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
const Gtk = imports.gi.Gtk;
const Extension = imports.misc.extensionUtils.getCurrentExtension();
const Settings = Extension.imports.settings;
const Config = imports.misc.config;

const IS_3_XX_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("3");

let frictionSlider = null;
let springKSlider = null;
let speedupFactor = null;
let massSlider = null;
let xTilesSlider = null;
let yTilesSlider = null;
let maximizeEffectSwitch = null;
let resizeEffectSwitch = null;

function init() { }

function buildPrefsWidget() {
    let config = new Settings.Prefs();

    let frame;
    if (IS_3_XX_SHELL_VERSION) {
        frame = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            border_width: 20,
            spacing: 20
        });
    } else {
        frame = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 20,
            margin_bottom: 20,
            margin_start: 20,
            margin_end: 20,
            spacing: 20
        });
    }

    frictionSlider = addSlider(frame, "Friction", config.FRICTION, 1.0, 10.0, 1);
    springKSlider = addSlider(frame, "Spring", config.SPRING_K, 1.0, 10.0, 1);
    speedupFactor = addSlider(frame, "Speedup Factor", config.SPEEDUP_FACTOR, 2.0, 40.0, 1);
    massSlider = addSlider(frame, "Mass", config.MASS, 20.0, 80.0, 0);
    xTilesSlider = addSlider(frame, "X Tiles", config.X_TILES, 3.0, 20.0, 0);
    yTilesSlider = addSlider(frame, "Y Tiles", config.Y_TILES, 3.0, 20.0, 0);
    maximizeEffectSwitch = addBooleanSwitch(frame, "Maximize effect", config.MAXIMIZE_EFFECT);
    resizeEffectSwitch = addBooleanSwitch(frame, "Resize effect", config.RESIZE_EFFECT);

    addDefaultButton(frame, config);

    if (IS_3_XX_SHELL_VERSION) {
        frame.show_all();
    }

    return frame;
}

function addDefaultButton(frame, config) {
    let button = null;
    if (IS_3_XX_SHELL_VERSION) {
        button = new Gtk.Button({label: "Reset to default"});
    } else {
        button = new Gtk.Button({label: "Reset to default", vexpand: true, valign: Gtk.Align.END});
    }

    button.connect('clicked', function () {
        config.FRICTION.set(3.5);
        config.SPRING_K.set(8.5);
        config.SPEEDUP_FACTOR.set(16.0);
        config.MASS.set(50.0);
        config.X_TILES.set(6.0);
        config.Y_TILES.set(6.0);
        config.MAXIMIZE_EFFECT.set(true);
        config.RESIZE_EFFECT.set(false);

        frictionSlider.set_value(config.FRICTION.get());
        springKSlider.set_value(config.SPRING_K.get());
        speedupFactor.set_value(config.SPEEDUP_FACTOR.get());
        massSlider.set_value(config.MASS.get());
        xTilesSlider.set_value(config.X_TILES.get());
        yTilesSlider.set_value(config.Y_TILES.get());
        maximizeEffectSwitch.set_active(config.MAXIMIZE_EFFECT.get());
        resizeEffectSwitch.set_active(config.RESIZE_EFFECT.get());
    });

    if (IS_3_XX_SHELL_VERSION) {
        frame.pack_end(button, false, false, 0);
    } else {
        frame.append(button);
    }
    
    return button;
}

function addSlider(frame, labelText, prefConfig, lower, upper, decimalDigits) {
    let scale = new Gtk.Scale({
        digits: decimalDigits,
        adjustment: new Gtk.Adjustment({lower: lower, upper: upper}),
        value_pos: Gtk.PositionType.RIGHT,
        hexpand: true, 
        halign: Gtk.Align.END
    });
    if (!IS_3_XX_SHELL_VERSION) {
        scale.set_draw_value(true);
    }
    scale.set_value(prefConfig.get());
    scale.connect('value-changed', function (sw) {
        var newval = sw.get_value();
        if (newval != prefConfig.get()) {
            prefConfig.set(newval);
        }
    });
    scale.set_size_request(400, 15);

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 20});
    if (IS_3_XX_SHELL_VERSION) {
        hbox.add(new Gtk.Label({label: labelText, use_markup: true}));
        hbox.add(scale);
        
        frame.add(hbox);
    } else {
        hbox.append(new Gtk.Label({label: labelText, use_markup: true}));
        hbox.append(scale);
        
        frame.append(hbox);
    }
    
    return scale;
}

function addBooleanSwitch(frame, labelText, prefConfig) {
    let gtkSwitch = new Gtk.Switch({hexpand: true, halign: Gtk.Align.END});
    gtkSwitch.set_active(prefConfig.get());
    gtkSwitch.connect('state-set', function (sw) {
        var newval = sw.get_active();
        if (newval != prefConfig.get()) {
            prefConfig.set(newval);
        }
    });

    let hbox = new Gtk.Box({orientation: Gtk.Orientation.HORIZONTAL, spacing: 20});
    if (IS_3_XX_SHELL_VERSION) {
        hbox.add(new Gtk.Label({label: labelText, use_markup: true}));
        hbox.add(gtkSwitch);
        
        frame.add(hbox);
    } else {
        hbox.append(new Gtk.Label({label: labelText, use_markup: true}));
        hbox.append(gtkSwitch);
        
        frame.append(hbox);
    }
    
    return gtkSwitch;
}