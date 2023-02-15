//////////////////////////////////////////////////////////////////////////////////////////
//             ,-.  ,--.  ,-.  ,  , ,---.  ,-.  ;-.     ,-. .  . ,-.  ,--.              //
//             |  \ |    (   ` | /    |   /   \ |  )   /    |  | |  ) |                 //
//             |  | |-    `-.  |<     |   |   | |-'    |    |  | |-<  |-                //
//             |  / |    .   ) | \    |   \   / |      \    |  | |  ) |                 //
//             `-'  `--'  `-'  '  `   '    `-'  '       `-' `--` `-'  `--'              //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

const {Clutter, GObject, Meta, Shell} = imports.gi;

const Util          = imports.misc.util;
const Main          = imports.ui.main;
const ControlsState = imports.ui.overviewControls.ControlsState;
const Workspace     = imports.ui.workspace.Workspace;

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();
const utils          = Me.imports.src.utils;

//////////////////////////////////////////////////////////////////////////////////////////
// In GNOME Shell, SwipeTrackers are used all over the place to capture swipe gestures. //
// There's one for entering the overview, one for switching workspaces in desktop mode, //
// one for switching workspaces in overview mode, one for horizontal scrolling in the   //
// app drawer, and many more. The ones used for workspace-switching usually do not      //
// respond to single-click dragging but only to multi-touch gestures. We want to be     //
// able to rotate the cube with the left mouse button, so we add the gesture defined    //
// below to these two SwipeTracker instances (this is done by the _addDragGesture() of  //
// the extension class). The gesture is loosely based on the gesture defined here:      //
// https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/swipeTracker.js#L213    //
// It behaves the same in the regard that it reports update events for horizontal       //
// movements. However, it stores vertical movements as well and makes this accessible   //
// via the "pitch" property. This is then used for vertical rotations of the cube.      //
//////////////////////////////////////////////////////////////////////////////////////////

const State = {
  INACTIVE: 0,  // The state will change to PENDING as soon as there is a mouse click.
  PENDING: 1,   // There was a click, but not enough movement to trigger the gesture.
  ACTIVE: 2     // The gesture has been triggered and is in progress.
};

// clang-format off
var DragGesture =
  GObject.registerClass({
      Properties: {
        'distance': GObject.ParamSpec.double(
          'distance', 'distance', 'distance', GObject.ParamFlags.READWRITE, 0, Infinity, 0),
        'pitch': GObject.ParamSpec.double(
          'pitch', 'pitch', 'pitch', GObject.ParamFlags.READWRITE, 0, 1, 0),
        'sensitivity': GObject.ParamSpec.double(
          'sensitivity', 'sensitivity', 'sensitivity', GObject.ParamFlags.READWRITE, 1, 10, 1),
      },
      Signals: {
        'begin':  {param_types: [GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_DOUBLE]},
        'update': {param_types: [GObject.TYPE_UINT, GObject.TYPE_DOUBLE, GObject.TYPE_DOUBLE]},
        'end':    {param_types: [GObject.TYPE_UINT, GObject.TYPE_DOUBLE]},
      },
    },
    class DragGesture extends GObject.Object {
  // clang-format on
  _init(actor, mode) {
    super._init();

    this._actor = actor;
    this._state = State.INACTIVE;
    this._mode  = mode;

    // We listen to the 'captured-event' to be able to intercept some other actions. The
    // main problem is the long-press action of the desktop background actor. This
    // swallows any click events preventing us from dragging the desktop background.
    // By connecting to 'captured-event', we have to extra-careful to propagate any event
    // we are not interested in.
    this._actorConnection1 = actor.connect('captured-event', (a, e) => {
      return this._handleEvent(e);
    });

    // Once the input is grabbed, events are delivered directly to the actor, so we have
    // also to connect to the normal "event" signal.
    this._actorConnection2 = actor.connect('event', (a, e) => {
      if (this._lastGrab) {
        return this._handleEvent(e);
      }
      return Clutter.EVENT_PROPAGATE;
    });
  }

  // Disconnects from the actor.
  destroy() {
    this._actor.disconnect(this._actorConnection1);
    this._actor.disconnect(this._actorConnection2);
  }

  // This is called on every captured event.
  _handleEvent(event) {

    // Abort if the gesture is not meant for the current action mode (e.g. either
    // Shell.ActionMode.OVERVIEW or Shell.ActionMode.NORMAL).
    if (this._mode != Main.actionMode) {
      return Clutter.EVENT_PROPAGATE;
    }

    // In the overview, we only want to switch workspaces by dragging when in
    // window-picker state.
    if (Main.actionMode == Shell.ActionMode.OVERVIEW) {
      if (Main.overview._overview.controls._stateAdjustment.value !=
          ControlsState.WINDOW_PICKER) {
        return Clutter.EVENT_PROPAGATE;
      }
    }

    // Ignore touch events on X11. On X11, we get emulated pointer events.
    if (!Meta.is_wayland_compositor() &&
        (event.type() == Clutter.EventType.TOUCH_BEGIN ||
         event.type() == Clutter.EventType.TOUCH_UPDATE ||
         event.type() == Clutter.EventType.TOUCH_END)) {
      return Clutter.EVENT_PROPAGATE;
    }

    // When a mouse button is pressed or a touch event starts, we store the corresponding
    // position. The gesture is maybe triggered later, if the pointer was moved a little.
    if (event.type() == Clutter.EventType.BUTTON_PRESS ||
        event.type() == Clutter.EventType.TOUCH_BEGIN) {

      // Here's a minor hack: In the overview, there are some draggable things like window
      // previews which "compete" with this gesture. Sometimes, the cube is dragged,
      // sometimes the window previews. So we make sure that we do only start the gesture
      // for events which originate from the given actor or from a workspace's background.
      if (Main.actionMode != Shell.ActionMode.OVERVIEW ||
          event.get_source() == this._actor ||
          event.get_source().get_parent() instanceof Workspace) {
        this._clickPos = event.get_coords();
        this._state    = State.PENDING;
      }

      return Clutter.EVENT_PROPAGATE;
    }

    // Abort the pending state if the pointer leaves the actor.
    if (event.type() == Clutter.EventType.LEAVE && this._state == State.PENDING) {
      this._cancel();
      return Clutter.EVENT_PROPAGATE;
    }

    // As soon as the pointer is moved a bit, the drag action becomes active.
    if (this._eventIsMotion(event)) {

      // If the mouse button is not pressed, we are not interested in the event.
      if (this._state != State.INACTIVE && event.type() == Clutter.EventType.MOTION &&
          (event.get_state() & Clutter.ModifierType.BUTTON1_MASK) == 0) {

        this._cancel();
        return Clutter.EVENT_PROPAGATE;
      }

      const currentPos = event.get_coords();

      // If we are in the pending state, the gesture may be triggered as soon as the
      // pointer is moved enough.
      if (this._state == State.PENDING) {

        const threshold = Clutter.Settings.get_default().dnd_drag_threshold;

        if (Math.abs(currentPos[0] - this._clickPos[0]) > threshold ||
            Math.abs(currentPos[1] - this._clickPos[1]) > threshold) {


          // When starting a drag in desktop mode, we grab the input so that we can move
          // the pointer across windows without loosing the input events.
          if (Main.actionMode == Shell.ActionMode.NORMAL) {
            const sequence = event.type() == Clutter.EventType.TOUCH_UPDATE ?
              event.get_event_sequence() :
              null;

            if (!this._grab(event.get_device(), sequence)) {
              return Clutter.EVENT_PROPAGATE;
            }
          }

          this._state                 = State.ACTIVE;
          [this._lastX, this._startY] = currentPos;
          this.pitch                  = 0;
          this.emit('begin', event.get_time(), currentPos[0], currentPos[1]);
        }

        // Even if the gesture started, we propagate the event so that any other
        // gestures may wait for long-presses are canceled properly.
        return Clutter.EVENT_PROPAGATE;
      }

      // In the active state, we report updates on each movement.
      if (this._state == State.ACTIVE) {

        // Compute the horizontal movement relative to the last call.
        let deltaX  = currentPos[0] - this._lastX;
        this._lastX = currentPos[0];

        // Compute the accumulated pitch relative to the screen height.
        this.pitch = (this._startY - currentPos[1]) / global.screen_height;

        // Increase sensitivity.
        deltaX *= this.sensitivity;

        // Increase horizontal movement if the cube is rotated vertically.
        deltaX *= Util.lerp(1.0, global.workspaceManager.get_n_workspaces(),
                            Math.abs(this.pitch));

        this.emit('update', event.get_time(), -deltaX, this.distance);

        return Clutter.EVENT_STOP;
      }

      return Clutter.EVENT_PROPAGATE;
    }

    // As soon as the mouse button is released or the touch event ends, we quit the
    // gesture.
    if (this._eventIsRelease(event)) {

      // If the gesture was active, report an end event.
      if (this._state == State.ACTIVE) {

        this._cancel();

        this.emit('end', event.get_time(), this.distance);

        return Clutter.EVENT_STOP;
      }

      // If the gesture was in pending state, set it to inactive again.
      this._cancel();

      return Clutter.EVENT_PROPAGATE;
    }

    return Clutter.EVENT_PROPAGATE;
  }

  // This aborts any ongoing grab and resets the current state to inactive.
  _cancel() {
    if (this._lastGrab) {
      this._ungrab();
    }

    this._state = State.INACTIVE;
  }

  // Makes sure that all events from the pointing device we received last input from is
  // passed to the given actor. This is used to ensure that we do not "loose" the touch
  // buttons will dragging them around.
  _grab(device, sequence) {

    // On GNOME Shell 42, there's a new API.
    if (utils.shellVersionIsAtLeast(42)) {
      this._lastGrab = global.stage.grab(this._actor);
      return this._lastGrab != null;
    }

    // Before, we needed to grab the device and enter modal mode.
    if (global.begin_modal(0, 0)) {
      if (sequence) {
        device.sequence_grab(sequence, this._actor);
        this._grabbedSequence = sequence;
      } else {
        device.grab(this._actor);
      }
      this._lastGrab = device;
      return true;
    }

    return false;
  }

  // Releases a grab created with the method above.
  _ungrab() {
    if (utils.shellVersionIsAtLeast(42)) {
      this._lastGrab.dismiss();
    } else {
      if (this._grabbedSequence) {
        this._lastGrab.sequence_ungrab(this._grabbedSequence);
        this._grabbedSequence = null;
      } else {
        this._lastGrab.ungrab();
      }
      global.end_modal(0);
    }
    this._lastGrab = null;
  }

  // This is borrowed from here:
  // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/dnd.js#L214
  _eventIsRelease(event) {
    if (event.type() == Clutter.EventType.BUTTON_RELEASE) {
      const buttonMask = Clutter.ModifierType.BUTTON1_MASK |
        Clutter.ModifierType.BUTTON2_MASK | Clutter.ModifierType.BUTTON3_MASK;
      // We only obey the last button release from the device, other buttons may get
      // pressed / released during the drag.
      return (event.get_state() & buttonMask) == 0;
    } else if (event.type() == Clutter.EventType.TOUCH_END) {
      // For touch, we only obey the pointer emulating sequence.
      return global.display.is_pointer_emulating_sequence(event.get_event_sequence());
    }

    return false;
  }

  // This is borrowed from here:
  // https://gitlab.gnome.org/GNOME/gnome-shell/-/blob/main/js/ui/dnd.js#L259
  _eventIsMotion(event) {
    return event.type() == Clutter.EventType.MOTION ||
      (event.type() == Clutter.EventType.TOUCH_UPDATE &&
       global.display.is_pointer_emulating_sequence(event.get_event_sequence()));
  }
});