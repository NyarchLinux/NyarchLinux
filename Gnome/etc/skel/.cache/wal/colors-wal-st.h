const char *colorname[] = {

  /* 8 normal colors */
  [0] = "#1b1b1e", /* black   */
  [1] = "#384457", /* red     */
  [2] = "#4E586E", /* green   */
  [3] = "#565464", /* yellow  */
  [4] = "#965D6A", /* blue    */
  [5] = "#636F88", /* magenta */
  [6] = "#AB9AA7", /* cyan    */
  [7] = "#dcd0d5", /* white   */

  /* 8 bright colors */
  [8]  = "#9a9195",  /* black   */
  [9]  = "#384457",  /* red     */
  [10] = "#4E586E", /* green   */
  [11] = "#565464", /* yellow  */
  [12] = "#965D6A", /* blue    */
  [13] = "#636F88", /* magenta */
  [14] = "#AB9AA7", /* cyan    */
  [15] = "#dcd0d5", /* white   */

  /* special colors */
  [256] = "#1b1b1e", /* background */
  [257] = "#dcd0d5", /* foreground */
  [258] = "#dcd0d5",     /* cursor */
};

/* Default colors (colorname index)
 * foreground, background, cursor */
 unsigned int defaultbg = 0;
 unsigned int defaultfg = 257;
 unsigned int defaultcs = 258;
 unsigned int defaultrcs= 258;
