import Clutter from 'gi://Clutter';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';

import {ArcMenuManager} from './arcmenuManager.js';
import * as MW from './menuWidgets.js';

import * as DND from 'resource:///org/gnome/shell/ui/dnd.js';
import * as Params from 'resource:///org/gnome/shell/misc/params.js';

export const DragLocation = {
    INVALID: 0,
    START_EDGE: 1,
    ON_ICON: 2,
    END_EDGE: 3,
    EMPTY_SPACE: 4,
    TOP_EDGE: 5,
    BOTTOM_EDGE: 6,
};

// eslint-disable-next-line jsdoc/require-jsdoc
function swap(value, length) {
    return length - value - 1;
}

// eslint-disable-next-line jsdoc/require-jsdoc
function animateIconPosition(icon, box, nChangedIcons) {
    if (!icon.has_allocation() || icon.allocation.equal(box) || icon.opacity === 0) {
        icon.allocate(box);
        return false;
    }

    icon.save_easing_state();
    icon.set_easing_mode(Clutter.AnimationMode.EASE_OUT_QUAD);
    icon.set_easing_delay(nChangedIcons * 10);

    icon.allocate(box);

    icon.restore_easing_state();

    return true;
}

export const IconGridLayout = GObject.registerClass({
    Properties: {
        'column-spacing': GObject.ParamSpec.int('column-spacing',
            'Column spacing', 'Column spacing',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 0),
        'row-spacing': GObject.ParamSpec.int('row-spacing',
            'Row spacing', 'Row spacing',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 0),
        'columns': GObject.ParamSpec.int('columns',
            'Columns', 'Columns',
            GObject.ParamFlags.READWRITE,
            1, GLib.MAXINT32, 1),
        'force-columns': GObject.ParamSpec.int('force-columns',
            'Force Columns', 'Force Columns',
            GObject.ParamFlags.READWRITE,
            0, GLib.MAXINT32, 0),
        'halign': GObject.ParamSpec.enum('halign',
            'Horizontal page align',
            'Horizontal page align',
            GObject.ParamFlags.READWRITE,
            Clutter.ActorAlign.$gtype,
            Clutter.ActorAlign.FILL),
        'first-row-align': GObject.ParamSpec.enum('first-row-align',
            'First row align', 'First row align',
            GObject.ParamFlags.READWRITE,
            Clutter.ActorAlign.$gtype,
            Clutter.ActorAlign.CENTER),

    },
}, class IconGridLayout extends Clutter.LayoutManager {
    _init(params = {}) {
        super._init(params);

        this._sizeChanged = false;
        this._width = 0;
        this._height = 0;
        this._items = new Map();
        this._children = [];
        this._childrenMaxSize = null;
    }

    _getChildrenMaxSize() {
        if (!this._childrenMaxSize) {
            let minWidth = 0;
            let minHeight = 0;

            this._children.forEach(item => {
                const childMinHeight = item.get_preferred_height(-1)[1];
                const childMinWidth = item.get_preferred_width(-1)[1];

                minWidth = Math.max(minWidth, childMinWidth);
                minHeight = Math.max(minHeight, childMinHeight);
            });

            this._childrenMaxSize = [minWidth, minHeight];
        }
        return this._childrenMaxSize;
    }

    _calculateSpacing(width, childWidth) {
        if (this.halign !== Clutter.ActorAlign.CENTER)
            return 0;

        let columns = 0;
        if (this.firstRowAlign === Clutter.ActorAlign.CENTER) {
            const visibleChildren = this._children.filter(child => child.visible);
            // if the amount of visiblechildren is less than the amount of columns
            // set columns to visiblechildren.length in order to center the items
            columns = visibleChildren.length < this.columns ? visibleChildren.length : this.columns;
        } else {
            columns = this.columns;
        }

        const nColumns = columns;
        const usedWidth = childWidth * nColumns;
        const columnSpacing = this.columnSpacing * (nColumns - 1);

        const emptyHSpace = width - usedWidth - columnSpacing;
        const leftEmptySpace = Math.floor(emptyHSpace / 2);

        return leftEmptySpace;
    }

    _unlinkItem(item) {
        const itemData = this._items.get(item);

        item.disconnect(itemData.destroyId);
        item.disconnect(itemData.visibleId);
        item.disconnect(itemData.queueRelayoutId);

        this._items.delete(item);
    }

    _removeItemData(item) {
        this._unlinkItem(item);

        const itemIndex = this._children.indexOf(item);
        this._children.splice(itemIndex, 1);
    }

    _addItem(item, index) {
        if (index === -1)
            index = this._children.length;

        this._items.set(item, {
            actor: item,
            destroyId: item.connect('destroy', () => this._removeItemData(item)),
            visibleId: item.connect('notify::visible', () => {
                this._shouldEaseItems = true;
            }),
            queueRelayoutId: item.connect('queue-relayout', () => {
                this._childrenMaxSize = null;
            }),
        });

        this._children.splice(index, 0, item);
    }

    vfunc_set_container(container) {
        this._container = container;
    }

    vfunc_get_preferred_width() {
        return [5, this._width];
    }

    vfunc_get_preferred_height() {
        const children = this._children;
        const totalColumns = this.columns;

        let minRowHeight = 0;
        let natRowHeight = 0;
        let natHeight = 0;
        let firstRow = true;
        let column = 0;

        for (let i = 0; i < children.length; i += 1) {
            const child = children[i];
            if (!child.visible)
                continue;

            const isSeparator = child instanceof MW.ArcMenuSeparator;
            const [childMinHeight, childNatHeight] = child.get_preferred_height(-1);

            minRowHeight = Math.max(minRowHeight, childMinHeight);
            natRowHeight = Math.max(natRowHeight, childNatHeight);

            const newRow = column % totalColumns === 0;
            if (firstRow && newRow) {
                firstRow = false;
                natHeight = natRowHeight; // + this.rowSpacing + PADDING;
                natRowHeight = 0;
            } else if (isSeparator) {
                natHeight += childNatHeight + this.rowSpacing;
                natRowHeight = 0;
            } else if (newRow) {
                natHeight += natRowHeight + this.rowSpacing;
                natRowHeight = 0;
            }

            column++;
            if (column === this.columns || isSeparator)
                column = 0;
        }

        this._height = natHeight;
        return [natHeight, minRowHeight];
    }

    vfunc_allocate() {
        const children = this._children;
        const shouldEaseItems = this._shouldEaseItems;
        const sizeChanged = this._sizeChanged;
        const isRtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;

        const [childWidth, childHeight_] = this._getChildrenMaxSize();
        const xOffset = this._calculateSpacing(this._width, childWidth);

        const childBox = new Clutter.ActorBox();

        let nChangedIcons = 0;
        let rowHeight = 0;
        let y = 0;
        let column = 0;
        let naturalWidth = 0;
        let naturalHeight = 0;

        for (let i = 0; i < children.length; i += 1) {
            const child = children[i];

            const isSeparator = child instanceof MW.ArcMenuSeparator;
            const xFill = child.x_align === Clutter.ActorAlign.FILL;

            if (isRtl)
                column = swap(column, this.columns);

            const newRow = column % this.columns === 0;

            [,, naturalWidth, naturalHeight] = child.get_preferred_size();

            if (isSeparator)
                naturalWidth = this._width;
            else if (xFill)
                naturalWidth = this._width / this.columns;

            let x;
            if (isSeparator)
                x = 0;
            else
                x = xOffset + column * (naturalWidth + this.columnSpacing);

            // The first item in a row will determine the row height
            // add previous child naturalHeight offset
            if (isSeparator || newRow)
                y += rowHeight;

            rowHeight = naturalHeight + this.rowSpacing;

            childBox.set_origin(Math.floor(x), Math.floor(y));
            childBox.set_size(naturalWidth, naturalHeight);

            if (!shouldEaseItems || sizeChanged)
                child.allocate(childBox);
            else if (animateIconPosition(child, childBox, nChangedIcons))
                nChangedIcons++;

            column++;

            if (column === this.columns || isSeparator)
                column = 0;
        }

        this._sizeChanged = false;
        this._shouldEaseItems = false;
    }

    addItem(item, index = -1) {
        if (this._items.has(item))
            throw new Error(`Item ${item} already added to IconGridLayout`);

        if (!this._container)
            return;

        this._shouldEaseItems = true;

        this._container.add_child(item);
        this._addItem(item, index);
    }

    appendChild(item) {
        this.addItem(item);
    }

    moveItem(item, newPosition) {
        if (!this._items.has(item))
            throw new Error(`Item ${item} is not part of the IconGridLayout`);

        this._shouldEaseItems = true;

        this._removeItemData(item);

        this._addItem(item, newPosition);
    }

    removeItem(item) {
        if (!this._items.has(item))
            throw new Error(`Item ${item} is not part of the IconGridLayout`);

        if (!this._container)
            return;

        this._shouldEaseItems = true;

        this._container.remove_child(item);
        this._removeItemData(item);
    }

    removeAllItems() {
        for (let i = this._children.length - 1; i >= 0; --i) {
            const item = this._children[i];
            this.removeItem(item);
        }
    }

    getItemPosition(item) {
        if (!this._items.has(item))
            return -1;

        return this._children.indexOf(item);
    }

    getItemAt(position) {
        if (position < 0 || position >= this._children.length)
            return null;

        return this._children[position];
    }

    getDropTarget(x, y) {
        const emptySpace = 5;

        const isRtl = Clutter.get_default_text_direction() === Clutter.TextDirection.RTL;

        const gridWidth = this._width;
        const gridHeight = this._height;

        const inTopEmptySpace = y < -emptySpace;
        const inLeftEmptySpace = x < -emptySpace;
        const inRightEmptySpace = x > emptySpace + gridWidth;
        const inBottomEmptySpace = y > emptySpace + gridHeight;

        if (inTopEmptySpace || inBottomEmptySpace || inRightEmptySpace || inLeftEmptySpace)
            return [0, DragLocation.INVALID];

        const halfHSpacing = this.rowSpacing / 2;
        const halfVSpacing = this.columnSpacing / 2;
        const nRows = Math.ceil(this.nChildren / this.columns);
        const singleColumnGrid = this.columns === 1;

        for (let i = 0; i < this._children.length; i++) {
            const item = this._children[i];

            // skip hidden item. the item current being dragged.
            if (item.opacity === 0 || !item.visible)
                continue;

            const childBox = item.allocation;

            const firstInRow = i % this.columns === 0;
            const lastInRow = i % this.columns === this.columns - 1;
            const firstInColumn = Math.floor(i / this.columns) === 0;
            const lastInColumn = Math.floor(i / this.columns) === nRows - 1;

            // Check icon boundaries
            if (!singleColumnGrid && ((inLeftEmptySpace && firstInRow) ||
                (inRightEmptySpace && lastInRow))) {
                if (y < childBox.y1 - halfVSpacing ||
                    y > childBox.y2 + halfVSpacing)
                    continue;
            } else if (singleColumnGrid && ((inTopEmptySpace && firstInColumn) ||
                (inBottomEmptySpace && lastInColumn))) {
                if (x < childBox.x1 - halfHSpacing ||
                    x > childBox.x2 + halfHSpacing)
                    continue;
            } else {
                // eslint-disable-next-line no-lonely-if
                if (x < childBox.x1 - halfHSpacing ||
                    x > childBox.x2 + halfHSpacing ||
                    y < childBox.y1 - halfVSpacing ||
                    y > childBox.y2 + halfVSpacing)
                    continue;
            }

            const leftDividerLeeway = Math.round(item.get_preferred_width(-1)[1] / 5);
            const rightDividerLeeway = Math.round(item.get_preferred_width(-1)[1] / 5);
            const topDividerLeeway = Math.round(item.get_preferred_height(-1)[1] / 5);
            const bottomDividerLeeway = Math.round(item.get_preferred_height(-1)[1] / 5);

            let dragLocation;
            if (!singleColumnGrid && x < childBox.x1 + leftDividerLeeway)
                dragLocation = DragLocation.START_EDGE;
            else if (!singleColumnGrid && x > childBox.x2 - rightDividerLeeway)
                dragLocation = DragLocation.END_EDGE;
            else if (singleColumnGrid && y < childBox.y1 + topDividerLeeway)
                dragLocation = DragLocation.TOP_EDGE;
            else if (singleColumnGrid && y > childBox.y2 - bottomDividerLeeway)
                dragLocation = DragLocation.BOTTOM_EDGE;
            else
                dragLocation = DragLocation.ON_ICON;

            if (isRtl) {
                if (dragLocation === DragLocation.START_EDGE)
                    dragLocation = DragLocation.END_EDGE;
                else if (dragLocation === DragLocation.END_EDGE)
                    dragLocation = DragLocation.START_EDGE;
            }

            return [i, dragLocation];
        }

        return [-1, DragLocation.EMPTY_SPACE];
    }

    adaptToSize(width) {
        if (this._width === width)
            return;

        this._width = width;
        this._sizeChanged = true;
    }

    getChildren() {
        return this._children;
    }

    get nChildren() {
        return this._children.length;
    }
});

export const IconGrid = GObject.registerClass(
class IconGrid extends St.Widget {
    _init(layoutParams = {}) {
        const acceptDrop = layoutParams.accept_drop;
        delete layoutParams.accept_drop;

        layoutParams = Params.parse(layoutParams, {
            columns: 1,
            column_spacing: 0,
            row_spacing: 0,
            force_columns: 0,
            halign: Clutter.ActorAlign.FILL,
            first_row_align: Clutter.ActorAlign.CENTER,
        });

        const layoutManager = new IconGridLayout(layoutParams);

        super._init({
            layoutManager,
            x_expand: true,
            x_align: Clutter.ActorAlign.FILL,
        });

        // only need acceptDrop for the main pinned-apps grid
        if (acceptDrop) {
            // DND requires this to be set
            this._delegate = this;
        }
    }

    _canAccept(source) {
        if (!(source instanceof MW.DraggableMenuItem))
            return false;

        if (this.contains(source))
            return false;

        if (!source.folderId)
            return false;

        const pinnedAppsList = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();
        for (let i = 0; i < pinnedAppsList.length; i++) {
            if (pinnedAppsList[i].id === source.pinnedAppData.id)
                return false;
        }

        return true;
    }

    handleDragOver(source, _actor, _x, _y) {
        if (!this._canAccept(source))
            return DND.DragMotionResult.CONTINUE;

        return DND.DragMotionResult.MOVE_DROP;
    }

    acceptDrop(source, _actor, _x, _y) {
        if (!this._canAccept(source))
            return false;

        const sourceData = source.pinnedAppData;

        source.cancelActions();

        // remove app from folder pinned app list
        const parent = source.get_parent();
        const layoutManager = parent.layout_manager;
        const index = layoutManager.getItemPosition(source);

        const folderSettings = source.folderSettings;

        const sourceParentChildren = layoutManager.getChildren();
        const folderPinnedApps = [];
        for (let i = 0; i < sourceParentChildren.length; i++)
            folderPinnedApps.push(sourceParentChildren[i].pinnedAppData);

        folderPinnedApps.splice(index, 1);
        folderSettings.set_value('pinned-apps', new GLib.Variant('aa{ss}', folderPinnedApps));

        // add app to main pinned apps
        const pinnedAppsList = ArcMenuManager.settings.get_value('pinned-apps').deepUnpack();
        pinnedAppsList.push(sourceData);
        ArcMenuManager.settings.set_value('pinned-apps', new GLib.Variant('aa{ss}', pinnedAppsList));

        return true;
    }

    /**
     * @param {Clutter.ActorAlign} alignment
     */
    set halign(alignment) {
        this.layout_manager.halign = alignment;
        this.queue_relayout();
    }

    /**
     * @param {Clutter.ActorAlign} columnSpacing
     */
    set column_spacing(columnSpacing) {
        this.layout_manager.column_spacing = columnSpacing;
        this.queue_relayout();
    }

    /**
     * @param {number} rowSpacing
     */
    set row_spacing(rowSpacing) {
        this.layout_manager.row_spacing = rowSpacing;
        this.queue_relayout();
    }

    vfunc_allocate(box) {
        const [width, height_] = box.get_size();
        this.layout_manager.adaptToSize(width);
        super.vfunc_allocate(box);
    }

    addItem(item, index = -1) {
        this.layout_manager.addItem(item, index);
        this.queue_relayout();
    }

    appendItem(item) {
        this.layout_manager.addItem(item, -1);
        this.queue_relayout();
    }

    moveItem(item, newPosition) {
        this.layout_manager.moveItem(item, newPosition);
        this.queue_relayout();
    }

    removeItem(item) {
        if (!this.contains(item))
            return;

        this.layout_manager.removeItem(item);
    }

    removeAllItems() {
        this.layout_manager.removeAllItems();
    }

    setColumns(columns) {
        this.layout_manager.columns = columns;
        this.queue_relayout();
    }

    getItemPosition(item) {
        if (!this.contains(item))
            return -1;

        return this.layout_manager.getItemPosition(item);
    }

    getItemAt(position) {
        return this.layout_manager.getItemAt(position);
    }

    getDropTarget(x, y) {
        return this.layout_manager.getDropTarget(x, y);
    }
});
