const GObject = imports.gi.GObject;
const AppSystem = imports.gi.Shell.AppSystem;
const WindowTracker = imports.gi.Shell.WindowTracker;
const GLib = imports.gi.GLib;
const Me = imports.misc.extensionUtils.getCurrentExtension();

var AppManager = GObject.registerClass(
	class AppManager extends GObject.Object {
		_init(settings) {
			this._settings = settings;
		}

		leftClick(icon, event) {
			let trayApp = this._getTrayApp(icon);
			if (trayApp) {
				let focusedApp = WindowTracker.get_default().focusApp;
				let windows = trayApp.get_windows();

				if (windows == "") {
					return this._openApplication(trayApp, icon, event);
				}

				if (focusedApp != null && focusedApp.id == trayApp.id) {
					return this._minimizeWindows(focusedApp.get_windows(), icon, event);
				}

				return this._activateWindows(windows, trayApp, event);
			}

			icon.click(event);

			// On Windows double-click restore app
			if (this.isWine(icon)) {
				icon.click(event);
			}
		}

		middleClick(icon, event) {
			// When holding SHIFT
			if (event.get_state_full()[1] === 1) {
				let trayApp = this._getTrayApp(icon);
				if (trayApp) {
					const pid = this._getPid(icon);
					// Kill app
					if (this._isUsingQt(pid)) {
						return GLib.spawn_command_line_sync(`/bin/kill ${pid}`);
					}
					let windows = trayApp.get_windows();
					windows.forEach((window) => {
						window.kill();
					});
					trayApp.request_quit();
				}
			} else {
				icon.click(event);
			}
		}

		getAppSetting(icon, setting) {
			const iconApp = this._getTrayApp(icon);
			if (iconApp) {
				const appsSettings = JSON.parse(
					this._settings.get_string("applications")
				);
				const appSettings = appsSettings.find(
					(app) => app.id == iconApp.get_id()
				);

				return appSettings?.[setting];
			}
		}

		isWine(icon) {
			if (
				(icon.wm_class == "Wine" || icon.wm_class == "explorer.exe") &&
				this._settings.get_boolean("wine-behavior")
			) {
				return true;
			}
		}

		_getTrayApp(icon) {
			if (this.isWine(icon)) {
				const wineApps = AppSystem.get_default()
					.get_running()
					.filter((app) => {
						return app.get_windows()[0].wm_class.includes(".exe");
					});
				return wineApps[0];
			}

			const searchedApps = AppSystem.search(this._getWmClass(icon.wm_class));
			if (searchedApps[0] && searchedApps[0][0]) {
				var i = 1;
				for (let lookup of searchedApps[0]) {
					let app = AppSystem.get_default().lookup_app(lookup);
					if (app && (app.get_windows() != "" || i == searchedApps[0].length)) {
						return app;
					}
					i++;
				}
			}

			return false;
		}

		_openApplication(trayApp, icon, event) {
			const isFlatpak = trayApp.app_info.has_key("X-Flatpak");
			const onBlacklist = Me.metadata["open-blacklist"].includes(icon.wm_class); // Caprine
			if (this._isUsingQt(this._getPid(icon)) || isFlatpak || onBlacklist) {
				return icon.click(event);
			}

			return trayApp.open_new_window(0);
		}

		_minimizeWindows(windows, icon, event) {
			if (this._isUsingQt(this._getPid(icon))) {
				return icon.click(event);
			}

			windows.forEach((window) => {
				window.minimize();
			});
		}

		_activateWindows(windows, trayApp, event) {
			windows.forEach((window) => {
				if (this._settings.get_boolean("invoke-to-workspace")) {
					window.change_workspace(
						global.workspace_manager.get_active_workspace()
					);
				}
				trayApp.activate_window(window, event.get_time());
				window.unminimize();
			});
		}

		_isUsingQt(pid) {
			let [ok, out, err, exit] = GLib.spawn_command_line_sync(
				`/bin/bash -c 'pmap -p ${pid} | grep Qt'`
			);
			if (out.length) {
				return true;
			}
		}

		_getWmClass(wmclass) {
			wmclass = wmclass.replace(/[0-9]/g, ""); // skype discord
			wmclass = wmclass.replace("Desktop", ""); // telegram
			return wmclass;
		}

		_getPid(icon) {
			const wmclass = this._getWmClass(icon.wm_class);
			if (icon.title != "snixembed") {
				return icon.pid;
			}

			let [ok, out, err, exit] = GLib.spawn_command_line_sync(
				`/bin/bash -c "pidof -s ${wmclass}"`
			);
			if (out.length) {
				return Number(out);
			}
		}
	}
);
