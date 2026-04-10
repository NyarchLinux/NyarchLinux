import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import {SubPage} from './subPage.js';

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
                    currentLayoutBoxRow.image.gicon = Gio.Icon.new_for_string(newMenuLayoutInfo.IMAGE);

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

const LayoutsBox = GObject.registerClass({
    Signals: {
        'menu-selected': {param_types: [GObject.TYPE_INT]},
    },
},  class ArcMenuLayoutsBox extends Gtk.FlowBox {
    _init(settings, tile) {
        super._init({
            max_children_per_line: 15,
            row_spacing: 4,
            column_spacing: 4,
            valign: Gtk.Align.START,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            selection_mode: Gtk.SelectionMode.SINGLE,
        });
        this.childrenCount = 0;
        this._settings = settings;
        this.layoutStyle = tile.layout;
        this.styles = tile.layout;

        // clamp max children per line. min = 1, max = 3;
        this.max_children_per_line = Math.min(Math.max(tile.layout.length, 1), 3);

        this.connect('child-activated', (_self, child) => {
            this.setActiveChild(child);
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
            const layoutTile = new MenuLayoutTile(style);
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

    setActiveChild(child) {
        if (this._previousSelectedChild)
            this._previousSelectedChild.setActive(false);

        child.setActive(true);
        this._previousSelectedChild = child;
    }

    unselect_all() {
        if (this._previousSelectedChild)
            this._previousSelectedChild.setActive(false);
        super.unselect_all();
    }

    select_child(child) {
        this.setActiveChild(child);
        super.select_child(child);
    }

    add(widget) {
        widget.margin_top = widget.margin_bottom =
                widget.margin_start = widget.margin_end = 4;

        this.append(widget);
        this.childrenCount++;
    }
});

const CurrentLayoutRow = GObject.registerClass(
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
            gicon: Gio.Icon.new_for_string(imagePath),
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

const MenuLayoutTile = GObject.registerClass(class ArcMenuMenuLayoutTile extends Gtk.FlowBoxChild {
    _init(styleInfo) {
        super._init({
            css_classes: ['card', 'activatable'],
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4,
            halign: Gtk.Align.FILL,
            hexpand: true,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 8,
            margin_end: 8,
        });
        this.set_child(box);

        this.name = styleInfo.TITLE;
        this.layout = styleInfo.LAYOUT;

        this._image = new Gtk.Image({
            gicon: Gio.Icon.new_for_string(styleInfo.IMAGE),
            pixel_size: 145,
        });

        this._label = new Gtk.Label({
            label: _(this.name),
            hexpand: true,
            css_classes: ['caption'],
        });

        box.append(this._image);
        box.append(this._label);
    }

    setActive(active) {
        if (active) {
            this._image.css_classes = ['accent'];
            this._label.css_classes = ['caption', 'accent'];
        } else {
            this._image.css_classes = [];
            this._label.css_classes = ['caption'];
        }
    }
});

