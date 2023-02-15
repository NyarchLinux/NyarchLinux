const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const { General }    = Me.imports.preferences.pages.general
const { BlackList }  = Me.imports.preferences.pages.blacklist
const { Custom }     = Me.imports.preferences.pages.custom
const { _ }          = Me.imports.utils.i18n

var pages = () => [
  {
    title: _ ('General'),
    icon_name: 'emblem-system-symbolic',
    widget: new General (),
  },
  {
    title: _ ('Blacklist'),
    icon_name: 'action-unavailable-symbolic',
    widget: new BlackList (),
  },
  {
    title: _ ('Custom'),
    icon_name: 'document-edit-symbolic',
    widget: new Custom (),
  },
]
