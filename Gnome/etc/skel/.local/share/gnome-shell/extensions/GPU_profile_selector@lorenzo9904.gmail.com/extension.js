import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Extension from 'resource:///org/gnome/shell/extensions/extension.js';

import * as TopBarView from './ui/TopBarView.js';
import * as AttachedToBatteryView from './ui/AttachedToBatteryView.js';


export default class GpuSelector extends Extension.Extension {
    enable() {
        let all_settings = this.getSettings();
        // Deprecated: if there is no battery, there is no power management panel, so the extension moves to TopBar
        // if (Utility.isBatteryPlugged() && all_settings.get_boolean("force-topbar-view") !== true) {
        if (all_settings.get_boolean("force-topbar-view") !== true) {
            // init the indicator object
            this._indicator = new AttachedToBatteryView.AttachedToBatteryView(this);
            // add the toggle items to indicator
            this._indicator.quickSettingsItems.push(new AttachedToBatteryView.AttachedToBatteryToggle(this));
            // Add to status area in quicksettings panel
            Main.panel.statusArea.quickSettings.addExternalIndicator(this._indicator);
        } else {
            // init the indicator object
            this._indicator = new TopBarView.TopBarView(this);
            // Add to status area panel
            Main.panel.addToStatusArea("GPU_SELECTOR", this._indicator, 1);
        }
        // enable indicator
        this._indicator.enable();
    }

    disable() {
        this._indicator.disable();
        this._indicator.destroy();
        this._indicator = null;
    }
}
