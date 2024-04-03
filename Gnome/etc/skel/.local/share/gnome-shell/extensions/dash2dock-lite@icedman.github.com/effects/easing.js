'use strict';

/* PennerEasing */
export const Linear = {
  easeNone: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeIn: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
  easeInOut: (t, b, c, d) => {
    return (c * t) / d + b;
  },
};

export const Bounce = {
  easeIn: (t, b, c, d) => {
    return c - Bounce.easeOut(d - t, 0, c, d) + b;
  },

  easeOut: (t, b, c, d) => {
    if ((t /= d) < 1 / 2.75) {
      return c * (7.5625 * t * t) + b;
    } else if (t < 2 / 2.75) {
      let postFix = (t -= 1.5 / 2.75);
      return c * (7.5625 * postFix * t + 0.75) + b;
    } else if (t < 2.5 / 2.75) {
      let postFix = (t -= 2.25 / 2.75);
      return c * (7.5625 * postFix * t + 0.9375) + b;
    } else {
      let postFix = (t -= 2.625 / 2.75);
      return c * (7.5625 * postFix * t + 0.984375) + b;
    }
  },

  easeInOut: (t, b, c, d) => {
    if (t < d / 2) return Bounce.easeIn(t * 2, 0, c, d) * 0.5 + b;
    else return Bounce.easeOut(t * 2 - d, 0, c, d) * 0.5 + c * 0.5 + b;
  },
};

var Back = {
  easeIn: (t, b, c, d) => {
    let s = 1.70158;
    let postFix = (t /= d);
    return c * postFix * t * ((s + 1) * t - s) + b;
  },

  easeOut: (t, b, c, d) => {
    let s = 1.70158;
    return c * ((t = t / d - 1) * t * ((s + 1) * t + s) + 1) + b;
  },

  easeInOut: (t, b, c, d) => {
    let s = 1.70158;
    if ((t /= d / 2) < 1)
      return (c / 2) * (t * t * (((s *= 1.525) + 1) * t - s)) + b;
    let postFix = (t -= 2);
    return (c / 2) * (postFix * t * (((s *= 1.525) + 1) * t + s) + 2) + b;
  },
};
