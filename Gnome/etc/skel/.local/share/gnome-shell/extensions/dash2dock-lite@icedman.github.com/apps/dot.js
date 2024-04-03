// adapted from https://github.com/jderose9/dash-to-panel
// adapted from https://github.com/micheleg/dash-to-dock

import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';
import St from 'gi://St';

import { Drawing } from '../drawing.js';

export const Dot = GObject.registerClass(
  {},
  class Dot extends St.Widget {
    _init(x, settings = {}) {
      super._init();

      let size = x || 400;

      this._canvas = new DotCanvas(settings);
      this._canvas.width = size;
      this._canvas.height = size;
      this.add_child(this._canvas);

      this.set_state = this._canvas.set_state.bind(this._canvas);
    }

    redraw() {
      this.visible = true;
      this._canvas.redraw();
    }
  }
);

const DotCanvas = GObject.registerClass(
  {},
  class DotCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init();

      this.state = {};

      this._padding = 8;
      this._barHeight = 6;
    }

    redraw() {
      this.queue_repaint();
    }

    set_state(s) {
      if (
        !this.state ||
        this.state.count != s.count ||
        this.state.color != s.color ||
        this.state.style != s.style ||
        this.state.rotate != s.rotate ||
        this.state.translate != s.translate
      ) {
        this.state = s;
        this.redraw();
      }
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();

      let size = width;

      if (!this.state || !this.state.color || !this.state.count) return;

      const dot_color = this.state.color;

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      ctx.save();

      ctx.translate(width / 2, height / 2);
      if (this.state.translate) {
        ctx.translate(
          this.state.translate[0] * width,
          this.state.translate[1]
        ) * height;
      }
      if (this.state.rotate) {
        ctx.rotate((this.state.rotate * 3.14) / 180);
      }
      ctx.translate(-width / 2, -height / 2);

      // _draw_dot...
      let func = this[`_draw_${this.state.style}`];
      if (typeof func === 'function') {
        func.bind(this)(ctx, this.state);
      }

      ctx.restore();

      ctx.$dispose();
    }

    _draw_segmented(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight;
      let width = size - this._padding * 2;
      ctx.translate(this._padding, size - height);

      let sz = width / 20;
      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = Math.ceil((width - (count - 1) * spacing) / count);
      let lineLength = width - sz * (count - 1) - spacing * (count - 1);

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_solid(ctx, state) {
      this._draw_segmented(ctx, { ...state, count: 1 });
    }

    _draw_dashes(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 2;
      let width = size - this._padding * 2;

      let sz = width / 14;
      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = Math.floor(width / 4) - spacing;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, sz);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_dash(ctx, state) {
      this._draw_dashes(ctx, { ...state, count: 1 });
    }

    _draw_squares(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 5;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let dashLength = height;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.rectangle(i * dashLength + i * spacing, 0, dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_square(ctx, state) {
      this._draw_squares(ctx, { ...state, count: 1 });
    }

    _draw_triangles(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 6;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = height + 8;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.moveTo(i * dashLength + i * spacing + dashLength / 2, 0);
        ctx.lineTo(i * dashLength + i * spacing, height);
        ctx.lineTo(i * dashLength + i * spacing + dashLength, height);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_triangle(ctx, state) {
      this._draw_triangles(ctx, { ...state, count: 1 });
    }

    _draw_diamonds(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight + 10;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 16); // separation between the dots
      let dashLength = height;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.moveTo(i * dashLength + i * spacing + dashLength / 2, 0);
        ctx.lineTo(i * dashLength + i * spacing, height / 2);
        ctx.lineTo(i * dashLength + i * spacing + dashLength / 2, height);
        ctx.lineTo(i * dashLength + i * spacing + dashLength, height / 2);
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_diamond(ctx, state) {
      this._draw_diamonds(ctx, { ...state, count: 1 });
    }

    _draw_dots(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = state.count;
      if (count > 4) count = 4;
      let height = this._barHeight;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 18); // separation between the dots
      let radius = height;

      ctx.translate(
        Math.floor(
          (size - count * radius - (count - 1) * spacing) / 2 - radius / 2
        ),
        size - height
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        ctx.arc(
          (2 * i + 1) * radius + i * radius,
          -radius,
          radius,
          0,
          2 * Math.PI
        );
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_binary(ctx, state) {
      let [size, _] = this.get_surface_size();

      let count = 4;
      let n = Math.min(15, state.count);
      let binaryValue = String('0000' + (n >>> 0).toString(2)).slice(-4);

      let height = this._barHeight + 2;
      let width = size - this._padding * 2;

      let spacing = Math.ceil(width / 14); // separation between the dots
      let dashLength = height * 1.4;
      let radius = height * 0.9;

      ctx.translate(
        Math.floor((size - count * dashLength - (count - 1) * spacing) / 2),
        size - height - radius / 2
      );

      for (let i = 0; i < count; i++) {
        ctx.newSubPath();
        if (binaryValue[i] == '1') {
          ctx.arc(
            i * dashLength + i * spacing + dashLength / 2,
            radius / 2,
            radius,
            0,
            2 * Math.PI
          );
        } else {
          ctx.rectangle(
            i * dashLength + i * spacing,
            0,
            dashLength,
            height - 2
          );
        }
      }

      ctx.strokePreserve();
      Drawing.set_color(ctx, state.color, state.color[3]);
      ctx.fill();
    }

    _draw_dot(ctx, state) {
      this._draw_dots(ctx, { ...state, count: 1 });
    }
  }
);
