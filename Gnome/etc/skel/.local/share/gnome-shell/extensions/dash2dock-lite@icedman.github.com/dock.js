'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as Fav from 'resource:///org/gnome/shell/ui/appFavorites.js';

import Meta from 'gi://Meta';
import Shell from 'gi://Shell';
import GObject from 'gi://GObject';
import Clutter from 'gi://Clutter';
import Graphene from 'gi://Graphene';
import St from 'gi://St';
import Gio from 'gi://Gio';

import { Dash } from 'resource:///org/gnome/shell/ui/dash.js';

import { TintEffect } from './effects/tint_effect.js';
import { MonochromeEffect } from './effects/monochrome_effect.js';

import {
  DockItemList,
  DockItemContainer,
  DockBackground,
} from './dockItems.js';
import { AutoHide } from './autohide.js';
import { Animator } from './animator.js';

const Point = Graphene.Point;

export const DockPosition = {
  BOTTOM: 'bottom',
  LEFT: 'left',
  RIGHT: 'right',
  TOP: 'top',
};

export const DockAlignment = {
  CENTER: 'center',
  START: 'start',
  END: 'end',
};

const PREVIEW_FRAMES = 64;
const ANIM_DEBOUNCE_END_DELAY = 750;

const MIN_SCROLL_RESOLUTION = 4;
const MAX_SCROLL_RESOLUTION = 10;

export let Dock = GObject.registerClass(
  {},
  class Dock extends St.Widget {
    _init(params) {
      super._init({
        name: 'd2daDock',
        reactive: false,
        track_hover: false,
        width: 0,
        height: 0,
        clip_to_allocation: true,
        x_align: Clutter.ActorAlign.CENTER,
        y_align: Clutter.ActorAlign.CENTER,
      });

      this.extension = params.extension;

      this._alignment = DockAlignment.CENTER;
      this._monitorIndex = Main.layoutManager.primaryIndex;

      this._background = new DockBackground({ name: 'd2daBackground' });
      this.add_child(this._background);

      this.addDash();

      this.dash.reactive = true;
      this.dash.track_hover = true;
      this.dash.connectObject(
        'scroll-event',
        this._onScrollEvent.bind(this),
        'button-press-event',
        this._onButtonPressEvent.bind(this),
        'motion-event',
        this._onMotionEvent.bind(this),
        'enter-event',
        this._onEnterEvent.bind(this),
        'leave-event',
        this._onLeaveEvent.bind(this),
        'destroy',
        () => {},
        this
      );

      this.dash.opacity = 0;
      this._scrollCounter = 0;

      this.animator = new Animator();
      this.animator.dashContainer = this;
      this.animator.extension = this.extension;
      this.animator.enable();

      this.autohider = new AutoHide();
      this.autohider.dashContainer = this;
      this.autohider.extension = this.extension;
      if (this.extension.autohide_dash) {
        this.autohider.enable();
      }

      this.struts = new St.Widget({
        name: 'DockStruts',
      });
      this.dwell = new St.Widget({
        name: 'DockDwell',
        reactive: true,
        track_hover: true,
      });
      this.dwell.connectObject(
        'motion-event',
        this.autohider._onMotionEvent.bind(this.autohider),
        'enter-event',
        this.autohider._onEnterEvent.bind(this.autohider),
        'leave-event',
        this.autohider._onLeaveEvent.bind(this.autohider),
        this
      );
    }

    createItem(appinfo_filename) {
      let item = new DockItemContainer({
        appinfo_filename,
      });
      item.dock = this;
      item._menu._onActivate = () => {
        this._maybeBounce(item);
      };
      this._extraIcons.add_child(item);
      return item;
    }

    dock() {
      this.addToChrome();
      this.layout();
      this._beginAnimation();
    }

    undock() {
      if (this._list) {
        // todo Main.uiGroup no longer available in gnome 46
        Main.uiGroup.remove_child(this._list);
        this._list = null;
      }
      this._endAnimation();
      this.dash._box.remove_effect_by_name('icon-effect');
      this.autohider.disable();
      this.removeFromChrome();

      this.restorePanel();
    }

    _onButtonPressEvent(evt) {
      return Clutter.EVENT_PROPAGATE;
    }
    _onMotionEvent(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onEnterEvent(evt) {
      this._beginAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onLeaveEvent(evt) {
      this.autohider._debounceCheckHide();
      this._debounceEndAnimation();
      return Clutter.EVENT_PROPAGATE;
    }
    _onFocusWindow(evt) {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onFullScreen() {
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onAppsChanged(evt) {
      this._icons = null;
      this._beginAnimation();
      this.autohider._debounceCheckHide();
      return Clutter.EVENT_PROPAGATE;
    }
    _onClock() {
      this._clock?.redraw();
    }
    _onCalendar() {
      this._calendar?.redraw();
    }

    _createEffect(idx) {
      let effect = null;
      switch (idx) {
        case 1: {
          effect = new TintEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
        case 2: {
          effect = new MonochromeEffect({
            name: 'color',
            color: this.extension.icon_effect_color,
          });
          effect.preload(this.extension.path);
          break;
        }
      }
      return effect;
    }

    _updateIconEffect() {
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
      let effect = this._createEffect(this.extension.icon_effect);
      if (effect) {
        this.dash._box.get_parent().add_effect_with_name('icon-effect', effect);
      }
      this.iconEffect = effect;
    }

    slideIn() {
      if (this._hidden) {
        this._hidden = false;
        this._beginAnimation();
      }
    }

    slideOut() {
      if (this._list && this._list.visible) {
        return;
      }
      if (!this._hidden) {
        this._hidden = true;
        this._beginAnimation();
      }
    }

    getMonitor() {
      this._monitorIndex = this.extension._queryDisplay(this._monitorIndex);
      let m =
        Main.layoutManager.monitors[this._monitorIndex] ||
        Main.layoutManager.primaryMonitor;
      this._monitor = m;
      return m;
    }

    addDash() {
      let dash = new Dash();
      dash._adjustIconSize = () => {};
      this.dash = dash;
      this.dash._background.visible = false;
      this.dash._box.clip_to_allocation = false;

      this._extraIcons = new St.BoxLayout();
      this.dash._box.add_child(this._extraIcons);

      this._separator = new St.Widget({
        style_class: 'dash-separator',
        y_align: Clutter.ActorAlign.CENTER,
        height: 48,
      });
      this._separator.name = 'separator';
      this._extraIcons.add_child(this._separator);

      this.add_child(dash);
      return dash;
    }

    addToChrome() {
      if (this._onChrome) {
        return;
      }

      this._updateIconEffect();

      Main.layoutManager.addChrome(this.struts, {
        affectsStruts: !this.extension.autohide_dash,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      Main.layoutManager.addChrome(this, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      Main.layoutManager.addChrome(this.dwell, {
        affectsStruts: false,
        affectsInputRegion: false,
        trackFullscreen: true,
      });

      this._onChrome = true;
    }

    removeFromChrome() {
      if (!this._onChrome) {
        return;
      }
      Main.layoutManager.removeChrome(this.struts);
      Main.layoutManager.removeChrome(this);
      Main.layoutManager.removeChrome(this.dwell);
      this._onChrome = false;
      this.dash._box.get_parent().remove_effect_by_name('icon-effect');
    }

    isVertical() {
      return (
        this._position == DockPosition.LEFT ||
        this._position == DockPosition.RIGHT
      );
    }

    _preferredIconSize() {
      let preferredIconSizes = this._preferredIconSizes;
      let iconSize = 64;
      if (!preferredIconSizes) {
        preferredIconSizes = [32];
        for (let i = 16; i < 128; i += 4) {
          preferredIconSizes.push(i);
        }
        this._preferredIconSizes = preferredIconSizes;
      }

      iconSize =
        2 *
        (preferredIconSizes[
          Math.floor(this.extension.icon_size * preferredIconSizes.length)
        ] || 64);
      iconSize *= this.extension.scale;

      this._iconSize = iconSize;
      return iconSize;
    }

    /**
     *  DashItemContainer
     *    > child (DashIcon[appwell])
     *      > .icon (IconGrid)
     *        > .icon (StIcon)
     *      > ._dot
     *    > .label
     *
     *  ShowAppsIcon extends DashItemContainer
     *    > .icon (IconGrid)
     *      > .icon
     *    > ._iconActor
     */

    _inspectIcon(c) {
      if (!c.visible) return false;

      /* separator */
      c._cls = c._cls || c.get_style_class_name();
      if (c._cls === 'dash-separator') {
        this._separators.push(c);
        this._lastSeparator = c;
        c.visible = true;
        c.style = 'margin-left: 8px; margin-right: 8px;';
        return false;
      }

      /* ShowAppsIcon */
      if (c.icon /* IconGrid */ && c.icon.icon /* StIcon */) {
        c._icon = c.icon.icon;
        c._button = c.child;
        c.icon.style = 'background-color: transparent !important;';
      }

      /* DashItemContainer */
      if (
        c.child /* DashIcon */ &&
        c.child.icon /* IconGrid */ &&
        c.child.icon.icon /* StIcon */
      ) {
        c._grid = c.child.icon;
        c._icon = c.child.icon.icon;
        c._appwell = c.child;
        if (c._appwell) {
          c._appwell.visible = true;
          c._dot = c._appwell._dot;
          // hide icons if favorites only
          if (this.extension.favorites_only) {
            let app = c._appwell.app;
            let appId = app ? app.get_id() : '';
            if (!this._favorite_ids.includes(appId)) {
              c._appwell.visible = false;
              c.width = -1;
              c.height = -1;
              return false;
            }
          }
        }
        if (c._dot) {
          c._dot.opacity = 0;
        }
      }

      if (c._icon) {
        c._label = c.label;
        if (
          c == this.dash._showAppsIcon &&
          this.extension.apps_icon_front &&
          !this.isVertical()
        ) {
          this._icons.unshift(c);
        } else {
          this._icons.push(c);
        }
        return true;
      }

      return false;
    }

    _findIcons() {
      if (this._icons) {
        let iconsLength = this.dash._box.get_children().length;
        if (this._extraIcons) {
          iconsLength += this._extraIcons.get_children().length;
        }
        if (this._icons.length + 2 >= iconsLength) {
          // use icons cache
          return this._icons;
        }
      }

      this._separators = [];
      this._icons = [];

      if (!this.dash) return [];

      if (this.extension.favorites_only) {
        this._favorite_ids = Fav.getAppFavorites()._getIds();
      }

      this.dash._box.get_children().forEach((icon) => {
        this._inspectIcon(icon);
      });

      if (this.extension.favorites_only) {
        if (this._separators.length) {
          this._separators[0].visible = false;
          this._separators = [];
        }
      }

      let lastFavIcon = this._icons[this._icons.length - 1] ?? null;

      if (this._extraIcons) {
        this._lastSeparator = null;
        this._extraIcons.get_children().forEach((icon) => {
          this._inspectIcon(icon);
        });
        if (this._lastSeparator && lastFavIcon) {
          this._lastSeparator._prev = lastFavIcon;
        }
        this._extraIcons.visible = this._extraIcons.get_children().length > 1;
      }
      if (this.dash._showAppsIcon) {
        this.dash._showAppsIcon.visible = this.extension.apps_icon;
        if (this._inspectIcon(this.dash._showAppsIcon)) {
          let icon = this.dash._showAppsIcon._icon;
          if (!icon._connected) {
            icon._connected = true;
            icon.connectObject(
              'button-press-event',
              () => {
                let overview = Main.uiGroup
                  .get_children()
                  .find((c) => c.name == 'overviewGroup')
                  .get_children()
                  .find((c) => c.name == 'overview');
                if (overview._delegate.visible) {
                  overview._delegate.toggle();
                } else {
                  overview._delegate.showApps();
                }
                return Clutter.EVENT_PROPAGATE;
              },
              'enter-event',
              () => {
                this.dash._showAppsIcon.showLabel();
              },
              'leave-event',
              () => {
                this.dash._showAppsIcon.hideLabel();
              },
              this
            );
          }
        }
      }

      let noAnimation = !this.extension.animate_icons_unmute;

      let pv = new Point();
      pv.x = 0.5;
      pv.y = 0.5;
      this._icons.forEach((c) => {
        c._icon.track_hover = true;
        c._icon.reactive = true;
        c._icon.pivot_point = pv;
        if (c._button) {
          c._button.reactive = noAnimation;
          c._button.track_hover = noAnimation;
          c.toggle_mode = false;
        }
        if (c._grid) {
          c._grid.style = noAnimation ? '' : 'background: none !important;';
        }
        if (c._appwell && !c._appwell._activate) {
          c._appwell._activate = c._appwell.activate;
          c._appwell.activate = () => {
            this._maybeBounce(c);
            this._maybeMinimizeOrMaximize(c._appwell.app);
            c._appwell._activate();
          };
        }
        let icon = c._icon;
        if (!icon._destroyConnectId) {
          icon._destroyConnectId = icon.connect('destroy', () => {
            this._icons = null;
          });
        }
        let { _draggable } = icon;
        if (_draggable && !_draggable._dragBeginId) {
          _draggable._dragBeginId = _draggable.connect('drag-begin', () => {
            this._dragging = true;
            this._dragged = icon;
          });
          _draggable._dragEndId = _draggable.connect('drag-end', () => {
            this._dragging = false;
            this._icons = null;
          });
        }

        // icon image quality
        if (this._iconSizeScaledDown) {
          c._icon.set_icon_size(
            this._iconSizeScaledDown * this.extension.icon_quality
          );
        }
      });

      return this._icons;
    }

    _updateExtraIcons() {
      if (!this._extraIcons) {
        return;
      }

      // check these intermittently!
      //---------------
      // the mount icons
      //---------------
      {
        let extras = [...this._extraIcons.get_children()];
        let extraNames = extras.map((e) => e.name);
        let mounted = Object.keys(this.extension.services._mounts);

        extras.forEach((extra) => {
          if (!extra._mountType) {
            return;
          }
          if (!mounted.includes(extra.name)) {
            this._extraIcons.remove_child(extra);
            this._icons = null;
          }
        });

        mounted.forEach((mount) => {
          if (!extraNames.includes(mount)) {
            let mountedIcon = this.createItem(mount);
            mountedIcon._mountType = true;
            this._icons = null;
          }
        });
      }

      //---------------
      // the folder icons
      //---------------
      let folders = [
        {
          icon: '_downloadsIcon',
          path: '/tmp/downloads-dash2dock-lite.desktop',
          show: this.extension.downloads_icon, // && this._position == DockPosition.BOTTOM
        },
        // {
        //   icon: '_documentsIcon',
        //   path: '/tmp/documents-dash2dock-lite.desktop',
        //   show: this.extension.documents_icon // && this._position == DockPosition.BOTTOM
        // }
      ];
      folders.forEach((f) => {
        if (!this[f.icon] && f.show) {
          // pin downloads icon
          this[f.icon] = this.createItem(f.path);

          let target = this[f.icon];

          target._onClick = async () => {
            if (this._position != DockPosition.BOTTOM) {
              target.activateNewWindow();
              return;
            }
            if (!this.extension.services._downloadFiles) {
              await this.extension.services.checkDownloads();
            }
            let files = [...(this.extension.services._downloadFiles || [])];
            if (!files.length) return;
            if (files.length < this.extension.services._downloadFilesLength) {
              files = [
                {
                  index: -1,
                  name: 'More...',
                  path: 'Downloads',
                  icon: target._icon.icon_name,
                  type: 'directory',
                },
                ...files,
              ];
            }
            files = files.sort(function (a, b) {
              return a.index > b.index ? 1 : -1;
            });

            if (!this._list) {
              this._list = new DockItemList();
              this._list.dock = this;
              Main.uiGroup.add_child(this._list);
            } else if (this._list.visible) {
              this._list.slideOut();
            } else {
              // remove and re-add so that it is repositioned to topmost
              Main.uiGroup.remove_child(this._list);
              Main.uiGroup.add_child(this._list);
              this._list.visible = true;
            }

            if (this._list.visible && !this._list._hidden) {
              this._list.slideIn(target, files);
              let pv = new Point();
              pv.x = 0.5;
              pv.y = 1;
            }
          };

          this._icons = null;
        } else if (this[f.icon] && !f.show) {
          // unpin downloads icon
          this._extraIcons.remove_child(this[f.icon]);
          this._downloadsIcon = null;
          this._icons = null;
        }
      });

      //---------------
      // the trash icon
      //---------------
      if (!this._trashIcon && this.extension.trash_icon) {
        // pin trash icon
        this._trashIcon = this.createItem(`/tmp/trash-dash2dock-lite.desktop`);
        this._icons = null;
      } else if (this._trashIcon && !this.extension.trash_icon) {
        // unpin trash icon
        this._extraIcons.remove_child(this._trashIcon);
        this._trashIcon = null;
        this._icons = null;
      } else if (this._trashIcon && this.extension.trash_icon) {
        // move trash icon to the end
        if (this._extraIcons.last_child != this._trashIcon) {
          this._extraIcons.remove_child(this._trashIcon);
          this._extraIcons.add_child(this._trashIcon);
        }
      }
    }

    layout() {
      if (this.extension.apps_icon_front) {
        this.dash.last_child.text_direction = 2; // RTL
        this.dash._box.text_direction = 1; // LTR
      } else {
        this.dash.last_child.text_direction = 1; // LTR
        this.dash._box.text_direction = 1; // LTR
      }

      const locations = [
        DockPosition.BOTTOM,
        DockPosition.LEFT,
        DockPosition.RIGHT,
        DockPosition.TOP,
      ];
      this._position =
        locations[this.extension.dock_location] || DockPosition.BOTTOM;

      this._updateExtraIcons();

      this._icons = this._findIcons();

      let m = this.getMonitor();
      let scaleFactor = m.geometry_scale;
      let vertical = this.isVertical();

      this._scaleFactor = scaleFactor;

      let flags = {
        top: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 1,
          centerY: 0,
        },
        bottom: {
          edgeX: 0,
          edgeY: 1,
          offsetX: 0,
          offsetY: -1,
          centerX: 1,
          centerY: 0,
        },
        left: {
          edgeX: 0,
          edgeY: 0,
          offsetX: 0,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
        right: {
          edgeX: 1,
          edgeY: 0,
          offsetX: -1,
          offsetY: 0,
          centerX: 0,
          centerY: 1,
        },
      };
      let f = flags[this._position];

      let width = 1200;
      let height = 140;
      let dock_size_limit = 1;
      let animation_spread = this.extension.animation_spread;
      let animation_magnify = this.extension.animation_magnify;

      let iconMargins = 0;
      let iconStyle = '';
      if (this.extension.icon_spacing > 0) {
        let margin = 8 * this.extension.icon_spacing;
        if (vertical) {
          iconStyle = `margin-top: ${margin}px; margin-bottom: ${margin}px;`;
        } else {
          iconStyle = `margin-left: ${margin}px; margin-right: ${margin}px;`;
        }
        iconMargins = margin * 2 * this._icons.length;
      }

      let iconSize = this._preferredIconSize();
      let iconSizeSpaced = iconSize + 2 + 8 * animation_spread;

      let projectedWidth =
        iconSize +
        iconSizeSpaced * (this._icons.length > 3 ? this._icons.length : 3);
      projectedWidth += iconMargins;

      let scaleDown = 1.0;
      let limit = vertical ? 0.96 : 0.98;

      let maxWidth = (vertical ? m.height : m.width) * limit;

      if (projectedWidth * scaleFactor > maxWidth * 0.98) {
        scaleDown = (maxWidth - iconSize / 2) / (projectedWidth * scaleFactor);
      }

      iconSize *= scaleDown;
      iconSizeSpaced *= scaleDown;
      projectedWidth *= scaleDown;
      this._projectedWidth = projectedWidth;

      this._edge_distance =
        (this.extension.edge_distance || 0) * 20 * scaleFactor;

      if (this.extension.panel_mode) {
        this._edge_distance = 0;
      }

      this._icons.forEach((icon) => {
        icon.width = Math.floor(iconSizeSpaced * scaleFactor);
        icon.height = Math.floor(iconSizeSpaced * scaleFactor);
        if (icon.style != iconStyle) {
          icon.style = iconStyle;
        }
      });

      width = this._projectedWidth * scaleFactor;
      height = iconSizeSpaced * 1.5 * scaleFactor;

      this.width = (vertical ? height : width) + iconSize * scaleFactor;
      this.height = (vertical ? width : height) + iconSize * scaleFactor;

      if (this.animated) {
        let adjust = 1.25;
        this.width *= vertical ? adjust : 1;
        this.height *= !vertical ? adjust : 1;
        this.width += !vertical * iconSizeSpaced * adjust * scaleFactor;
        this.height += vertical * iconSizeSpaced * adjust * scaleFactor;

        if (this.width > m.width) {
          this.width = m.width;
        }
        if (this.height > m.height) {
          this.height = m.height;
        }
      }

      // console.log(`${width} ${height}`);

      // reposition the dash
      this.dash.last_child.layout_manager.orientation = vertical;
      this.dash._box.layout_manager.orientation = vertical;
      if (this._extraIcons) {
        this._extraIcons.layout_manager.orientation = vertical;
      }

      this.x =
        m.x +
        m.width * f.edgeX +
        this.width * f.offsetX +
        (m.width / 2 - this.width / 2) * f.centerX;

      this.y =
        m.y +
        m.height * f.edgeY +
        this.height * f.offsetY +
        (m.height / 2 - this.height / 2) * f.centerY;

      // todo vertical
      if (this.extension.panel_mode) {
        if (vertical) {
          this.y = m.y;
          this.height = m.height;
        } else {
          this.x = m.x;
          this.width = m.width;
        }
      }

      // center the dash
      this.dash.x = this.width / 2 - this.dash.width / 2;
      this.dash.y = this.height / 2 - this.dash.height / 2;

      // hug the edge
      if (vertical) {
        this.dash.x = this.width * f.edgeX + this.dash.width * f.offsetX;
      } else {
        this.dash.y = this.height * f.edgeY + this.dash.height * f.offsetY;
      }

      this._iconSizeScaledDown = iconSize;
      this._scaledDown = scaleDown;

      // resize dash icons
      // console.log(this.dash.height);
      // console.log('---------------');

      // this.acquirePanel();
    }

    acquirePanel() {
      // panel
      if (!this.panel && Main.panel) {
        this.panel = Main.panel;
        this.panelLeft = this.panel._leftBox;
        this.panelRight = this.panel._rightBox;
        this.panelCenter = this.panel._centerBox;
      }

      if (!this.panel) return;

      // W: breakable
      let reparent = [this.panelLeft, this.panelRight, this.panelCenter];
      reparent.forEach((c) => {
        if (c.get_parent()) {
          c._parent = c.get_parent();
          c.get_parent().remove_child(c);
        }
        this._background.add_child(c);
      });
      this.panel.visible = false;

      this.panelLeft.height = this.panel.height - 8;
      this.panelLeft.x = 20;
      this.panelLeft.y =
        this.height - this.struts.height + this.panelLeft.height / 2;
      this.panelRight.track_hover = false;

      this.panelRight.height = this.panel.height - 8;
      this.panelRight.x = this.struts.width - this.panelRight.width - 20;
      this.panelRight.y = this.panelRight.height / 2;

      this.panelCenter.height = this.panel.height - 8;
      this.panelCenter.x = this.struts.width - this.panelCenter.width - 20;
      this.panelCenter.y = this.panelRight.y + this.panelRight.height;
    }

    restorePanel() {
      if (!this.panel) return;

      // W: breakable
      let reparent = [this.panelLeft, this.panelRight, this.panelCenter];
      reparent.forEach((c) => {
        if (c.get_parent()) {
          c.get_parent().remove_child(c);
        }
        c._parent.add_child(c);
      });
      this.panel.visible = true;
    }

    preview() {
      this._preview = PREVIEW_FRAMES;
    }

    animate() {
      if (this._preview) {
        let p = this.dash.get_transformed_position();
        p[0] += this.dash.width / 2;
        p[1] += this.dash.height / 2;
        this.simulated_pointer = p;
        this._preview--;
      }
      this.animator.animate();
      this.simulated_pointer = null;
    }

    _get_distance_sqr(pos1, pos2) {
      let a = pos1[0] - pos2[0];
      let b = pos1[1] - pos2[1];
      return a * a + b * b;
    }

    _get_distance(pos1, pos2) {
      return Math.sqrt(this._get_distance_sqr(pos1, pos2));
    }

    _isOverlapRect(r1, r2) {
      let [r1x, r1y, r1w, r1h] = r1;
      let [r2x, r2y, r2w, r2h] = r2;
      // are the sides of one rectangle touching the other?
      if (
        r1x + r1w >= r2x && // r1 right edge past r2 left
        r1x <= r2x + r2w && // r1 left edge past r2 right
        r1y + r1h >= r2y && // r1 top edge past r2 bottom
        r1y <= r2y + r2h
      ) {
        // r1 bottom edge past r2 top
        return true;
      }
      return false;
    }

    _isInRect(r, p, pad) {
      let [x1, y1, w, h] = r;
      let x2 = x1 + w;
      let y2 = y1 + h;
      let [px, py] = p;
      return px + pad >= x1 && px - pad < x2 && py + pad >= y1 && py - pad < y2;
    }

    _isWithinDash(p) {
      if (this._hidden) {
        return false;
      }
      if (this._hoveredIcon) return true;
      let xy = this.struts.get_transformed_position();
      let wh = [this.struts.width, this.struts.height];
      if (this._isInRect([xy[0], xy[1], wh[0], wh[1]], p, 20)) {
        return true;
      }
      return false;
    }

    _beginAnimation(caller) {
      if (this.extension.debug_visual) {
        this.add_style_class_name('hi');
        this.struts.add_style_class_name('hi');
        this.dwell.add_style_class_name('hi');
      }
      // if (caller) {
      //   console.log(`animation triggered by ${caller}`);
      // }
      if (this.extension._hiTimer && this.debounceEndSeq) {
        this.extension._loTimer.runDebounced(this.debounceEndSeq);
        // this.extension._loTimer.cancel(this.debounceEndSeq);
      }

      this.animationInterval = this.extension.animationInterval;
      if (this.extension._hiTimer) {
        if (!this._animationSeq) {
          this._animationSeq = this.extension._hiTimer.runLoop(
            () => {
              this.animate();
            },
            this.animationInterval,
            'animationTimer'
          );
        } else {
          this.extension._hiTimer.runLoop(this._animationSeq);
        }
      }
    }

    _endAnimation() {
      if (this.extension.debug_visual) {
        this.remove_style_class_name('hi');
        this.struts.remove_style_class_name('hi');
        this.dwell.remove_style_class_name('hi');
      }
      if (this.extension._hiTimer) {
        this.extension._hiTimer.cancel(this._animationSeq);
        this.extension._loTimer.cancel(this.debounceEndSeq);
      }
      this.autohider._debounceCheckHide();
      this._icons = null;
    }

    _debounceEndAnimation() {
      if (this.extension._loTimer) {
        if (!this.debounceEndSeq) {
          this.debounceEndSeq = this.extension._loTimer.runDebounced(
            () => {
              this._endAnimation();
            },
            ANIM_DEBOUNCE_END_DELAY + this.animationInterval,
            'debounceEndAnimation'
          );
        } else {
          this.extension._loTimer.runDebounced(this.debounceEndSeq);
        }
      }
    }

    cancelAnimations() {
      this.extension._hiTimer.cancel(this._animationSeq);
      this._animationSeq = null;
      this.extension._hiTimer.cancel(this.autohider._animationSeq);
      this.autohider._animationSeq = null;
    }

    _maybeMinimizeOrMaximize(app) {
      let windows = app.get_windows();
      if (!windows.length) return;

      let event = Clutter.get_current_event();
      let modifiers = event ? event.get_state() : 0;
      let pressed = event.type() == Clutter.EventType.BUTTON_PRESS;
      let button1 = (modifiers & Clutter.ModifierType.BUTTON1_MASK) != 0;
      let button2 = (modifiers & Clutter.ModifierType.BUTTON2_MASK) != 0;
      let button3 = (modifiers & Clutter.ModifierType.BUTTON3_MASK) != 0;
      let shift = (modifiers & Clutter.ModifierType.SHIFT_MASK) != 0;
      let isMiddleButton = button3; // middle?
      let isCtrlPressed = (modifiers & Clutter.ModifierType.CONTROL_MASK) != 0;
      let openNewWindow =
        app.can_open_new_window() &&
        app.state == Shell.AppState.RUNNING &&
        (isCtrlPressed || isMiddleButton);
      if (openNewWindow) return;

      let workspaceManager = global.workspace_manager;
      let activeWs = workspaceManager.get_active_workspace();
      let focusedWindow = null;

      windows.forEach((w) => {
        if (w.has_focus()) {
          focusedWindow = w;
        }
      });

      // delay - allow dash to actually call 'activate' first
      if (focusedWindow) {
        this.extension._hiTimer.runOnce(() => {
          if (shift) {
            if (focusedWindow.get_maximized() == 3) {
              focusedWindow.unmaximize(3);
            } else {
              focusedWindow.maximize(3);
            }
          } else {
            windows.forEach((w) => {
              w.minimize();
            });
          }
        }, 50);
      } else {
        this.extension._hiTimer.runOnce(() => {
          windows.forEach((w) => {
            if (w.is_hidden()) {
              w.unminimize();
              if (w.has_focus()) {
                w.raise();
              }
            }
          });
        }, 50);
      }
    }

    _maybeBounce(container) {
      if (!this.extension.open_app_animation) {
        return;
      }
      if (
        !container.child.app ||
        (container.child.app && !container.child.app.get_n_windows())
      ) {
        if (container.child) {
          this.animator.bounceIcon(container.child);
        }
      }
    }

    _onScrollEvent(obj, evt) {
      this._lastScrollEvent = evt;
      let pointer = global.get_pointer();
      let target = this._nearestIcon; // this._hoveredIcon;
      // console.log(`${target == this._hoveredIcon}`);
      if (target) {
        if (this._scrollCounter < -2 || this._scrollCounter > 2)
          this._scrollCounter = 0;

        let icon = target;

        // add scrollwheel vs touchpad differentiation
        let multiplier = 1;
        if (
          evt.get_source_device().get_device_type() == 5 ||
          evt.get_source_device().get_device_name().includes('Touch')
        ) {
          multiplier = 1;
        } else {
          multiplier = 5;
        }

        // console.log(this._scrollCounter);

        let SCROLL_RESOLUTION =
          MIN_SCROLL_RESOLUTION +
          MAX_SCROLL_RESOLUTION -
          (MAX_SCROLL_RESOLUTION * this.extension.scroll_sensitivity || 0);
        if (icon._appwell && icon._appwell.app) {
          this._lastScrollObject = icon;
          let direction = evt.get_scroll_direction();
          switch (direction) {
            case Clutter.ScrollDirection.UP:
            case Clutter.ScrollDirection.LEFT:
              this._scrollCounter += (1 / SCROLL_RESOLUTION) * multiplier;
              break;
            case Clutter.ScrollDirection.DOWN:
            case Clutter.ScrollDirection.RIGHT:
              this._scrollCounter -= (1 / SCROLL_RESOLUTION) * multiplier;
              break;
          }
          this._cycleWindows(icon._appwell.app, evt);
        }
      }
    }

    _lockCycle() {
      if (this._lockedCycle) return;
      this._lockedCycle = true;
      this.extension._hiTimer.runOnce(() => {
        this._lockedCycle = false;
      }, 500);
    }

    _cycleWindows(app, evt) {
      if (this._lockedCycle) {
        this._scrollCounter = 0;
        return false;
      }

      let focusId = 0;
      let workspaceManager = global.workspace_manager;
      let activeWs = workspaceManager.get_active_workspace();

      let windows = app.get_windows();

      if (evt.modifier_state & Clutter.ModifierType.CONTROL_MASK) {
        windows = windows.filter((w) => {
          return activeWs == w.get_workspace();
        });
      }

      let nw = windows.length;
      windows.sort((w1, w2) => {
        return w1.get_id() > w2.get_id() ? -1 : 1;
      });

      if (nw > 1) {
        for (let i = 0; i < nw; i++) {
          if (windows[i].has_focus()) {
            focusId = i;
          }
          if (windows[i].is_hidden()) {
            windows[i].unminimize();
            windows[i].raise();
          }
        }

        let current_focus = focusId;

        if (this._scrollCounter < -1 || this._scrollCounter > 1) {
          focusId += Math.round(this._scrollCounter);
          if (focusId < 0) {
            focusId = nw - 1;
          }
          if (focusId >= nw) {
            focusId = 0;
          }
          this._scrollCounter = 0;
        }

        if (current_focus == focusId) return;
      } else if (nw == 1) {
        if (windows[0].is_hidden()) {
          windows[0].unminimize();
          windows[0].raise();
        }
      }

      let window = windows[focusId];
      if (window) {
        this._lockCycle();
        if (activeWs == window.get_workspace()) {
          window.raise();
          window.focus(0);
        } else {
          activeWs.activate_with_focus(window, global.get_current_time());
        }
      }
    }
  }
);
