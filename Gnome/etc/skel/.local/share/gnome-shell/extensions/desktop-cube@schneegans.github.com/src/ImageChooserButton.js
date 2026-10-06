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

import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import GObject from 'gi://GObject';

import * as utils from './utils.js';

const _ = await utils.importGettext();

//////////////////////////////////////////////////////////////////////////////////////////
// This is based on a similar class from the Fly-Pie extension (MIT License).           //
// https://github.com/Schneegans/Fly-Pie/blob/main/src/prefs/ImageChooserButton.js      //
// We only need file chooser buttons for images, so the content.                        //
//////////////////////////////////////////////////////////////////////////////////////////

export function registerImageChooserButton() {

  if (GObject.type_from_name('DesktopCubeImageChooserButton') == null) {
    GObject.registerClass(
      {
        GTypeName: 'DesktopCubeImageChooserButton',
        Template: `resource:///ui/imageChooserButton.ui`,
        InternalChildren: ['button', 'label'],
        Properties: {
          'file': GObject.ParamSpec.string('file', 'file', 'file',
                                           GObject.ParamFlags.READWRITE, ''),
        },
      },
      class DesktopCubeImageChooserButton extends Gtk.Box {  // --------------------------
        _init(params = {}) {
          super._init(params);

          this._dialog = new Gtk.Dialog({use_header_bar: true, modal: true, title: ''});
          this._dialog.add_button(_('Select File'), Gtk.ResponseType.OK);
          this._dialog.add_button(_('Cancel'), Gtk.ResponseType.CANCEL);
          this._dialog.set_default_response(Gtk.ResponseType.OK);

          const fileFilter = new Gtk.FileFilter();
          fileFilter.add_mime_type('image/*');

          this._fileChooser = new Gtk.FileChooserWidget({
            action: Gtk.FileChooserAction.OPEN,
            hexpand: true,
            vexpand: true,
            height_request: 500,
            filter: fileFilter
          });

          this._dialog.get_content_area().append(this._fileChooser);

          this._dialog.connect('response', (dialog, id) => {
            if (id == Gtk.ResponseType.OK) {
              this.file = this._fileChooser.get_file().get_path();
            }
            dialog.hide();
          });

          this._button.connect('clicked', (button) => {
            this._dialog.set_transient_for(button.get_root());

            this._dialog.show();

            if (this._file != null) {
              this._fileChooser.set_file(this._file);
            }
          });
        }

        // Returns the currently selected file.
        get file() {
          return this._file.get_path();
        }

        // This makes the file chooser dialog preselect the given file.
        set file(value) {
          this._file = Gio.File.new_for_path(value);

          if (this._file.query_exists(null)) {
            this._label.label = this._file.get_basename();
          } else {
            this._label.label = _('(None)');
            this._file        = null;
          }

          this.notify('file');
        }
      });
  }
}