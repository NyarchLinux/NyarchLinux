import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {ArcMenuManager} from './arcmenuManager.js';

Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');
Gio._promisify(Gio.File.prototype, 'delete_async');

const FileName = 'XXXXXX-arcmenu-stylesheet.css';

/**
 * Create and load a custom stylesheet file into global.stage St.Theme
 */
export function createStylesheet() {
    try {
        const [file] = Gio.File.new_tmp(FileName);
        ArcMenuManager.customStylesheet = file;
        updateStylesheet();
    } catch (e) {
        console.log(`ArcMenu - Error creating custom stylesheet: ${e}`);
    }
}

/**
 * Unload the custom stylesheet from global.stage St.Theme
 */
function unloadStylesheet() {
    if (!ArcMenuManager.customStylesheet)
        return;

    const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
    theme.unload_stylesheet(ArcMenuManager.customStylesheet);
}

/**
 * Delete and unload the custom stylesheet file from global.stage St.Theme
 */
export async function deleteStylesheet() {
    unloadStylesheet();

    const stylesheet = ArcMenuManager.customStylesheet;

    try {
        if (stylesheet.query_exists(null))
            await stylesheet.delete_async(GLib.PRIORITY_DEFAULT, null);
    } catch (e) {
        if (!e.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NOT_FOUND))
            console.log(`ArcMenu - Error deleting custom stylesheet: ${e}`);
    }
}

/**
 * Write theme data to custom stylesheet and reload into global.stage St.Theme
 */
export async function updateStylesheet() {
    const {settings} = ArcMenuManager;
    const stylesheet = ArcMenuManager.customStylesheet;

    if (!stylesheet) {
        console.log('ArcMenu - Warning: Custom stylesheet not found! Unable to set contents of custom stylesheet.');
        return;
    }

    unloadStylesheet();

    let customMenuThemeCSS = '';
    let extraStylingCSS = '';

    const menuBGColor = settings.get_string('menu-background-color');
    const menuFGColor = settings.get_string('menu-foreground-color');
    const menuBorderColor = settings.get_string('menu-border-color');
    const menuBorderWidth = settings.get_int('menu-border-width');
    const menuBorderRadius = settings.get_int('menu-border-radius');
    const menuFontSize = settings.get_int('menu-font-size');
    const menuSeparatorColor = settings.get_string('menu-separator-color');
    const itemHoverBGColor = settings.get_string('menu-item-hover-bg-color');
    const itemHoverFGColor = settings.get_string('menu-item-hover-fg-color');
    const itemActiveBGColor = settings.get_string('menu-item-active-bg-color');
    const itemActiveFGColor = settings.get_string('menu-item-active-fg-color');

    const [menuRise, menuRiseValue] = settings.get_value('menu-arrow-rise').deep_unpack();

    const [buttonFG, buttonFGColor] = settings.get_value('menu-button-fg-color').deep_unpack();
    const [buttonBG, buttonBGColor] = settings.get_value('menu-button-bg-color').deep_unpack();
    const [buttonHoverBG, buttonHoverBGColor] = settings.get_value('menu-button-hover-bg-color').deep_unpack();
    const [buttonHoverFG, buttonHoverFGColor] = settings.get_value('menu-button-hover-fg-color').deep_unpack();
    const [buttonActiveBG, buttonActiveBGColor] = settings.get_value('menu-button-active-bg-color').deep_unpack();
    const [buttonActiveFG, buttonActiveFGColor] = settings.get_value('menu-button-active-fg-color').deep_unpack();
    const [buttonRadius, buttonRadiusValue] = settings.get_value('menu-button-border-radius').deep_unpack();
    const [buttonWidth, buttonWidthValue] = settings.get_value('menu-button-border-width').deep_unpack();
    const [buttonBorder, buttonBorderColor] = settings.get_value('menu-button-border-color').deep_unpack();
    const [searchBorder, searchBorderValue] = settings.get_value('search-entry-border-radius').deep_unpack();

    if (buttonFG) {
        extraStylingCSS += `.arcmenu-menu-button{
                                color: ${buttonFGColor};
                            }`;
    }
    if (buttonBG) {
        extraStylingCSS += `.arcmenu-panel-menu{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonBGColor};
                            }`;
    }
    if (buttonHoverBG) {
        extraStylingCSS += `.arcmenu-panel-menu:hover{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonHoverBGColor};
                            }`;
    }
    if (buttonHoverFG) {
        extraStylingCSS += `.arcmenu-panel-menu:hover .arcmenu-menu-button{
                                color: ${buttonHoverFGColor};
                            }`;
    }
    if (buttonActiveFG) {
        extraStylingCSS += `.arcmenu-menu-button:active{
                                color: ${buttonActiveFGColor};
                            }`;
    }
    if (buttonActiveBG) {
        extraStylingCSS += `.arcmenu-panel-menu:active{
                                box-shadow: inset 0 0 0 100px transparent;
                                background-color: ${buttonActiveBGColor};
                            }`;
    }
    if (buttonRadius) {
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-radius: ${buttonRadiusValue}px;
                            }`;
    }
    if (buttonWidth) {
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-width: ${buttonWidthValue}px;
                            }`;
    }
    if (buttonBorder) {
        extraStylingCSS += `.arcmenu-panel-menu{
                                border-color: ${buttonBorderColor};
                            }`;
    }
    if (menuRise) {
        extraStylingCSS += `.arcmenu-menu{
                                -arrow-rise: ${menuRiseValue}px;
                            }`;
    }
    if (searchBorder) {
        extraStylingCSS += `#ArcMenuSearchEntry{
                                border-radius: ${searchBorderValue}px;
                            }`;
    }

    if (settings.get_boolean('override-menu-theme')) {
        customMenuThemeCSS = `
        .arcmenu-menu{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
        }
        .arcmenu-menu .popup-menu-content {
            background-color: ${menuBGColor};
            border-color: ${menuBorderColor};
            border-width: ${menuBorderWidth}px;
            border-radius: ${menuBorderRadius}px;
        }
        .arcmenu-menu StButton {
            color: ${menuFGColor};
            background-color: ${menuBGColor};
            border-width: 0px;
            box-shadow: none;
            border-radius: 8px;
        }
        .arcmenu-menu StScrollBar StButton#vhandle, .arcmenu-menu StScrollBar StButton#hhandle {
            background-color: ${modifyColorLuminance(menuBGColor, 0.15)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:hover, .arcmenu-menu StScrollBar StButton#hhandle:hover {
            background-color: ${modifyColorLuminance(menuBGColor, 0.20)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:active, .arcmenu-menu StScrollBar StButton#hhandle:active {
            background-color: ${modifyColorLuminance(menuBGColor, 0.25)};
        }
        .arcmenu-menu .popup-menu-item {
            color: ${menuFGColor};
        }
        .arcmenu-menu .popup-menu-item:focus, .arcmenu-menu .popup-menu-item:hover,
        .arcmenu-menu .popup-menu-item:checked, .arcmenu-menu .popup-menu-item.selected, .arcmenu-menu .popup-menu-item:selected,
        .arcmenu-menu StButton:focus, .arcmenu-menu StButton:hover, .arcmenu-menu StButton:checked {
            color: ${itemHoverFGColor};
            background-color: ${itemHoverBGColor};
        }
        .arcmenu-menu .popup-menu-item:active, .arcmenu-menu StButton:active {
            color: ${itemActiveFGColor};
            background-color: ${itemActiveBGColor};
        }
        .arcmenu-menu .popup-menu-item:insensitive{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
            font-size: ${menuFontSize - 2}pt;
        }
        .arcmenu-menu .world-clocks-header, .arcmenu-menu .world-clocks-timezone,
        .arcmenu-menu .weather-header{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-menu .world-clocks-time, .arcmenu-menu .world-clocks-city{
            color: ${menuFGColor};
        }
        .arcmenu-menu .weather-forecast-time{
            color: ${modifyColorLuminance(menuFGColor, 0.1)};
        }
        .arcmenu-menu .popup-separator-menu-item .popup-separator-menu-item-separator{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu .popup-separator-menu-item StLabel{
            color: ${menuFGColor};
        }
        .separator-color-style{
            background-color: ${menuSeparatorColor};
        }
        .arcmenu-menu StEntry{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, 0.1, .4)};
        }
        .arcmenu-menu StEntry:hover{
            background-color: ${modifyColorLuminance(menuBGColor, 0.15, .4)};
        }
        .arcmenu-menu StEntry:focus{
            background-color: ${modifyColorLuminance(menuBGColor, 0.2, .4)};
            box-shadow: inset 0 0 0 2px ${itemActiveBGColor};
        }
        .arcmenu-menu StLabel.hint-text{
            color: ${modifyColorLuminance(menuFGColor, 0, 0.6)};
        }
        #ArcMenu_Tooltip{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
            background-color: ${modifyColorLuminance(menuBGColor, -0.125, 1)};
            border: 1px solid ${modifyColorLuminance(menuBorderColor, 0.025)};
        }
        .arcmenu-menu .user-icon{
            border-color: ${modifyColorLuminance(menuFGColor, 0, .7)};
        }
        `;
    }

    const customStylesheetCSS = customMenuThemeCSS + extraStylingCSS;

    if (customStylesheetCSS.length === 0)
        return;

    try {
        const bytes = new GLib.Bytes(customStylesheetCSS);

        const [success, etag_] = await stylesheet.replace_contents_bytes_async(bytes, null, false,
            Gio.FileCreateFlags.REPLACE_DESTINATION, null);

        if (!success) {
            console.log('ArcMenu - Failed to replace contents of custom stylesheet.');
            return;
        }

        ArcMenuManager.customStylesheet = stylesheet;
        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.load_stylesheet(ArcMenuManager.customStylesheet);
    } catch (e) {
        console.log(`ArcMenu - Error replacing contents of custom stylesheet: ${e}`);
    }
}

/**
 *
 * @param {string} colorString the color to modify
 * @param {number} luminanceAdjustment luminance adjustment
 * @param {number} overrideAlpha change the color alpha to this value
 * @returns a string in rbga() format representing the new modified color
 */
function modifyColorLuminance(colorString, luminanceAdjustment, overrideAlpha = null) {
    let color, hue, saturation, luminance;

    // GNOME 47 merged ClutterColor into CoglColor
    if (Clutter.Color) {
        color = Clutter.color_from_string(colorString)[1];
        [hue, luminance, saturation] = color.to_hls();
    } else {
        color = Cogl.color_from_string(colorString)[1];
        [hue, saturation, luminance] = color.to_hsl();
    }

    let modifiedLuminance;

    if ((luminance >= .85 && luminanceAdjustment > 0) || (luminance <= .15 && luminanceAdjustment < 0))
        modifiedLuminance = Math.max(Math.min(luminance - luminanceAdjustment, 1), 0);
    else
        modifiedLuminance = Math.max(Math.min(luminance + luminanceAdjustment, 1), 0);

    let alpha = (color.alpha / 255).toPrecision(3);
    if (overrideAlpha)
        alpha = overrideAlpha;

    let modifiedColor;

    // GNOME 47 merged ClutterColor into CoglColor
    if (Clutter.Color)
        modifiedColor = Clutter.color_from_hls(hue, modifiedLuminance, saturation);
    else
        modifiedColor = Cogl.color_init_from_hsl(hue, saturation, modifiedLuminance);

    return `rgba(${modifiedColor.red}, ${modifiedColor.green}, ${modifiedColor.blue}, ${alpha})`;
}
