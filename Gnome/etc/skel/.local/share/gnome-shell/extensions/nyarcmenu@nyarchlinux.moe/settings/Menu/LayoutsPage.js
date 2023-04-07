/* exported LayoutsPage */
const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const {Adw, Gio, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const PW = Me.imports.prefsWidgets;
const _ = Gettext.gettext;

const Settings = Me.imports.settings;
const {SubPage} = Settings.Menu.SubPage;

var LayoutsPage = GObject.registerClass({
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
        const currentLayoutName = this.getMenuLayoutName(this._settings.get_enum('menu-layout'));
        const currentLayoutImagePath = this.getMenuLayoutImagePath(this._settings.get_enum('menu-layout'));

        const currentLayoutBoxRow = new CurrentLayoutRow(currentLayoutName, currentLayoutImagePath);

        currentLayoutGroup.add(currentLayoutBoxRow);
        this.add(currentLayoutGroup);

        const menuLayoutGroup = new Adw.PreferencesGroup({
            title: _('Choose a new menu layout?'),
        });
        this.add(menuLayoutGroup);

        Constants.MenuStyles.STYLES.forEach(style => {
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

                    currentLayoutBoxRow.label.label = this.getMenuLayoutName(this.selectedMenuLayout);
                    currentLayoutBoxRow.image.gicon =
                        Gio.icon_new_for_string(this.getMenuLayoutImagePath(this.selectedMenuLayout));
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

    getMenuLayoutName(index) {
        for (const styles of Constants.MenuStyles.STYLES) {
            for (const style of styles.MENU_TYPE) {
                if (style.LAYOUT === index)
                    return _(style.TITLE);
            }
        }
        return '';
    }

    getMenuLayoutTweaksName(index) {
        for (const styles of Constants.MenuStyles.STYLES) {
            for (const style of styles.MENU_TYPE) {
                if (style.LAYOUT === index)
                    return _('%s Layout Tweaks').format(_(style.TITLE));
            }
        }
        return '';
    }

    getMenuLayoutImagePath(index) {
        for (const styles of Constants.MenuStyles.STYLES) {
            for (const style of styles.MENU_TYPE) {
                if (style.LAYOUT === index)
                    return style.IMAGE;
            }
        }
        return '';
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

            this.selectedLayout?.setActive(false);
            this.selectedLayout = selectedLayout;
            this.menuLayout = selectedLayout.layout;

            this.emit('menu-selected', Gtk.ResponseType.OK);
        });

        this.styles.forEach(style => {
            const currentMenuLayout = this._settings.get_enum('menu-layout');
            const layoutTile = new PW.MenuLayoutTile(style.TITLE, style.IMAGE, style.LAYOUT);
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

        if (this.selectedLayout && currentMenuLayout !== this.selectedLayout.layout) {
            this.selectedLayout.setActive(false);
            this.selectedLayout = null;
        }
    }

    applySelection() {
        if (this.selectedLayout) {
            this.select_child(this.selectedLayout);
            this.selectedLayout.setActive(true);
        }
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
            pixel_size: 125,
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
