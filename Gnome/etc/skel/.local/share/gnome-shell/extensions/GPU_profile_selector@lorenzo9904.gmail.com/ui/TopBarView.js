import St from 'gi://St';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import * as Utility from '../lib/Utility.js';


const ICON_SIZE = 6;
const ICON_INTEL_FILE_NAME = '/img/intel_icon_plain.svg';
const ICON_NVIDIA_FILE_NAME = '/img/nvidia_icon_plain.svg';
const ICON_HYBRID_FILE_NAME = '/img/hybrid_icon_plain.svg';


export const TopBarView = GObject.registerClass(
class TopBarView extends PanelMenu.Button {  
    _init(extensionObject) {
        super._init(0);
        this._all_settings = extensionObject.getSettings();
        this._extension_path = extensionObject.path;
    }

    enable() {
        this.icon_selector = new St.Icon({
            gicon : Gio.icon_new_for_string(this._extension_path + Utility.EXTENSION_ICON_FILE_NAME),
            style_class : 'system-status-icon',
            icon_size: ICON_SIZE
        });

        // init integrated GPU profile menu item and its click listeners
        this.integrated_menu_item = new PopupMenu.PopupMenuItem('Integrated');
        this.integrated_menu_item_id = this.integrated_menu_item.connect('activate', () => {
            // view stuff
            this.hybrid_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.remove_child(this.icon_selector);
            this.integrated_menu_item.add_child(this.icon_selector);
            this.remove_child(this.icon_top);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_INTEL_FILE_NAME),
                style_class: 'system-status-icon',
            });
            this.add_child(this.icon_top);
            // exec switch
            Utility.switchIntegrated();
        });

        // init hybrid GPU profile menu item and its click listeners
        this.hybrid_menu_item = new PopupMenu.PopupMenuItem('Hybrid');
        this.hybrid_menu_item_id = this.hybrid_menu_item.connect('activate', () => {
            // view stuff
            this.integrated_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.remove_child(this.icon_selector);
            this.hybrid_menu_item.add_child(this.icon_selector);
            this.remove_child(this.icon_top);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_HYBRID_FILE_NAME),
                style_class: 'system-status-icon',
            });
            this.add_child(this.icon_top);
            // exec switch
            Utility.switchHybrid(this._all_settings);
        });

        // init nvidia GPU profile menu item and its click listeners
        this.nvidia_menu_item = new PopupMenu.PopupMenuItem('Nvidia');
        this.nvidia_menu_item_id = this.nvidia_menu_item.connect('activate', () => {
            // view stuff
            this.integrated_menu_item.remove_child(this.icon_selector);
            this.hybrid_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.add_child(this.icon_selector);
            this.remove_child(this.icon_top);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_NVIDIA_FILE_NAME),
                style_class: 'system-status-icon',
            });
            this.add_child(this.icon_top);
            // exec switch
            Utility.switchNvidia(this._all_settings);
        });

        // add all menu item to power menu
        this.separator_menu_item = new PopupMenu.PopupSeparatorMenuItem();
        this.menu.addMenuItem(this.separator_menu_item);
        this.menu.addMenuItem(this.integrated_menu_item);
        this.menu.addMenuItem(this.hybrid_menu_item);
        this.menu.addMenuItem(this.nvidia_menu_item);

        // check GPU profile
        const gpu_profile = Utility.getCurrentProfile();
        if (gpu_profile === Utility.GPU_PROFILE_INTEGRATED) {
            this.hybrid_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.remove_child(this.icon_selector);
            this.integrated_menu_item.add_child(this.icon_selector);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_INTEL_FILE_NAME),
                style_class: 'system-status-icon',
            });
        } else if(gpu_profile === Utility.GPU_PROFILE_HYBRID) {
            this.integrated_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.remove_child(this.icon_selector);
            this.hybrid_menu_item.add_child(this.icon_selector);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_HYBRID_FILE_NAME),
                style_class: 'system-status-icon',
            });
        } else {
            this.integrated_menu_item.remove_child(this.icon_selector);
            this.hybrid_menu_item.remove_child(this.icon_selector);
            this.nvidia_menu_item.add_child(this.icon_selector);
            this.icon_top = new St.Icon({
                gicon : Gio.icon_new_for_string(this._extension_path + ICON_NVIDIA_FILE_NAME),
                style_class: 'system-status-icon',
            });
        }
        this.add_child(this.icon_top);
    }

    disable() {
        if (this.integrated_menu_item_id) {
            this.integrated_menu_item.disconnect(this.integrated_menu_item_id);
            this.integrated_menu_item_id = 0;
        }
        this.integrated_menu_item.destroy();
        this.integrated_menu_item = null;

        if (this.hybrid_menu_item_id) {
            this.hybrid_menu_item.disconnect(this.hybrid_menu_item_id);
            this.hybrid_menu_item_id = 0;
        }
        this.hybrid_menu_item.destroy();
        this.hybrid_menu_item = null;

        if (this.nvidia_menu_item_id) {
            this.nvidia_menu_item.disconnect(this.nvidia_menu_item_id);
            this.nvidia_menu_item_id = 0;
        }
        this.nvidia_menu_item.destroy();
        this.nvidia_menu_item = null;

        this.separator_menu_item.destroy();
        this.separator_menu_item = null;

        this.icon_selector = null;
    }
});
