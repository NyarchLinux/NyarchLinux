'use strict';

import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import Graphene from 'gi://Graphene';
const Point = Graphene.Point;

import { Dot } from './apps/dot.js';
import { DockPosition } from './dock.js';

import {
  DockItemDotsOverlay,
  DockItemBadgeOverlay,
  DockItemContainer,
  DockBackground,
} from './dockItems.js';

import { Bounce, Linear } from './effects/easing.js';

const ANIM_POS_COEF = 0.5;
const ANIM_SCALE_COEF = 1.5 * 2;
const ANIM_SPREAD_COEF = 1.25 * 1;
const ANIM_ON_LEAVE_COEF = 2.0;
const ANIM_ICON_RAISE = 0.6;
const ANIM_ICON_SCALE = 1.5;
const ANIM_ICON_HIT_AREA = 2.5;

const DOT_CANVAS_SIZE = 96;

export let Animator = class {
  enable() {}

  disable() {}

  animate() {
    let dock = this.dashContainer;

    let simulation = false;
    // this._hidden = true;

    dock.layout();

    if (dock.opacity < 255) {
      dock.opacity += 5;
    }

    let m = dock.getMonitor();
    let pointer = global.get_pointer();
    if (dock.extension.simulated_pointer) {
      pointer = [...dock.extension.simulated_pointer];
      simulation = true;
    }
    if (dock.simulated_pointer) {
      pointer = [...dock.simulated_pointer];
      simulation = true;
    }

    let vertical = dock.isVertical();

    let [px, py] = pointer;

    let p = new Point();
    p.x = 0.5;
    p.y = 0.5;

    let isWithin = dock._isWithinDash([px, py]);
    let animated = isWithin;
    dock.animated = animated;

    let animateIcons = dock._icons;
    let iconSize = dock._iconSizeScaledDown;
    let scaleFactor = dock._scaleFactor;

    let nearestIdx = -1;
    let nearestIcon = null;
    let nearestDistance = -1;

    let idx = 0;
    animateIcons.forEach((icon) => {
      let pos = icon.get_transformed_position();
      icon._pos = [...pos];
      icon._fixedPosition = [...pos];

      // get nearest
      let bposcenter = [...pos];
      bposcenter[0] += (iconSize * scaleFactor) / 2;
      bposcenter[1] += (iconSize * scaleFactor) / 2;
      let dst = dock._get_distance(pointer, bposcenter);

      if (
        isWithin &&
        (nearestDistance == -1 || nearestDistance > dst) &&
        dst < iconSize * ANIM_ICON_HIT_AREA * scaleFactor
      ) {
        nearestDistance = dst;
        nearestIcon = icon;
        nearestIdx = idx;
        icon._distance = dst;
      }

      icon._target = pos;
      icon._targetScale = 1;

      idx++;
    });

    let noAnimation = !dock.extension.animate_icons_unmute;
    if ((!simulation && !isWithin) || noAnimation) {
      nearestIcon = null;
    }

    dock._nearestIcon = nearestIcon;

    let didScale = false;

    //------------------------
    // animation behavior
    //------------------------
    let edge_distance = dock._edge_distance;
    let rise = dock.extension.animation_rise * ANIM_ICON_RAISE;
    let magnify = dock.extension.animation_magnify * ANIM_ICON_SCALE;
    let spread = dock.extension.animation_spread;
    if (spread < 0.2) {
      magnify *= 0.8;
    }
    if (magnify > 0.5 && spread < 0.55) {
      spread = 0.55 + spread * 0.2;
    }

    let padding = 10;
    let threshold = (iconSize + padding) * 2.5 * scaleFactor;

    if (animated && edge_distance < 0) {
      edge_distance = 0;
    }

    // animate
    let iconTable = [];
    animateIcons.forEach((icon) => {
      let original_pos = icon.get_transformed_position();

      // used by background resizing and repositioning
      icon._fixedPosition = [...original_pos];

      original_pos[0] += icon.width / 2;
      original_pos[1] += icon.height / 2;

      icon._pos = [...original_pos];
      icon._translate = 0;
      icon._translateRise = 0;

      iconTable.push(icon);

      let scale = 1;
      let dx = original_pos[0] - px;
      if (vertical) {
        dx = original_pos[1] - py;
      }
      if (dx * dx < threshold * threshold && nearestIcon) {
        let adx = Math.abs(dx);
        let p = 1.0 - adx / threshold;
        let fp = p * 0.6 * (1 + magnify);
        icon._p = p;

        // affect scale;
        if (magnify != 0) {
          scale += fp;
        }

        // affect rise
        let sz = iconSize * fp * scaleFactor;
        icon._translateRise = sz * 0.1 * rise;

        didScale = true;
      }

      icon._scale = scale;
      icon._targetScale = scale * scaleFactor;
      icon._icon.set_size(iconSize, iconSize);

      // moved to findIcons
      // icon._icon.set_icon_size(iconSize * dock.extension.icon_quality);

      if (!icon._pos) {
        return;
      }

      icon.opacity = icon == dock._dragged && dock._dragging ? 50 : 255;
      icon._prevTranslate = icon._translate;
    });

    // spread
    let hoveredIcon = null;
    for (let i = 0; i < iconTable.length; i++) {
      if (iconTable.length < 2) break;
      let icon = iconTable[i];
      if (icon._icon && icon._icon.hover) {
        hoveredIcon = icon;
      }
      if (icon._scale > 1.1) {
        // affect spread
        let offset =
          1.25 * (icon._scale - 1) * iconSize * scaleFactor * spread * 0.8;
        let o = offset;
        // left
        for (let j = i - 1; j >= 0; j--) {
          let left = iconTable[j];
          left._translate -= offset;
          o *= 0.98;
        }
        // right
        o = offset;
        for (let j = i + 1; j < iconTable.length; j++) {
          let right = iconTable[j];
          right._translate += offset;
          o *= 0.98;
        }
      }
    }

    dock._hoveredIcon = hoveredIcon;

    // re-center to hovered icon
    let TRANSLATE_COEF = 24;
    if (hoveredIcon) {
      hoveredIcon._targetScale += 0.1;
      let adjust = hoveredIcon._translate / 2;
      animateIcons.forEach((icon) => {
        if (icon._scale > 1) {
          let o = -adjust * (2 - icon._scale);
          let nt = icon._translate - o;
          icon._translate =
            (icon._translate * TRANSLATE_COEF + nt) / (TRANSLATE_COEF + 1);
        }
      });
    }

    //-------------------
    // interpolation / animation
    //-------------------
    let _scale_coef = ANIM_SCALE_COEF;
    // let _spread_coef = ANIM_SPREAD_COEF;
    let _pos_coef = ANIM_POS_COEF;
    if (dock.extension.animation_fps > 0) {
      _pos_coef /= 1 + dock.extension.animation_fps / 2;
      _scale_coef /= 1 + dock.extension.animation_fps / 2;
      // _spread_coef /= 1 + dock.extension.animation_fps / 2;
    }
    if (!nearestIcon) {
      _scale_coef *= ANIM_ON_LEAVE_COEF;
      _pos_coef *= ANIM_ON_LEAVE_COEF;
      // _spread_coef *= ANIM_ON_LEAVE_COEF;
    }

    // low frame rate
    if (dock.extension.animation_fps == 2) {
      _pos_coef *= 4;
      _scale_coef *= 4;
    }

    let first = animateIcons[0];
    let last = animateIcons[animateIcons.length - 1];

    animateIcons.forEach((icon) => {
      let scale = icon._icon.get_scale();

      let newScale =
        (icon._targetScale + scale[0] * _scale_coef) / (_scale_coef + 1);
      icon._scale = newScale;

      let flags = {
        bottom: { x: 0.5, y: 1, lx: 0, ly: 0.5 * newScale },
        top: { x: 0.5, y: 0, lx: 0, ly: -1.75 * newScale },
        left: { x: 0, y: 0.5, lx: -1.25 * newScale, ly: -1.25 },
        right: { x: 1, y: 0.5, lx: 1.5 * newScale, ly: -1.25 },
      };
      let pvd = flags[dock._position];

      let pv = new Point();
      pv.x = pvd.x;
      pv.y = pvd.y;
      icon._icon.pivot_point = pv;
      icon._icon.set_scale(newScale, newScale);

      let rdir =
        dock._position == DockPosition.TOP ||
        dock._position == DockPosition.LEFT
          ? 1
          : -1;

      let oldX = icon._icon.translationX;
      let oldY = icon._icon.translationY;
      let translationX =
        vertical * icon._translateRise * rdir +
        (oldX + icon._translate * !vertical * _pos_coef) / (_pos_coef + 1);
      let translationY =
        !vertical * icon._translateRise * rdir +
        (oldY + icon._translate * vertical * _pos_coef) / (_pos_coef + 1);

      icon._icon.translationX = Math.floor(translationX);
      icon._icon.translationY = Math.floor(translationY);

      // jitter reduction hack
      if (dock.extension._enableJitterHack && icon._scale < 1.05 && isWithin) {
        let size = 32;
        icon._translation = icon._translation || [];
        let currentTranslation = icon._icon.translationX;
        if (!vertical) {
          icon._translation.push(icon._icon.translationX);
        } else {
          currentTranslation = icon._icon.translationY;
          icon._translation.push(icon._icon.translationY);
        }
        if (icon._translation.length > size / 2) {
          icon._translation.shift();
          // todo ... what the cpu usage :)
          let sum = icon._translation.reduce((accumulator, currentValue) => {
            return accumulator + currentValue;
          }, 0);
          let avg = Math.floor(sum / icon._translation.length);
          let diff = Math.abs(currentTranslation - avg);
          if (diff <= 2) {
            if (!vertical) {
              icon._icon.translationX = avg;
            } else {
              icon._icon.translationY = avg;
            }
          }
        }
      }

      // todo center the appwell (scaling correction)
      let child = icon._appwell || icon.first_child;
      if (child && scaleFactor > 1) {
        let correction = icon._icon.height * scaleFactor - icon._icon.height;
        if (!icon._appwell) {
          child.x = correction;
        }
        child.y = correction;
      }

      // labels
      if (icon._label) {
        icon._label.translationX = translationX - iconSize * pvd.lx;
        icon._label.translationY = translationY - iconSize * pvd.ly;
      }

      // badges
      {
        let appNotices = icon._appwell
          ? dock.extension.services._appNotices[icon._appwell.app.get_id()]
          : null;
        let noticesCount = 0;
        if (appNotices) {
          noticesCount = appNotices.count;
        }
        // noticesCount = 1;
        let target = icon._dot?.get_parent();
        let badge = target?._badge;

        if (!badge && icon._appwell && target) {
          badge = new DockItemBadgeOverlay(new Dot(DOT_CANVAS_SIZE));
          target._badge = badge;
          target.add_child(badge);
        }
        if (badge && noticesCount > 0) {
          badge.update(icon, {
            noticesCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
          });
          badge.show();
        } else {
          badge?.hide();
        }
      }

      // dots
      {
        let appCount = icon._appwell ? icon._appwell.app.get_n_windows() : 0;
        // appCount = 1;
        let target = icon._dot?.get_parent();
        let dots = target?._dots;
        if (!dots && icon._appwell && target) {
          dots = new DockItemDotsOverlay(new Dot(DOT_CANVAS_SIZE));
          target._dots = dots;
          target.add_child(dots);
        }
        if (dots && appCount > 0) {
          dots.update(icon, {
            appCount,
            position: dock._position,
            vertical,
            extension: dock.extension,
          });
          dots.show();
        } else {
          dots?.hide();
        }
      }

      // custom icons
      if (dock.extension.services) {
        dock.extension.services.updateIcon(icon, {
          scaleFactor,
          iconSize,
          dock,
        });
      }
    });

    // separators
    dock._separators.forEach((actor) => {
      let prev = actor.get_previous_sibling() || actor._prev;
      let next = actor.get_next_sibling();
      if (prev && next && prev._icon && next._icon) {
        actor.translationX =
          (prev._icon.translationX + next._icon.translationX) / 2;
        actor.translationY =
          (prev._icon.translationY + next._icon.translationY) / 2;
        let thickness = dock.extension.separator_thickness || 0;
        actor.width = !vertical ? thickness : iconSize * 0.5 * scaleFactor;
        actor.height = vertical ? thickness : iconSize * 0.75 * scaleFactor;
        actor.visible = thickness > 0;
      }
    });

    let targetX = 0;
    let targetY = 0;
    if (dock._hidden && dock.extension.autohide_dash) {
      if (isWithin) {
        dock.slideIn();
      }
    }

    let ed =
      dock._position == DockPosition.BOTTOM ||
      dock._position == DockPosition.RIGHT
        ? 1
        : -1;

    // if (!animated && !dock._hidden && dock.extension.peek_hidden_icons) {
    //   edge_distance = -dock._iconSizeScaledDown * scaleFactor / 1.5;
    // }

    // dash hide/show
    if (dock._hidden) {
      if (vertical) {
        if (dock._position == DockPosition.LEFT) {
          targetX =
            -(dock._background.width + edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetX =
            (dock._background.width - edge_distance * -ed * 2) * scaleFactor;
        }
      } else {
        if (dock._position == DockPosition.BOTTOM) {
          targetY =
            (dock._background.height - edge_distance * -ed * 2) * scaleFactor;
        } else {
          targetY =
            -(dock._background.height + edge_distance * -ed * 2) * scaleFactor;
        }
      }
    }

    // edge
    targetX += vertical ? edge_distance * -ed : 0;
    targetY += !vertical ? edge_distance * -ed : 0;

    _pos_coef += 5 - 5 * dock.extension.autohide_speed;
    dock.dash.translationY =
      (dock.dash.translationY * _pos_coef + targetY) / (_pos_coef + 1);
    dock.dash.translationX =
      (dock.dash.translationX * _pos_coef + targetX) / (_pos_coef + 1);

    // background
    {
      dock._background.style = dock.extension._backgroundStyle;
      dock._background.update({
        first,
        last,
        iconSize,
        scaleFactor,
        position: dock._position,
        vertical: vertical,
        panel_mode: dock.extension.panel_mode,
        dashContainer: dock,
      });

      // allied areas
      if (vertical) {
        dock.struts.width =
          dock._background.width +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;
        dock.struts.height = dock.height;
        dock.struts.y = dock.y;
        if (dock._position == DockPosition.RIGHT) {
          dock.struts.x = dock.x + dock.width - dock.struts.width;
        } else {
          dock.struts.x = dock.x;
        }
      } else {
        dock.struts.width = dock.width;
        dock.struts.height =
          dock._background.height +
          iconSize * 0.2 * scaleFactor +
          edge_distance -
          dock._background._padding * scaleFactor;
        dock.struts.x = dock.x;
        if (dock._position == DockPosition.BOTTOM) {
          dock.struts.y = dock.y + dock.height - dock.struts.height;
        } else {
          dock.struts.y = dock.y;
        }
      }

      let dwellHeight = 4;
      if (vertical) {
        dock.dwell.width = dwellHeight;
        dock.dwell.height = dock.height;
        dock.dwell.x = m.x;
        dock.dwell.y = dock.y;
        if (dock._position == DockPosition.RIGHT) {
          dock.dwell.x = m.x + m.width - dwellHeight;
        }
      } else {
        dock.dwell.width = dock.width;
        dock.dwell.height = dwellHeight;
        dock.dwell.x = dock.x;
        dock.dwell.y = dock.y + dock.height - dock.dwell.height;
        if (dock._position == DockPosition.TOP) {
          dock.dwell.y = dock.y;
        }
      }
    }

    dock.dash.opacity = 255;

    //---------------------
    // animate the list
    //---------------------
    if (dock._list && dock._list.visible && dock._list._target) {
      let list = dock._list;
      list.opacity = 255;

      let target = list._target;
      let list_coef = 2;

      let tw = target.width * target._icon.scaleX;
      let th = target.height * target._icon.scaleY;

      list._box?.get_children().forEach((c) => {
        c.translationX = target._icon.translationX + tw / 8;
        c.translationY =
          -target._icon.scaleX * target._icon.height + target._icon.height;
        c._label.translationX = -c._label.width;

        let tx = c._x;
        let ty = c._y;
        let tz = c._rotation_angle_z;
        let to = 255;
        if (list._hidden) {
          tx = c._ox;
          ty = c._oy;
          tz = c._oz;
          to = 0;
          if (list._hiddenFrames-- == 0) {
            list.visible = false;
            list._hidden = false;
          }
        }

        let list_coef_x = list_coef + 4;
        let list_coef_z = list_coef + 6;
        c._label.opacity =
          (c._label.opacity * list_coef + to) / (list_coef + 1);
        c.x = (c.x * list_coef_x + tx) / (list_coef_x + 1);
        c.y = (c.y * list_coef + ty) / (list_coef + 1);
        c.rotation_angle_z =
          (c.rotation_angle_z * list_coef_z + tz) / (list_coef_z + 1);
      });

      target._label.hide();
      didScale = true;
    }

    if (didScale) {
      dock.autohider._debounceCheckHide();
      dock._debounceEndAnimation();
    }
  }

  bounceIcon(appwell) {
    let dock = this.dashContainer;

    let scaleFactor = dock.getMonitor().geometry_scale;
    let travel =
      (dock._iconSize / 3) * ((0.25 + dock.extension.animation_bounce) * 1.5);
    // * scaleFactor;
    appwell.translation_y = 0;

    let icon = appwell.get_parent()._icon;

    let t = 250;
    let _frames = [
      {
        _duration: t,
        _func: (f, s) => {
          let res = Linear.easeNone(f._time, 0, travel, f._duration);
          if (dock.isVertical()) {
            appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
            if (icon._badge) {
              icon._badge.translation_x = appwell.translation_x;
            }
          } else {
            // appwell.translation_y = -res;
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
          }
        },
      },
      {
        _duration: t * 3,
        _func: (f, s) => {
          let res = Bounce.easeOut(f._time, travel, -travel, f._duration);
          if (dock.isVertical()) {
            appwell.translation_x = appwell.translation_x =
              dock._position == DockPosition.LEFT ? res : -res;
          } else {
            // appwell.translation_y = -res;
            appwell.translation_y =
              dock._position == DockPosition.BOTTOM ? -res : res;
          }
        },
      },
    ];

    let frames = [];
    for (let i = 0; i < 3; i++) {
      _frames.forEach((b) => {
        frames.push({
          ...b,
        });
      });
    }

    dock.extension._hiTimer.runAnimation([
      ...frames,
      {
        _duration: 10,
        _func: (f, s) => {
          appwell.translation_y = 0;
        },
      },
    ]);
  }
};
