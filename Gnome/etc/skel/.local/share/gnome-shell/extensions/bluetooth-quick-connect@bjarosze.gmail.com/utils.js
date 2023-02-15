// Copyright 2018 Bartosz Jaroszewski
// SPDX-License-Identifier: GPL-2.0-or-later
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 2 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

const GLib = imports.gi.GLib;

function spawn(command, callback) {
    let [status, pid] = GLib.spawn_async(
        null,
        ['/usr/bin/env', 'bash', '-c', command],
        null,
        GLib.SpawnFlags.SEARCH_PATH | GLib.SpawnFlags.DO_NOT_REAP_CHILD,
        null
    );

    // ensure we always close the pid to avoid zombie processes
    GLib.child_watch_add(
        GLib.PRIORITY_DEFAULT, pid,
        (_pid, _status) => {
            try {
                if (callback) {
                    callback(_pid, _status);
                }
            } finally {
                GLib.spawn_close_pid(_pid);
            }
        });
}


function isDebugModeEnabled() {
    return new Settings().isDebugModeEnabled();
}

var Logger = class Logger {
    constructor(settings) {
        this._enabled = settings.isDebugModeEnabled();
    }

    info(message) {
        if (!this._enabled) return;

        log(`[bluetooth-quick-connect] ${message}`);
    }

    warn(message) {
        log(`[bluetooth-quick-connect WARNING] ${message}`);
    }
};

function addSignalsHelperMethods(prototype) {
    prototype._connectSignal = function (subject, signal_name, method) {
        if (!this._signals) this._signals = [];

        let signal_id = subject.connect(signal_name, method);
        this._signals.push({
            subject: subject,
            signal_id: signal_id
        });
    }

    prototype._disconnectSignals = function () {
        if (!this._signals) return;

        this._signals.forEach((signal) => {
            signal.subject.disconnect(signal.signal_id);
        });
        this._signals = [];
    };
}
