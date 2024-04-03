#!/usr/bin/gjs

const { Adw, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;

let _tests = [];
var runSequence = (tests) => {
  if (tests) {
    _tests = tests;
  }
  if (_tests.length == 0) return;
  let t = _tests[0];
  _tests.splice(0, 1);
  let d = Math.floor(t.delay * 1000);
  print(t.func);
};

runSequence([
  {
    func: () => {
      print(1);
    },
    delay: 1.5,
  },
  {
    func: () => {
      print(2);
    },
    delay: 1.5,
  },
]);
