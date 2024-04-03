'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import { trySpawnCommandLine } from 'resource:///org/gnome/shell/misc/util.js';

import Gio from 'gi://Gio';
import St from 'gi://St';
import Graphene from 'gi://Graphene';

const Point = Graphene.Point;

import { Clock } from './apps/clock.js';
import { Calendar } from './apps/calendar.js';

// sync with animator
const CANVAS_SIZE = 120;

class ServiceCounter {
  constructor(name, interval, callback, advance) {
    advance = advance || 0;
    this.name = name;
    this._interval = interval;
    this._ticks = advance == -1 ? interval : advance;
    this._callback = callback;
  }

  update(elapsed) {
    this._ticks += elapsed;
    if (this._ticks >= this._interval) {
      this._ticks -= this._interval;
      if (this._callback) {
        this._callback();
      }
      return true;
    }
    return false;
  }
}

export const Services = class {
  enable() {
    this._mounts = {};
    this._services = [
      new ServiceCounter('trash', 1000 * 15, this.checkTrash.bind(this)),
      new ServiceCounter(
        'clock',
        1000 * 60, // every minute
        // 1000 * 1, // every second
        () => {
          this.extension.docks.forEach((d) => {
            d._onClock();
          });
        },
        -1
      ),
      new ServiceCounter(
        'calendar',
        1000 * 60 * 15,
        () => {
          this.extension.docks.forEach((d) => {
            d._onCalendar();
          });
        },
        -1
      ),
      new ServiceCounter(
        'ping',
        1000 * 5,
        () => {
          // deferred stuff is required when .desktop entry if first created
          // check for deferred mounts
          this._commitMounts();

          // notifications
          this.checkNotifications();
        },
        0
      ),
    ];

    this._disableNotifications = 0;

    this._deferredMounts = [];
    this._volumeMonitor = Gio.VolumeMonitor.get();
    this._volumeMonitor.connectObject(
      'mount-added',
      this._onMountAdded.bind(this),
      'mount-removed',
      this._onMountRemoved.bind(this),
      this
    );

    this._trashDir = Gio.File.new_for_uri('trash:///');
    this._trashMonitor = this._trashDir.monitor(
      Gio.FileMonitorFlags.WATCH_MOVES,
      null
    );
    this._trashMonitor.connectObject(
      'changed',
      (fileMonitor, file, otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.MOVED_IN:
            return;
        }
        this.checkTrash();
      },
      this
    );

    this._downloadsDir = Gio.File.new_for_path('Downloads');
    this._downloadsMonitor = this._downloadsDir.monitor(
      Gio.FileMonitorFlags.WATCH_MOVES,
      null
    );
    this._downloadsMonitor.connectObject(
      'changed',
      (fileMonitor, file, otherFile, eventType) => {
        switch (eventType) {
          case Gio.FileMonitorEvent.CHANGED:
          case Gio.FileMonitorEvent.CREATED:
          case Gio.FileMonitorEvent.MOVED_IN:
            return;
        }
        this.checkDownloads();
      },
      this
    );

    this.checkTrash();
    this.checkDownloads();
    this.checkNotifications();

    this.checkMounts();
    this._commitMounts();
  }

  disable() {
    this._services = [];
    this._volumeMonitor.disconnectObject(this);
    this._volumeMonitor = null;
    this._trashMonitor.disconnectObject(this);
    this._trashMonitor = null;
    this._trashDir = null;
  }

  _commitMounts() {
    if (this._deferredMounts && this._deferredMounts.length) {
      let mounts = [...this._deferredMounts];
      this._deferredMounts = [];
      mounts.forEach((m) => {
        this._onMountAdded(null, m);
      });
    }
  }

  _onMountAdded(monitor, mount) {
    if (!this.extension.mounted_icon) {
      return false;
    }

    this.last_mounted = mount;
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    this.setupMountIcon(mount);
    this.extension.animate();
    return true;
  }

  _onMountRemoved(monitor, mount) {
    let basename = mount.get_default_location().get_basename();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let mount_id = `/tmp/${appname}`;
    delete this._mounts[mount_id];
    this.extension.animate();
  }

  update(elapsed) {
    this._services.forEach((s) => {
      s.update(elapsed);
    });
  }

  setupTrashIcon() {
    let extension_path = this.extension.path;
    let appname = `trash-dash2dock-lite.desktop`;
    let app_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(app_id);
    let open_app = 'nautilus --select';

    let trash_action = `${extension_path}/apps/empty-trash.sh`;
    {
      let fn = Gio.File.new_for_path('.local/share/Trash');
      trash_action = `rm -rf "${fn.get_path()}"`;
    }

    let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=Trash\nExec=${open_app} trash:///\nIcon=user-trash\nStartupWMClass=trash-dash2dock-lite\nActions=trash\n\n[Desktop Action trash]\nName=Empty Trash\nExec=${trash_action}\nTerminal=true\n`;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  setupFolderIcon(name, title, icon, path) {
    // expand
    let full_path = Gio.file_new_for_path(path).get_path();
    let extension_path = this.extension.path;
    let appname = `${name}-dash2dock-lite.desktop`;
    let app_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(app_id);
    // let open_app = 'xdg-open';
    let open_app = 'nautilus --select';

    let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${title}\nExec=${open_app} ${full_path}\nIcon=${icon}\nStartupWMClass=${name}-dash2dock-lite\n`;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );
  }

  setupFolderIcons() {
    this.setupTrashIcon();
    this.setupFolderIcon(
      'downloads',
      'Downloads',
      'folder-downloads',
      'Downloads'
    );
    this.setupFolderIcon(
      'documents',
      'Documents',
      'folder-documents',
      'Documents'
    );
  }

  setupMountIcon(mount) {
    let basename = mount.get_default_location().get_basename();
    let label = mount.get_name();
    let appname = `mount-${basename}-dash2dock-lite.desktop`;
    let fullpath = mount.get_default_location().get_path();
    let icon = mount.get_icon().names[0] || 'drive-harddisk-solidstate';
    let mount_exec = 'echo "not implemented"';
    let unmount_exec = `umount ${fullpath}`;
    let mount_id = `/tmp/${appname}`;
    let fn = Gio.File.new_for_path(mount_id);

    if (!fn.query_exists(null)) {
      let content = `[Desktop Entry]\nVersion=1.0\nTerminal=false\nType=Application\nName=${label}\nExec=xdg-open ${fullpath}\nIcon=${icon}\nStartupWMClass=mount-${basename}-dash2dock-lite\nActions=unmount;\n\n[Desktop Action mount]\nName=Mount\nExec=${mount_exec}\n\n[Desktop Action unmount]\nName=Unmount\nExec=${unmount_exec}\n`;
      const [, etag] = fn.replace_contents(
        content,
        null,
        false,
        Gio.FileCreateFlags.REPLACE_DESTINATION,
        null
      );
    }

    this._mounts[mount_id] = mount;
  }

  checkNotifications() {
    if (this._disableNotifications > 4) return;

    let media;
    let messages;

    try {
      let tryBox = [
        Main.panel._centerBox,
        Main.panel._leftBox,
        Main.panel._rightBox,
      ];
      for (let i = 0; i < 3; i++) {
        let cc = tryBox[i].get_children();
        cc.forEach((c) => {
          if (media && messages) {
            return;
          }
          media =
            c.child._delegate._messageList._scrollView.last_child.get_children()[0];
          messages =
            c.child._delegate._messageList._scrollView.last_child.get_children()[1];
        });
        if (media && messages) {
          break;
        }
      }
    } catch (err) {
      // fail silently - don't crash
      console.log(err);
      this._disableNotifications++;
    }

    if (!media || !messages) {
      return;
    }

    this._notifications = messages._messages || [];
    if (!this._notifications.length) {
      this._notifications = [];
    }

    this._appNotices = this._appNotices || {};

    Object.keys(this._appNotices).forEach((k) => {
      this._appNotices[k].previous = this._appNotices[k].count;
      this._appNotices[k].count = 0;
    });

    let app_map = {
      'org.gnome.Evolution-alarm-notify.desktop': 'org.gnome.Calendar.desktop',
    };

    this._notifications.forEach((n) => {
      let appId = null;
      if (!n.notification) return;
      if (n.notification.source.app) {
        appId = n.notification.source.app.get_id();
      }
      if (!appId && n.notification.source._app) {
        appId = n.notification.source._app.get_id();
      }
      if (!appId) {
        appId = n.notification.source._appId;
      }
      if (!appId) {
        appId = '?';
      }

      // remap
      appId = app_map[appId] || appId;

      if (!this._appNotices[appId]) {
        this._appNotices[appId] = {
          count: 0,
          previous: 0,
          urgency: 0,
          source: n.notification.source,
        };
      }
      this._appNotices[appId].count++;
      if (this._appNotices[appId].urgency < n.notification.urgency) {
        this._appNotices[appId].urgency = n.notification.urgency;
      }
      this._appNotices[`${appId}`] = this._appNotices[appId];
      if (!appId.endsWith('desktop')) {
        this._appNotices[`${appId}.desktop`] = this._appNotices[appId];
      }
    });

    let hasUpdates = false;
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].previous != this._appNotices[k].count) {
        hasUpdates = true;
      }
    });

    let update = {};
    Object.keys(this._appNotices).forEach((k) => {
      if (this._appNotices[k].count > 0) {
        update[k] = this._appNotices[k];
      }
    });
    this._appNotices = update;

    if (hasUpdates) {
      this.extension.animate();
    }
  }

  checkTrash() {
    if (!this.extension.trash_icon) return;

    let iter = this._trashDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );
    let prev = this.trashFull;
    this.trashFull = iter.next_file(null) != null;
    if (prev != this.trashFull) {
      this.extension.animate({ refresh: true });
    }
    return this.trashFull;
  }

  async checkDownloads() {
    this._trySpawnCommandLine = trySpawnCommandLine;
    if (!this.extension.downloads_icon) return;
    try {
      let path = this._downloadsDir.get_path();
      let cmd = `${this.extension.path}/apps/list-downloads.sh`;
      await trySpawnCommandLine(cmd);
    } catch (err) {
      console.log(err);
    }

    let fileStat = {};
    let fn = Gio.File.new_for_path('/tmp/downloads.txt');
    if (fn.query_exists(null)) {
      try {
        const [success, contents] = fn.load_contents(null);
        const decoder = new TextDecoder();
        let contentsString = decoder.decode(contents);
        let idx = 0;
        let lines = contentsString.split('\n');
        lines.forEach((l) => {
          let res =
            /\s([a-zA-Z]{3})\s{1,3}([0-9]{1,3})\s{1,3}([0-9:]{4,8})\s{1,3}(.*)/.exec(
              l
            );
          if (res) {
            fileStat[res[4]] = {
              index: idx,
              name: res[4],
              date: `${res[1]}. ${res[2]}, ${res[3]}`,
            };
            idx++;
          }
        });
      } catch (err) {
        console.log(err);
      }
    }

    let iter = this._downloadsDir.enumerate_children(
      'standard::*',
      Gio.FileQueryInfoFlags.NONE,
      null
    );

    // console.log(fileStat);

    this._downloadFilesLength = Object.keys(fileStat).length;
    let maxs = [5, 10, 15, 20, 25];
    let max_recent_items = maxs[this.extension.max_recent_items];

    this._downloadFiles = [];
    let f = iter.next_file(null);
    while (f) {
      if (!f.get_is_hidden()) {
        let name = f.get_name();
        if (fileStat[name]?.index <= max_recent_items + 1) {
          this._downloadFiles.push({
            index: fileStat[name]?.index,
            name,
            display: f.get_display_name(),
            icon: f.get_icon().get_names()[0] ?? 'folder',
            type: f.get_content_type(),
            date: fileStat[name]?.date ?? '',
          });
        }
      }
      f = iter.next_file(null);
    }
  }

  checkMounts() {
    if (!this.extension.mounted_icon) {
      this._mounts = {};
      return;
    }

    let mounts = [];
    let mount_ids = [];
    if (this.extension.mounted_icon) {
      mounts = this._volumeMonitor.get_mounts();
      mount_ids = mounts.map((mount) => {
        let basename = mount.get_default_location().get_basename();
        let appname = `mount-${basename}-dash2dock-lite.desktop`;
        return appname;
      });
    }

    this.mounts = mounts;
    mounts.forEach((mount) => {
      let basename = mount.get_default_location().get_basename();
      let appname = `mount-${basename}-dash2dock-lite.desktop`;
      this._deferredMounts.push(mount);
    });

    // added devices will subsequently be on mounted events
  }

  updateIcon(item, settings) {
    if (!item) {
      return;
    }
    let icon = item._icon;
    if (!icon || !icon.icon_name) {
      return;
    }

    let { scaleFactor, iconSize, dock } = settings;

    // todo move dots and badges here?

    // the trash
    if (this.extension.trash_icon && icon.icon_name.startsWith('user-trash')) {
      let new_icon = this.trashFull ? 'user-trash-full' : 'user-trash';
      if (new_icon != icon.icon_name) {
        icon.icon_name = new_icon;
      }
    }

    // clock
    if (icon.icon_name == 'org.gnome.clocks') {
      if (this.extension.clock_icon) {
        let clock = item._clock;
        if (!clock) {
          clock = new Clock(CANVAS_SIZE, dock.extension._widgetStyle);
          dock._clock = clock;
          item._clock = clock;
          item._appwell.first_child.add_child(clock);
        }
        if (clock) {
          clock._icon = icon;
          clock.width = item._icon.width;
          clock.height = item._icon.height;
          clock.set_scale(item._icon.scaleX, item._icon.scaleY);
          let canvasScale = clock.width / (clock._canvas.width + 2);
          clock._canvas.set_scale(canvasScale, canvasScale);
          clock.pivot_point = item._icon.pivot_point;
          clock.translationX = item._icon.translationX;
          clock.translationY = item._icon.translationY;
          clock.show();
          item._icon.visible = !clock.shouldHideIcon();
        }
      } else {
        let clock = item._clock;
        item._icon.visible = true;
        clock?.hide();
      }
    }

    // calender
    if (icon.icon_name == 'org.gnome.Calendar') {
      if (this.extension.calendar_icon) {
        let calender = item._calender;
        if (!calender) {
          calender = new Calendar(CANVAS_SIZE, dock.extension._widgetStyle);
          dock._calender = calender;
          item._calender = calender;
          item._appwell.first_child.add_child(calender);
        }
        if (calender) {
          calender.width = item._icon.width;
          calender.height = item._icon.height;
          calender.set_scale(item._icon.scaleX, item._icon.scaleY);
          let canvasScale = calender.width / (calender._canvas.width + 2);
          calender._canvas.set_scale(canvasScale, canvasScale);
          calender.pivot_point = item._icon.pivot_point;
          calender.translationX = item._icon.translationX;
          calender.translationY = item._icon.translationY;
          calender.show();
          item._icon.visible = !calender.shouldHideIcon();
        }
      } else {
        let calender = item._calender;
        item._icon.visible = true;
        calender?.hide();
      }
    }
  }
};
