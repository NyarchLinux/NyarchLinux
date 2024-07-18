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
'use strict';

import Clutter from 'gi://Clutter';
import Meta from 'gi://Meta';
import GObject from 'gi://GObject';

export class ResizeEffect extends Clutter.DeformEffect {
    static {
        GObject.registerClass(this);
    }    

    _init(params = {}) {
        super._init();
        this.operationType = params.op;
        this.settingsData = params.settingsData;

        this.CLUTTER_TIMELINE_END_RESIZE_EFFECT_DURATION = 1000;

        this.paintEvent = null;
        this.moveEvent = null;
        this.newFrameEvent = null;
        this.completedEvent = null;
        
        this.i = 0;
        this.j = 0;
        this.k = 0;
        this.xPickedUp = 0;
        this.yPickedUp = 0;
        this.xNew = 0;
        this.yNew = 0;
        this.xOld = 0;
        this.yOld = 0;
        this.xDelta = 0;
        this.yDelta = 0;
        this.msecOld = 0;
        
        this.xDeltaStop = 0;
        this.yDeltaStop = 0;
        this.xDeltaStopMoving = 0;
        this.yDeltaStopMoving = 0;
        this.timerId = null;

        //Init stettings
        this.END_EFFECT_MULTIPLIER = this.settingsData.FRICTION.get() * 10 + 10;
        this.END_EFFECT_DIVIDER = 4;
        this.X_MULTIPLIER = this.settingsData.SPRING_K.get() * 2 / 10;
        this.Y_MULTIPLIER = this.settingsData.SPRING_K.get() * 2 / 10;
        this.CORNER_RESIZING_DIVIDER = 6;
    
        this.X_TILES = 20;
        this.Y_TILES = 20;

        this.set_n_tiles(this.X_TILES, this.Y_TILES);

        this.initialized = false;
    }

    vfunc_set_actor(actor) {
        super.vfunc_set_actor(actor);

        if (actor && !this.initialized) {
            this.initialized = true;

            [this.xNew, this.yNew] = global.get_pointer();

            let [xWin, yWin] = actor.get_position();

            [this.xOld, this.yOld] = [this.xNew, this.yNew];
            [this.xPickedUp, this.yPickedUp] = [this.xNew - xWin, this.yNew - yWin];
            
            this.moveEvent = actor.connect('notify::allocation', this.on_move_event.bind(this));
        }
    }

    vfunc_modify_paint_volume(pv) {
        return false;
    }

    destroy() {
        if (this.timerId) {
            this.timerId.stop();
            if (this.completedEvent) {
                this.timerId.disconnect(this.completedEvent);
                this.completedEvent = null;
            }
            if (this.newFrameEvent) {
                this.timerId.disconnect(this.newFrameEvent);
                this.newFrameEvent = null;
            }
            this.timerId = null;
        }

        let actor = this.get_actor();
        if (actor) {            
            if (this.paintEvent) {
                actor.disconnect(this.paintEvent);
                this.paintEvent = null;
            }

            if (this.moveEvent) {
                actor.disconnect(this.moveEvent);
                this.moveEvent = null;
            }

            actor.remove_effect(this);
        }
    }

    on_end_event(actor) {
        [this.xDeltaStop, this.yDeltaStop] = [this.xDelta * 1.5, this.yDelta * 1.5];
        [this.xDeltaStopMoving, this.yDeltaStopMoving] = [0, 0];
        
        this.timerId = new Clutter.Timeline({actor: actor, duration: this.CLUTTER_TIMELINE_END_RESIZE_EFFECT_DURATION});
        this.newFrameEvent = this.timerId.connect('new-frame', this.on_stop_effect_event.bind(this));
        this.completedEvent = this.timerId.connect('completed', this.destroy.bind(this));
        this.timerId.start();      
    }   

    on_stop_effect_event(timer, msec) {
        this.i = timer.get_progress() * this.END_EFFECT_MULTIPLIER;    
        this.xDelta = Math.trunc(this.xDeltaStop * Math.sin(this.i) / Math.exp(this.i / this.END_EFFECT_DIVIDER, 2));
        this.yDelta = Math.trunc(this.yDeltaStop * Math.sin(this.i) / Math.exp(this.i / this.END_EFFECT_DIVIDER, 2));

        this.invalidate();
    }

    on_move_event(actor, allocation, flags) {
        [this.xNew, this.yNew] = global.get_pointer();

        this.xDelta += (this.xOld - this.xNew) * this.X_MULTIPLIER;
        this.yDelta += (this.yOld - this.yNew) * this.Y_MULTIPLIER;

        [this.xOld, this.yOld] = [this.xNew, this.yNew];
    }

    vfunc_deform_vertex(w, h, v) {
        switch (this.operationType) {
            case Meta.GrabOp.RESIZING_W:
                v.x += this.xDelta * (w - v.x) * Math.pow(v.y - this.yPickedUp, 2) / (Math.pow(h, 2) * w);
                break;

            case Meta.GrabOp.RESIZING_E:
                v.x += this.xDelta * v.x * Math.pow(v.y - this.yPickedUp, 2) / (Math.pow(h, 2) * w);
                break;

            case Meta.GrabOp.RESIZING_S:
                v.y += this.yDelta * v.y * Math.pow(v.x - this.xPickedUp, 2) / (Math.pow(w, 2) * h);
                break;

            case Meta.GrabOp.RESIZING_N:
                v.y += this.yDelta * (h - v.y) * Math.pow(v.x - this.xPickedUp, 2) / (Math.pow(w, 2) * h);
                break;      

            case Meta.GrabOp.RESIZING_NW:
                v.x += this.xDelta / this.CORNER_RESIZING_DIVIDER * (w - v.x) * Math.pow(v.y, 2) / (Math.pow(h, 2) * w);
                v.y +=  this.yDelta / this.CORNER_RESIZING_DIVIDER * (h - v.y) * Math.pow(v.x, 2) / (Math.pow(w, 2) * h);  
                break;
                
            case Meta.GrabOp.RESIZING_NE:
                v.x += this.xDelta / this.CORNER_RESIZING_DIVIDER * v.x * Math.pow(v.y, 2) / (Math.pow(h, 2) * w);
                v.y += this.yDelta / this.CORNER_RESIZING_DIVIDER * (h - v.y) * Math.pow(w - v.x, 2) / (Math.pow(w, 2) * h);    
                break;

            case Meta.GrabOp.RESIZING_SE:
                v.x += this.xDelta / this.CORNER_RESIZING_DIVIDER * v.x * Math.pow(h - v.y, 2) / (Math.pow(h, 2) * w);
                v.y += this.yDelta / this.CORNER_RESIZING_DIVIDER * v.y * Math.pow(w - v.x, 2) / (Math.pow(w, 2) * h);    
                break;

            case Meta.GrabOp.RESIZING_SW:
                v.x += this.xDelta / this.CORNER_RESIZING_DIVIDER * (w - v.x) * Math.pow(v.y - h, 2) / (Math.pow(h, 2) * w);
                v.y += this.yDelta / this.CORNER_RESIZING_DIVIDER * v.y * Math.pow(v.x, 2) / (Math.pow(w, 2) * h);
                break;          
        }
    }
}