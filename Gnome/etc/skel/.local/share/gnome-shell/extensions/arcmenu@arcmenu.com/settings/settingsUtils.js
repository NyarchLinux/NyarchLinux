import Gdk from 'gi://Gdk';
import GdkPixbuf from 'gi://GdkPixbuf';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';

import * as Constants from '../constants.js';

/**
 *
 * @param {Constants.MenuLayout} menuLayout menulayout enum
 * @returns 'name of menu layout'
 */
export function getMenuLayoutName(menuLayout) {
    for (const styles of Constants.MenuStyles) {
        for (const style of styles.MENU_TYPE) {
            if (style.LAYOUT === menuLayout)
                return style.TITLE;
        }
    }
    return '';
}

/**
 *
 * @param {Array} rows the array of setting rows to show/hide
 * @param {Constants.MenuLayout} menuLayout menulayout enum
 */
export function setVisibleRows(rows, menuLayout) {
    for (const row in rows)
        rows[row].visible = true;

    switch (menuLayout) {
    case Constants.MenuLayout.PLASMA:
    case Constants.MenuLayout.TOGNEE:
    case Constants.MenuLayout.ARCMENU:
        break;
    case Constants.MenuLayout.ELEVEN:
    case Constants.MenuLayout.AZ:
    case Constants.MenuLayout.INSIDER:
    case Constants.MenuLayout.SLEEK:
        rows[Constants.SettingsPage.DIRECTORY_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.APPLICATION_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.EXTRA_CATEGORIES].visible = false;
        break;
    case Constants.MenuLayout.WHISKER:
    case Constants.MenuLayout.BRISK:
    case Constants.MenuLayout.ENTERPRISE:
    case Constants.MenuLayout.ZEST:
        rows[Constants.SettingsPage.DIRECTORY_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.APPLICATION_SHORTCUTS].visible = false;
        break;
    case Constants.MenuLayout.MINT:
    case Constants.MenuLayout.BUDGIE:
    case Constants.MenuLayout.GNOME_MENU:
        rows[Constants.SettingsPage.DIRECTORY_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.APPLICATION_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.POWER_OPTIONS].visible = false;
        break;
    case Constants.MenuLayout.RAVEN:
    case Constants.MenuLayout.UNITY:
        rows[Constants.SettingsPage.DIRECTORY_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.POWER_OPTIONS].visible = false;
        break;
    case Constants.MenuLayout.ELEMENTARY:
    case Constants.MenuLayout.CHROMEBOOK:
    case Constants.MenuLayout.RUNNER:
    case Constants.MenuLayout.POP:
        rows[Constants.SettingsPage.PINNED_APPS].visible = false;
        rows[Constants.SettingsPage.APPLICATION_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.DIRECTORY_SHORTCUTS].visible = false;
        rows[Constants.SettingsPage.POWER_OPTIONS].visible = false;
        rows[Constants.SettingsPage.EXTRA_CATEGORIES].visible = false;
        break;
    case Constants.MenuLayout.REDMOND:
    case Constants.MenuLayout.WINDOWS:
        rows[Constants.SettingsPage.EXTRA_CATEGORIES].visible = false;
        break;
    case Constants.MenuLayout.GNOME_OVERVIEW:
        for (const row in rows)
            rows[row].visible = false;
        break;
    default:
        break;
    }
}

/**
 *
 * @param {string} colorString string representing a color
 * @returns a new Gdk.RGBA() representing the colorString
 */
export function parseRGBA(colorString) {
    const rgba = new Gdk.RGBA();
    rgba.parse(colorString);
    return rgba;
}

function rgbaToArray(rgba) {
    return [Math.round(rgba.red * 255), Math.round(rgba.green * 255), Math.round(rgba.blue * 255), Math.round(rgba.alpha * 255)];
}

/**
 *
 * @param {string} color1 string representing a color
 * @param {string} color2 string representing a color
 * @param {string} color3 string representing a color
 * @param {string} color4 string representing a color
 * @returns GdkPixbuf.Pixbuf
 */
export function createThemePreviewPixbuf(color1, color2, color3, color4) {
    color1 = rgbaToArray(parseRGBA(color1));
    color2 = rgbaToArray(parseRGBA(color2));
    color3 = rgbaToArray(parseRGBA(color3));
    color4 = rgbaToArray(parseRGBA(color4));
    const borderColor = [170, 170, 170, 255];

    const hasAlpha = true;
    const width = 42;
    const height = 14;
    const pixels = hasAlpha ? 4 : 3;
    const rowStride = width * pixels;

    // Remove the alpha channel from the color arrays if hasAlpha = false
    if (!hasAlpha) {
        color1.pop();
        color2.pop();
        color3.pop();
        color4.pop();
        borderColor.pop();
    }

    const data = new Uint8Array(rowStride * height);

    // Top and Bottom border
    for (let i = 0; i < width; i++) {
        data.set(borderColor, i * pixels);
        data.set(borderColor, (height - 1) * rowStride + i * pixels);
    }

    // Middle section (color patterns)
    for (let row = 1; row < height - 1; row++) {
        // First pixel of the row (gray border)
        data.set(borderColor, row * rowStride);

        // Patterned section (using color1, color2, color3, color4)
        for (let col = 1; col < width - 1; col++) {
            let color;
            if (col <= 10)
                color = color1;
            else if (col <= 20)
                color = color2;
            else if (col <= 30)
                color = color3;
            else
                color = color4;

            data.set(color, row * rowStride + col * pixels);
        }

        // Last pixel of the row (gray border)
        data.set(borderColor, row * rowStride + (width - 1) * pixels);
    }

    const pixbuf = GdkPixbuf.Pixbuf.new_from_bytes(
        data,
        GdkPixbuf.Colorspace.RGB,
        hasAlpha,
        8,
        width,
        height,
        rowStride
    );

    return pixbuf;
}

/**
 *
 * @param {Gdk.RGBA} color A Gdk.RGBA to convert to a string in hex format
 * @returns String of Color in hex
 */
export function rgbToHex(color) {
    const [r, g, b, a_] = [Math.round(color.red * 255), Math.round(color.green * 255),
        Math.round(color.blue * 255), Math.round(color.alpha * 255)];
    return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 *
 * @param {object} listing The shortcut data listing
 * @returns An icon name for the given listing data
 */
export function getIconStringFromListing(listing) {
    let path;
    const shortcutCommand = listing[2];
    const shortcutIconName = listing[1];

    switch (shortcutCommand) {
    case Constants.ShortcutCommands.DOCUMENTS:
        path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOCUMENTS);
        break;
    case Constants.ShortcutCommands.DOWNLOADS:
        path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_DOWNLOAD);
        break;
    case Constants.ShortcutCommands.MUSIC:
        path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_MUSIC);
        break;
    case Constants.ShortcutCommands.PICTURES:
        path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_PICTURES);
        break;
    case Constants.ShortcutCommands.VIDEOS:
        path = GLib.get_user_special_dir(GLib.UserDirectory.DIRECTORY_VIDEOS);
        break;
    case Constants.ShortcutCommands.HOME:
        path = GLib.get_home_dir();
        break;
    case Constants.ShortcutCommands.NETWORK:
        return 'network-workgroup-symbolic';
    case Constants.ShortcutCommands.COMPUTER:
        return 'drive-harddisk-symbolic';
    case Constants.ShortcutCommands.RECENT:
        return 'document-open-recent-symbolic';
    default:
        path = shortcutCommand ?? shortcutIconName;
    }

    if (!path)
        return shortcutIconName;

    const file = Gio.File.new_for_path(path);

    if (!file.query_exists(null))
        return shortcutIconName;

    try {
        const info = file.query_info('standard::symbolic-icon', 0, null);
        return info.get_symbolic_icon().to_string();
    } catch (e) {
        if (e instanceof Gio.IOErrorEnum) {
            if (!file.is_native())
                return new Gio.ThemedIcon({name: 'folder-remote-symbolic'}).to_string();
            else
                return new Gio.ThemedIcon({name: 'folder-symbolic'}).to_string();
        }
    }
    return '';
}
