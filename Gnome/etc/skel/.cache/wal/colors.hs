--Place this file in your .xmonad/lib directory and import module Colors into .xmonad/xmonad.hs config
--The easy way is to create a soft link from this file to the file in .xmonad/lib using ln -s
--Then recompile and restart xmonad.

module Colors
    ( wallpaper
    , background, foreground, cursor
    , color0, color1, color2, color3, color4, color5, color6, color7
    , color8, color9, color10, color11, color12, color13, color14, color15
    ) where

-- Shell variables
-- Generated by 'wal'
wallpaper="/home/weeb/.local/share/backgrounds/2023-11-06-13-15-02-default.png"

-- Special
background="#1f1b16"
foreground="#f2e0cc"
cursor="#f2e0cc"

-- Colors
color0="#1f1b16"
color1="#CB7359"
color2="#C08C5D"
color3="#DE9870"
color4="#948082"
color5="#B1968F"
color6="#E7AF91"
color7="#f2e0cc"
color8="#a99c8e"
color9="#CB7359"
color10="#C08C5D"
color11="#DE9870"
color12="#948082"
color13="#B1968F"
color14="#E7AF91"
color15="#f2e0cc"
