import Adw from "gi://Adw"
import * as Prefs from "./preferences/Prefs.js"
import { ExtensionPreferences } from "resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js"

export default class TrayIconsReloadedPreferences extends ExtensionPreferences {
    fillPreferencesWindow(window) {
        const page = new Adw.PreferencesPage()
        const group = new Adw.PreferencesGroup()
        group.add(new Prefs.Prefs(this.getSettings())) // TODO: We should embrace fully AdwPreferencesPage
        page.add(group)
        window.add(page)
    }
}
