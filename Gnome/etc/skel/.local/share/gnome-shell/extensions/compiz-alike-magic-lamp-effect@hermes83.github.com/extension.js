
/*
 * Compiz-alike-magic-lamp-effect for GNOME Shell
 *
 * Copyright (C) 2020
 *     Mauro Pepe <https://github.com/hermes83/compiz-alike-magic-lamp-effect>
 *
 * This file is part of the gnome-shell extension Compiz-alike-magic-lamp-effect.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is free software: you can
 * redistribute it and/or modify it under the terms of the GNU
 * General Public License as published by the Free Software
 * Foundation, either version 3 of the License, or (at your option)
 * any later version.
 *
 * gnome-shell extension Compiz-alike-magic-lamp-effect is distributed in the hope that it
 * will be useful, but WITHOUT ANY WARRANTY; without even the
 * implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR
 * PURPOSE.  See the GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with gnome-shell extension Compiz-alike-magic-lamp-effect.  If not, see
 * <http://www.gnu.org/licenses/>.
 */
'use strict';

const { GObject, Clutter, Meta, St } = imports.gi;
const ExtensionUtils = imports.misc.extensionUtils;
const Extension = ExtensionUtils.getCurrentExtension();
const Main = imports.ui.main;
const Settings = Extension.imports.settings;
const Config = imports.misc.config;

const IS_4_XX_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("4");
const IS_3_XX_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("3");
const IS_3_38_SHELL_VERSION = Config.PACKAGE_VERSION.startsWith("3.38");

let extension;

function init() {}

function enable() {
    extension = new CompizMagicLampEffectExtension();
    if (extension) {
        extension.enable();
    }
}   

function disable() {
    if (extension) {
        extension.disable();
        extension = null;
    }
}

class CompizMagicLampEffectExtension {
    constructor() {
        this.MINIMIZE_EFFECT_NAME = 'minimize-magic-lamp-effect';
        this.UNMINIMIZE_EFFECT_NAME = 'unminimize-magic-lamp-effect';

        this.prefs = new Settings.Prefs();

        this.minimizeId = null;
        this.unminimizeId = null;
        this.destroyId = null;
    }

    enable() {
        // https://github.com/GNOME/gnome-shell/blob/master/js/ui/windowManager.js

        Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = Main.wm._shouldAnimateActor;
        Main.wm._shouldAnimateActor = function(actor, types) {
            let stack = new Error().stack;
            if (stack && (stack.indexOf("_minimizeWindow") !== -1 || stack.indexOf("_unminimizeWindow") !== -1)) {
                return false;
            }
            
            return Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor(actor, types);
        };

        Main.wm._shellwm.original_completed_minimize = Main.wm._shellwm.completed_minimize;
        Main.wm._shellwm.completed_minimize = function(actor) {
            return;
        };

        Main.wm._shellwm.original_completed_unminimize = Main.wm._shellwm.completed_unminimize;
        Main.wm._shellwm.completed_unminimize = function(actor) {
            return;
        };

        this.minimizeId = global.window_manager.connect("minimize", (e, actor) => {
            if (Main.overview.visible) {
                Main.wm._shellwm.original_completed_minimize(actor);
                return;
            }

            let icon = this.getIcon(actor);

            this.destroyActorEffect(actor);

            actor.add_effect_with_name(this.MINIMIZE_EFFECT_NAME, new MagicLampMinimizeEffect({icon: icon}));
        });

        this.unminimizeId = global.window_manager.connect("unminimize", (e, actor) => {
            actor.show();

            if (Main.overview.visible) {
                Main.wm._shellwm.original_completed_unminimize(actor);
                return;
            }

            let icon = this.getIcon(actor);

            this.destroyActorEffect(actor);

            actor.add_effect_with_name(this.UNMINIMIZE_EFFECT_NAME, new MagicLampUnminimizeEffect({icon: icon}));
        });
    }

    disable() {
        if (this.prefs) {
            this.prefs = null;
        }
        if (this.minimizeId) {
            global.window_manager.disconnect(this.minimizeId);
        }
        if (this.minimizeId) {
            global.window_manager.disconnect(this.unminimizeId);
        }
    
        global.get_window_actors().forEach((actor) => {
            this.destroyActorEffect(actor);
        });
        
        if (Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor) {
            Main.wm._shouldAnimateActor = Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor;
            Main.wm.original_minimizeMaximizeWindow_shouldAnimateActor = null;
        }
        if (Main.wm._shellwm.original_completed_minimize) {
            Main.wm._shellwm.completed_minimize = Main.wm._shellwm.original_completed_minimize;
            Main.wm._shellwm.original_completed_minimize = null;
        }
        if (Main.wm._shellwm.original_completed_unminimize) {
            Main.wm._shellwm.completed_unminimize = Main.wm._shellwm.original_completed_unminimize;    
            Main.wm._shellwm.original_completed_unminimize = null;
        }
    }

    getIcon(actor) {
        let [success, icon] = actor.meta_window.get_icon_geometry();
        if (success) {
            return icon;
        } 
    
        let monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];
        if (monitor && Main.overview.dash) {
            Main.overview.dash._redisplay();  

            let dashIcon = null;
            let transformed_position = null;
            let pids = null;
            let pid = actor.get_meta_window() ? actor.get_meta_window().get_pid() : null;
            if (pid) {
                Main.overview.dash._box.get_children()
                    .filter(dashElement => dashElement.child && dashElement.child._delegate && dashElement.child._delegate.app)
                    .forEach(dashElement => {
                        pids = dashElement.child._delegate.app.get_pids();
                        if (pids && pids.indexOf(pid) >= 0) {
                            transformed_position = dashElement.get_transformed_position();
                            if (transformed_position && transformed_position[0]) {
                                dashIcon = {x: transformed_position[0], y: monitor.y + monitor.height, width: 0, height: 0};
                                return;
                            }
                        }
                    });
            }
            if (dashIcon) {
                return dashIcon;
            }

            return {x: monitor.x + monitor.width / 2, y: monitor.y + monitor.height, width: 0, height: 0};
        }

        return {x: 0, y: 0, width: 0, height: 0};    
    }

    destroyActorEffect(actor) {
        if (!actor) {
            return;
        }

        let minimizeEffect = actor.get_effect(this.MINIMIZE_EFFECT_NAME);
        if (minimizeEffect) {
            minimizeEffect.destroy();
        }

        let unminimizeEffect = actor.get_effect(this.UNMINIMIZE_EFFECT_NAME);
        if (unminimizeEffect) {
            unminimizeEffect.destroy();
        }
    }
}

const AbstractCommonMagicLampEffect = GObject.registerClass({},
    class AbstractCommonMagicLampEffect extends Clutter.DeformEffect {

        _init(params = {}) {
            super._init();

            this.EPSILON = 40;

            this.isMinimizeEffect = false;
            this.newFrameEvent = null;
            this.completedEvent = null;
            
            this.timerId = null;
            this.msecs = 0;

            this.monitor = {x: 0, y: 0, width: 0, height: 0};
            this.iconMonitor = {x: 0, y: 0, width: 0, height: 0};
            this.window = {x: 0, y: 0, width: 0, height: 0, scale: 1};
            this.icon = params.icon;
            
            this.progress = 0;
            this.split = 0.3;
            this.k = 0;
            this.j = 0;
            this.expandWidth = 0;
            this.fullWidth = 0;
            this.expandHeight = 0;
            this.fullHeight = 0;
            this.width = 0;
            this.height = 0;
            this.x = 0;
            this.y = 0;
            this.offsetX = 0;
            this.offsetY = 0;
            this.effectX = 0;
            this.effectY = 0;
            this.iconPosition = null;

            this.toTheBorder = true;   // true
            this.maxIconSize = null;    // 48
            this.alignIcon = 'center';  // 'left-top'

            let prefs = (new Settings.Prefs());
            this.EFFECT = prefs.EFFECT.get(); //'default' - 'sine'
            this.DURATION = prefs.DURATION.get();
            this.X_TILES = prefs.X_TILES.get();
            this.Y_TILES = prefs.Y_TILES.get();

            this.initialized = false;
        }

        destroy_actor(actor) {}

        on_tick_elapsed(timer, msecs) {}

        vfunc_set_actor(actor) {
            super.vfunc_set_actor(actor);

            if (!this.actor || this.initialized) {
                return;
            }

            this.initialized = true;
            
            this.monitor = Main.layoutManager.monitors[actor.meta_window.get_monitor()];

            [this.window.x, this.window.y] = [this.actor.get_x() - this.monitor.x, this.actor.get_y() - this.monitor.y];
            [this.window.width, this.window.height] = actor.get_size();
            
            if (!this.icon || (this.icon.x == 0 && this.icon.y == 0 && this.icon.width == 0 && this.icon.height == 0)) {
                this.icon.x = this.monitor.x + this.monitor.width / 2;
                this.icon.y = this.monitor.height + this.monitor.y;
            }

            Main.layoutManager.monitors.forEach((monitor, monitorIndex)  => {
                let scale = 1;
                if (global.display && global.display.get_monitor_scale) {
                    scale = global.display.get_monitor_scale(monitorIndex);
                }

                if (this.icon.x >= monitor.x && this.icon.x <= monitor.x + monitor.width * scale && this.icon.y >= monitor.y && this.icon.y <= monitor.y + monitor.height * scale)  {
                    this.iconMonitor = monitor;
                }
            });
            if (this.iconMonitor.x == 0 && this.iconMonitor.y == 0 && this.iconMonitor.width == 0 && this.iconMonitor.height == 0) {
                this.iconMonitor = this.monitor;
                this.icon.x = this.monitor.x + this.monitor.width / 2;
                this.icon.y = this.monitor.height + this.monitor.y;
            }

            [this.icon.x, this.icon.y, this.icon.width, this.icon.height] = [this.icon.x - this.monitor.x, this.icon.y - this.monitor.y, this.icon.width, this.icon.height];

            if (this.icon.y + this.icon.height >= this.monitor.height - this.EPSILON) {
                this.iconPosition = St.Side.BOTTOM;
                if (this.toTheBorder) {
                    this.icon.y = this.iconMonitor.y + this.iconMonitor.height - this.monitor.y
                    this.icon.height = 0;
                }
            } else if (this.icon.x <= this.EPSILON) {
                this.iconPosition = St.Side.LEFT;
                if (this.toTheBorder) {
                    this.icon.x = this.iconMonitor.x - this.monitor.x;
                    this.icon.width = 0;
                }
            } else if (this.icon.x + this.icon.width >= this.monitor.width - this.EPSILON) {
                this.iconPosition = St.Side.RIGHT;
                if (this.toTheBorder) {
                    this.icon.x = this.iconMonitor.x + this.iconMonitor.width - this.monitor.x;
                    this.icon.width = 0;
                }
            } else {
                this.iconPosition = St.Side.TOP;
                if (this.toTheBorder) {
                    this.icon.y = this.iconMonitor.y - this.monitor.y;
                    this.icon.height = 0;
                }
            }

            this.set_n_tiles(this.X_TILES, this.Y_TILES);
            
            if (IS_4_XX_SHELL_VERSION || IS_3_38_SHELL_VERSION) {
                this.timerId = new Clutter.Timeline({ actor: this.actor, duration: this.DURATION + (this.monitor.width * this.monitor.height) / (this.window.width * this.window.height) });
            } else {
                this.timerId = new Clutter.Timeline({ duration: this.DURATION + (this.monitor.width * this.monitor.height) / (this.window.width * this.window.height) });
            }

            if (IS_3_XX_SHELL_VERSION) {
                this.paintEvent = this.actor.connect('paint', () => {});
            }
            this.newFrameEvent = this.timerId.connect('new-frame', this.on_tick_elapsed.bind(this));
            this.completedEvent = this.timerId.connect('completed', this.destroy.bind(this));
            this.timerId.start();
        }

        destroy() {
            if (this.timerId) {
                if (this.newFrameEvent) {
                    this.timerId.disconnect(this.newFrameEvent);
                    this.newFrameEvent = null;
                }
                if (this.completedEvent) {
                    this.timerId.disconnect(this.completedEvent);
                    this.completedEvent = null;
                }
                this.timerId.run_dispose();
                this.timerId = null;
            }

            let actor = this.get_actor();
            if (actor) {
                if (this.paintEvent) {
                    actor.disconnect(this.paintEvent);
                    this.paintEvent = null;
                }
                actor.remove_effect(this);

                this.destroy_actor(actor);
            }
        }

        vfunc_deform_vertex(w, h, v) {
            if (this.initialized) {
                let propX = w / this.window.width;
                let propY = h / this.window.height;

                if (this.iconPosition == St.Side.LEFT) {
                    this.width = this.window.width - this.icon.width + this.window.x * this.k;

                    this.x = (this.width - this.j * this.width) * v.tx;  
                    this.y = v.ty * this.window.height * (this.x + (this.width - this.x) * (1 - this.k)) / this.width + 
                            v.ty * this.icon.height * (this.width - this.x) / this.width;

                    this.offsetX = this.icon.width - this.window.x * this.k;
                    this.offsetY = (this.icon.y - this.window.y) * ((this.width - this.x) / this.width) * this.k;

                    if (this.EFFECT === 'sine') {
                        this.effectY = Math.sin(this.x / this.width * Math.PI * 4) * this.window.height / 14 * this.k;
                    } else {
                        this.effectY = Math.sin((0.5 - (this.width - this.x) / this.width) * 2 * Math.PI) * (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty)) / 7 * this.k;
                    }
                } else if (this.iconPosition == St.Side.TOP) {
                    this.height = this.window.height - this.icon.height + this.window.y * this.k;

                    this.y = (this.height - this.j * this.height) * v.ty;
                    this.x = v.tx * this.window.width * (this.y + (this.height - this.y) * (1 - this.k)) / this.height + 
                            v.tx * this.icon.width * (this.height - this.y) / this.height;

                    this.offsetX = (this.icon.x - this.window.x) * ((this.height - this.y) / this.height) * this.k;
                    this.offsetY = this.icon.height - this.window.y * this.k;

                    if (this.EFFECT === 'sine') {
                        this.effectX = Math.sin(this.y / this.height * Math.PI * 4) * this.window.width / 14 * this.k;
                    } else {
                        this.effectX = Math.sin((0.5 - (this.height - this.y) / this.height) * 2 * Math.PI) * (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx)) / 7 * this.k;
                    }
                } else if (this.iconPosition == St.Side.RIGHT) {
                    this.expandWidth = (this.iconMonitor.width - this.icon.width - this.window.x - this.window.width);
                    this.fullWidth = (this.iconMonitor.width - this.icon.width - this.window.x) - this.expandWidth * (1 - this.k);
                    this.width = this.fullWidth - this.j * this.fullWidth;

                    this.x = v.tx * this.width;
                    this.y = v.ty * (this.icon.height) +
                            v.ty * (this.window.height - this.icon.height) * (1 - this.j) * (1 - v.tx) +
                            v.ty * (this.window.height - this.icon.height) * (1 - this.k) * (v.tx);
                    
                    this.offsetY = (this.icon.y - this.window.y) * (this.x / this.fullWidth) * this.k + (this.icon.y - this.window.y) * this.j;
                    this.offsetX = this.iconMonitor.width - this.icon.width - this.window.x - this.width - this.expandWidth * (1 - this.k);
                    
                    if (this.EFFECT === 'sine') {
                        this.effectY = Math.sin((this.width - this.x) / this.fullWidth * Math.PI * 4) * this.window.height / 14 * this.k;
                    } else {
                        this.effectY = Math.sin(((this.width - this.x) / this.fullWidth) * 2 * Math.PI + Math.PI) * (this.window.y + this.window.height * v.ty - (this.icon.y + this.icon.height * v.ty)) / 7 * this.k;
                    }
                } else if (this.iconPosition == St.Side.BOTTOM) {
                    this.expandHeight = (this.iconMonitor.height - this.icon.height - this.window.y - this.window.height);
                    this.fullHeight = (this.iconMonitor.height - this.icon.height - this.window.y) - this.expandHeight * (1 - this.k);
                    this.height = this.fullHeight - this.j * this.fullHeight;
                    
                    this.y = v.ty * this.height;
                    this.x = v.tx * (this.icon.width) +
                            v.tx * (this.window.width - this.icon.width) * (1 - this.j) * (1 - v.ty) +
                            v.tx * (this.window.width - this.icon.width) * (1 - this.k) * (v.ty);

                    this.offsetX = (this.icon.x - this.window.x) * (this.y / this.fullHeight) * this.k + (this.icon.x - this.window.x) * this.j;
                    this.offsetY = this.iconMonitor.height - this.icon.height - this.window.y - this.height - this.expandHeight * (1 - this.k);

                    if (this.EFFECT === 'sine') {
                        this.effectX = Math.sin((this.height - this.y) / this.fullHeight * Math.PI * 4) * this.window.width / 14 * this.k;
                    } else {
                        this.effectX = Math.sin(((this.height - this.y) / this.fullHeight) * 2 * Math.PI + Math.PI) * (this.window.x + this.window.width * v.tx - (this.icon.x + this.icon.width * v.tx)) / 7 * this.k;
                    }
                }
                
                v.x = (this.x + this.offsetX + this.effectX) * propX;
                v.y = (this.y + this.offsetY + this.effectY) * propY;
            }    
        }
    }
);

const MagicLampMinimizeEffectBase = GObject.registerClass({},
    class MagicLampMinimizeEffectBase extends AbstractCommonMagicLampEffect {
        _init(params = {}) {
            super._init(params);

            this.k = 0;
            this.j = 0;
            this.isMinimizeEffect = true;
        
        }

        destroy_actor(actor) {
            Main.wm._shellwm.original_completed_minimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            if (Main.overview.visible) {
                this.destroy();
            }

            this.progress = timer.get_progress();
            this.k = this.progress <= this.split ? this.progress * (1 / 1 / this.split) : 1;
            this.j = this.progress > this.split ? (this.progress - this.split) * (1 / 1 / (1 - this.split)) : 0;
            this.invalidate();
        }
    }
);

const MagicLampUnminimizeEffectBase = GObject.registerClass({},
    class MagicLampUnminimizeEffectBase extends AbstractCommonMagicLampEffect {
        _init(params = {}) {
            super._init(params);

            this.k = 1;
            this.j = 1;
            this.isMinimizeEffect = false;
        }
        
        destroy_actor(actor) {
            Main.wm._shellwm.original_completed_unminimize(actor);
        }

        on_tick_elapsed(timer, msecs) {
            if (Main.overview.visible) {
                this.destroy();
            }

            this.progress = timer.get_progress();
            this.k = 1 - (this.progress > (1 - this.split) ? (this.progress - (1 - this.split)) * (1 / 1 / (1 - (1 - this.split))) : 0);
            this.j = 1 - (this.progress <= (1 - this.split) ? this.progress * (1 / 1 / (1 - this.split)) : 1);
            this.invalidate();
        }
    }
);

var MagicLampMinimizeEffect;
var MagicLampUnminimizeEffect;

if (IS_4_XX_SHELL_VERSION) { 
    MagicLampMinimizeEffect = GObject.registerClass({}, class MagicLampMinimizeEffect extends MagicLampMinimizeEffectBase {            
        vfunc_modify_paint_volume(pv) {
            return false;
        }
    });
    MagicLampUnminimizeEffect = GObject.registerClass({}, class MagicLampUnminimizeEffect extends MagicLampUnminimizeEffectBase {            
        vfunc_modify_paint_volume(pv) {
            return false;
        }
    });
} else {
    MagicLampMinimizeEffect = MagicLampMinimizeEffectBase;
    MagicLampUnminimizeEffect = MagicLampUnminimizeEffectBase;
}