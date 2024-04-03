'use strict';

import Gio from 'gi://Gio';
import St from 'gi://St';

const CustomStylesPath = '/tmp';

export const Style = class {
  constructor() {
    this.styles = {};
    this.style_contents = {};
  }

  unloadAll() {
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx.get_theme();
    Object.keys(this.styles).forEach((k) => {
      let fn = this.styles[k];
      theme.unload_stylesheet(fn);
    });
  }

  build(name, style_array) {
    let fn = this.styles[name];
    let ctx = St.ThemeContext.get_for_stage(global.stage);
    let theme = ctx.get_theme();

    let content = '';
    style_array.forEach((k) => {
      content = `${content}\n${k}`;
    });

    if (this.style_contents[name] === content) {
      // log('skip regeneration');
      return;
    }

    if (fn) {
      theme.unload_stylesheet(fn);
    } else {
      fn = Gio.File.new_for_path(`${CustomStylesPath}/${name}.css`);
      this.styles[name] = fn;
    }

    this.style_contents[name] = content;
    const [, etag] = fn.replace_contents(
      content,
      null,
      false,
      Gio.FileCreateFlags.REPLACE_DESTINATION,
      null
    );

    theme.load_stylesheet(fn);

    // log(content);
  }

  rgba(color) {
    let clr = color || [1, 1, 1, 1];
    let res = clr.map((r) => Math.floor(255 * r));
    res[3] = clr[3].toFixed(1);
    return res.join(',');
  }
};
