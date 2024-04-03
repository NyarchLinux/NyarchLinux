'use strict';

import GLib from 'gi://GLib';

// todo.. recompute ... seems to length the debounce hold out period
const DEBOUNCE_PRECISION = 1;

const pointer_wrapper = {
  get_position: () => {
    let [px, py] = global.get_pointer();
    return [{}, px, py];
  },
  warp: (screen, x, y) => {
    screen.simulated_pointer = [x, y];
  },
};

export const getPointer = () => {
  return pointer_wrapper;
};

export const warpPointer = (pointer, x, y, extension) => {
  pointer.warp(extension, x, y);
};

export const setTimeout = (func, delay, ...args) => {
  const wrappedFunc = () => {
    func.apply(this, args);
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

export const setInterval = (func, delay, ...args) => {
  const wrappedFunc = () => {
    return func.apply(this, args) || true;
  };
  return GLib.timeout_add(GLib.PRIORITY_DEFAULT, delay, wrappedFunc);
};

export const clearTimeout = (id) => {
  GLib.source_remove(id);
};

export const clearInterval = (id) => {
  GLib.source_remove(id);
};
