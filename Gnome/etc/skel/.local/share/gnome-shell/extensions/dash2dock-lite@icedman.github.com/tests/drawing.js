const { Clutter, GObject, GLib, PangoCairo, Pango } = imports.gi;
const Cairo = imports.cairo;

function draw_rotated_line(ctx, color, width, angle, len, offset) {
  offset = offset || 0;
  ctx.save();
  ctx.rotate(angle);
  set_color(ctx, color, 1);
  ctx.setLineWidth(width);
  ctx.moveTo(0, offset);
  ctx.lineTo(0, len);
  ctx.stroke();
  ctx.restore();
}

function draw_line(ctx, color, width, x, y, x2, y2) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.setLineWidth(width);
  ctx.moveTo(x, y);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function draw_circle(ctx, color, x, y, diameter, line_width) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.arc(x, y, diameter / 2 - diameter / 20, 0, 2 * Math.PI);
  ctx.setLineWidth(line_width || 0);
  if (line_width > 0) {
    ctx.stroke();
  } else {
    ctx.fill();
  }
  ctx.restore();
}

function draw_rounded_rect(
  ctx,
  color,
  x,
  y,
  h_size,
  v_size,
  line_width,
  border_radius
) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.translate(x, y);
  ctx.setLineWidth(line_width || 0);
  ctx.moveTo(border_radius, 0);
  ctx.lineTo(h_size - border_radius, 0);
  // ctx.lineTo(h_size, border_radius);
  ctx.curveTo(h_size - border_radius, 0, h_size, 0, h_size, border_radius);
  ctx.lineTo(h_size, v_size - border_radius);
  // ctx.lineTo(h_size - border_radius, h_size);
  ctx.curveTo(
    h_size,
    v_size - border_radius,
    h_size,
    v_size,
    h_size - border_radius,
    v_size
  );
  ctx.lineTo(border_radius, v_size);
  // ctx.lineTo(0, h_size - border_radius);
  ctx.curveTo(border_radius, v_size, 0, v_size, 0, v_size - border_radius);
  ctx.lineTo(0, border_radius);
  ctx.curveTo(0, border_radius, 0, 0, border_radius, 0);
  if (line_width == 0) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function draw_rect(ctx, color, x, y, h_size, v_size, line_width) {
  ctx.save();
  set_color(ctx, color, 1);
  ctx.translate(x, y);
  ctx.setLineWidth(line_width || 0);
  ctx.moveTo(0, 0);
  ctx.lineTo(h_size, 0);
  ctx.lineTo(h_size, v_size);
  ctx.lineTo(0, v_size);
  ctx.lineTo(0, 0);
  if (line_width == 0) {
    ctx.fill();
  } else {
    ctx.stroke();
  }
  ctx.restore();
}

function draw_text(ctx, showtext, font = 'DejaVuSans 42') {
  ctx.save();
  let pl = PangoCairo.create_layout(ctx);
  pl.set_text(showtext, -1);
  pl.set_font_description(Pango.FontDescription.from_string(font));
  PangoCairo.update_layout(ctx, pl);
  let [w, h] = pl.get_pixel_size();
  ctx.relMoveTo(-w / 2, -h / 2);
  PangoCairo.show_layout(ctx, pl);
  ctx.relMoveTo(w / 2, 0);
  ctx.restore();
  return [w, h];
}

function set_color(ctx, clr, alpha) {
  if (typeof clr === 'string') {
    const [, cc] = Clutter.Color.from_string(clr);
    ctx.setSourceRGBA(cc.red, cc.green, cc.blue, alpha);
  } else {
    if (clr.red) {
      ctx.setSourceRGBA(clr.red, clr.green, clr.blue, alpha);
    } else {
      ctx.setSourceRGBA(clr[0], clr[1], clr[2], alpha);
    }
  }
}

function set_color_rgba(ctx, red, green, blue, alpha) {
  ctx.setSourceRGBA(red, green, blue, alpha);
}

var Drawing = {
  set_color,
  set_color_rgba,
  draw_rotated_line,
  draw_line,
  draw_circle,
  draw_rect,
  draw_rounded_rect,
  draw_text,
};
