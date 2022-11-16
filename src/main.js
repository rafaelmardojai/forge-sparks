// SPDX-License-Identifier: MIT

import 'gi://Adw?version=1'
import 'gi://Gdk?version=4.0'
import 'gi://GObject?version=2.0'
import 'gi://Gtk?version=4.0'

import Gio from 'gi://Gio?version=2.0';
import GLib from 'gi://GLib?version=2.0'
import Secret from 'gi://Secret?version=1';
import Soup from 'gi://Soup?version=3.0';

import Application from "./application.js";

pkg.initGettext();

GLib.set_application_name('Forge Sparks');

Gio._promisify(Soup.Session.prototype, 'send_and_read_async', 'send_and_read_finish');
Gio._promisify(Secret, 'password_store', 'password_store_finish');
Gio._promisify(Secret, 'password_lookup', 'password_lookup_finish');

export function main(argv) {
    const application = new Application();
    return application.run(argv);
}
