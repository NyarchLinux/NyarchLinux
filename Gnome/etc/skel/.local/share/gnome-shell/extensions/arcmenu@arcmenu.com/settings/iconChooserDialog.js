import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {HeaderBarDialog} from '../prefsWidgets.js';

import {ExtensionPreferences, gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const IconGroup = Object.freeze({
    ALL: 0,
    EXTENSION: 1,
    DISTRO: 2,
    SYSTEM: 3,
});

const IconGroupFromString = Object.freeze({
    'all': IconGroup.ALL,
    'extension': IconGroup.EXTENSION,
    'distro': IconGroup.DISTRO,
    'system': IconGroup.SYSTEM,
});

const IconType = Object.freeze({
    ALL: 0,
    SYMBOLIC: 1,
    FULL_COLOR: 2,
});

const IconTypeFromString = Object.freeze({
    'all': IconType.ALL,
    'symbolic': IconType.SYMBOLIC,
    'fullcolor': IconType.FULL_COLOR,
});

export class IconChooserDialog extends HeaderBarDialog {
    static {
        GObject.registerClass(this);
    }

    constructor(settings, parent) {
        super(_('Select an Icon'), _('Select'), parent);
        this._settings = settings;
        this.set_default_size(540, 620);
        this.iconString = '';
        this._searchQuery = '';
        this._groupType = IconGroup.ALL;
        this._iconType = IconType.ALL;

        const topBox = new Gtk.Box({
            css_classes: ['linked'],
            margin_bottom: 12,
        });

        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: _('Search icons…'),
            search_delay: 300,
            hexpand: true,
        });
        topBox.append(searchEntry);

        const filtersButton = this._createFiltersButton();
        topBox.append(filtersButton);

        this.pageGroup.add(topBox);

        this._iconsListStore = new Gio.ListStore();
        this._filter = new Gtk.CustomFilter();

        const searchFilterModel = new Gtk.FilterListModel({
            model: this._iconsListStore,
            filter: this._filter,
        });

        const selection = new Gtk.SingleSelection({
            model: searchFilterModel,
            autoselect: false,
        });

        const factory = new Gtk.SignalListItemFactory();
        factory.connect('setup', this._setupItem.bind(this));
        factory.connect('bind', this._bindItem.bind(this));

        this._iconsGridView = new Gtk.GridView({
            model: selection,
            factory,
            max_columns: 9,
            min_columns: 4,
            css_classes: ['card'],
        });

        const scrolled = new Gtk.ScrolledWindow({
            child: this._iconsGridView,
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
        });
        this.pageGroup.add(scrolled);

        const fileChooserButton = new Gtk.Button({
            label: _('Browse Files...'),
            valign: Gtk.Align.CENTER,
            margin_top: 12,
        });
        fileChooserButton.connect('clicked', () => this._launchFileChooser());
        this.pageGroup.add(fileChooserButton);

        searchEntry.connect('search-changed', () => {
            this._searchQuery = searchEntry.text.trim().toLowerCase();
            this._updateFilter();
        });

        this._updateFilter();

        const provider = new Gtk.CssProvider();
        provider.load_from_string(`
            gridview.icon-grid > child { margin: 2px; }
            gridview.icon-grid { padding: 2px; }
        `);
        Gtk.StyleContext.add_provider_for_display(
            Gdk.Display.get_default(),
            provider,
            Gtk.STYLE_PROVIDER_PRIORITY_APPLICATION
        );
        this._iconsGridView.add_css_class('icon-grid');

        selection.selected = Gtk.INVALID_LIST_POSITION;
        selection.connect('notify::selected-item', () => this._setActionButtonSensitive(true));

        const extension = ExtensionPreferences.lookupByURL(import.meta.url);
        extension.getSystemIcons().then(allIcons => {
            this._iconsListStore.splice(0, 0, allIcons);
        }).catch(e => console.log(e));
    }

    _updateFilter() {
        const query = this._searchQuery;
        const currentGroup = this._groupType;

        this._filter.set_filter_func(item => {
            const {displayName, group} = item;
            const nameToLower = displayName.toLowerCase();

            if (currentGroup !== IconGroup.ALL && group !== currentGroup)
                return false;
            if (query && !nameToLower.includes(query))
                return false;
            if (this._iconType === IconType.SYMBOLIC && !nameToLower.includes('-symbolic'))
                return false;
            if (this._iconType === IconType.FULL_COLOR && nameToLower.includes('-symbolic'))
                return false;

            return true;
        });

        this._filter.changed(Gtk.FilterChange.DIFFERENT);
    };

    _createAction(name, defaultValue, values, callback) {
        const action = Gio.SimpleAction.new_stateful(
            name,
            GLib.VariantType.new('s'),
            new GLib.Variant('s', defaultValue)
        );

        action.connect('activate', (act, parameter) => {
            const value = parameter.get_string()[0];
            if (act.state.unpack() !== value) {
                act.change_state(parameter);
                if (callback)
                    callback(value);
            }
        });

        action.set_enabled(values.includes(defaultValue));

        return action;
    }

    _createFiltersButton() {
        const menu = new Gio.Menu();
        const typeSection = new Gio.Menu();
        typeSection.append(_('All'), 'win.icontype::all');
        typeSection.append(_('Symbolic'), 'win.icontype::symbolic');
        typeSection.append(_('Full Color'), 'win.icontype::fullcolor');
        menu.append_section(_('Type'), typeSection);

        const groupSection = new Gio.Menu();
        groupSection.append(_('All'), 'win.grouptype::all');
        groupSection.append(_('Extension'), 'win.grouptype::extension');
        groupSection.append(_('Distros'), 'win.grouptype::distro');
        groupSection.append(_('System'), 'win.grouptype::system');
        menu.append_section(_('Category'), groupSection);

        const popover = new Gtk.PopoverMenu({
            menu_model: menu,
            has_arrow: false,
            css_classes: ['menu'],
        });
        popover.set_offset(0, 6);

        const filterButton = new Gtk.MenuButton({
            always_show_arrow: false,
            popover,
            direction: Gtk.ArrowType.DOWN,
            icon_name: 'open-menu-symbolic',
            tooltip_text: _('Filter'),
        });

        const applyFilters = () => {
            const iconType = iconTypeAction.state.deepUnpack();
            const groupType = groupTypeAction.state.deepUnpack();
            this._iconType = IconTypeFromString[iconType];
            this._groupType = IconGroupFromString[groupType];
            this._updateFilter();
        };

        const iconTypeAction = this._createAction('icontype', 'all',
            ['all', 'symbolic', 'fullcolor'], () => applyFilters());

        const groupTypeAction = this._createAction('grouptype', 'all',
            ['all', 'extension', 'distros', 'system'], () => applyFilters());

        const actionGroup = new Gio.SimpleActionGroup();
        actionGroup.add_action(iconTypeAction);
        actionGroup.add_action(groupTypeAction);
        this.insert_action_group('win', actionGroup);
        return filterButton;
    }

    _setupItem(_factory, listItem) {
        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 8,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 8,
            margin_end: 8,
        });

        const image = new Gtk.Image({pixel_size: 32});
        box.append(image);

        listItem._image = image;
        listItem.set_child(box);
    }

    _bindItem(_factory, listItem) {
        const item = listItem.get_item();
        const {displayName} = item;

        listItem.child.tooltip_text = displayName;
        listItem._image.icon_name = displayName;
    }

    _launchFileChooser() {
        const fileFilter = new Gtk.FileFilter();
        fileFilter.add_pixbuf_formats();
        const dialog = new Gtk.FileChooserDialog({
            title: _('Select an Icon'),
            transient_for: this.get_root(),
            modal: true,
            action: Gtk.FileChooserAction.OPEN,
        });
        dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
        dialog.add_button(_('Select'), Gtk.ResponseType.ACCEPT);

        dialog.set_filter(fileFilter);

        dialog.connect('response', (self, response) => {
            if (response === Gtk.ResponseType.ACCEPT) {
                this.iconString = dialog.get_file().get_path();
                this.emit('response', Gtk.ResponseType.APPLY);
            }
            dialog.destroy();
        });
        dialog.show();
    }

    _onActionClicked() {
        const selected = this._iconsGridView.model.selected_item;
        if (selected)
            this.iconString = selected.iconString;

        super._onActionClicked();
    }
}
