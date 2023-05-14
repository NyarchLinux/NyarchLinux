static const char norm_fg[] = "#dcd0d5";
static const char norm_bg[] = "#1b1b1e";
static const char norm_border[] = "#9a9195";

static const char sel_fg[] = "#dcd0d5";
static const char sel_bg[] = "#4E586E";
static const char sel_border[] = "#dcd0d5";

static const char urg_fg[] = "#dcd0d5";
static const char urg_bg[] = "#384457";
static const char urg_border[] = "#384457";

static const char *colors[][3]      = {
    /*               fg           bg         border                         */
    [SchemeNorm] = { norm_fg,     norm_bg,   norm_border }, // unfocused wins
    [SchemeSel]  = { sel_fg,      sel_bg,    sel_border },  // the focused win
    [SchemeUrg] =  { urg_fg,      urg_bg,    urg_border },
};
