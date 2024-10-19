import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import {gettext as _} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';

export const DialogWindow = GObject.registerClass({
    Signals: {
        'response': {param_types: [GObject.TYPE_INT]},
    },
}, class ArcMenuDialogWindow extends Adw.PreferencesWindow {
    _init(title, parent) {
        super._init({
            title,
            transient_for: parent.get_root(),
            modal: true,
            search_enabled: true,
        });
        this.page = new Adw.PreferencesPage();
        this.pageGroup = new Adw.PreferencesGroup();

        this.add(this.page);
        this.page.add(this.pageGroup);
    }
});

export const SettingRow = GObject.registerClass(
class ArcMenuSettingRow extends Adw.ActionRow {
    _init(params) {
        super._init({
            activatable: true,
            ...params,
        });

        const goNextImage = new Gtk.Image({
            gicon: Gio.icon_new_for_string('go-next-symbolic'),
            halign: Gtk.Align.END,
            valign: Gtk.Align.CENTER,
            hexpand: false,
            vexpand: false,
        });

        this.add_suffix(goNextImage);
    }
});

export const DragRow = GObject.registerClass({
    Properties: {
        'shortcut-name': GObject.ParamSpec.string(
            'shortcut-name', 'shortcut-name', 'shortcut-name',
            GObject.ParamFlags.READWRITE,
            ''),
        'shortcut-icon': GObject.ParamSpec.string(
            'shortcut-icon', 'shortcut-icon', 'shortcut-icon',
            GObject.ParamFlags.READWRITE,
            ''),
        'shortcut-command': GObject.ParamSpec.string(
            'shortcut-command', 'shortcut-command', 'shortcut-command',
            GObject.ParamFlags.READWRITE,
            ''),
        'gicon': GObject.ParamSpec.object(
            'gicon', 'gicon', 'gicon',
            GObject.ParamFlags.READWRITE,
            Gio.Icon.$gtype),
        'pixbuf': GObject.ParamSpec.object(
            'pixbuf', 'pixbuf', 'pixbuf',
            GObject.ParamFlags.READWRITE,
            GdkPixbuf.Pixbuf.$gtype),
        'icon-pixel-size': GObject.ParamSpec.int(
            'icon-pixel-size', 'icon-pixel-size', 'icon-pixel-size',
            GObject.ParamFlags.READWRITE,
            1, GLib.MAXINT32, 22),
        'switch-enabled': GObject.ParamSpec.boolean(
            'switch-enabled', 'switch-enabled', 'switch-enabled',
            GObject.ParamFlags.READWRITE,
            false),
        'switch-active': GObject.ParamSpec.boolean(
            'switch-active', 'switch-active', 'switch-active',
            GObject.ParamFlags.READWRITE,
            false),
    },
    Signals: {
        'drag-drop-done': { },
        'change-button-clicked': { },
        'switch-toggled': { },
    },
}, class ArcMenuDragRow extends Adw.ActionRow {
    _init(params) {
        super._init(params);

        this._params = params;

        this.icon = new Gtk.Image({
            gicon: this.gicon,
            pixel_size: this.icon_pixel_size,
        });
        this.add_prefix(this.icon);

        if (this.pixbuf)
            this.icon.set_from_pixbuf(this.pixbuf);

        this.connect('notify::gicon', () => (this.icon.gicon = this.gicon));

        this.dragIcon = new Gtk.Image({
            gicon: Gio.icon_new_for_string('list-drag-handle-symbolic'),
            pixel_size: 12,
        });
        this.add_prefix(this.dragIcon);

        if (this.switch_enabled) {
            this.switch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                vexpand: false,
                margin_start: 10,
                active: this.switch_active,
            });
            this.switch.connect('notify::active', () => {
                this.switch_active = this.switch.get_active();
                this.emit('switch-toggled');
            });
            this.add_suffix(this.switch);
            this.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10,
            }));
        }

        const dragSource = new Gtk.DragSource({actions: Gdk.DragAction.MOVE});
        this.add_controller(dragSource);

        const dropTarget = new Gtk.DropTargetAsync({actions: Gdk.DragAction.MOVE});
        this.add_controller(dropTarget);

        dragSource.connect('drag-begin', (self, gdkDrag) => {
            this._dragParent = self.get_widget().get_parent();
            this._dragParent.dragRow = this;

            const alloc = this.get_allocation();
            const dragWidget = self.get_widget().createDragRow(alloc);
            this._dragParent.dragWidget = dragWidget;

            const icon = Gtk.DragIcon.get_for_drag(gdkDrag);
            icon.set_child(dragWidget);

            gdkDrag.set_hotspot(this._dragParent.dragX, this._dragParent.dragY);
        });

        dragSource.connect('prepare', (self, x, y) => {
            this.set_state_flags(Gtk.StateFlags.NORMAL, true);
            const parent = self.get_widget().get_parent();
            // store drag start cursor location
            parent.dragX = x;
            parent.dragY = y;
            return new Gdk.ContentProvider();
        });

        dragSource.connect('drag-end', (_self, _gdkDrag) => {
            this._dragParent.dragWidget = null;
            this._dragParent.drag_unhighlight_row();
        });

        dropTarget.connect('drag-enter', self => {
            const parent = self.get_widget().get_parent();
            const widget = self.get_widget();

            parent.drag_highlight_row(widget);
        });

        dropTarget.connect('drag-leave', self => {
            const parent = self.get_widget().get_parent();
            parent.drag_unhighlight_row();
        });

        dropTarget.connect('drop', (_self, gdkDrop) => {
            const parent = this.get_parent();
            const {dragRow} = parent; // The row being dragged.
            const dragRowStartIndex = dragRow.get_index();
            const dragRowNewIndex = this.get_index();

            gdkDrop.read_value_async(ArcMenuDragRow, 1, null, () => gdkDrop.finish(Gdk.DragAction.MOVE));

            // The drag row hasn't moved
            if (dragRowStartIndex === dragRowNewIndex)
                return true;

            parent.remove(dragRow);
            parent.show();
            parent.insert(dragRow, dragRowNewIndex);

            this.emit('drag-drop-done');
            return true;
        });
    }

    createDragRow(alloc) {
        const dragWidget = new Gtk.ListBox();
        dragWidget.set_size_request(alloc.width, alloc.height);

        const dragRow = new DragRow(this._params);
        dragWidget.append(dragRow);
        dragWidget.drag_highlight_row(dragRow);

        dragRow.title = _(this.title);
        dragRow.css_classes = this.css_classes;
        dragRow.icon.gicon = this.gicon;

        if (this.pixbuf)
            dragRow.icon.set_from_pixbuf(this.pixbuf);

        const editButton = new Gtk.Button({
            icon_name: 'view-more-symbolic',
            valign: Gtk.Align.CENTER,
        });
        dragRow.add_suffix(editButton);

        return dragWidget;
    }
});

const ModifyEntryType = {
    MOVE_UP: 0,
    MOVE_DOWN: 1,
    REMOVE: 2,
};

export const EditEntriesBox = GObject.registerClass({
    Properties: {
        'allow-modify': GObject.ParamSpec.boolean(
            'allow-modify', 'allow-modify', 'allow-modify',
            GObject.ParamFlags.READWRITE,
            false),
        'allow-remove': GObject.ParamSpec.boolean(
            'allow-remove', 'allow-remove', 'allow-remove',
            GObject.ParamFlags.READWRITE,
            false),
        'row': GObject.ParamSpec.object(
            'row', 'row', 'row',
            GObject.ParamFlags.READWRITE,
            Gtk.Widget.$gtype),
    },
    Signals: {
        'modify-button-clicked': {},
        'entry-modified': {param_types: [GObject.TYPE_INT, GObject.TYPE_INT]},
    },
},  class ArcMenuEditEntriesBox extends Gtk.MenuButton {
    _init(params) {
        super._init({
            icon_name: 'view-more-symbolic',
            valign: Gtk.Align.CENTER,
            popover: new Gtk.Popover(),
            ...params,
        });

        const popoverBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 3,
        });
        this.popover.set_child(popoverBox);

        const modifyEntryButton = new Gtk.Button({
            label: _('Modify'),
            has_frame: false,
            visible: this.allow_modify,
        });
        modifyEntryButton.connect('clicked', () => {
            this.popover.popdown();
            this.emit('modify-button-clicked');
        });
        popoverBox.append(modifyEntryButton);

        const topSeparator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL);
        topSeparator.visible = this.allow_modify;
        popoverBox.append(topSeparator);

        const moveUpButton = new Gtk.Button({
            label: _('Move Up'),
            has_frame: false,
        });
        moveUpButton.connect('clicked', () => this.modifyEntry(ModifyEntryType.MOVE_UP));
        popoverBox.append(moveUpButton);

        const moveDownButton = new Gtk.Button({
            label: _('Move Down'),
            has_frame: false,
        });
        moveDownButton.connect('clicked', () => this.modifyEntry(ModifyEntryType.MOVE_DOWN));
        popoverBox.append(moveDownButton);

        const removeEntryButton = new Gtk.Button({
            label: _('Remove'),
            has_frame: false,
            visible: this.allow_remove,
        });
        removeEntryButton.connect('clicked', () => this.modifyEntry(ModifyEntryType.REMOVE));

        const bottomSeparator = Gtk.Separator.new(Gtk.Orientation.HORIZONTAL);
        bottomSeparator.visible = this.allow_remove;
        popoverBox.append(bottomSeparator);

        popoverBox.append(removeEntryButton);

        this.connect('notify::allow-modify', () => {
            modifyEntryButton.visible = this.allow_modify;
            topSeparator.visible = this.allow_modify;
        });
        this.connect('notify::allow-remove', () => {
            removeEntryButton.visible = this.allow_remove;
            bottomSeparator.visible = this.allow_remove;
        });
    }

    modifyEntry(modifyEntryType) {
        this.popover.popdown();

        const startIndex = this.row.get_index();
        const parent = this.row.get_parent();
        const children = [...parent];
        let indexModification;

        if (modifyEntryType === ModifyEntryType.MOVE_DOWN) {
            if (startIndex >= children.length - 1)
                return;

            indexModification = 1;
        } else if (modifyEntryType === ModifyEntryType.MOVE_UP) {
            if (startIndex <= 0)
                return;

            indexModification = -1;
        }
        if (modifyEntryType === ModifyEntryType.REMOVE)
            indexModification = (startIndex + 1) * -1; // we want newIndex == -1 for a remove

        const newIndex = startIndex + indexModification;

        parent.remove(this.row);
        if (newIndex !== -1)
            parent.insert(this.row, newIndex);
        parent.show();

        this.emit('entry-modified', startIndex, newIndex);
    }
});

export const IconGrid = GObject.registerClass(class ArcMenuIconGrid extends Gtk.FlowBox {
    _init(spacing = 4) {
        super._init({
            max_children_per_line: 15,
            row_spacing: spacing,
            column_spacing: spacing,
            valign: Gtk.Align.START,
            halign: Gtk.Align.CENTER,
            homogeneous: true,
            selection_mode: Gtk.SelectionMode.SINGLE,
        });
        this._spacing = spacing;
        this.childrenCount = 0;
        this.connect('child-activated', (_self, child) => {
            this.setActiveChild(child);
        });
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
                widget.margin_start = widget.margin_end = this._spacing;

        this.append(widget);
        this.childrenCount++;
    }
});

export const MenuButtonIconTile = GObject.registerClass(class ArcMenuMenuButtonIconTile extends Gtk.FlowBoxChild {
    _init(icon, name) {
        super._init({
            css_classes: ['card', 'activatable'],
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 4,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4,
        });
        this.set_child(box);

        const ICON_SIZE = 32;
        this._image = new Gtk.Image({
            gicon: Gio.icon_new_for_string(icon),
            pixel_size: ICON_SIZE,
        });

        this._label = new Gtk.Label({
            label: name ? _(name) : '',
            hexpand: true,
            css_classes: ['caption'],
            visible: !!name,
        });

        box.append(this._image);
        box.append(this._label);
    }

    setIcon(icon) {
        this._image.gicon = Gio.icon_new_for_string(icon);
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

export const MenuLayoutTile = GObject.registerClass(class ArcMenuMenuLayoutTile extends Gtk.FlowBoxChild {
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
            gicon: Gio.icon_new_for_string(styleInfo.IMAGE),
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
