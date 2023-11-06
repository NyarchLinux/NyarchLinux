static const char norm_fg[] = "#f2e0cc";
static const char norm_bg[] = "#1f1b16";
static const char norm_border[] = "#a99c8e";

static const char sel_fg[] = "#f2e0cc";
static const char sel_bg[] = "#C08C5D";
static const char sel_border[] = "#f2e0cc";

static const char urg_fg[] = "#f2e0cc";
static const char urg_bg[] = "#CB7359";
static const char urg_border[] = "#CB7359";

static const char *colors[][3]      = {
    /*               fg           bg         border                         */
    [SchemeNorm] = { norm_fg,     norm_bg,   norm_border }, // unfocused wins
    [SchemeSel]  = { sel_fg,      sel_bg,    sel_border },  // the focused win
    [SchemeUrg] =  { urg_fg,      urg_bg,    urg_border },
};
