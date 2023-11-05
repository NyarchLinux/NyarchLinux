import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import * as PW from '../../prefsWidgets.js';
import {SubPage} from './SubPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const LayoutsPage = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
},
class ArcMenuLayoutsPage extends SubPage {
    _init(settings, params) {
        super._init(settings, params);

        this.restoreDefaultsButton.visible = false;

        const currentLayoutGroup = new Adw.PreferencesGroup({
            title: _('Current Menu Layout'),
        });

        const menuLayoutInfo = this.getMenuLayoutInfo(this._settings.get_enum('menu-layout'));

        const currentLayoutName = menuLayoutInfo.TITLE;
        const currentLayoutImagePath = menuLayoutInfo.IMAGE;

        const currentLayoutBoxRow = new CurrentLayoutRow(currentLayoutName, currentLayoutImagePath);
        currentLayoutGroup.add(currentLayoutBoxRow);

        this.add(currentLayoutGroup);

        const menuLayoutGroup = new Adw.PreferencesGroup({
            title: _('Choose a new menu layout?'),
        });
        this.add(menuLayoutGroup);

        Constants.MenuStyles.forEach(style => {
            const tile = new Adw.ExpanderRow({
                title: _('%s Menu Layouts').format(_(style.TITLE)),
                icon_name: style.IMAGE,
            });
            tile.layout = style.MENU_TYPE;

            menuLayoutGroup.add(tile);

            const layoutsBox = new LayoutsBox(this._settings, tile);

            if (layoutsBox.selectedLayout)
                this.activeLayoutBox = layoutsBox;

            const row = new Gtk.ListBoxRow({
                selectable: false,
                activatable: false,
            });
            row.set_child(layoutsBox);
            layoutsBox.connect('menu-selected', (widget, response) => {
                if (response === Gtk.ResponseType.OK) {
                    this._settings.set_enum('menu-layout', widget.menuLayout);
                    this.activeLayoutBox.clearSelection();

                    this.activeLayoutBox = widget;
                    this.activeLayoutBox.applySelection();
                    this.selectedMenuLayout = widget.menuLayout;

                    const newMenuLayoutInfo = this.getMenuLayoutInfo(this.selectedMenuLayout);

                    currentLayoutBoxRow.label.label = newMenuLayoutInfo.TITLE;
                    currentLayoutBoxRow.image.gicon = Gio.icon_new_for_string(newMenuLayoutInfo.IMAGE);

                    this.expandedRow.expanded = false;
                    this.emit('response', Gtk.ResponseType.APPLY);
                }
            });
            tile.connect('notify::expanded', () => {
                if (this.expandedRow && this.expandedRow !== tile)
                    this.expandedRow.expanded = false;

                this.expandedRow = tile;
            });
            tile.add_row(row);
        });
    }

    getMenuLayoutInfo(index) {
        for (const styles of Constants.MenuStyles) {
            for (const style of styles.MENU_TYPE) {
                if (style.LAYOUT === index)
                    return style;
            }
        }
        return null;
    }
});

var LayoutsBox = GObject.registerClass({
    Signals: {
        'menu-selected': {param_types: [GObject.TYPE_INT]},
    },
},  class ArcMenuLayoutsBox extends PW.IconGrid {
    _init(settings, tile) {
        super._init();

        this._settings = settings;
        this.layoutStyle = tile.layout;
        this.styles = tile.layout;

        // clamp max children per line. min = 1, max = 3;
        this.max_children_per_line = Math.min(Math.max(tile.layout.length, 1), 3);

        this.connect('child-activated', () => {
            const currentMenuLayout = this._settings.get_enum('menu-layout');
            const selectedChildren = this.get_selected_children();
            const selectedLayout = selectedChildren[0];

            if (currentMenuLayout === selectedLayout.layout)
                return;

            this.selectedLayout = selectedLayout;
            this.menuLayout = selectedLayout.layout;

            this.emit('menu-selected', Gtk.ResponseType.OK);
        });

        this.styles.forEach(style => {
            const currentMenuLayout = this._settings.get_enum('menu-layout');
            const layoutTile = new PW.MenuLayoutTile(style);
            this.add(layoutTile);

            if (currentMenuLayout === style.LAYOUT) {
                this.selectedLayout = layoutTile;
                this.applySelection();
            }
        });
    }

    clearSelection() {
        const currentMenuLayout = this._settings.get_enum('menu-layout');
        this.unselect_all();

        if (this.selectedLayout && currentMenuLayout !== this.selectedLayout.layout)
            this.selectedLayout = null;
    }

    applySelection() {
        if (this.selectedLayout)
            this.select_child(this.selectedLayout);
    }
});

var CurrentLayoutRow = GObject.registerClass(
class ArcMenuMenuLayoutRow extends Gtk.Box {
    _init(title, imagePath, layout) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ['card'],
            hexpand: false,
            spacing: 0,
            halign: Gtk.Align.CENTER,
        });

        if (layout)
            this.layout = layout.MENU_TYPE;

        const box = new Gtk.Box({
            margin_start: 15,
            margin_end: 15,
            margin_top: 8,
            margin_bottom: 8,
            orientation: Gtk.Orientation.VERTICAL,
            hexpand: false,
        });

        this.image = new Gtk.Image({
            hexpand: false,
            halign: Gtk.Align.CENTER,
            gicon: Gio.icon_new_for_string(imagePath),
            pixel_size: 145,
        });

        this.label = new Gtk.Label({
            label: _(title),
            hexpand: true,
            halign: Gtk.Align.CENTER,
            vexpand: false,
            valign: Gtk.Align.START,
            css_classes: ['heading'],
        });

        box.append(this.image);
        box.append(this.label);

        this.append(box);
    }
});
