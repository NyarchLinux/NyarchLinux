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
import GObject from 'gi://GObject';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';

import { WobblyModel } from './wobbly_model.js';

export class WobblyEffect extends Clutter.DeformEffect {
    static {
        GObject.registerClass(this);
    }

    _init(params = {}) {
        super._init();
        this.operationType = params.op;
        this.settingsData = params.settingsData;

        this.CLUTTER_TIMELINE_DURATION = 1000 * 1000;

        this.paintEvent = null;
        this.moveEvent = null;
        this.newFrameEvent = null;
        this.completedEvent = null;
        this.overviewShowingEvent = null;
        
        this.timerId = null;
        this.width = 0;
        this.height = 0;
        this.deltaX = 0;
        this.deltaY = 0;
        this.mouseX = 0;
        this.mouseY = 0;
        this.msecOld = 0;

        this.actorX = 0;
        this.actorY = 0;

        this.wobblyModel = null;
        this.coeff = null;
        this.deformedObjects = null;
        this.tilesX = 0;
        this.tilesY = 0;
        
        this.FRICTION = this.settingsData.FRICTION.get();
        this.SPRING_K = this.settingsData.SPRING_K.get();            
        this.SPEEDUP_FACTOR = this.settingsData.SPEEDUP_FACTOR.get();
        this.MASS = this.settingsData.MASS.get();
        this.X_TILES = 'maximized' === this.operationType ? 10 : this.settingsData.X_TILES.get();
        this.Y_TILES = 'maximized' === this.operationType ? 10 : this.settingsData.Y_TILES.get();

        this.set_n_tiles(this.X_TILES, this.Y_TILES);
        
        this.initialized = false;
        this.ended = false;
    }

    vfunc_set_actor(actor) {
        super.vfunc_set_actor(actor);

        if (actor && !this.initialized) {
            this.initialized = true;

            [this.width, this.height] = actor.get_size();
            [this.newX, this.newY] = actor.get_position();
            [this.actorX, this.actorY] = [this.newX, this.newY];
            [this.oldX, this.oldY] = [this.newX, this.newY];
            [this.mouseX, this.mouseY] = global.get_pointer();
            [this.tilesX, this.tilesY] = [this.X_TILES + 0.1, this.Y_TILES + 0.1];

            this.coeff = new Array(this.Y_TILES + 1);
            this.deformedObjects = new Array(this.Y_TILES + 1);
        
            let x, y, tx, ty, tx1, tx2, tx3, tx4, ty1, ty2, ty3, ty4;
            for (y = this.Y_TILES; y >= 0; y--) {
                ty = y / this.Y_TILES;

                ty1 = (1 - ty) * (1 - ty) * (1 - ty);
                ty2 = ty * (1 - ty) * (1 - ty);
                ty3 = ty * ty * (1 - ty);
                ty4 = ty * ty * ty;

                this.coeff[y] = new Array(this.X_TILES + 1);
                this.deformedObjects[y] = new Array(this.X_TILES + 1);
        
                for (x = this.X_TILES; x >= 0; x--) {
                    tx = x / this.X_TILES;

                    tx1 = (1 - tx) * (1 - tx) * (1 - tx);
                    tx2 = tx * (1 - tx) * (1 - tx);
                    tx3 = tx * tx * (1 - tx);
                    tx4 = tx * tx * tx;
                    
                    this.coeff[y][x] = [
                        tx1 * ty1, 3 * tx2 * ty1, 3 * tx3 * ty1, tx4 * ty1,
                        3 * tx1 * ty2, 9 * tx2 * ty2, 9 * tx3 * ty2, 3 * tx4 * ty2,
                        3 * tx1 * ty3, 9 * tx2 * ty3, 9 * tx3 * ty3, 3 * tx4 * ty3,
                        tx1 * ty4, 3 * tx2 * ty4, 3 * tx3 * ty4, tx4 * ty4
                    ];

                    this.deformedObjects[y][x] = [tx * this.width, ty * this.height];
                }
            }

            this.wobblyModel = new WobblyModel({friction: this.FRICTION, springK: this.SPRING_K, mass: this.MASS, sizeX: this.width, sizeY: this.height});
            
            if ('unmaximized' === this.operationType) {
                this.wobblyModel.unmaximize();
                this.ended = true;
            } else if ('maximized' === this.operationType) {                    
                this.wobblyModel.maximize();
                this.ended = true;
            } else {
                this.wobblyModel.grab(this.mouseX - this.newX, this.mouseY - this.newY);
                this.moveEvent = actor.connect('notify::allocation', this.on_move_event.bind(this));
            }

            this.overviewShowingEvent = Main.overview.connect('showing', this.destroy.bind(this));

            this.timerId = new Clutter.Timeline({actor: actor, duration: this.CLUTTER_TIMELINE_DURATION});
            this.newFrameEvent = this.timerId.connect('new-frame', this.on_new_frame_event.bind(this));
            this.completedEvent = this.timerId.connect('completed', this.destroy.bind(this));
            this.timerId.start();
        }
    }

    vfunc_modify_paint_volume(pv) {
        return false;
    }

    destroy() {
        if (this.overviewShowingEvent) {
            Main.overview.disconnect(this.overviewShowingEvent);
        }

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

        if (this.wobblyModel) {
            this.wobblyModel.dispose();
            this.wobblyModel = null;
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
        this.ended = true;
    }   

    on_move_event(actor, allocation, flags) {
        this.oldX = this.newX;
        this.oldY = this.newY;
        [this.newX, this.newY] = actor.get_position();
        
        let deltaX = this.newX - this.oldX;
        let deltaY = this.newY - this.oldY;
        this.deltaX -= deltaX;
        this.deltaY -= deltaY;

        this.wobblyModel.move(deltaX, deltaY);
    }

    on_new_frame_event(timer, msec) {
        if (this.ended && (!this.timerId || !this.wobblyModel || !this.wobblyModel.movement)) {
            this.destroy();
            return;
        }

        this.wobblyModel.step((msec - this.msecOld) / this.SPEEDUP_FACTOR);
        this.msecOld = msec;

        let x, y;
        for (y = this.Y_TILES; y >= 0 ; y--) {
            for (x = this.X_TILES; x >= 0 ; x--) {
                this.deformedObjects[y][x][0] = this.coeff[y][x][0] * this.wobblyModel.objects[0].x
                    + this.coeff[y][x][1] * this.wobblyModel.objects[1].x
                    + this.coeff[y][x][2] * this.wobblyModel.objects[2].x
                    + this.coeff[y][x][3] * this.wobblyModel.objects[3].x
                    + this.coeff[y][x][4] * this.wobblyModel.objects[4].x
                    + this.coeff[y][x][5] * this.wobblyModel.objects[5].x
                    + this.coeff[y][x][6] * this.wobblyModel.objects[6].x
                    + this.coeff[y][x][7] * this.wobblyModel.objects[7].x
                    + this.coeff[y][x][8] * this.wobblyModel.objects[8].x
                    + this.coeff[y][x][9] * this.wobblyModel.objects[9].x
                    + this.coeff[y][x][10] * this.wobblyModel.objects[10].x
                    + this.coeff[y][x][11] * this.wobblyModel.objects[11].x
                    + this.coeff[y][x][12] * this.wobblyModel.objects[12].x
                    + this.coeff[y][x][13] * this.wobblyModel.objects[13].x
                    + this.coeff[y][x][14] * this.wobblyModel.objects[14].x
                    + this.coeff[y][x][15] * this.wobblyModel.objects[15].x;
                this.deformedObjects[y][x][1] = this.coeff[y][x][0] * this.wobblyModel.objects[0].y
                    + this.coeff[y][x][1] * this.wobblyModel.objects[1].y
                    + this.coeff[y][x][2] * this.wobblyModel.objects[2].y
                    + this.coeff[y][x][3] * this.wobblyModel.objects[3].y
                    + this.coeff[y][x][4] * this.wobblyModel.objects[4].y
                    + this.coeff[y][x][5] * this.wobblyModel.objects[5].y
                    + this.coeff[y][x][6] * this.wobblyModel.objects[6].y
                    + this.coeff[y][x][7] * this.wobblyModel.objects[7].y
                    + this.coeff[y][x][8] * this.wobblyModel.objects[8].y
                    + this.coeff[y][x][9] * this.wobblyModel.objects[9].y
                    + this.coeff[y][x][10] * this.wobblyModel.objects[10].y
                    + this.coeff[y][x][11] * this.wobblyModel.objects[11].y
                    + this.coeff[y][x][12] * this.wobblyModel.objects[12].y
                    + this.coeff[y][x][13] * this.wobblyModel.objects[13].y
                    + this.coeff[y][x][14] * this.wobblyModel.objects[14].y
                    + this.coeff[y][x][15] * this.wobblyModel.objects[15].y;
            }
        }

        [this.actorX, this.actorY] = this.actor.get_position();
        if ((this.newX === this.actorX && this.newY === this.actorY) || 'move' !== this.operationType) {
            this.invalidate();
        }
    }

    vfunc_deform_vertex(w, h, v) {
        [v.x, v.y] = this.deformedObjects[(v.ty * this.tilesY) >> 0][(v.tx * this.tilesX) >> 0];
        v.x += this.deltaX;
        v.y += this.deltaY;
        v.x *= w / this.width;
        v.y *= h / this.height;
    }
}