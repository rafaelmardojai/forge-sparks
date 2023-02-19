// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import Window from './window.js';
import PreferencesWindow from './preferences.js';
import { settings } from './util.js';

import './style.css';
import './gtk/help-overlay.blp' assert { type: 'builder' };

export default class Application extends Adw.Application {

    static {
        GObject.registerClass(this);
    }

    /**
     * Crete a Application
     */
    constructor() {
        super({ application_id: pkg.name });

        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
            'Print version information and exit', null);

        this.connect('handle-local-options', (app, options) => {
            if (options.contains('version')) {
                print(pkg.version);
                /* quit the invoked process after printing the version number
                 * leaving the running instance unaffected
                 */
                return 0;
            }
            return -1;
        });

        this._initAppActions();
    }

    _initAppActions() {
        let aboutAction = new Gio.SimpleAction({ name: 'about' });
        aboutAction.connect('activate', this._showAbout.bind(this));
        this.add_action(aboutAction);

        let prefsAction = new Gio.SimpleAction({ name: 'preferences' });
        prefsAction.connect('activate', this._showPrefs.bind(this));
        this.add_action(prefsAction);

        let quitAction = new Gio.SimpleAction({ name: 'quit' });
        quitAction.connect('activate', () => {
            this.quit();
        });
        this.add_action(quitAction);

        let notificationAction = new Gio.SimpleAction({
            name: 'open-notification',
            parameter_type: new GLib.VariantType('as')
        });
        notificationAction.connect('activate', this._openNotification.bind(this));
        this.add_action(notificationAction);

        let markReadAction = new Gio.SimpleAction({
            name: 'mark-read',
            parameter_type: new GLib.VariantType('s')
        });
        // markReadAction.connect('activate', this._markAsRead.bind(this));
        this.add_action(markReadAction);

        this.set_accels_for_action('app.quit', ['<Primary>q']);
        this.set_accels_for_action('win.open-primary-menu', ['F10']);
        this.set_accels_for_action('win.show-help-overlay', ['<Primary>question']);
    }

    vfunc_startup() {
        super.vfunc_startup();
        log('Forge Sparks:', pkg.name);
        log('Version:', pkg.version);
    }

    vfunc_activate() {
        if (!this.window){
            this.window = new Window({ application: this });
            this.window.hide_on_close = settings.get_boolean('hide-on-close');
        }
        this.window.show();
    }

    _showPrefs() {
        const window = new PreferencesWindow({ transient_for: this.window });
        window.present();
    }

    _showAbout() {
        const about = new Adw.AboutWindow({
            developers: ['Rafael Mardojai CM'],
            /* Translators: Replace "translator-credits" with your names, one name per line */
            translator_credits: _('translator-credits'),
            application_name: GLib.get_application_name(),
            comments: _('Get git forges notifications'),
            application_icon: pkg.name,
            version: pkg.version,
            website: '',
            copyright: 'Copyright 2022 Rafael Mardojai CM',
            modal: true,
            transient_for: this.window,
            license_type: Gtk.License.MIT_X11,
        });
        about.present();
    }

    _openNotification(_action, params) {
        const paramsArray = params.get_strv();
        const id = paramsArray[0];
        const url = paramsArray[1];

        Gtk.show_uri_full(this.window, url, Gdk.CURRENT_TIME, null, (_obj, result) => {
            const opened = Gtk.show_uri_full_finish(this.window, result);
            if (opened) {
                this.window.resolveNotification(id);
            }
        });
    }
};
