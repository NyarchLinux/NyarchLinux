const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const extUtils       = imports.misc.extensionUtils

const { uuid } = extUtils.getCurrentExtension ()

var init_translations = () => {
  extUtils.initTranslations (uuid)
}
var init_translations_prefs = () => {
  imports.gettext.textdomain (uuid)
  extUtils.initTranslations (uuid)
}

var _ = imports.gettext.domain (uuid).gettext
var ngettext = imports.gettext.domain (uuid).ngettext
