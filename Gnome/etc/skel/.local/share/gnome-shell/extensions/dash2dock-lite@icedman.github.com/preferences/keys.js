'use strict';

// const ExtensionUtils = imports.misc.extensionUtils;
// const Me = ExtensionUtils.getCurrentExtension();
// const { PrefKeys } = Me.imports.preferences.prefKeys;

import { PrefKeys } from './prefKeys.js';

export let schemaId = 'org.gnome.shell.extensions.dash2dock-lite';

export const SettingsKeys = () => {
  let settingsKeys = new PrefKeys();
  settingsKeys.setKeys({
    // debug: {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    // 'debug-log': {
    //   default_value: false,
    //   widget_type: 'switch',
    // },
    'experimental-features': {
      default_value: false,
      widget_type: 'switch',
    },
    'debug-visual': {
      default_value: false,
      widget_type: 'switch',
    },
    'shrink-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'icon-size': {
      default_value: 0,
      widget_type: 'scale',
    },
    'animate-icons-unmute': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'animate-icons': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'open-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'lamp-app-animation': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      // test: { values: [0, 1] },
    },
    'autohide-dash': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'autohide-dodge': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-through' },
    },
    'pressure-sense': {
      default_value: true,
      widget_type: 'switch',
      key_maps: {},
      test: { pointer: 'slide-down' },
    },
    'autohide-speed': {
      default_value: 0.5,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'customize-topbar': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'topbar-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'topbar-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'topbar-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'topbar-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'customize-label': {
      default_value: false,
      widget_type: 'switch',
      key_maps: {},
      themed: true,
    },
    'label-border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'label-border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'label-border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'label-background-color': {
      default_value: [0, 0, 0, 0.5],
      widget_type: 'color',
      themed: true,
    },
    'label-foreground-color': {
      default_value: [0, 0, 0, 0],
      widget_type: 'color',
      themed: true,
    },
    'favorites-only': {
      default_value: false,
      widget_type: 'switch',
    },
    'apps-icon': {
      default_value: true,
      widget_type: 'switch',
    },
    'apps-icon-front': {
      default_value: false,
      widget_type: 'switch',
    },
    'trash-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'downloads-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'documents-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'max-recent-items': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [5, 10, 15, 20, 25] },
    },
    'mounted-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'clock-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'calendar-icon': {
      default_value: false,
      widget_type: 'switch',
    },
    'calendar-style': {
      default_value: 0,
      widget_type: 'dropdown',
    },
    'peek-hidden-icons': {
      default_value: false,
      widget_type: 'switch',
    },
    'animation-fps': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { pointer: 'slide-through', values: [0, 1, 2] },
    },
    'animation-bounce': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-magnify': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-spread': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'animation-rise': {
      default_value: 0,
      widget_type: 'scale',
      test: { pointer: 'slide-through', values: [0, 0.5, 1] },
    },
    'icon-shadow': {
      default_value: true,
      widget_type: 'switch',
    },
    'edge-distance': {
      default_value: 0,
      widget_type: 'scale',
      test: { values: [-1, 0, 1] },
    },
    'border-radius': {
      default_value: 0,
      widget_type: 'scale',
      themed: true,
    },
    'border-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'border-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'separator-thickness': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
      themed: true,
    },
    'separator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'dock-padding': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'icon-spacing': {
      default_value: 0.5,
      widget_type: 'scale',
    },
    'panel-mode': {
      default_value: false,
      widget_type: 'switch',
    },
    'running-indicator-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: [
        'default',
        'dots',
        'dot',
        'dashes',
        'dash',
        'squares',
        'square',
        'segmented',
        'solid',
        'triangles',
        'triangle',
        'diamonds',
        'diamond',
        'binary',
      ],
      test: { values: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
    },
    'running-indicator-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'notification-badge-style': {
      default_value: 0,
      widget_type: 'dropdown',
      options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3, 4, 5] },
    },
    'notification-badge-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
    },
    'preferred-monitor': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'multi-monitor-preference': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'dock-location': {
      default_value: 0,
      widget_type: 'dropdown',
      // options: ['default', 'dot', 'dash', 'square', 'triangle', 'diamond'],
      test: { values: [0, 1, 2, 3] },
    },
    'icon-resolution': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2, 3] },
    },
    'icon-effect': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
      themed: true,
    },
    'icon-effect-color': {
      default_value: [1, 1, 1, 1],
      widget_type: 'color',
      themed: true,
    },
    'msg-to-ext': {
      default_value: '',
      widget_type: 'string',
    },
    'animation-type': {
      default_value: 0,
      widget_type: 'dropdown',
      test: { values: [0, 1, 2] },
    },
    'pressure-sense-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
    },
    'scroll-sensitivity': {
      default_value: 0.4,
      widget_type: 'scale',
    },
    'drawing-accent-color': {
      default_value: [1.0, 0, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-secondary-color': {
      default_value: [1.0, 0.6, 0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-color': {
      default_value: [0.2, 0.2, 0.2, 1.0],
      widget_type: 'color',
    },
    'drawing-light-color': {
      default_value: [1.0, 1.0, 1.0, 1.0],
      widget_type: 'color',
    },
    'drawing-dark-foreground': {
      default_value: [0.8, 0.8, 0.8, 1.0],
      widget_type: 'color',
    },
    'drawing-light-foreground': {
      default_value: [0.3, 0.3, 0.3, 1.0],
      widget_type: 'color',
    },
  });

  return settingsKeys;
};
