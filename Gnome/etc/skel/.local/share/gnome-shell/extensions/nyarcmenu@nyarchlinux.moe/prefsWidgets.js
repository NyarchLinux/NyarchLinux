const Me = imports.misc.extensionUtils.getCurrentExtension();
const {Adw, Gdk, GdkPixbuf, Gio, GLib, GObject, Gtk} = imports.gi;
const Constants = Me.imports.constants;
const Gettext = imports.gettext.domain(Me.metadata['gettext-domain']);
const _ = Gettext.gettext;

var DialogWindow = GObject.registerClass({
    Signals: {
        'response': { param_types: [GObject.TYPE_INT]},
    },
},class ArcMenu_DialogWindow extends Adw.PreferencesWindow {
    _init(title, parent) {
        super._init({
            title: title,
            transient_for: parent.get_root(),
            modal: true,
            search_enabled: true
        });
        this.page = new Adw.PreferencesPage();
        this.pageGroup = new Adw.PreferencesGroup();

        this.add(this.page);
        this.page.add(this.pageGroup);
    }
});

var DragRow = GObject.registerClass({
    Properties: {
        'shortcut-name':  GObject.ParamSpec.string(
            'shortcut-name', 'shortcut-name', 'shortcut-name',
            GObject.ParamFlags.READWRITE,
            ''),
        'shortcut-icon':  GObject.ParamSpec.string(
            'shortcut-icon', 'shortcut-icon', 'shortcut-icon',
            GObject.ParamFlags.READWRITE,
            ''),
        'shortcut-command':  GObject.ParamSpec.string(
            'shortcut-command', 'shortcut-command', 'shortcut-command',
            GObject.ParamFlags.READWRITE,
            ''),
        'gicon':  GObject.ParamSpec.object(
            'gicon', 'gicon', 'gicon',
            GObject.ParamFlags.READWRITE,
            Gio.Icon.$gtype),
        'xpm-pixbuf':  GObject.ParamSpec.object(
            'xpm-pixbuf', 'xpm-pixbuf', 'xpm-pixbuf',
            GObject.ParamFlags.READWRITE,
            GdkPixbuf.Pixbuf.$gtype),
        'icon-pixel-size':  GObject.ParamSpec.int(
            'icon-pixel-size', 'icon-pixel-size', 'icon-pixel-size',
            GObject.ParamFlags.READWRITE,
            1, GLib.MAXINT32, 22),
        'switch-enabled':  GObject.ParamSpec.boolean(
            'switch-enabled', 'switch-enabled', 'switch-enabled',
            GObject.ParamFlags.READWRITE,
            false),
        'switch-active':  GObject.ParamSpec.boolean(
            'switch-active', 'switch-active', 'switch-active',
            GObject.ParamFlags.READWRITE,
            false),
        'change-enabled':  GObject.ParamSpec.boolean(
            'change-enabled', 'change-enabled', 'change-enabled',
            GObject.ParamFlags.READWRITE,
            false),
    },
    Signals: {
        'drag-drop-done': { },
        'change-button-clicked': { },
        'switch-toggled': { },
    },
},class ArcMenu_DragRow extends Adw.ActionRow {
    _init(params) {
        super._init(params);
        let dragSource = new Gtk.DragSource({
            actions: Gdk.DragAction.MOVE
        });
        this.add_controller(dragSource);

        this.icon = new Gtk.Image( {
            gicon: this.gicon,
            pixel_size: this.icon_pixel_size
        });

        if(this.xpm_pixbuf)
            this.icon.set_from_pixbuf(this.xpm_pixbuf);

        this.dragIcon = new Gtk.Image( {
            gicon: Gio.icon_new_for_string("list-drag-handle-symbolic"),
            pixel_size: 12
        });
        this.add_prefix(this.icon);
        this.add_prefix(this.dragIcon);

        this.connect('notify::gicon', () => this.icon.gicon = this.gicon)

        let dropTarget = new Gtk.DropTargetAsync({
            actions: Gdk.DragAction.MOVE
        });
        this.add_controller(dropTarget);

        if(this.switch_enabled){
            this.switch = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                vexpand: false,
                margin_start: 10,
                active: this.switch_active
            });
            this.switch.connect("notify::active", () => {
                this.switch_active = this.switch.get_active();
                this.emit('switch-toggled');
            })
            this.add_suffix(this.switch);
            this.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
        }

        if(this.change_enabled){
            this.changeButton = new Gtk.Button({
                icon_name: 'text-editor-symbolic',
                valign: Gtk.Align.CENTER
            });
            this.changeButton.connect('clicked', () => {
                this.emit('change-button-clicked');
            });
            this.add_suffix(this.changeButton);
            this.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
        }

        dragSource.connect("drag-begin", (self, gdkDrag) => {
            //get listbox parent
            let listBox = self.get_widget().get_parent();
            //get widgets parent - the listBoxDragRow
            listBox.dragRow = this;
            this.listBox = listBox;

            let alloc = this.get_allocation();
            let dragWidget = self.get_widget().createDragRow(alloc);
            listBox.dragWidget = dragWidget;

            let icon = Gtk.DragIcon.get_for_drag(gdkDrag);
            icon.set_child(dragWidget);

            gdkDrag.set_hotspot(listBox.dragX, listBox.dragY);
        });

        dragSource.connect("prepare", (self, x, y) => {
            //get listbox parent
            this.set_state_flags(Gtk.StateFlags.NORMAL, true);
            let listBox = self.get_widget().get_parent();
            //store drag start cursor location
            listBox.dragX = x;
            listBox.dragY = y;
            return new Gdk.ContentProvider(ArcMenu_DragRow);
        });

        dragSource.connect("drag-end", (self, gdkDrag, deleteData) => {
            this.listBox.dragWidget = null;
            this.listBox.drag_unhighlight_row();
            deleteData = true;
        });

        dropTarget.connect("drag-enter", (self, gdkDrop, x, y, selection, info, time) => {
            let listBox = self.get_widget().get_parent();
            let widget = self.get_widget();

            listBox.startIndex = widget.get_index();
            listBox.drag_highlight_row(widget);
        });

        dropTarget.connect("drag-leave", (self, gdkDrop, x, y, selection, info, time) => {
            let listBox = self.get_widget().get_parent();
            listBox.drag_unhighlight_row();
        });

        dropTarget.connect("drop", (self, gdkDrop, x, y, selection, info, time) => {
            //get listbox parent
            let listBox = this.get_parent();
            let index = this.get_index();
            if(index === listBox.dragRow.get_index()){
                gdkDrop.read_value_async(ArcMenu_DragRow, 1, null, () => {
                    gdkDrop.finish(Gdk.DragAction.MOVE);
                });
                return true;
            }
            listBox.remove(listBox.dragRow);
            listBox.show();
            listBox.insert(listBox.dragRow, index);

            gdkDrop.read_value_async(ArcMenu_DragRow, 1, null, () => {
                gdkDrop.finish(Gdk.DragAction.MOVE);
            });
            this.emit("drag-drop-done");
            return true;
        });
    }

    createDragRow(alloc){
        let dragWidget = new Gtk.ListBox();
        dragWidget.set_size_request(alloc.width, alloc.height);

        let dragRow = new Adw.ActionRow({
            title: _(this.title),
            css_classes: this.css_classes
        });
        dragWidget.append(dragRow);
        dragWidget.drag_highlight_row(dragRow);

        let icon = new Gtk.Image( {
            pixel_size: this.icon_pixel_size,
            gicon: this.gicon
        });
        dragRow.add_prefix(icon);

        if(this.xpm_pixbuf)
            icon.set_from_pixbuf(this.xpm_pixbuf);

        let dragImage = new Gtk.Image( {
            gicon: Gio.icon_new_for_string("list-drag-handle-symbolic"),
            pixel_size: 12
        });
        dragRow.add_prefix(dragImage);

        if(this.switch_enabled){
            let modifyButton = new Gtk.Switch({
                valign: Gtk.Align.CENTER,
                margin_start: 10,
                active: this.switch_active
            });
            dragRow.add_suffix(modifyButton);
            dragRow.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
        }

        if(this.change_enabled){
            let changeButton = new Gtk.Button({
                icon_name: 'text-editor-symbolic',
                valign: Gtk.Align.CENTER
            });
            dragRow.add_suffix(changeButton);
            dragRow.add_suffix(new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 10,
                margin_bottom: 10
            }));
        }

        let editButton = new Gtk.Button({
            icon_name: 'view-more-symbolic',
            valign: Gtk.Align.CENTER
        });
        dragRow.add_suffix(editButton);

        return dragWidget;
    }
});

var EditEntriesBox = GObject.registerClass({
    Properties : {
        'allow-modify':  GObject.ParamSpec.boolean(
            'allow-modify', 'allow-modify', 'allow-modify',
            GObject.ParamFlags.READWRITE,
            false),
        'allow-delete':  GObject.ParamSpec.boolean(
            'allow-delete', 'allow-delete', 'allow-delete',
            GObject.ParamFlags.READWRITE,
            false),
        'row':  GObject.ParamSpec.object(
            'row', 'row', 'row',
            GObject.ParamFlags.READWRITE,
            Gtk.Widget.$gtype),
    },
    Signals: {
        'modify': {},
        'change': {},
        'row-changed': {},
        'row-deleted': {}
    },
},  class ArcMenu_EditEntriesBox extends Gtk.MenuButton{
    _init(params){
        super._init({
            icon_name: 'view-more-symbolic',
            valign: Gtk.Align.CENTER,
            popover: new Gtk.Popover(),
            ...params
        });

        let popoverBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 3
        });
        this.popover.set_child(popoverBox);

        this.modifyEntry = new Gtk.Button({
            label: _("Modify"),
            has_frame: false,
        });
        this.modifyEntry.connect('clicked', () => {
            this.popover.popdown();
            this.emit('modify');
        });

        let modifyEntryBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            visible: this.allow_modify,
            spacing: 3
        });
        modifyEntryBox.append(this.modifyEntry);
        modifyEntryBox.append(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL));
        popoverBox.append(modifyEntryBox);

        let moveUpButton = new Gtk.Button({
            label: _("Move Up"),
            has_frame: false
        });
        moveUpButton.connect('clicked', () => {
            let parent = this.row.get_parent();
            let index = this.row.get_index();
            if(index > 0){
                parent.remove(this.row);
                parent.insert(this.row, index - 1);
            }
            parent.show();
            this.popover.popdown();
            this.emit('row-changed');
        });
        popoverBox.append(moveUpButton);

        let moveDownButton = new Gtk.Button({
            label: _("Move Down"),
            has_frame: false
        });
        moveDownButton.connect('clicked', () => {
            let parent = this.row.get_parent();
            let children = [...parent];
            let index = this.row.get_index();
            if(index + 1 < children.length) {
                parent.remove(this.row);
                parent.insert(this.row, index + 1);
            }
            parent.show();
            this.popover.popdown();
            this.emit('row-changed');
        });
        popoverBox.append(moveDownButton);

        this.deleteEntry = new Gtk.Button({
            label: _("Remove"),
            has_frame: false,
        });
        this.deleteEntry.connect('clicked', () => {
            let parent = this.row.get_parent();
            parent.remove(this.row);
            parent.show();
            this.popover.popdown();
            this.emit('row-deleted');
        });

        let deleteEntryBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            visible: this.allow_delete,
            spacing: 3
        });
        deleteEntryBox.append(Gtk.Separator.new(Gtk.Orientation.HORIZONTAL));
        deleteEntryBox.append(this.deleteEntry);
        popoverBox.append(deleteEntryBox);

        this.connect('notify::allow-modify', () => modifyEntryBox.visible = this.allow_modify );
        this.connect('notify::allow-delete', () => deleteEntryBox.visible = this.allow_delete );
    }
});

var IconGrid = GObject.registerClass(class ArcMenu_IconGrid extends Gtk.FlowBox{
    _init() {
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
    }

    add(widget){
        widget.margin_top = widget.margin_bottom =
                widget.margin_start = widget.margin_end = 4;

        this.append(widget);
        this.childrenCount++;
    }
});

var MenuLayoutTile = GObject.registerClass(class ArcMenu_MenuLayoutTile extends Gtk.FlowBoxChild{
    _init(name, file, layout) {
        super._init({
            css_classes: ['card'],
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 4,
            margin_end: 4,
            halign: Gtk.Align.FILL,
            hexpand: true,
        });

        let box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            margin_top: 4,
            margin_bottom: 4,
            margin_start: 8,
            margin_end: 8,
        });
        this.set_child(box);

        this.name = name;
        this.layout = layout;

        this._image = new Gtk.Image({
            gicon: Gio.icon_new_for_string(file),
            pixel_size: 115,
        });

        this._label = new Gtk.Label({
            label: _(this.name),
            css_classes: ['caption']
        });

        box.append(this._image);
        box.append(this._label);
    }

    setActive(active){
        if(active){
            this._image.css_classes = ['accent'];
            this._label.css_classes = ['caption', 'accent'];
        }
        else{
            this._image.css_classes = [];
            this._label.css_classes = ['caption'];
        }
    }
});