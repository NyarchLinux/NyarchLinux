'use strict';

import GLib from 'gi://GLib';

export const Timer = class {
  constructor(name) {
    this._name = name;
    this._subscribers = [];
    this._subscriberId = 0xff;
  }

  initialize(resolution) {
    this._resolution = resolution || 1000;
    this._autoStart = true;
    this._autoHibernate = true;

    this._hibernating = false;
    this._hibernatCounter = 0;
    this._hibernateWait = 250 + this._resolution * 2;
  }

  shutdown() {
    this._autoStart = false;
    this._hibernating = false;
    this.stop();
  }

  start(resolution) {
    if (this.is_running()) {
      // print('already running');
      return;
    }
    this._resolution = resolution || 1000;
    this._time = 0;
    this._timeoutId = GLib.timeout_add(
      GLib.PRIORITY_DEFAULT,
      this._resolution,
      this.onUpdate.bind(this)
    );
    this._hibernating = false;
    this.onStart();
  }

  stop() {
    if (!this.is_running()) {
      // print('already stopped');
      return;
    }
    GLib.source_remove(this._timeoutId);
    this._timeoutId = null;
    this.onStop();
  }

  restart(resolution) {
    this.stop();
    this.start(resolution || this._resolution || 1000);
  }

  pause() {
    if (!this.is_running()) {
      return;
    }
    this._paused = true;
    this.onPause();
  }

  resume() {
    if (!this.is_running()) {
      return;
    }
    this._paused = false;
    this.onResume();
  }

  hibernate() {
    if (!this.is_running()) {
      return;
    }

    this.stop();
    this._hibernating = true;
    this._hibernatCounter = 0;
  }

  is_running() {
    return this._timeoutId != null;
  }

  toggle_pause() {
    if (!this.is_running()) {
      return;
    }
    if (!this._paused) {
      this.pause();
    } else {
      this.resume();
    }
  }

  onStart() {
    // print(`started ${this._name} [${this.subscriberNames().join(',')}]`);
    this._subscribers.forEach((s) => {
      if (s.onStart) {
        s.onStart(s);
      }
    });
  }

  onStop() {
    this._subscribers.forEach((s) => {
      if (s.onStop) {
        s.onStop(s);
      }
    });
    // print(`stopped ${this._name}`);
  }

  onPause() {
    this._subscribers.forEach((s) => {
      if (s.onPause) {
        s.onPause(s);
      }
    });
  }

  onResume() {
    this._subscribers.forEach((s) => {
      if (s.onResume) {
        s.onResume(s);
      }
    });
  }

  onUpdate() {
    if (!this._timeoutId || this._paused) {
      return true;
    }

    this._subscribers.forEach((s) => {
      if (s.onUpdate) {
        s.onUpdate(s, this._resolution);
      }
    });

    this._time += this._resolution;

    if (this._autoHibernate) {
      if (!this._subscribers.length) {
        this._hibernatCounter += this._resolution;
        if (this._hibernatCounter >= this._hibernateWait) {
          this.hibernate();
        }
      } else {
        this._hibernatCounter = 0;
      }
    }

    // print(`${this._time/1000} subs:${this._subscribers.length}`);
    return true;
  }

  runningTime() {
    return this._time;
  }

  subscribe(obj) {
    if (!obj._id) {
      obj._id = this._subscriberId++;
    }
    let idx = this._subscribers.findIndex((s) => s._id == obj._id);
    if (idx == -1) {
      this._subscribers.push(obj);
    } else {
      this._subscribers[idx] = {
        ...this._subscribers[idx],
        ...obj,
      };
      obj = this._subscribers[idx];
    }

    if (
      (this._hibernating || this._autoStart) &&
      this._subscribers.length == 1
    ) {
      this.start(this._resolution);
    }

    // log(`subscribers: ${this.subscriberNames().join(',')}`);
    return obj;
  }

  unsubscribe(obj) {
    let idx = this._subscribers.findIndex((s) => s._id == obj._id);
    if (idx != -1) {
      if (this._subscribers.length == 1) {
        this._subscribers = [];
      } else {
        this._subscribers = [
          ...this._subscribers.slice(0, idx),
          ...this._subscribers.slice(idx + 1),
        ];
      }
    }
  }

  subscriberNames() {
    return this._subscribers.map((s) => {
      if (s._name) {
        return s._name;
      }
      return `${s._id}`;
    });
  }

  dumpSubscribers() {
    if (this._name) {
      print('--------');
      print(this._name);
    }
    this._subscribers.forEach((s) => {
      print('--------');
      Object.keys(s).forEach((k) => {
        print(`${k}: ${s[k]}`);
      });
    });
  }

  runLoop(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'loop',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          s._time -= s._delay;
        }
      },
    };
    return this.subscribe(obj);
  }

  runOnce(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'once',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          this.unsubscribe(s);
        }
      },
    };
    return this.subscribe(obj);
  }

  runDebounced(func, delay, name) {
    if (typeof func === 'object') {
      func._time = 0;
      return this.subscribe(func);
    }
    let obj = {
      _name: name,
      _type: 'debounced',
      _time: 0,
      _delay: delay,
      _func: func,
      onUpdate: (s, dt) => {
        s._time += dt;
        if (s._time >= s._delay) {
          s._func(s);
          this.unsubscribe(s);
        }
      },
    };
    return this.subscribe(obj);
  }

  runSequence(array, settings) {
    if (typeof array === 'object' && !array.length) {
      array._time = 0;
      array._currentIdx = 0;
      return this.subscribe(array);
    }
    let obj = {
      _time: 0,
      _currentIdx: 0,
      _sequences: [...array],
      ...settings,
      onUpdate: (s, dt) => {
        let current = s._sequences[s._currentIdx];
        if (!current) {
          this.unsubscribe(s);
          return;
        }
        s._time += dt;
        if (s._time >= current.delay) {
          current.func(current);
          s._time = -current.delay;
          s._currentIdx++;
          if (s._currentIdx >= s._sequences.length && s._loop) {
            s._currentIdx = 0;
          }
        }
      },
    };
    return this.subscribe(obj);
  }

  runAnimation(array, settings) {
    if (typeof func === 'object' && !array.length) {
      func._time = 0;
      return this.subscribe(func);
    }

    let duration = 0;
    array.forEach((f) => {
      if (!f._start) {
        f._start = duration;
      }
      duration += f._duration;
    });

    let obj = {
      _time: 0,
      _duration: duration,
      _loop: false,
      _frames: [...array],
      ...(settings || {}),
      onUpdate: (s, dt) => {
        s._time += dt;

        let frames = [];
        if (s._frames) {
          frames = s._frames.filter((f) => {
            return f._start <= s._time && s._time < f._start + f._duration;
          });
        }
        s._currentFrames = frames;

        if (!s._func) {
          s._func = (s) => {
            s._currentFrames.forEach((f) => {
              f._time = s._time - f._start;
              f._func(f, s);
            });
          };
        }

        if (s._time > s._duration) {
          this.unsubscribe(s);
          s._time = s._duration;
          s._func(s);
          return;
        }
        s._func(s);
      },
    };
    return this.subscribe(obj);
  }

  cancel(obj) {
    if (obj) {
      this.unsubscribe(obj);
    }
  }
};
