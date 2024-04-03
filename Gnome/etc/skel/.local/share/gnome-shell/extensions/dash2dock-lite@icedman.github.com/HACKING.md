## media playing

```js
media = Main.panel._centerBox.first_child.child._delegate._messageList._scrollView.last_child.get_children()[0]

v = media._players.entries(0)
v.next().value
```

## message list

```js
calendar = Main.panel._centerBox.first_child.child._delegate._messageList._scrollView.last_child.get_children()[1]

calendar._messages;
calendar.first_child.get_children()[0]

// messageList.js
calendar._messages[1]._iconBin
calendar._messages[1].titleLabel
calendar._messages[1].bodyLabel
calendar._messages[1].notification
calendar._messages[0].notification.source._appId

const MessageTray = imports.ui.messageTray;
// LOW, NORMAL, HIGH, CRITICAL
// MessageTray.Urgency.CRITICAL

calendar._messages[1].notification.urgency
calendar._messages[1]._iconBin.first_child.icon_name

// calendar events
// org.gnome.Evolution-alarm-notify.desktop

```

## gsettings

S = imports.gi.Gio.Settings
s = new S({schema_id: 'org.gnome.desktop.wm.preferences'})
s.get_string('button-layout')

## theme

file = Gio.File.new_for_path(".../style.css")
theme_ctx = St.ThemeContext.get_for_stage(global.stage)
theme = theme_ctx.get_theme();
theme.load_stylesheet(file);
theme.unload_stylesheet(file);

## coolest animation

https://github.com/PuruVJ/macos-web-svelte-dock

## Preferences improvement

AdwExpanderRow