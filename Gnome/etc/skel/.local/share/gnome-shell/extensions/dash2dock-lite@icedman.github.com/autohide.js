'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';

import { DockPosition } from './dock.js';

const Point = Graphene.Point;

const HIDE_ANIMATION_INTERVAL = 15;
const HIDE_ANIMATION_INTERVAL_PAD = 15;
const DEBOUNCE_HIDE_TIMEOUT = 120;
const PRESSURE_SENSE_DISTANCE = 40;

// some codes lifted from dash-to-dock intellihide
const handledWindowTypes = [
  Meta.WindowType.NORMAL,
  // Meta.WindowType.DOCK,
  Meta.WindowType.DIALOG,
  Meta.WindowType.MODAL_DIALOG,
  // Meta.WindowType.TOOLBAR,
  // Meta.WindowType.MENU,
  Meta.WindowType.UTILITY,
  // Meta.WindowType.SPLASHSCREEN
];

export let AutoHide = class {
  enable() {
    if (this._enabled) return;
    // console.log('enable autohide');
    this._enabled = true;
    this._shown = true;
    this._dwell = 0;
    console.log('autohide enabled');
  }

  disable() {
    if (!this._enabled) return;
    if (this.extension._hiTimer) {
      this.extension._hiTimer.cancel(this._animationSeq);
    }

    this.show();

    this._enabled = false;

    let actors = global.get_window_actors();
    let windows = actors.map((a) => a.get_meta_window());
    windows.forEach((w) => {
      if (w._tracked) {
        this._untrack(w);
      }
    });

    console.log('autohide disabled');
  }

  _getScaleFactor() {
    let scaleFactor = this.dashContainer._monitor.geometry_scale;
    return scaleFactor;
  }

  _onMotionEvent() {
    if (this.extension.pressure_sense && !this._shown) {
      let monitor = this.dashContainer._monitor;
      let pointer = global.get_pointer();
      if (this.extension.simulated_pointer) {
        pointer = [...this.extension.simulated_pointer];
      }

      let sw = monitor.width;
      let sh = monitor.height;
      let scale = this._getScaleFactor();
      let area = scale * (PRESSURE_SENSE_DISTANCE * PRESSURE_SENSE_DISTANCE);
      let dx = 0;
      let dy = 0;

      if (this.last_pointer) {
        dx = pointer[0] - this.last_pointer[0];
        dx = dx * dx;
        dy = pointer[1] - this.last_pointer[1];
        dy = dy * dy;
      }

      let dwell_count =
        80 - 60 * (this.extension.pressure_sense_sensitivity || 0);

      if (this.dashContainer.isVertical()) {
        if (
          // right
          (this.dashContainer._position == DockPosition.RIGHT &&
            dy < area &&
            pointer[0] > monitor.x + sw - 4) ||
          // left
          (this.dashContainer._position == DockPosition.LEFT &&
            dy < area &&
            pointer[0] < monitor.x + 4)
        ) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      } else {
        // bottom
        if (dx < area && pointer[1] + 4 > monitor.y + sh) {
          this._dwell++;
        } else {
          this._dwell = 0;
          this.last_pointer = pointer;
        }
      }

      // console.log(`${this._dwell} ${dwell_count} ${this.extension.pressure_sense_sensitivity}`);

      if (this._dwell > dwell_count) {
        this.show();
      }
    }
  }

  _onEnterEvent() {
    if (!this.extension.pressure_sense) {
      this.show();
    }
  }

  _onLeaveEvent() {
    if (this._shown) {
      this._dwell = 0;
      this._debounceCheckHide();
    }
  }

  _onFocusWindow() {
    this._debounceCheckHide();
  }

  _onFullScreen() {
    this._debounceCheckHide();
  }

  show() {
    this._dwell = 0;
    this.frameDelay = 0;
    this._shown = true;
    this.dashContainer.slideIn();
  }

  hide() {
    this._dwell = 0;
    this.frameDelay = 10;
    this._shown = false;
    this.dashContainer.slideOut();
  }

  _track(window) {
    if (!window._tracked) {
      // log('tracking...');
      window.connectObject(
        'position-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dashContainer.extension.checkHide();
        },
        'size-changed',
        // this._debounceCheckHide.bind(this),
        () => {
          this.dashContainer.extension.checkHide();
        },
        this
      );
      window._tracked = true;
    }
  }

  _untrack(window) {
    try {
      if (window && window._tracked) {
        window.disconnectObject(this);
        window._tracked = false;
      }
    } catch (err) {
      // may have been destroyed already
    }
  }

  _checkOverlap() {
    if (this.extension._inOverview) {
      return false;
    }
    let pointer = global.get_pointer();
    if (this.extension.simulated_pointer) {
      pointer = [...this.extension.simulated_pointer];
    }

    // inaccurate
    let pos = this.dashContainer.struts.get_transformed_position();
    let rect = {
      x: pos[0],
      y: pos[1],
      w: this.dashContainer.struts.width,
      h: this.dashContainer.struts.height,
    };
    let arect = [rect.x, rect.y, rect.w, rect.h];
    let dash_position = [this.dashContainer.x, this.dashContainer.y];

    if (!this.extension.autohide_dash) {
      return false;
    }

    // within the dash
    if (
      this.dashContainer._isWithinDash(pointer) ||
      this.dashContainer._isInRect(arect, pointer)
    ) {
      return false;
    }

    if (!this.extension.autohide_dodge) {
      return true;
    }

    let monitor = this.dashContainer._monitor;
    let actors = global.get_window_actors();
    let windows = actors.map((a) => {
      let w = a.get_meta_window();
      w._parent = a;
      return w;
    });
    windows = windows.filter((w) => w.can_close());
    windows = windows.filter((w) => w.get_monitor() == monitor.index);
    let workspace = global.workspace_manager.get_active_workspace_index();
    windows = windows.filter(
      (w) =>
        workspace == w.get_workspace().index() && w.showing_on_its_workspace()
    );
    windows = windows.filter((w) => w.get_window_type() in handledWindowTypes);

    let isOverlapped = false;
    let dock = this.dashContainer.struts.get_transformed_position();
    dock.push(this.dashContainer.struts.width);
    dock.push(this.dashContainer.struts.height);

    windows.forEach((w) => {
      this._track(w);
      if (isOverlapped) return;

      let frame = w.get_frame_rect();
      let win = [frame.x, frame.y, frame.width, frame.height];

      if (this.dashContainer._isOverlapRect(dock, win)) {
        isOverlapped = true;
      }
    });

    this.windows = windows;
    return isOverlapped;
  }

  _debounceCheckHide() {
    if (this.extension._loTimer) {
      if (!this._debounceCheckSeq) {
        this._debounceCheckSeq = this.extension._loTimer.runDebounced(
          () => {
            this._checkHide();
          },
          DEBOUNCE_HIDE_TIMEOUT,
          'debounceCheckHide'
        );
      } else {
        this.extension._loTimer.runDebounced(this._debounceCheckSeq);
      }
    }
  }

  _checkHide() {
    if (this._enabled) {
      if (this._checkOverlap()) {
        this.hide();
      } else {
        this.show();
      }
    }
  }
};
