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

const Clutter = imports.gi.Clutter;

const St = imports.gi.St;
const GObject = imports.gi.GObject;
const GLib = imports.gi.GLib;
const Gio = imports.gi.Gio;
const Gtk = imports.gi.Gtk;

const Main = imports.ui.main;
const Panel = imports.ui.panel;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const MessageTray = imports.ui.messageTray;

const Util = imports.misc.util;
const ExtensionUtils = imports.misc.extensionUtils;
const ExtensionManager = imports.ui.main.extensionManager;
const Me = ExtensionUtils.getCurrentExtension();

const Format = imports.format;
const Gettext = imports.gettext.domain('arch-update');
const _ = Gettext.gettext;

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
let TRANSIENT          = true;
let UPDATE_CMD         = "gnome-terminal -- /bin/sh -c \"sudo pacman -Syu ; echo Done - Press enter to exit; read _\" ";
let CHECK_CMD          = "/usr/bin/checkupdates";
let MANAGER_CMD        = "";
let PACMAN_DIR         = "/var/lib/pacman/local";
let STRIP_VERSIONS     = false;
let STRIP_VERSIONS_N   = true;
let AUTO_EXPAND_LIST   = 0;
let DISABLE_PARSING    = false;

/* Variables we want to keep when extension is disabled (eg during screen lock) */
let FIRST_BOOT         = 1;
let UPDATES_PENDING    = -1;
let UPDATES_LIST       = [];


function init() {
	String.prototype.format = Format.format;
	ExtensionUtils.initTranslations("arch-update");
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
class ArchUpdateIndicator extends PanelMenu.Button {

	_init() {
		super._init(0);
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
		this.menuExpander.menu.box.style_class = 'arch-updates-list';

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
		this.checkingMenuItem.actor.add_actor( checkingLabel );
		this.checkingMenuItem.actor.add_actor( cancelButton  );

		// A little trick on "check now" menuitem to keep menu opened
		this.checkNowMenuItem = new PopupMenu.PopupMenuItem( _('Check now') );
		this.checkNowMenuContainer = new PopupMenu.PopupMenuSection();
		this.checkNowMenuContainer.actor.add_actor(this.checkNowMenuItem.actor);

		// Assemble all menu items into the popup menu
		this.menu.addMenuItem(this.menuExpander);
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
		this.menu.addMenuItem(this.updateNowMenuItem);
		this.menu.addMenuItem(this.checkingMenuItem);
		this.menu.addMenuItem(this.checkNowMenuContainer);
		this.menu.addMenuItem(this.managerMenuItem);
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

		// Restore previous updates list if any
		this._updateList = UPDATES_LIST;

		// Load settings
		this._settings = ExtensionUtils.getSettings('org.gnome.shell.extensions.arch-update');
		this._settings.connect('changed', this._positionChanged.bind(this));
		this._settingsChangedId = this._settings.connect('changed', this._applySettings.bind(this));
		this._applySettings();

		// Start monitoring external changes
		this._startFolderMonitor();

		if (FIRST_BOOT) {
			// Schedule first check only if this is the first extension load
			// This won't be run again if extension is disabled/enabled (like when screen is locked)
			let that = this;
			this._FirstTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, BOOT_WAIT, function () {
				that._checkUpdates();
				that._FirstTimeoutId = null;
				FIRST_BOOT = 0;
				return false; // Run once
			});
		}

	}

	_getCustIcon(icon_name) {
		// I did not find a way to lookup icon via Gio, so use Gtk
		// I couldn't find why, but get_default is sometimes null, hence this additional test
		// TODO : Maybe switch to St.IconTheme
		// https://gjs.guide/extensions/upgrading/gnome-shell-44.html#gtk-icontheme
		// https://gjs-docs.gnome.org/st12~12/st.icontheme
		if (!USE_BUILDIN_ICONS && St.Settings.get().gtk_icon_theme) {
			let theme = new Gtk.IconTheme();
			theme.set_theme_name( St.Settings.get().gtk_icon_theme );

			if (theme.has_icon(icon_name)) {
				return Gio.icon_new_for_string( icon_name );
			}
		}
		// Icon not available in theme, or user prefers built in icon
		return Gio.icon_new_for_string( Me.dir.get_child('icons').get_path() + "/" + icon_name + ".svg" );
	}

	_positionChanged(){
		if (this._settings.get_boolean('enable-positioning')) {
			this.container.get_parent().remove_actor(this.container);
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
		ExtensionUtils.openPrefs();
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
		TRANSIENT = this._settings.get_boolean('transient');
		UPDATE_CMD = this._settings.get_string('update-cmd');
		CHECK_CMD = this._settings.get_string('check-cmd');
		DISABLE_PARSING = this._settings.get_boolean('disable-parsing');
		MANAGER_CMD = this._settings.get_string('package-manager');
		PACMAN_DIR = this._settings.get_string('pacman-dir');
		STRIP_VERSIONS = this._settings.get_boolean('strip-versions');
		STRIP_VERSIONS_N = this._settings.get_boolean('strip-versions-in-notification');
		AUTO_EXPAND_LIST = this._settings.get_int('auto-expand-list');
		this.managerMenuItem.actor.visible = ( MANAGER_CMD != "" );
		this._checkShowHide();
		this._updateStatus();
		let that = this;
		if (this._TimeoutId) GLib.source_remove(this._TimeoutId);
		this._TimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, CHECK_INTERVAL, function () {
			that._checkUpdates();
			return true;
		});
	}

	destroy() {
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
		if (PACMAN_DIR) {
			this.pacman_dir = Gio.file_new_for_path(PACMAN_DIR);
			this.monitor = this.pacman_dir.monitor_directory(0, null);
			this.monitor.connect('changed', this._onFolderChanged.bind(this));
		}
	}

	_onFolderChanged() {
		// Folder have changed ! Let's schedule a check in a few seconds
		let that = this;
		if (this._FirstTimeoutId) GLib.source_remove(this._FirstTimeoutId);
		this._FirstTimeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 5, function () {
			that._checkUpdates();
			that._FirstTimeoutId = null;
			return false;
		});
	}

	_showChecking(isChecking) {
		if (isChecking == true) {
			this.updateIcon.set_gicon( this._getCustIcon('arch-unknown-symbolic') );
			this.checkNowMenuContainer.actor.visible = false;
			this.checkingMenuItem.actor.visible = true;;
		} else {
			this.checkNowMenuContainer.actor.visible = true;;
			this.checkingMenuItem.actor.visible = false;;
		}
	}

	_updateStatus(updatesCount) {
		updatesCount = typeof updatesCount === 'number' ? updatesCount : UPDATES_PENDING;
		if (updatesCount > 0) {
			// Updates pending
			this.updateIcon.set_gicon( this._getCustIcon('arch-updates-symbolic') );
			this._updateMenuExpander( true, Gettext.ngettext( "%d update pending", "%d updates pending", updatesCount ).format(updatesCount) );
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
							Gettext.ngettext( "New Arch Linux Update", "New Arch Linux Updates", updateList.length ),
							updateList.join(', ')
						);
					}
				} else {
					this._showNotification(
						Gettext.ngettext( "New Arch Linux Update", "New Arch Linux Updates", updatesCount ),
						Gettext.ngettext( "There is %d update pending", "There are %d updates pending", updatesCount ).format(updatesCount)
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
		this.menuExpander.menu.box.destroy_all_children();
		if (label == "") {
			// No text, hide the menuitem
			this.menuExpander.actor.visible = false;
		} else {
		// We make our expander look like a regular menu label if disabled
			this.menuExpander.actor.reactive = enabled;
			this.menuExpander._triangle.visible = enabled;
			this.menuExpander.label.set_text(label);
			this.menuExpander.actor.visible = true;
			if (enabled && this._updateList.length > 0) {
				this._updateList.forEach( item => {
					if(DISABLE_PARSING) {
						var menutext = item;
						if (STRIP_VERSIONS) {
							var chunks = menutext.split(" ",2);
							menutext = chunks[0];
						}
						this.menuExpander.menu.box.add( new St.Label({ text: menutext }) );
					} else {
						let matches = item.match(RE_UpdateLine);
						if (matches == null) {
							// Not an update
							this.menuExpander.menu.box.add( new St.Label({ text: item, style_class: 'arch-updates-update-title' }) );
						} else {
							let hBox = new St.BoxLayout({ vertical: false });
							hBox.add_child( new St.Label({
								text: matches[1],
								x_expand: true,
								style_class: 'arch-updates-update-name' }) );
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
							this.menuExpander.menu.box.add_child( hBox );
						}
					}
				} );
			}
		}
		// 'Update now' visibility is linked so let's save a few lines and set it here
		this.updateNowMenuItem.actor.reactive = enabled;
	}

	_checkUpdates() {
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
				base_stream: new Gio.UnixInputStream({fd: out_fd})
			});
			// We will process the output at once when it's done
			this._updateProcess_sourceId = GLib.child_watch_add(0, pid, () => {this._checkUpdatesRead()} );
			this._updateProcess_pid = pid;
		} catch (err) {
			this._showChecking(false);
			this.lastUnknowErrorString = err.message.toString();
			this._updateStatus(-2);
		}
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
		if (this._notifSource == null) {
			// We have to prepare this only once
			this._notifSource = new MessageTray.SystemNotificationSource();
			this._notifSource.createIcon = function() {
				let gicon = Gio.icon_new_for_string( Me.dir.get_child('icons').get_path() + "/arch-updates-logo.svg" );
				return new St.Icon({ gicon: gicon });
			};
			// Take care of note leaving unneeded sources
			this._notifSource.connect('destroy', ()=>{this._notifSource = null;});
			Main.messageTray.add(this._notifSource);
		}
		let notification = null;
		// We do not want to have multiple notifications stacked
		// instead we will update previous
		if (this._notifSource.notifications.length == 0) {
			notification = new MessageTray.Notification(this._notifSource, title, message);
			notification.addAction( _('Update now') , ()=>{this._updateNow();} );
		} else {
			notification = this._notifSource.notifications[0];
			notification.update( title, message, { clear: true });
		}
		notification.setTransient(TRANSIENT);
		this._notifSource.showNotification(notification);
	}

});

let archupdateindicator;

function enable() {
	archupdateindicator = new ArchUpdateIndicator();
	Main.panel.addToStatusArea('ArchUpdateIndicator', archupdateindicator);
	archupdateindicator._positionChanged();
}

function disable() {
	archupdateindicator.destroy();
	archupdateindicator = null;
}
