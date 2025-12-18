import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const SubPage = GObject.registerClass({
    Properties: {
        'setting-string': GObject.ParamSpec.string(
            'setting-string', 'setting-string', 'setting-string',
            GObject.ParamFlags.READWRITE,
            ''),
        'list-type': GObject.ParamSpec.int(
            'list-type', 'list-type', 'list-type',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 1),
        'preferences-page': GObject.ParamSpec.boolean(
            'preferences-page', 'preferences-page', 'preferences-page',
            GObject.ParamFlags.READWRITE,
            true),
    },
},
class ArcMenuSubPage extends Adw.NavigationPage {
    _init(settings, params) {
        super._init({
            ...params,
        });
        this._settings = settings;

        this.headerBar = new Adw.HeaderBar();

        const sidebarToolBarView = new Adw.ToolbarView();

        if (this.preferences_page) {
            sidebarToolBarView.add_top_bar(this.headerBar);
            this.set_child(sidebarToolBarView);
            this.page = new PrefsPage();
            sidebarToolBarView.set_content(this.page);
        }

        this.restoreDefaultsButton = new Gtk.Button({
            icon_name: 'view-refresh-symbolic',
            tooltip_text: _('Reset settings'),
            css_classes: ['flat'],
        });
        this.restoreDefaultsButton.connect('clicked', () => {
            const dialog = new Gtk.MessageDialog({
                text: `<b>${_('Reset all %s settings?').format(this.title)}</b>`,
                secondary_text: _('All %s settings will be reset to the default value.').format(this.title),
                use_markup: true,
                buttons: Gtk.ButtonsType.YES_NO,
                message_type: Gtk.MessageType.WARNING,
                transient_for: this.get_root(),
                modal: true,
            });
            dialog.connect('response', (widget, response) => {
                if (response === Gtk.ResponseType.YES)
                    this.restoreDefaults();
                dialog.destroy();
            });
            dialog.show();
        });

        if (this.preferences_page)
            this.headerBar.pack_end(this.restoreDefaultsButton);
    }

    add(widget) {
        if (this.preferences_page)
            this.page.add(widget);
        else
            this.set_child(widget);
    }

    resetScrollAdjustment() {
        if (!this.preferences_page)
            return;

        const maybeScrolledWindowChild = [...this.page][0];

        if (maybeScrolledWindowChild instanceof Gtk.ScrolledWindow)
            maybeScrolledWindowChild.vadjustment.value = 0;
    }
});

var PrefsPage = GObject.registerClass(
class ArcMenuPrefsPage extends Adw.PreferencesPage {
    _init(params) {
        super._init(params);
        this.children = [];
    }

    add(page) {
        this.children.push(page);
        super.add(page);
    }
});
