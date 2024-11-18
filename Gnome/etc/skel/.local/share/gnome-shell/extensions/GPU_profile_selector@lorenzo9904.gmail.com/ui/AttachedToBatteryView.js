import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GObject from 'gi://GObject';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as QuickSettings from 'resource:///org/gnome/shell/ui/quickSettings.js';

import * as Utility from '../lib/Utility.js';


export const AttachedToBatteryToggle = GObject.registerClass(
class AttachedToBatteryToggle extends QuickSettings.QuickMenuToggle {
    _init(extensionObject) {
        super._init({
            title: Utility.capitalizeFirstLetter(Utility.getCurrentProfile()),
            iconName: 'selection-mode-symbolic',
            toggleMode: false, // disable the possibility to click the button
        });
        this.all_settings = extensionObject.getSettings();
        
        // This function is unique to this class. It adds a nice header with an icon, title and optional subtitle.
        this.menu.setHeader('selection-mode-symbolic', Utility.capitalizeFirstLetter(Utility.getCurrentProfile()), 'Choose a GPU mode');
        
        // add a sections of items to the menu
        this._itemsSection = new PopupMenu.PopupMenuSection();
        this._itemsSection.addAction('Nvidia', () => {
            Utility.switchNvidia(this.all_settings);
            super.title = 'Nvidia'
            this.menu.setHeader('selection-mode-symbolic', 'Nvidia (Reboot needed)', 'Choose a GPU mode');
        });
        this._itemsSection.addAction('Hybrid', () => {
            Utility.switchHybrid(this.all_settings);
            super.title = 'Hybrid'
            this.menu.setHeader('selection-mode-symbolic', 'Hybrid (Reboot needed)', 'Choose a GPU mode');
        });
        this._itemsSection.addAction('Integrated', () => {
            Utility.switchIntegrated();
            super.title = 'Integrated'
            this.menu.setHeader('selection-mode-symbolic', 'Integrated (Reboot needed)', 'Choose a GPU mode');
        });
        this.menu.addMenuItem(this._itemsSection);

        // Add an entry-point for more settings
        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
        const settingsItem = this.menu.addAction('More Settings',
            () => extensionObject.openPreferences());
            
        // Ensure the settings are unavailable when the screen is locked
        settingsItem.visible = Main.sessionMode.allowSettings;
        this.menu._settingsActions[extensionObject.uuid] = settingsItem;
    }
});

export const AttachedToBatteryView = GObject.registerClass(
class AttachedToBatteryView extends QuickSettings.SystemIndicator {
    _init(extensionObject) {
        super._init();
    }

    enable() {
        this._indicator = this._addIndicator();
        this._indicator.icon_name = 'selection-mode-symbolic' //Gio.icon_new_for_string(Me.dir.get_path() + Utility.ICON_SELECTOR_FILE_NAME);
        this._indicator.visible = false;
    }

    disable() {
        this.quickSettingsItems.forEach(item => item.destroy());
        this._indicator.destroy();
        super.destroy();
    }
});
