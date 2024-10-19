/*
    This file is part of Arch Linux Updates Indicator

    Arch Linux Updates Indicator is free software: you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    Arch Linux Updates Indicator is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License
    along with Arch Linux Updates Indicator.  If not, see <http://www.gnu.org/licenses/>.

    Copyright 2016-2022 Raphaël Rochet
*/

import Clutter from 'gi://Clutter';
import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GioUnix from 'gi://GioUnix';
import GLib from 'gi://GLib';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Button} from 'resource:///org/gnome/shell/ui/panelMenu.js';

import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as MessageTray from 'resource:///org/gnome/shell/ui/messageTray.js';
import * as Util from 'resource:///org/gnome/shell/misc/util.js';
import {Extension, gettext as _, ngettext as __} from 'resource:///org/gnome/shell/extensions/extension.js';

/* RegExp to tell what's an update */
/* I am very loose on this, may make it easier to port to other distros */
const RE_UpdateLine = /^(.+)\s+(\S+)\s+->\s+(.+)$/;

/* Options */
let ALWAYS_VISIBLE     = true;
let USE_BUILDIN_ICONS  = true;
let SHOW_COUNT         = true;
let BOOT_WAIT          = 15;      // 15s
let CHECK_INTERVAL     = 60*60;   // 1h
let NOTIFY             = false;
let HOWMUCH            = 0;
let UPDATE_CMD         = "gnome-terminal -- /bin/sh -c \"sudo pacman -Syu ; echo Done - Press enter to exit; read _\" ";
let CHECK_CMD          = "/usr/bin/checkupdates";
let MANAGER_CMD        = "";
let PACMAN_DIR         = "/var/lib/pacman/local";
let STRIP_VERSIONS     = false;
let STRIP_VERSIONS_N   = true;
let AUTO_EXPAND_LIST   = 0;
let DISABLE_PARSING    = false;
let PACKAGE_INFO_CMD   = "xdg-open https://www.archlinux.org/packages/%2$s/%3$s/%1$s";
let LINKIFY_MENU       = true;
let SHOW_TIMECHECKED   = true;

/* Variables we want to keep when extension is disabled (eg during screen lock) */
let FIRST_BOOT         = 1;
let UPDATES_PENDING    = -1;
let UPDATES_LIST       = [];
let LAST_CHECK         = undefined;

export default class ArchUpdateIndicatorExtension extends Extension {
	constructor(metadata) {
		super(metadata);
	}
	init() {
		String.prototype.format = Format.format;
	}
	enable() {
		this.archupdateindicator = new ArchUpdateIndicator(this);
		Main.panel.addToStatusArea('ArchUpdateIndicator', this.archupdateindicator);
		this.archupdateindicator._positionChanged();
	}
	disable() {
		this.archupdateindicator.destroy();
		this.archupdateindicator = null;
	}
}

const ArchUpdateIndicator = GObject.registerClass(
	{
		_TimeoutId: null,
		_FirstTimeoutId: null,
		_updateProcess_sourceId: null,
		_updateProcess_stream: null,
		_updateProcess_pid: null,
		_updateList: [],
	},
class ArchUpdateIndicator extends Button {

	_init(ext) {
		console.log(`Arch-update : loading`);
		super._init(0.5);
		this._extension = ext;
		/* A process builder without i10n for reproducible processing. */
		this.launcher = new Gio.SubprocessLauncher({
			flags: (Gio.SubprocessFlags.STDOUT_PIPE |
				    Gio.SubprocessFlags.STDERR_PIPE)
		});
		this.launcher.setenv("LANG", "C", true);

		this.updateIcon = new St.Icon({gicon: this._getCustIcon('arch-unknown-symbolic'), style_class: 'system-status-icon'});

		let box = new St.BoxLayout({ vertical: false, style_class: 'panel-status-menu-box' });
		this.label = new St.Label({ text: '',
			y_expand: true,
			y_align: Clutter.ActorAlign.CENTER });

		box.add_child(this.updateIcon);
		box.add_child(this.label);
		this.add_child(box);

		// Prepare the special menu : a submenu for updates list that will look like a regular menu item when disabled
		// Scrollability will also be taken care of by the popupmenu
		this.menuExpander = new PopupMenu.PopupSubMenuMenuItem('');
		this.menuExpanderContainer = new St.BoxLayout({ vertical: true, style_class: 'arch-updates-updates-list' });
		this.menuExpander.menu.box.add_child( this.menuExpanderContainer );

		// Other standard menu items
		let settingsMenuItem = new PopupMenu.PopupMenuItem(_('Settings'));
		this.updateNowMenuItem = new PopupMenu.PopupMenuItem(_('Update now'));
		this.managerMenuItem = new PopupMenu.PopupMenuItem(_('Open package manager'));

		// A special "Checking" menu item with a stop button
		this.checkingMenuItem = new PopupMenu.PopupBaseMenuItem( {reactive:false} );
		let checkingLabel = new St.Label({ text: _('Checking') + " …" });
		let cancelButton = new St.Button({
			child: new St.Icon({ icon_name: 'process-stop-symbolic' }),
			style_class: 'system-menu-action arch-updates-menubutton',
			x_expand: true
		});
		cancelButton.set_x_align(Clutter.ActorAlign.END);
		this.checkingMenuItem.add_child( checkingLabel );
		this.checkingMenuItem.add_child( cancelButton  );

		// A little trick on "check now" menuitem to keep menu opened
		this.checkNowMenuItem = new PopupMenu.PopupMenuItem( _('Check now') );
		this.checkNowMenuContainer = new PopupMenu.PopupMenuSection();
		this.checkNowMenuContainer.box.add_child(this.checkNowMenuItem);

		// A placeholder to show the last check time
		this.timeCheckedMenu = new PopupMenu.PopupMenuItem( "-", {reactive:false} );

		// Assemble all menu items into the popup menu
		this.menu.addMenuItem(this.menuExpander);
		this.menu.addMenuItem(this.timeCheckedMenu);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(this.updateNowMenuItem);
		this.menu.addMenuItem(this.checkingMenuItem);
		this.menu.addMenuItem(this.checkNowMenuContainer);
		this.menu.addMenuItem(this.managerMenuItem);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(settingsMenuItem);

		// Bind some events
		this.menu.connect('open-state-changed', this._onMenuOpened.bind(this));
		this.checkNowMenuItem.connect('activate', this._checkUpdates.bind(this));
		cancelButton.connect('clicked', this._cancelCheck.bind(this));
		settingsMenuItem.connect('activate', this._openSettings.bind(this));
		this.updateNowMenuItem.connect('activate', this._updateNow.bind(this));
		this.managerMenuItem.connect('activate', this._openManager.bind(this));

		// Some initial status display
		this._showChecking(false);
		this._updateMenuExpander(false, _('Waiting first check'));
		if (LAST_CHECK) this._updateLastCheckMenu();

		// Restore previous updates list if any
		this._updateList = UPDATES_LIST;

		// Load settings
		this._settings = this._extension.getSettings();
		this._settings.connect('changed', this._positionChanged.bind(this));
		this._settingsChangedId = this._settings.connect('changed', this._applySettings.bind(this));
		this._applySettings();

		if (FIRST_BOOT) {
			// Schedule first check only if this is the first extension load
			// This won't be run again if extension is disabled/enabled (like when screen is locked)
			this._FirstTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, BOOT_WAIT, ()=>{
				this._FirstTimeoutId = null;
				this._checkUpdates();
				FIRST_BOOT = 0;
				return false; // Run once
			});
		}

	}

	_getCustIcon(icon_name) {
		if (!USE_BUILDIN_ICONS) {
			let theme = new St.IconTheme();
			if (theme.has_icon(icon_name)) {
				return Gio.icon_new_for_string( icon_name );
			}
		}
		// Icon not available in theme, or user prefers built in icon
		return Gio.icon_new_for_string( this._extension.dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
	}

	_positionChanged(){
		if (this._settings.get_boolean('enable-positioning')) {
			this.container.get_parent().remove_child(this.container);
			let boxes = {
				0: Main.panel._leftBox,
				1: Main.panel._centerBox,
				2: Main.panel._rightBox
			};
			let p = this._settings.get_int('position');
			let i = this._settings.get_int('position-number');
			boxes[p].insert_child_at_index(this.container, i);
		}
	}

	_openSettings() {
		this._extension.openPreferences();
	}

	_openManager() {
		Util.spawnCommandLine(MANAGER_CMD);
	}

	_updateNow() {
		Util.spawnCommandLine(UPDATE_CMD);
	}

	_applySettings() {
		ALWAYS_VISIBLE = this._settings.get_boolean('always-visible');
		USE_BUILDIN_ICONS = this._settings.get_boolean('use-buildin-icons');
		SHOW_COUNT = this._settings.get_boolean('show-count');
		BOOT_WAIT = this._settings.get_int('boot-wait');
		CHECK_INTERVAL = 60 * this._settings.get_int('check-interval');
		NOTIFY = this._settings.get_boolean('notify');
		HOWMUCH = this._settings.get_int('howmuch');
		UPDATE_CMD = this._settings.get_string('update-cmd');
		CHECK_CMD = this._settings.get_string('check-cmd');
		DISABLE_PARSING = this._settings.get_boolean('disable-parsing');
		MANAGER_CMD = this._settings.get_string('package-manager');
		PACMAN_DIR = this._settings.get_string('pacman-dir');
		STRIP_VERSIONS = this._settings.get_boolean('strip-versions');
		STRIP_VERSIONS_N = this._settings.get_boolean('strip-versions-in-notification');
		AUTO_EXPAND_LIST = this._settings.get_int('auto-expand-list');
		PACKAGE_INFO_CMD = this._settings.get_string('package-info-cmd');
		LINKIFY_MENU = this._settings.get_boolean('linkify-menu');
		SHOW_TIMECHECKED = this._settings.get_boolean('show-timechecked');
		this.managerMenuItem.visible = ( MANAGER_CMD != "" );
		this.timeCheckedMenu.visible = SHOW_TIMECHECKED;
		this._checkShowHide();
		this._updateStatus();
		this._startFolderMonitor();
		this._scheduleCheck();
	}

	_scheduleCheck() {
		// Remove previous schedule if any
		if (this._TimeoutId) GLib.source_remove(this._TimeoutId);
		let delay = CHECK_INTERVAL; // seconds before next check
		if (LAST_CHECK) {
			// Adjust the delay so that locking screen or changing settings does not reset
			// the countdown to next check
			// Remove how many seconds already passed since last check
			delay -= ((new Date()) - LAST_CHECK) / 1000;
			// Do not go under "First check delay" setting
			if (delay < BOOT_WAIT) delay = BOOT_WAIT;
		}
		console.log(`Arch-update : next update check scheduled in (seconds) ` + delay.toString());
		this._TimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, delay, ()=>{
			this._TimeoutId = null;
			this._checkUpdates();
			return false;
		});
	}

	destroy() {
		console.log(`Arch-update : unloading`);
		this._settings.disconnect( this._settingsChangedId );
		if (this._notifSource) {
			// Delete the notification source, which lay still have a notification shown
			this._notifSource.destroy();
			this._notifSource = null;
		};
		if (this.monitor) {
			// Stop spying on pacman local dir
			this.monitor.cancel();
			this.monitor = null;
		}
		if (this._updateProcess_sourceId) {
			// We leave the checkupdate process end by itself but undef handles to avoid zombies
			GLib.source_remove(this._updateProcess_sourceId);
			this._updateProcess_sourceId = null;
			this._updateProcess_stream = null;
		}
		if (this._FirstTimeoutId) {
			GLib.source_remove(this._FirstTimeoutId);
			this._FirstTimeoutId = null;
		}
		if (this._TimeoutId) {
			GLib.source_remove(this._TimeoutId);
			this._TimeoutId = null;
		}
		super.destroy();
	}

	_checkShowHide() {
		if ( UPDATES_PENDING == -3 ) {
			// Do not apply visibility change while checking for updates
			return;
		} else if ( UPDATES_PENDING == -2 ) {
			// Always show indicator if there is an error
			this.visible = true;
		} else if (!ALWAYS_VISIBLE && UPDATES_PENDING < 1) {
			this.visible = false;
		} else {
			this.visible = true;
		}
		this.label.visible = SHOW_COUNT && UPDATES_PENDING > 0;
	}

	_onMenuOpened() {
		// This event is fired when menu is shown or hidden
		// Only open the submenu if the menu is being opened and there is something to show
		this._checkAutoExpandList();
	}

	_checkAutoExpandList() {
		if (this.menu.isOpen && UPDATES_PENDING > 0 && UPDATES_PENDING <= AUTO_EXPAND_LIST) {
			this.menuExpander.setSubmenuShown(true);
		} else {
			this.menuExpander.setSubmenuShown(false);
		}
	}

	_startFolderMonitor() {
		if (this.monitoring && this.monitoring != PACMAN_DIR) {
			// The path to be monitored has been changed
			this.monitor.cancel();
			this.monitor = null;
			this.monitoring = null;
		}
		if (PACMAN_DIR && !this.monitoring) {
			// If there's a path to monitor and we're not already monitoring
			this.monitoring = PACMAN_DIR;
			this.pacman_dir = Gio.file_new_for_path(PACMAN_DIR);
			this.monitor = this.pacman_dir.monitor_directory(0, null);
			this.monitor.connect('changed', this._onFolderChanged.bind(this));
		}
	}

	_onFolderChanged() {
		// Folder have changed ! Let's schedule a check in a few seconds
		// This will replace the first check if not done yet, we don't want to do double checking
		if (this._FirstTimeoutId) GLib.source_remove(this._FirstTimeoutId);
		this._FirstTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, ()=>{
			this._FirstTimeoutId = null;
			this._checkUpdates();
			FIRST_BOOT = 0;
			return false;
		});
	}

	_showChecking(isChecking) {
		if (isChecking == true) {
			this.updateIcon.set_gicon( this._getCustIcon('arch-unknown-symbolic') );
			this.checkNowMenuItem.visible = false;
			this.checkingMenuItem.visible = true;
		} else {
			this.checkNowMenuItem.visible = true;
			this.checkingMenuItem.visible = false;
		}
	}

	_updateLastCheckMenu() {
		this.timeCheckedMenu.label.set_text( _("Last checked") + "  " + LAST_CHECK.toLocaleString() );
		this.timeCheckedMenu.visible = SHOW_TIMECHECKED;
	}

	_updateStatus(updatesCount) {
		updatesCount = typeof updatesCount === 'number' ? updatesCount : UPDATES_PENDING;
		if (updatesCount > 0) {
			// Updates pending
			this.updateIcon.set_gicon( this._getCustIcon('arch-updates-symbolic') );
			this._updateMenuExpander( true, __( "%d update pending", "%d updates pending", updatesCount ).format(updatesCount) );
			this.label.set_text(updatesCount.toString());
			if (NOTIFY && UPDATES_PENDING < updatesCount) {
				if (HOWMUCH > 0) {
					let updateList = [];
					if (HOWMUCH > 1) {
						updateList = this._updateList;
					} else {
						// Keep only packets that was not in the previous notification
						updateList = this._updateList.filter(function(pkg) { return UPDATES_LIST.indexOf(pkg) < 0 });
					}
					// Filter out titles and whatnot
					if (!DISABLE_PARSING) {
						updateList = updateList.filter(function(line) { return RE_UpdateLine.test(line) });
					}
					// If version numbers should be stripped, do it
					if (STRIP_VERSIONS_N == true) {
						updateList = updateList.map(function(p) {
							// Try to keep only what's before the first space
							var chunks = p.split(" ",2);
							return chunks[0];
						});
					}
					if (updateList.length > 0) {
						// Show notification only if there's new updates
						this._showNotification(
							__( "New Arch Linux Update", "New Arch Linux Updates", updateList.length ),
							updateList.join(', ')
						);
					}
				} else {
					this._showNotification(
						__( "New Arch Linux Update", "New Arch Linux Updates", updatesCount ),
						__( "There is %d update pending", "There are %d updates pending", updatesCount ).format(updatesCount)
					);
				}
			}
			// Store the new list
			UPDATES_LIST = this._updateList;
		} else {
			this.label.set_text('');
			if (updatesCount == -1) {
				// Unknown
				this.updateIcon.set_gicon( this._getCustIcon('arch-unknown-symbolic') );
				this._updateMenuExpander( false, '' );
			} else if (updatesCount == -2) {
				// Error
				this.updateIcon.set_gicon( this._getCustIcon('arch-error-symbolic') );
				if ( this.lastUnknowErrorString.indexOf("/usr/bin/checkupdates") > 0 ) {
					// We do a special change here due to checkupdates moved to pacman-contrib
					this._updateMenuExpander( false, _("Note : you have to install pacman-contrib to use the 'checkupdates' script.") );
				} else {
					this._updateMenuExpander( false, _('Error') + "\n" + this.lastUnknowErrorString );
				}
			} else {
				// Up to date
				this.updateIcon.set_gicon( this._getCustIcon('arch-uptodate-symbolic') );
				this._updateMenuExpander( false, _('Up to date :)') );
				UPDATES_LIST = []; // Reset stored list
			}
		}
		UPDATES_PENDING = updatesCount;
		this._checkAutoExpandList();
		this._checkShowHide();
	}

	_updateMenuExpander(enabled, label) {
		if (label == "") {
			// No text, hide the menuitem
			this.menuExpander.visible = false;
		} else {
		// We make our expander look like a regular menu label if disabled
			this.menuExpander.reactive = enabled;
			this.menuExpander._triangle.visible = enabled;
			this.menuExpander.label.set_text(label);
			this.menuExpander.visible = true;
			if (enabled && this._updateList.length > 0) {
				this.menuExpanderContainer.destroy_all_children();
				this._updateList.forEach( item => {
					if(DISABLE_PARSING) {
						var menutext = item;
						if (STRIP_VERSIONS) {
							var chunks = menutext.split(" ",2);
							menutext = chunks[0];
						}
						this.menuExpanderContainer.add_child( this._createPackageLabel(menutext) );
					} else {
						let matches = item.match(RE_UpdateLine);
						if (matches == null) {
							// Not an update
							this.menuExpanderContainer.add_child( new St.Label({ text: item, style_class: 'arch-updates-update-title' }) );
						} else {
							let hBox = new St.BoxLayout({ vertical: false, style_class: 'arch-updates-update-line' });
							hBox.add_child( this._createPackageLabel(matches[1]) );
							if (!STRIP_VERSIONS) {
								hBox.add_child( new St.Label({
									text: matches[2] + " → ",
									y_expand: true,
									y_align: Clutter.ActorAlign.CENTER,
									style_class: 'arch-updates-update-version-from' }) );
								hBox.add_child( new St.Label({
									text: matches[3],
									style_class: 'arch-updates-update-version-to' }) );
							}
							this.menuExpanderContainer.add_child( hBox );
						}
					}
				} );
			}
		}
		// 'Update now' visibility is linked so let's save a few lines and set it here
		this.updateNowMenuItem.reactive = enabled;
		// Seems that's not done anymore by PopupBaseMenuItem after init, so let's update inactive styling
		if ( this.updateNowMenuItem.reactive ) {
			this.updateNowMenuItem.remove_style_class_name('popup-inactive-menu-item');
		} else {
			this.updateNowMenuItem.add_style_class_name('popup-inactive-menu-item');
		}
		if ( this.menuExpander.reactive ) {
			this.menuExpander.remove_style_class_name('popup-inactive-menu-item');
		} else {
			this.menuExpander.add_style_class_name('popup-inactive-menu-item');
		}
	}

	_createPackageLabel(name) {
		if (PACKAGE_INFO_CMD) {
			let label = new St.Label({
				text: name,
				x_expand: true,
				style_class: LINKIFY_MENU ? 'arch-updates-update-name-link': 'arch-updates-update-name'
			});
			let button = new St.Button({
				child: label,
				x_expand: true
			});
			button.connect('clicked', this._packageInfo.bind(this, name));
			return button;
		} else {
			return new St.Label({
				text: name,
				x_expand: true,
				style_class: 'arch-updates-update-name'
			});
		}
	}

	_packageInfo(item) {
		this.menu.close();
		let proc = this.launcher.spawnv(['pacman', '-Si', item]);
		proc.communicate_utf8_async(null, null, (proc, res) => {
			let repo = "REPO";
			let arch = "ARCH";
			let [,stdout,] = proc.communicate_utf8_finish(res);
			if (proc.get_successful()) {
				let m = stdout.match(/^Repository\s+:\s+(\w+).*?^Architecture\s+:\s+(\w+)/ms);
				if (m !== null) {
					repo = m[1];
					arch = m[2];
				}
			}
			let command = PACKAGE_INFO_CMD.format(item, repo, arch);
			Util.spawnCommandLine(command);
		});
	}

	_checkUpdates() {
		// Remove timer if any (in case the trigger was menu or external)
		if (this._TimeoutId) { GLib.source_remove(this._TimeoutId) ; this._TimeoutId = null }
		if(this._updateProcess_sourceId) {
			// A check is already running ! Maybe we should kill it and run another one ?
			return;
		}
		// Run asynchronously, to avoid  shell freeze - even for a 1s check
		this._showChecking(true);
		try {
			// Parse check command line
			let [parseok, argvp] = GLib.shell_parse_argv( CHECK_CMD );
			if (!parseok) { throw 'Parse error' };
			let [res, pid, in_fd, out_fd, err_fd]  = GLib.spawn_async_with_pipes(null, argvp, null, GLib.SpawnFlags.DO_NOT_REAP_CHILD, null);
			// Let's buffer the command's output - that's a input for us !
			this._updateProcess_stream = new Gio.DataInputStream({
				base_stream: new GioUnix.InputStream({fd: out_fd})
			});
			// We will process the output at once when it's done
			this._updateProcess_sourceId = GLib.child_watch_add(0, pid, () => {this._checkUpdatesRead()} );
			this._updateProcess_pid = pid;
		} catch (err) {
			this._showChecking(false);
			this.lastUnknowErrorString = err.message.toString();
			this._updateStatus(-2);
		}
		// Update last check (start) time and schedule next check even if the current one is not done yet
		// doing so makes sure it will be scheduled even if failed or canceled, and we don't end in
		// a looping test
		LAST_CHECK = new Date();
		this._updateLastCheckMenu();
		this._scheduleCheck();
	}

	_cancelCheck() {
		if (this._updateProcess_pid == null) { return; };
		Util.spawnCommandLine( "kill " + this._updateProcess_pid );
		this._updateProcess_pid = null; // Prevent double kill
		this._checkUpdatesEnd();
	}

	_checkUpdatesRead() {
		// Read the buffered output
		let updateList = [];
		let out, size;
		do {
			[out, size] = this._updateProcess_stream.read_line_utf8(null);
			if (out) updateList.push(out);
		} while (out);
		this._updateList = updateList;
		this._checkUpdatesEnd();
	}

	_checkUpdatesEnd() {
		// Free resources
		this._updateProcess_stream.close(null);
		this._updateProcess_stream = null;
		GLib.source_remove(this._updateProcess_sourceId);
		this._updateProcess_sourceId = null;
		this._updateProcess_pid = null;
		// Update indicator
		this._showChecking(false);
		if (DISABLE_PARSING) {
			this._updateStatus(this._updateList.length);
		} else {
			this._updateStatus(this._updateList.filter(function(line) { return RE_UpdateLine.test(line) }).length);
		}
	}

	_showNotification(title, message) {
		// Destroy previous notification if still there
		if (this._notification) {
			this._notification.destroy(MessageTray.NotificationDestroyedReason.REPLACED);
		}
		// Prepare a notification Source with our name and icon
		// It looks like notification Sources are destroyed when empty so we check every time
		if (this._notifSource == null) {
			// We have to prepare this only once
			this._notifSource = new MessageTray.Source({
				title: this._extension.metadata.name.toString(),
				icon: this._getCustIcon("arch-lit-symbolic"),
			});
			// Take care of not leaving unneeded sources
			this._notifSource.connect('destroy', ()=>{this._notifSource = null;});
			Main.messageTray.add(this._notifSource);
		}
		// Creates a new notification
		this._notification = new MessageTray.Notification({
			source: this._notifSource,
			title: title,
			body: message
		});
		this._notification.gicon = this._getCustIcon("arch-updates-symbolic");
		this._notification.addAction( _('Update now') , ()=>{this._updateNow();} );
		this._notification.connect('destroy', ()=>{this._notification = null;});
		this._notifSource.addNotification(this._notification);
	}

});

