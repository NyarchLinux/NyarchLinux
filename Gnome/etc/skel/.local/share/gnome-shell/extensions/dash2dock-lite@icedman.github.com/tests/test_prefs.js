#!/usr/bin/gjs

const { Adw, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;

class PrefKeys {
  constructor() {
    this._keys = {};
    this._signals = [];
  }

  setKeys(keys) {
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      this.setKey(
        name,
        key.value_type,
        key.default_value,
        key.widget_type,
        key.key_maps
      );
    });
  }

  setKey(name, value_type, default_value, widget_type, key_maps) {
    this._keys[name] = {
      name,
      value_type,
      default_value,
      widget_type,
      value: default_value,
      maps: key_maps,
      object: null,
    };
  }

  setValue(name, value) {
    this._keys[name].value = value;
    if (this.onSetValue) {
      this.onSetValue(name, this._keys[name].value);
    }
  }

  getKey(name) {
    return this._keys[name];
  }

  getValue(name) {
    let value = this._keys[name].value;
    if (this.onGetValue) {
      value = this.onGetValue(name, value);
    }
    return value;
  }

  reset(name) {
    this.setValue(name, this._keys[name].default_value);
  }

  resetAll() {
    Object.keys(this._keys).forEach((k) => {
      this.reset(k);
    });
  }

  keys() {
    return this._keys;
  }

  // onSetValue(name, value) {
  // }

  // onGetValue(name, value) {
  //   return value;
  // }

  connectSignals(builder) {
    let self = this;
    let keys = this._keys;
    Object.keys(keys).forEach((name) => {
      let key = keys[name];
      let signal_id = null;
      key.object = builder.get_object(key.name);
      switch (key.widget_type) {
        case 'switch': {
          signal_id = key.object.connect('state-set', (w) => {
            let value = w.get_active();
            self.setValue(name, value);
            // print(value);
          });
          break;
        }
        case 'dropdown': {
          signal_id = key.object.connect('notify::selected-item', (w) => {
            let index = w.get_selected();
            let value = index in key.maps ? key.maps[index] : index;
            self.setValue(name, value);
            print(value);
          });
          break;
        }
        case 'scale': {
          signal_id = key.object.connect('value-changed', (w) => {
            let value = w.get_value();
            self.setValue(name, value);
            // print(value);
          });
          break;
        }
        case 'color': {
          signal_id = key.object.connect('color-set', (w) => {
            let rgba = w.get_rgba();
            let value = [rgba.red, rgba.green, rgba.blue, rgba.alpha];
            print(value);
            self.setValue(name, value);
          });
          break;
        }
        case 'button': {
          signal_id = key.object.connect('clicked', (w) => {
            if (key.callback) {
              key.callback();
            }
          });
          break;
        }
      }

      this._signals.push({
        source: key.object,
        signal_id: signal_id,
      });
    });
  }
}

let prefKeys = new PrefKeys();
prefKeys.setKeys({
  'animation-fps': {
    default_value: 0,
    widget_type: 'dropdown',
    key_maps: {},
  },
  'running-indicator-color': {
    default_value: [1, 1, 1, 1],
    widget_type: 'color',
    key_maps: {},
  },
});

function find(n, name) {
  if (n.get_name() == name) {
    return n;
  }
  let c = n.get_first_child();
  while (c) {
    let cn = this.find(c, name);
    if (cn) {
      return cn;
    }
    c = c.get_next_sibling();
  }
  return null;
}

function dump(n, l) {
  let s = '';
  for (let i = 0; i < l; i++) {
    s += ' ';
  }
  print(`${s}${n.get_name()}`);
  let c = n.get_first_child();
  while (c) {
    this.dump(c, l + 1);
    c = c.get_next_sibling();
  }
}

let app = new Adw.Application({
  application_id: 'com.dash2dock-lite.GtkApplication',
});

app.connect('activate', (me) => {
  m = new Gtk.ApplicationWindow({ application: me });
  m.set_default_size(600, 250);
  m.set_title('Prefs Test');

  let iconTheme = Gtk.IconTheme.get_for_display(Gdk.Display.get_default());
  iconTheme.add_search_path('ui/icons');

  w = new Adw.PreferencesWindow();
  // w.add(new Adw.PreferencesPage());

  let builder = new Gtk.Builder();
  builder.add_from_file(`ui/general.ui`);
  builder.add_from_file(`ui/appearance.ui`);
  builder.add_from_file(`ui/tweaks.ui`);
  builder.add_from_file(`ui/menu.ui`);
  builder.add_from_file(`ui/others.ui`);
  w.add(builder.get_object('general'));
  w.add(builder.get_object('appearance'));
  w.add(builder.get_object('tweaks'));
  w.add(builder.get_object('others'));

  let menu_util = builder.get_object('menu_util');
  w.add(menu_util);
  w.title = 'Dash2Dock Animated';

  let headerbar = find(w, 'AdwHeaderBar');
  if (!headerbar) {
    return;
  }
  headerbar.pack_start(builder.get_object('info_menu'));

  // setup menu actions
  const actionGroup = new Gio.SimpleActionGroup();
  w.insert_action_group('prefs', actionGroup);

  // a list of actions with their associated link
  const actions = [
    {
      name: 'open-bug-report',
      link: 'https://github.com/icedman/dash2dock-lite/issues',
    },
    {
      name: 'open-readme',
      link: 'https://github.com/icedman/dash2dock-lite',
    },
    {
      name: 'open-license',
      link: 'https://github.com/icedman/dash2dock-lite/blob/master/LICENSE',
    },
  ];

  actions.forEach((action) => {
    let act = new Gio.SimpleAction({ name: action.name });
    act.connect('activate', (_) =>
      Gtk.show_uri(w, action.link, Gdk.CURRENT_TIME)
    );
    actionGroup.add_action(act);
  });

  w.remove(menu_util);

  prefKeys.connectSignals(builder);
  prefKeys.getKey('running-indicator-color').callback = () => {
    // prefKeys.reset('brightness_scale');
    print(prefKeys.getValue('running-indicator-color'));
    // print('reset');
  };
  if (builder.get_object('static-animation'))
    builder.get_object('static-animation').connect('clicked', () => {
      print('zero');
    });
  if (builder.get_object('self-test'))
    builder.get_object('self-test').connect('clicked', () => {
      print('self-testing...');
    });

  w.connect('close_request', () => {
    m.close();
    app.quit();
  });

  // let model = builder.get_object('preferred-monitor-model');
  // model.append('hello');

  w.show();

  // m.present();
});

app.connect('startup', () => {});

app.run(['xx']);
