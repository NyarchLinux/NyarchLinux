import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import * as Constants from '../../constants.js';
import {getMenuLayoutInfo} from '../settingsUtils.js';
import {SubPage} from './subPage.js';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const LayoutsPage = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
},
class ArcMenuLayoutsPage extends SubPage {
    _init(extension, settings, params) {
        super._init(extension, settings, params);

        this.restoreDefaultsButton.visible = false;

        const currentLayoutGroup = new Adw.PreferencesGroup({
            title: _('Current Menu Layout'),
        });

        const layoutInfo = getMenuLayoutInfo(this._settings.get_string('menu-layout'));
        const currentLayoutName = layoutInfo.name;
        const currentLayoutImagePath = `menu-${layoutInfo.id}-symbolic`;

        const currentLayoutBoxRow = new CurrentLayoutRow(currentLayoutName, currentLayoutImagePath);
        currentLayoutGroup.add(currentLayoutBoxRow);

        this.add(currentLayoutGroup);

        const menuLayoutGroup = new Adw.PreferencesGroup({
            title: _('Choose a new menu layout?'),
        });
        this.add(menuLayoutGroup);

        Constants.LayoutCategoriesInfo.forEach(layoutCategory => {
            const layoutsInfo = Constants.MenuLayoutsInfo.filter(layout => layout.category === layoutCategory.id);

            const tile = new Adw.ExpanderRow({
                title: _('%s Menu Layouts').format(_(layoutCategory.name)),
                icon_name: layoutCategory.icon,
            });

            menuLayoutGroup.add(tile);

            const layoutsBox = new LayoutCategoryBox(this._settings, layoutsInfo);

            if (layoutsBox.selectedChild)
                this.activeLayoutBox = layoutsBox;

            const row = new Gtk.ListBoxRow({
                selectable: false,
                activatable: false,
            });
            row.set_child(layoutsBox);
            layoutsBox.connect('menu-selected', (widget, response) => {
                if (response === Gtk.ResponseType.OK) {
                    this._settings.set_string('menu-layout', widget.menuLayout);
                    this.activeLayoutBox.clearSelection();

                    this.activeLayoutBox = widget;
                    this.activeLayoutBox.applySelection();
                    this.selectedMenuLayout = widget.menuLayout;

                    const newLayoutInfo = getMenuLayoutInfo(this.selectedMenuLayout);
                    currentLayoutBoxRow.label.label = newLayoutInfo.name;
                    currentLayoutBoxRow.image.gicon = Gio.Icon.new_for_string(`menu-${newLayoutInfo.id}-symbolic`);

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
});

const LayoutCategoryBox = GObject.registerClass({
    Signals: {
        'menu-selected': {param_types: [GObject.TYPE_INT]},
    },
}, class ArcMenuLayoutCategoryBox extends Gtk.FlowBox {
    _init(settings, layoutsInfo) {
        super._init({
            max_children_per_line: 15,
            row_spacing: 4,
            column_spacing: 4,
            valign: Gtk.Align.START,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            selection_mode: Gtk.SelectionMode.SINGLE,
        });
        this._settings = settings;

        // clamp max children per line. min = 1, max = 3;
        this.max_children_per_line = Math.min(Math.max(layoutsInfo.length, 1), 3);

        this.connect('child-activated', (_self, child) => {
            this.setActiveChild(child);
            const menuLayout = this._settings.get_string('menu-layout');
            const selectedChildren = this.get_selected_children();
            const selectedChild = selectedChildren[0];

            if (menuLayout === selectedChild.layoutId)
                return;

            this.selectedChild = selectedChild;
            this.menuLayout = selectedChild.layoutId;

            this.emit('menu-selected', Gtk.ResponseType.OK);
        });

        layoutsInfo.forEach(layout => {
            const menuLayout = this._settings.get_string('menu-layout');
            const layoutTile = new MenuLayoutTile(layout);
            this.add(layoutTile);

            if (menuLayout === layout.id) {
                this.selectedChild = layoutTile;
                this.applySelection();
            }
        });
    }

    clearSelection() {
        const menuLayout = this._settings.get_string('menu-layout');
        this.unselect_all();

        if (this.selectedChild && menuLayout !== this.selectedChild.layoutId)
            this.selectedChild = null;
    }

    applySelection() {
        if (this.selectedChild)
            this.select_child(this.selectedChild);
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
    }
});

const CurrentLayoutRow = GObject.registerClass(
class ArcMenuMenuLayoutRow extends Gtk.Box {
    _init(title, imagePath) {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            css_classes: ['card'],
            hexpand: false,
            spacing: 0,
            halign: Gtk.Align.CENTER,
        });

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
    _init(layoutInfo) {
        super._init({
            css_classes: ['card', 'activatable'],
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4,
            halign: Gtk.Align.FILL,
            hexpand: true,
        });

        this.layoutId = layoutInfo.id;

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 8,
            margin_end: 8,
        });
        this.set_child(box);

        this._image = new Gtk.Image({
            gicon: Gio.Icon.new_for_string(`menu-${this.layoutId}-symbolic`),
            pixel_size: 145,
        });

        this._label = new Gtk.Label({
            label: _(layoutInfo.name),
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

