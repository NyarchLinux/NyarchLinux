/*
 * Copyright © 2005 Novell, Inc.
 * Copyright © 2022 Mauro Pepe
 *
 * Permission to use, copy, modify, distribute, and sell this software
 * and its documentation for any purpose is hereby granted without
 * fee, provided that the above copyright notice appear in all copies
 * and that both that copyright notice and this permission notice
 * appear in supporting documentation, and that the name of
 * Novell, Inc. not be used in advertising or publicity pertaining to
 * distribution of the software without specific, written prior permission.
 * Novell, Inc. makes no representations about the suitability of this
 * software for any purpose. It is provided "as is" without express or
 * implied warranty.
 *
 * NOVELL, INC. DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE,
 * INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS, IN
 * NO EVENT SHALL NOVELL, INC. BE LIABLE FOR ANY SPECIAL, INDIRECT OR
 * CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
 * OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT,
 * NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION
 * WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * Author: David Reveman <davidr@novell.com>
 *         Scott Moreau <oreaus@gmail.com>
 *         Mauro Pepe <https://github.com/hermes83/compiz-windows-effect>
 *
 * Spring model implemented by Kristian Hogsberg.
 */
'use strict';

export class WobblyModel {
    constructor(config) {
        this.GRID_WIDTH = 4;
        this.GRID_HEIGHT = 4;
        this.INTENSITY = 0.8;

        this.objects = new Array(this.GRID_WIDTH * this.GRID_HEIGHT);
        this.springs = new Array(this.GRID_WIDTH * this.GRID_HEIGHT);
        this.movement = false;
        this.immobileObject = null;
    
        this.width = config.sizeX;
        this.height = config.sizeY;
        this.friction = config.friction;
        this.springK = config.springK * 0.5;
        this.mass = 100 - config.mass;
        
        this.initObjects();
        this.initSprings();
    }

    dispose() {
        this.objects = null;
        this.springs = null;
    }

    initObjects() {
        let i = 0, gridY, gridX, gw = this.GRID_WIDTH - 1, gh = this.GRID_HEIGHT - 1;
    
        for (gridY = 0; gridY < this.GRID_HEIGHT; gridY++) {
            for (gridX = 0; gridX < this.GRID_WIDTH; gridX++) {
                this.objects[i++] = { forceX: 0, forceY: 0, x: gridX * this.width / gw, y: gridY * this.height / gh, velocityX: 0, velocityY: 0, immobile: false };
            }
        }
    }

    initSprings() {
        let i = 0, numSprings = 0, gridY, gridX, hpad = this.width / (this.GRID_WIDTH - 1), vpad = this.height / (this.GRID_HEIGHT - 1);
    
        for (gridY = 0; gridY < this.GRID_HEIGHT; gridY++) {
            for (gridX = 0; gridX < this.GRID_WIDTH; gridX++) {
                if (gridX > 0) {
                    this.springs[numSprings++] = { a: this.objects[i - 1], b: this.objects[i], offsetX: hpad, offsetY: 0 };
                }
    
                if (gridY > 0) {
                    this.springs[numSprings++] = { a: this.objects[i - this.GRID_WIDTH], b: this.objects[i], offsetX: 0, offsetY: vpad };
                }
    
                i++;
            }
        }
    }

    nearestObject(x, y) {
        let distance, minDistance = -1, result = null;

        for (let i = this.objects.length - 1, object; i >= 0, object = this.objects[i]; --i) {
            distance = (object.x - x < 0 ? x - object.x : object.x - x) + (object.y - y < 0 ? y - object.y : object.y - y);
    
            if (minDistance === -1 || distance < minDistance) {
                minDistance = distance;
                result = object;
            }
        }

        return result;
    }

    grab(x, y) {
        this.immobileObject = this.nearestObject(x, y);
        this.immobileObject.immobile = true;
    }

    maximize() {
        this.immobileObject = null;

        let topLeft = this.nearestObject(0, 0), topRight = this.nearestObject(this.width, 0), bottomLeft = this.nearestObject(0, this.height), bottomRight = this.nearestObject(this.width, this.height);
        topLeft.immobile = true;
        topRight.immobile = true;
        bottomLeft.immobile = true;
        bottomRight.immobile = true;

        this.friction *= 2;
        if (this.friction > 10) {
            this.friction = 10;
        }

        for (let i = this.springs.length - 1, spring; i >= 0, spring = this.springs[i]; --i) {
            if (spring.a === topLeft) {
                spring.b.velocityX -= spring.offsetX * this.INTENSITY;
                spring.b.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.b === topLeft) {
                spring.a.velocityX -= spring.offsetX * this.INTENSITY;
                spring.a.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.a === topRight) {
                spring.b.velocityX -= spring.offsetX * this.INTENSITY;
                spring.b.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.b === topRight) {
                spring.a.velocityX -= spring.offsetX * this.INTENSITY;
                spring.a.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.a === bottomLeft) {
                spring.b.velocityX -= spring.offsetX * this.INTENSITY;
                spring.b.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.b === bottomLeft) {
                spring.a.velocityX -= spring.offsetX * this.INTENSITY;
                spring.a.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.a === bottomRight) {
                spring.b.velocityX -= spring.offsetX * this.INTENSITY;
                spring.b.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.b === bottomRight) {
                spring.a.velocityX -= spring.offsetX * this.INTENSITY;
                spring.a.velocityY -= spring.offsetY * this.INTENSITY;
            }
        }

        this.step(0);
    }

    unmaximize() {
        this.immobileObject = this.nearestObject(this.width / 2, this.height / 2);
        this.immobileObject.immobile = true;

        this.friction *= 2;
        if (this.friction > 10) {
            this.friction = 10;
        }

        for (let i = this.springs.length - 1, spring; i >= 0, spring = this.springs[i]; --i) {
            if (spring.a === this.immobileObject) {
                spring.b.velocityX -= spring.offsetX * this.INTENSITY;
                spring.b.velocityY -= spring.offsetY * this.INTENSITY;
            } else if (spring.b === this.immobileObject) {
                spring.a.velocityX -= spring.offsetX * this.INTENSITY;
                spring.a.velocityY -= spring.offsetY * this.INTENSITY;
            }
        }
        
        this.step(0);
    }

    step(steps) {
        let i, j, spring, object, springForce, movementStep = false;

        for (j = steps; j >= 0; --j) {
            for (i = this.springs.length - 1; i >= 0, spring = this.springs[i]; --i) {
                springForce = this.springK * (spring.b.x - spring.a.x - spring.offsetX);
                spring.a.forceX += springForce;
                spring.b.forceX -= springForce;

                springForce = this.springK * (spring.b.y - spring.a.y - spring.offsetY);
                spring.a.forceY += springForce;
                spring.b.forceY -= springForce;
            }

            for (i = this.objects.length - 1; i >= 0, object = this.objects[i]; --i) {
                if (!object.immobile) {
                    object.forceX -= this.friction * object.velocityX;
                    object.forceY -= this.friction * object.velocityY;
                    object.velocityX += object.forceX / this.mass;
                    object.velocityY += object.forceY / this.mass;
                    object.x += object.velocityX; 
                    object.y += object.velocityY;

                    movementStep |= object.forceX > 1 || object.forceX < -1 || object.forceY > 1 || object.forceY < -1;

                    object.forceX = 0;
                    object.forceY = 0;
                }
            }
        }

        this.movement = movementStep;
    }
    
    move(deltaX, deltaY) {
        this.immobileObject.x += deltaX;
        this.immobileObject.y += deltaY;
    }
}
