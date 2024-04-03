#!/usr/bin/gjs

// const Gio = imports.gi.Gio;
// var Application = new Gio.Application({applicationId:"sk.project.app", flags:32});
// var Notification = new Gio.Notification();
// Notification.set_body("message here");
// Application.send_notification(null, Notification);

const { Adw, Gdk, Gio, GLib, GObject, Gtk, Pango } = imports.gi;

let app = new Gtk.Application({
  application_id: 'org.gnome.clocks',
});

app.connect('activate', (me) => {
  m = new Gtk.ApplicationWindow({ application: me });
  m.set_default_size(600, 250);
  m.set_title('Notifications Test');

  w = new Gtk.Window();
  btn = new Gtk.Button({ label: 'Send push notification.' });
  w.set_child(btn);
  w.set_size_request(600, 600);

  btn.connect('clicked', () => {
    var notification = new Gio.Notification();
    notification.set_title('Custom Notice');
    notification.set_body('This is a push notification.');
    // notification.set_urgent(true);
    notification.set_icon(new Gio.ThemedIcon({ name: 'org.gnome.Clocks' }));
    app.send_notification(null, notification);
  });

  w.title = 'main';
  w.connect('close_request', () => {
    m.close();
    app.quit();
  });
  w.show();
});

app.connect('startup', () => {});

app.run(['xx']);
