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

const Config     = imports.misc.config;
const [GS_MAJOR] = Config.PACKAGE_VERSION.split('.');

const ExtensionUtils = imports.misc.extensionUtils;
const Me             = imports.misc.extensionUtils.getCurrentExtension();

// This method can be used to write a message to GNOME Shell's log. This is enhances
// the standard log() functionality by prepending the extension's name and the location
// where the message was logged. As the extensions name is part of the location, you
// can more effectively watch the log output of GNOME Shell:
// journalctl -f -o cat | grep -E 'desktop-cube|'
// This method is based on a similar script from the Fly-Pie GNOME Shell extension which
// os published under the MIT License (https://github.com/Schneegans/Fly-Pie).
function debug(message) {
  const stack = new Error().stack.split('\n');

  // Remove debug() function call from stack.
  stack.shift();

  // Find the index of the extension directory (e.g. desktopcube@schneegans.github.com)
  // in the stack entry. We do not want to print the entire absolute file path.
  const extensionRoot = stack[0].indexOf(Me.metadata.uuid);

  log('[' + stack[0].slice(extensionRoot) + '] ' + message);
}

// This method returns true if the current GNOME Shell version matches the given
// argument.
function shellVersionIs(major) {
  return GS_MAJOR == major;
}

// This method returns true if the current GNOME Shell version is at least as high as the
// given argument.
function shellVersionIsAtLeast(major) {
  return GS_MAJOR >= major;
}