// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';

import { Drawing } from '../drawing.js';

export const DebugOverlay = GObject.registerClass(
  {},
  class D2DLDebugOverlay extends Clutter.Actor {
    _init(x, y) {
      super._init();

      this._width = x ? x : 400;
      this._height = y ? y : 400;

      this.state = {
        color: [0.8, 0.25, 0.15, 1],
        monitor: { x: 0, y: 0, width: 0, height: 0 },
      };
      this.objects = [];

      this._canvas = new Clutter.Canvas();
      this._canvas.connect('draw', this.on_draw.bind(this));
      this._canvas.invalidate();
      this._canvas.set_size(this._width, this._height);
      this.set_size(this._width, this._height);
      this.set_content(this._canvas);
      this.reactive = false;
    }

    resize(width, height) {
      if (this._width != width || this._height != height) {
        this._width = width;
        this._height = height;
        this.set_size(this._width, this._height);
        this._canvas.set_size(this._width, this._height);
        this._canvas.invalidate();
      }
    }

    redraw() {
      this._canvas.invalidate();
    }

    set_state(s) {
      this.state = s;
      this.redraw();
    }

    on_draw(canvas, ctx, width, height) {
      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      this.onDraw(ctx);

      ctx.restore();
      ctx.$dispose();
    }

    onDraw(ctx) {
      let monitor = this.state.monitor;
      this.objects.forEach((d) => {
        // log(`${d.t} ${d.x} ${d.y}`);
        switch (d.t) {
          case 'line':
            Drawing.draw_line(
              ctx,
              d.c,
              d.w || 1,
              d.x - monitor.x,
              d.y - monitor.y,
              d.x2,
              d.y2,
              true
            );
            break;
          case 'circle':
            Drawing.draw_circle(
              ctx,
              d.c,
              d.x - monitor.x,
              d.y - monitor.y,
              d.d,
              true
            );
            break;
        }
      });
    }

    destroy() {}
  }
);
