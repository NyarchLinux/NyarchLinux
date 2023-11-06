const char *colorname[] = {

  /* 8 normal colors */
  [0] = "#1f1b16", /* black   */
  [1] = "#CB7359", /* red     */
  [2] = "#C08C5D", /* green   */
  [3] = "#DE9870", /* yellow  */
  [4] = "#948082", /* blue    */
  [5] = "#B1968F", /* magenta */
  [6] = "#E7AF91", /* cyan    */
  [7] = "#f2e0cc", /* white   */

  /* 8 bright colors */
  [8]  = "#a99c8e",  /* black   */
  [9]  = "#CB7359",  /* red     */
  [10] = "#C08C5D", /* green   */
  [11] = "#DE9870", /* yellow  */
  [12] = "#948082", /* blue    */
  [13] = "#B1968F", /* magenta */
  [14] = "#E7AF91", /* cyan    */
  [15] = "#f2e0cc", /* white   */

  /* special colors */
  [256] = "#1f1b16", /* background */
  [257] = "#f2e0cc", /* foreground */
  [258] = "#f2e0cc",     /* cursor */
};

/* Default colors (colorname index)
 * foreground, background, cursor */
 unsigned int defaultbg = 0;
 unsigned int defaultfg = 257;
 unsigned int defaultcs = 258;
 unsigned int defaultrcs= 258;
