//////////////////////////////////////////////////////////////////////////////////////////
//             ,-.  ,--.  ,-.  ,  , ,---.  ,-.  ;-.     ,-. .  . ,-.  ,--.              //
//             |  \ |    (   ` | /    |   /   \ |  )   /    |  | |  ) |                 //
//             |  | |-    `-.  |<     |   |   | |-'    |    |  | |-<  |-                //
//             |  / |    .   ) | \    |   \   / |      \    |  | |  ) |                 //
//             `-'  `--'  `-'  '  `   '    `-'  '       `-' `--` `-'  `--'              //
//////////////////////////////////////////////////////////////////////////////////////////

// SPDX-FileCopyrightText: Simon Schneegans <code@simonschneegans.de>
// SPDX-License-Identifier: GPL-3.0-or-later

'use strict';

// This method can be used to import the Config module.
export async function importConfig() {
  if (typeof global === 'undefined') {
    return (await import('resource:///org/gnome/Shell/Extensions/js/misc/config.js'));
  }
  return (await import('resource:///org/gnome/shell/misc/config.js'));
}

// We import the Config module. This is done differently in the GNOME Shell process and in
// the preferences process.
const Config = await importConfig();

// Returns the given argument, except for "alpha", "beta", and "rc". In these cases -3,
// -2, and -1 are returned respectively.
function toNumericVersion(x) {
  switch (x) {
    case 'alpha':
      return -3;
    case 'beta':
      return -2;
    case 'rc':
      return -1;
  }
  return x;
}

const [GS_MAJOR, GS_MINOR] = Config.PACKAGE_VERSION.split('.').map(toNumericVersion);

// This method returns true if the current GNOME Shell version matches the given
// arguments.
export function shellVersionIs(major, minor) {
  return GS_MAJOR == major && GS_MINOR == toNumericVersion(minor);
}

// This method returns true if the current GNOME Shell version is at least as high as the
// given arguments. Supports "alpha" and "beta" for the minor version number.
export function shellVersionIsAtLeast(major, minor = 0) {
  if (GS_MAJOR > major) {
    return true;
  }

  if (GS_MAJOR == major) {
    return GS_MINOR >= toNumericVersion(minor);
  }

  return false;
}

// This method can be used to write a message to GNOME Shell's log. This is enhances
// the standard log() functionality by prepending the extension's name and the location
// where the message was logged. As the extensions name is part of the location, you
// can more effectively watch the log output of GNOME Shell:
// journalctl -f -o cat | grep -E 'desktop-cube|'
// This method is based on a similar script from the Fly-Pie GNOME Shell extension which
// os published under the MIT License (https://github.com/Schneegans/Fly-Pie).
export function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. desktop-cube@schneegans.github.com)
  // in the stack entry. We do not want to print the entire absolute file path.
  const extensionRoot = stack[0].indexOf('desktop-cube@schneegans.github.com');

  console.log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}

// This method can be used to import gettext. This is done differently in the
// GNOME Shell process and in the preferences process.
export async function importGettext() {
  if (typeof global === 'undefined') {
    return (await import('resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js'))
      .gettext;
  }
  return (await import('resource:///org/gnome/shell/extensions/extension.js')).gettext;
}