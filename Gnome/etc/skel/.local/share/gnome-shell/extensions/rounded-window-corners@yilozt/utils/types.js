const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

/** Bounds of rounded corners  */
var Bounds = class Bounds {
  constructor () {
    this.x1 = 0
    this.y1 = 0
    this.x2 = 0
    this.y2 = 0
  }
}

var Padding = class Padding {
  constructor () {
    this.left = 0
    this.right = 0
    this.top = 0
    this.bottom = 0
  }
}

var box_shadow_css = (box_shadow, scale = 1) => {
  return `box-shadow: ${box_shadow.horizontal_offset * scale}px
          ${box_shadow.vertical_offset * scale}px
          ${box_shadow.blur_offset * scale}px
          ${box_shadow.spread_radius * scale}px
          rgba(0,0,0, ${box_shadow.opacity / 100})`
}
