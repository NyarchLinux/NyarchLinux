import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Cairo from 'gi://cairo';
import St from 'gi://St';

import { Drawing } from '../drawing.js';

export const Calendar = GObject.registerClass(
  {},
  class Calendar extends St.Widget {
    _init(x, settings = {}) {
      super._init();

      let size = x || 400;
      
      this.settings = settings;
      this._canvas = new CalendarCanvas(settings);
      this._canvas.width = size;
      this._canvas.height = size;
      this.add_child(this._canvas);
    }

    redraw() {
      this._canvas.settings = this.settings;
      this.visible = true;
      this._canvas.redraw();
    }

    shouldHideIcon() {
      return false;
    }
  }
);

const CalendarCanvas = GObject.registerClass(
  {},
  class CalendarCanvas extends St.DrawingArea {
    _init(settings = {}) {
      super._init();

      this.settings = {
        dark_color: [0.2, 0.2, 0.2, 1.0],
        light_color: [1.0, 1.0, 1.0, 1.0],
        accent_color: [1.0, 0.0, 0.0, 1.0],
        ...settings,
      };
    }

    redraw() {
      this.queue_repaint();
    }

    vfunc_repaint() {
      let ctx = this.get_context();
      let [width, height] = this.get_surface_size();

      let size = width;

      const hd_color = 'red';
      const bg_color = 'white';
      const day_color = 'black';
      const date_color = 'red';

      ctx.setOperator(Cairo.Operator.CLEAR);
      ctx.paint();

      ctx.translate(size / 2, size / 2);
      ctx.setLineWidth(1);
      ctx.setLineCap(Cairo.LineCap.ROUND);
      ctx.setOperator(Cairo.Operator.SOURCE);

      let bgSize = size * 0.7;
      let offset = size - bgSize;

      const d0 = new Date();

      Drawing.draw_rounded_rect(
        ctx,
        bg_color,
        -size / 2 + offset / 2,
        -size / 2 + offset / 2,
        bgSize,
        bgSize,
        0,
        8
      );
      Drawing.set_color(ctx, date_color, 1.0);
      ctx.moveTo(0, 12);
      Drawing.draw_text(ctx, `${d0.getDate()}`, 'DejaVuSans 36');

      let dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      Drawing.set_color(ctx, day_color, 1.0);
      ctx.moveTo(0, -22);
      Drawing.draw_text(ctx, `${dayNames[d0.getDay()]}`, 'DejaVuSans 16');

      ctx.$dispose();
    }
  }
);
