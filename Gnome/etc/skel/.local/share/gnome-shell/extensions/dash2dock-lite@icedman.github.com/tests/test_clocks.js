#!/usr/bin/gjs

const Cairo = imports.cairo;
const Clutter = imports.gi.Clutter;
const GtkClutter = imports.gi.GtkClutter;
const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Gtk = imports.gi.Gtk;
const Lang = imports.lang;

function _drawFrame(ctx, size, settings) {
  if (!settings.frame) {
    return;
  }
  let { background, border, borderWidth } = settings.frame;

  ctx.save();
  let bgSize = size * 0.9;
  // frame background
  Drawing.draw_rounded_rect(
    ctx,
    background,
    -bgSize / 2,
    -bgSize / 2,
    bgSize,
    bgSize,
    0,
    18
  );
  // frame border
  if (borderWidth) {
    Drawing.draw_rounded_rect(
      ctx,
      border,
      -bgSize / 2,
      -bgSize / 2,
      bgSize,
      bgSize,
      borderWidth,
      18
    );
  }
  ctx.restore();
}

function _drawDial(ctx, size, settings) {
  if (!settings.dial) {
    return;
  }
  let { background, border, borderWidth } = settings.dial;

  ctx.save();
  let bgSize = size * 0.84;
  // dial background
  Drawing.draw_circle(ctx, background, 0, 0, bgSize);
  // dial border
  if (borderWidth) {
    Drawing.draw_circle(ctx, border, 0, 0, bgSize, borderWidth);
  }
  ctx.restore();
}

function _drawMarks(ctx, size, settings) {
  if (!settings.marks) {
    return;
  }
  let { color, width } = settings.marks;

  ctx.save();
  for (let i = 0; i < 12; i++) {
    let a = (360 / 12) * i;
    let mark = size * 0.75;
    Drawing.draw_rotated_line(
      ctx,
      color,
      width,
      // size / 33,
      a * (Math.PI / 180),
      -Math.floor((size * 0.9) / 2.7),
      -Math.floor(mark / 2.7)
    );
  }
  ctx.restore();
}

function _drawHands(ctx, size, date, settings) {
  const { hour, minute, second } = settings.hands;
  const d0 = date;
  let h0 = d0.getHours();
  const m0 = d0.getMinutes();

  // hands
  Drawing.draw_rotated_line(
    ctx,
    minute,
    size / 20,
    (h0 * 30 + (m0 * 30) / 60) * (Math.PI / 180),
    -Math.floor(size / 3.7)
  );
  Drawing.draw_circle(ctx, minute, 0, 0, size / 12);
  Drawing.draw_rotated_line(
    ctx,
    hour,
    size / 33,
    m0 * 6 * (Math.PI / 180),
    -Math.floor(size / 2.7)
  );
}

function _drawClock(ctx, date, x, y, size, settings) {
  ctx.save();
  ctx.translate(x, y);
  ctx.moveTo(0, 0);

  _drawFrame(ctx, size, settings);
  _drawDial(ctx, size, settings);
  _drawMarks(ctx, size, settings);
  _drawHands(ctx, size, date, settings);

  ctx.restore();
}

// Get application folder and add it into the imports path
function getAppFileInfo() {
  let stack = new Error().stack,
    stackLine = stack.split('\n')[1],
    coincidence,
    path,
    file;

  if (!stackLine) throw new Error('Could not find current file (1)');

  coincidence = new RegExp('@(.+):\\d+').exec(stackLine);
  if (!coincidence) throw new Error('Could not find current file (2)');

  path = coincidence[1];
  file = Gio.File.new_for_path(path);
  return [file.get_path(), file.get_parent().get_path(), file.get_basename()];
}
const path = getAppFileInfo()[1];
imports.searchPath.push(path);
imports.searchPath.push(path + '/../');

const Drawing = imports.drawing;

const App = function () {
  this.title = 'Example Cairo';
  GLib.set_prgname(this.title);
};

App.prototype.run = function (ARGV) {
  this.application = new Gtk.Application();
  this.application.connect('activate', () => {
    this.onActivate();
  });
  this.application.connect('startup', () => {
    this.onStartup();
  });
  this.application.run([]);
};

App.prototype.onActivate = function () {
  this.window.show_all();
};

App.prototype.onStartup = function () {
  this.initClutter();
  this.buildUI();
};

App.prototype.initClutter = function () {
  GtkClutter.init(null);
  Clutter.init(null);
};

App.prototype.buildUI = function () {
  this.window = new Gtk.ApplicationWindow({
    application: this.application,
    title: this.title,
    default_height: 300,
    default_width: 500,
    window_position: Gtk.WindowPosition.CENTER,
  });
  try {
    this.window.set_icon_from_file(path + '/assets/appIcon.png');
  } catch (err) {
    this.window.set_icon_name('application-x-executable');
  }

  this.color = [1, 0, 0, 1];
  this.content = this.buildBody();
  this.window.add(this.content);
};

App.prototype.buildBody = function () {
  let area = new Gtk.DrawingArea();
  area.set_size_request(1200, 600);
  area.connect('draw', (area, ctx) => {
    this.draw(area, ctx);
  });

  area.add_events(Gdk.EventMask.POINTER_MOTION_MASK);
  area.connect('motion-notify-event', (obj, evt) => {
    this.coords = evt.get_coords();
    area.queue_draw();
  });
  return area;
};

App.prototype.draw = function (area, ctx) {
  let height, width;
  height = area.get_allocated_height();
  width = area.get_allocated_width();

  ctx.save();

  // background
  Drawing.set_color(ctx, [0.75, 0.75, 0.75], 1);
  ctx.paint();

  Drawing.draw_line(ctx, [1, 1, 0, 1], 1, 0, 0, width, height);

  let settings = {
    dark_color: [0, 0, 0, 1],
    light_color: [1, 1, 1, 1],
    accent_color: [1, 0, 0, 1],
  };
  _drawClock(ctx, new Date(), 100, 100, 100, {
    ...settings,
    hands: {
      hour: [1, 0, 0, 1],
      minute: [0, 0, 0, 1],
      second: [0, 0, 0, 1],
    },
    marks: {
      color: [0.5, 0.5, 0.5, 1],
      width: 1,
    },
    dial: {
      background: [1.0, 1.0, 1.0, 1],
      border: [0.85, 0.85, 0.85, 1],
      borderWidth: 2,
    },
    frame: {
      background: [0.5, 0.5, 0.5, 1],
      border: [0.25, 0.25, 0.25, 1],
      borderWidth: 0,
    },
  });

  ctx.restore();
};

//Run the application
let app = new App();
app.run(ARGV);
