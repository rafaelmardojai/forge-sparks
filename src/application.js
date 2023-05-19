// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { settings } from './util.js';
import Window from './window.js';
import PreferencesWindow from './preferences.js';

import './style.css';
import './style-dark.css';
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

        /* If the window should start hidden */
        this.hidden = false;

        /* Command line options */
        this.add_main_option('version', 'v'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
            'Print version information and exit', null);

        this.add_main_option('hidden', 'h'.charCodeAt(0), GLib.OptionFlags.NONE, GLib.OptionArg.NONE,
            'Start hidden', null);

        /* Setup application actions */
        this._initAppActions();
    }

    _initAppActions() {
        let activateAction = new Gio.SimpleAction({ name: 'activate' });
        activateAction.connect('activate', () => {
            this.activate();
        });
        this.add_action(activateAction);

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

        let closeAction = new Gio.SimpleAction({ name: 'close' });
        closeAction.connect('activate', () => {
            this.get_active_window().close();
        });
        this.add_action(closeAction);

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
        markReadAction.connect('activate', this._markAsRead.bind(this));
        this.add_action(markReadAction);

        let reloadAction = new Gio.SimpleAction({ name: 'reload' });
        reloadAction.connect('activate', () => {
            this.get_active_window().reload();
        });
        this.add_action(reloadAction);

        /* Set keyboard shortcuts for actions */
        this.set_accels_for_action('app.quit', ['<Primary>q']);
        this.set_accels_for_action('app.close', ['<Primary>w']);
        this.set_accels_for_action('app.preferences', ['<Primary>comma']);
        this.set_accels_for_action('app.reload', ['<Primary>r']);
        this.set_accels_for_action('win.open-primary-menu', ['F10']);
        this.set_accels_for_action('win.show-help-overlay', ['<Primary>question']);
    }

    vfunc_handle_local_options(options) {
        if (options.contains('version')) {
            print(pkg.version);
            return 0;
        }

        /* Hidden window on start */
        if (options.contains('hidden') && this.window === undefined) {
            this.hidden = true;
        }

        return -1;  /* Continue execution */
    }

    vfunc_startup() {
        super.vfunc_startup();
        log('Forge Sparks:', pkg.name);
        log('Version:', pkg.version);
    }

    vfunc_activate() {
        if (!this.window) {
            this.window = new Window({ application: this });
            this.window.hide_on_close = settings.get_boolean('hide-on-close');
        }

        /* Start window hidden or not */
        if (this.hidden) {
            this.window.visible = false;
            this.window._onWindowHide();
            this.hidden = false;
        } else {
            this.window.show();
        }
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
        const launcher = new Gtk.UriLauncher({ uri: url });

        let window = this.window;
        if (this.window.hide_on_close)
            window = null;

        launcher.launch(window, null, (_obj, result) => {
            const success = launcher.launch_finish(result);

            if (success) {
                this.window.resolveNotification(id);
            }
        });
    }

    _markAsRead(_action, param) {
        const [id, _length] = param.get_string();
        this.window.resolveNotification(id);
    }
};
