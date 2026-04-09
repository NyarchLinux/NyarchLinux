import Clutter from 'gi://Clutter';
import Cogl from 'gi://Cogl';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import {connectSettings, Debouncer} from './utils.js';

Gio._promisify(Gio.File.prototype, 'replace_contents_bytes_async', 'replace_contents_finish');
Gio._promisify(Gio.File.prototype, 'delete_async');

export class CustomStylesheet {
    constructor(settings) {
        this._fileName = 'XXXXXX-arcmenu-stylesheet.css';
        this._settings = settings;
        this._stylesheet = null;
        this._debouncer = new Debouncer();

        this._create();

        connectSettings(
            ['override-menu-theme', 'menu-background-color', 'menu-foreground-color', 'search-entry-border-radius',
                'menu-border-color', 'menu-border-width', 'menu-border-radius', 'menu-font-size', 'menu-separator-color',
                'menu-item-hover-bg-color', 'menu-item-hover-fg-color', 'menu-item-active-bg-color', 'menu-button-border-color',
                'menu-item-active-fg-color', 'menu-button-fg-color', 'menu-button-bg-color', 'menu-arrow-rise',
                'menu-button-hover-bg-color', 'menu-button-hover-fg-color', 'menu-button-active-bg-color',
                'menu-button-active-fg-color', 'menu-button-border-radius', 'menu-button-border-width'],
            this._onSettingsChanged.bind(this),
            this
        );
    }

    _onSettingsChanged() {
        this._debouncer.debounce('settingsChanged', () => this._update());
    }

    async _create() {
        try {
            const [file] = Gio.File.new_tmp(this._fileName);
            this._stylesheet = file;
            await this._update();
        } catch (e) {
            this._stylesheet = null;
            console.log(`ArcMenu - Error creating custom stylesheet: ${e}`);
        }
    }

    async _delete() {
        if (!this._stylesheet)
            return;

        this._unload();

        try {
            if (this._stylesheet.query_exists(null))
                await this._stylesheet.delete_async(GLib.PRIORITY_DEFAULT, null);
        } catch (e) {
            console.log(`ArcMenu - Error deleting custom stylesheet: ${e}`);
        } finally {
            this._stylesheet = null;
        }
    }

    destroy() {
        this._delete();
        this._debouncer.destroy();
        this._settings.disconnectObject(this);
        this._fileName = null;
        this._settings = null;
        this._debouncer = null;
    }

    _unload() {
        if (!this._stylesheet)
            return;

        const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
        theme.unload_stylesheet(this._stylesheet);
    }

    async _update() {
        if (!this._stylesheet) {
            console.log('ArcMenu - Warning: Custom stylesheet not found! Unable to set contents of custom stylesheet.');
            return;
        }

        this._unload();

        const customThemeEnabled = this._settings.get_boolean('override-menu-theme');
        const [menuRise, menuRiseValue] = this._settings.get_value('menu-arrow-rise').deep_unpack();
        const [buttonFG, buttonFGColor] = this._settings.get_value('menu-button-fg-color').deep_unpack();
        const [buttonBG, buttonBGColor] = this._settings.get_value('menu-button-bg-color').deep_unpack();
        const [buttonHoverBG, buttonHoverBGColor] = this._settings.get_value('menu-button-hover-bg-color').deep_unpack();
        const [buttonHoverFG, buttonHoverFGColor] = this._settings.get_value('menu-button-hover-fg-color').deep_unpack();
        const [buttonActiveBG, buttonActiveBGColor] = this._settings.get_value('menu-button-active-bg-color').deep_unpack();
        const [buttonActiveFG, buttonActiveFGColor] = this._settings.get_value('menu-button-active-fg-color').deep_unpack();
        const [buttonRadius, buttonRadiusValue] = this._settings.get_value('menu-button-border-radius').deep_unpack();
        const [buttonWidth, buttonWidthValue] = this._settings.get_value('menu-button-border-width').deep_unpack();
        const [buttonBorder, buttonBorderColor] = this._settings.get_value('menu-button-border-color').deep_unpack();
        const [searchBorder, searchBorderValue] = this._settings.get_value('search-entry-border-radius').deep_unpack();

        let css = '';

        if (buttonFG)
            css += `.arcmenu-menu-button{ color: ${buttonFGColor}; }`;
        if (buttonBG)
            css += `.arcmenu-panel-menu{ box-shadow: inset 0 0 0 100px transparent; background-color: ${buttonBGColor}; }`;
        if (buttonHoverBG)
            css += `.arcmenu-panel-menu:hover{ box-shadow: inset 0 0 0 100px transparent; background-color: ${buttonHoverBGColor}; }`;
        if (buttonHoverFG)
            css += `.arcmenu-panel-menu:hover .arcmenu-menu-button{ color: ${buttonHoverFGColor}; }`;
        if (buttonActiveFG)
            css += `.arcmenu-menu-button:active{ color: ${buttonActiveFGColor}; }`;
        if (buttonActiveBG)
            css += `.arcmenu-panel-menu:active{ box-shadow: inset 0 0 0 100px transparent; background-color: ${buttonActiveBGColor}; }`;
        if (buttonRadius)
            css += `.arcmenu-panel-menu{ border-radius: ${buttonRadiusValue}px; }`;
        if (buttonWidth)
            css += `.arcmenu-panel-menu{ border-width: ${buttonWidthValue}px; }`;
        if (buttonBorder)
            css += `.arcmenu-panel-menu{ border-color: ${buttonBorderColor}; }`;
        if (menuRise)
            css += `.arcmenu-menu{ -arrow-rise: ${menuRiseValue}px; }`;
        if (searchBorder)
            css += `#ArcMenuSearchEntry{ border-radius: ${searchBorderValue}px; }`;

        if (customThemeEnabled)
            css += this._buildCustomCSS();

        if (css.length === 0)
            return;

        try {
            const bytes = new GLib.Bytes(css);

            const [success, etag_] = await this._stylesheet.replace_contents_bytes_async(bytes, null, false,
                Gio.FileCreateFlags.REPLACE_DESTINATION, null);

            if (!success) {
                console.log('ArcMenu - Failed to replace contents of custom stylesheet.');
                return;
            }

            const theme = St.ThemeContext.get_for_stage(global.stage).get_theme();
            theme.load_stylesheet(this._stylesheet);
        } catch (e) {
            console.log(`ArcMenu - Error replacing contents of custom stylesheet: ${e}`);
        }
    }

    _buildCustomCSS() {
        const menuBGColor = this._settings.get_string('menu-background-color');
        const menuFGColor = this._settings.get_string('menu-foreground-color');
        const menuBorderColor = this._settings.get_string('menu-border-color');
        const menuBorderWidth = this._settings.get_int('menu-border-width');
        const menuBorderRadius = this._settings.get_int('menu-border-radius');
        const menuFontSize = this._settings.get_int('menu-font-size');
        const menuSeparatorColor = this._settings.get_string('menu-separator-color');
        const itemHoverBGColor = this._settings.get_string('menu-item-hover-bg-color');
        const itemHoverFGColor = this._settings.get_string('menu-item-hover-fg-color');
        const itemActiveBGColor = this._settings.get_string('menu-item-active-bg-color');
        const itemActiveFGColor = this._settings.get_string('menu-item-active-fg-color');

        return `.arcmenu-menu{
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
            background-color: ${this._adjustLuminance(menuBGColor, 0.15)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:hover, .arcmenu-menu StScrollBar StButton#hhandle:hover {
            background-color: ${this._adjustLuminance(menuBGColor, 0.20)};
        }
        .arcmenu-menu StScrollBar StButton#vhandle:active, .arcmenu-menu StScrollBar StButton#hhandle:active {
            background-color: ${this._adjustLuminance(menuBGColor, 0.25)};
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
            color: ${this._adjustLuminance(menuFGColor, 0, 0.6)};
            font-size: ${menuFontSize - 2}pt;
        }
        .arcmenu-menu .world-clocks-header, .arcmenu-menu .world-clocks-timezone,
        .arcmenu-menu .weather-header{
            color: ${this._adjustLuminance(menuFGColor, 0, 0.6)};
        }
        .arcmenu-menu .world-clocks-time, .arcmenu-menu .world-clocks-city{
            color: ${menuFGColor};
        }
        .arcmenu-menu .weather-forecast-time{
            color: ${this._adjustLuminance(menuFGColor, 0.1)};
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
            background-color: ${this._adjustLuminance(menuBGColor, 0.1, .4)};
        }
        .arcmenu-menu StEntry:hover{
            background-color: ${this._adjustLuminance(menuBGColor, 0.15, .4)};
        }
        .arcmenu-menu StEntry:focus{
            background-color: ${this._adjustLuminance(menuBGColor, 0.2, .4)};
            box-shadow: inset 0 0 0 2px ${itemActiveBGColor};
        }
        .arcmenu-menu StLabel.hint-text{
            color: ${this._adjustLuminance(menuFGColor, 0, 0.6)};
        }
        #ArcMenu_Tooltip{
            font-size: ${menuFontSize}pt;
            color: ${menuFGColor};
            background-color: ${this._adjustLuminance(menuBGColor, -0.125, 1)};
            border: 1px solid ${this._adjustLuminance(menuBorderColor, 0.025)};
        }
        .arcmenu-menu .user-icon{
            border-color: ${this._adjustLuminance(menuFGColor, 0, .7)};
        }`;
    }

    _adjustLuminance(colorString, luminanceAdjustment, overrideAlpha = null) {
        let color, hue, saturation, luminance;
        if (Clutter.Color) {
            color = Clutter.color_from_string(colorString)[1];
            [hue, luminance, saturation] = color.to_hls();
        } else {
            color = Cogl.color_from_string(colorString)[1];
            [hue, saturation, luminance] = color.to_hsl();
        }
        const modifiedLuminance =
        (luminance >= .85 && luminanceAdjustment > 0) ||
        (luminance <= .15 && luminanceAdjustment < 0)
            ? Math.max(Math.min(luminance - luminanceAdjustment, 1), 0)
            : Math.max(Math.min(luminance + luminanceAdjustment, 1), 0);

        let alpha = (color.alpha / 255).toPrecision(3);
        if (overrideAlpha)
            alpha = overrideAlpha;

        const modifiedColor = Clutter.Color
            ? Clutter.color_from_hls(hue, modifiedLuminance, saturation)
            : Cogl.color_init_from_hsl(hue, saturation, modifiedLuminance);

        return `rgba(${modifiedColor.red}, ${modifiedColor.green}, ${modifiedColor.blue}, ${alpha})`;
    }
}

