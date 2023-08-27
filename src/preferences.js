// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { settings, requestBackground } from './util.js';
import AccountsManager from './model/accountsManager.js';
import AccountDialog from './widgets/accountDialog.js';

import Template from './preferences.blp' assert { type: 'uri' };

const accounts = new AccountsManager();

export default class PreferencesWindow extends Adw.PreferencesWindow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'background', 'startup', 'hidden', 'accountsList', 'accountsStack',
            ],
        }, this);
    }

    /**
     * Crete a PreferencesWindow
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        /* Bind accounts list */
        this._accountsList.bind_model(accounts, this._createAccountRow.bind(this));

        /* Check accounts items */
        if (accounts.get_n_items() > 0) {
            this._accountsStack.set_visible_child_name('accounts');
        }
        accounts.connect('items-changed', () => {
            if (accounts.get_n_items() > 0) {
                this._accountsStack.set_visible_child_name('accounts');
            } else {
                this._accountsStack.set_visible_child_name('empty');
            }
        });

        /* Load saved settings */
        this._background.enable_expansion = settings.get_boolean('hide-on-close');
        this._startup.active = settings.get_boolean('autostart');
        this._hidden.active = settings.get_boolean('autostart-hidden');
    }

    /**
     * Callback for when the keep running on background pref (hide-on-close) is
     * toggled (this._background::notify::enable-expansion)
     */
    async _onBackgroundChanged() {
        /* If saved pref have not changed, return */
        if (this._background.enable_expansion == settings.get_boolean('hide-on-close'))
            return;

        /* Check if autostart should also be requested */
        const autostart = (settings.get_boolean('autostart') && this._background.enable_expansion);
        /* Check if hidden should also be requested */
        const hidden = (autostart && settings.get_boolean('autostart-hidden'));
        /* Request background permission and possibly autostart to the portal */
        const success = await requestBackground(this, autostart, hidden);
        /* New boolean value depends on success and user choice */
        const newValue = (this._background.enable_expansion && success)

        /* Update the saved the preference */
        settings.set_boolean('hide-on-close', newValue);
        /* Update the app window hide_on_close prop with the new value */
        const app = Gtk.Application.get_default();
        app.window.hide_on_close = newValue;

        /* If new value differs from user choice, force user choice to result */
        if (this._background.enable_expansion != newValue)
            this._background.enable_expansion = newValue;

        /* If success was false, show a toast */
        if (!success)
            this.add_toast(new Adw.Toast({
                title: _('The request failed.')
            }));
    }

    /**
     * Callback for when the run on startup pref (autostart) is toggled
     * (this._startup::notify::active)
     */
    async _onStartupChanged() {
        /* If saved pref have not changed, return */
        if (this._startup.active == settings.get_boolean('autostart'))
            return;

        /* Check if hidden should also be requested */
        const hidden = settings.get_boolean('autostart-hidden');
        /* Request background permission and autostart new value to the portal */
        const success = await requestBackground(this, this._startup.active, hidden);
        /* New boolean value depends on success and user choice */
        const newValue = (this._startup.active && success)

        /* Update the saved the preference */
        settings.set_boolean('autostart', newValue);

        /* Update the widget back with the actual new value */
        this._startup.freeze_notify();
        this._startup.active = newValue;
        this._startup.thaw_notify();

        /* If success was false, show a toast */
        if (!success)
            this.add_toast(new Adw.Toast({
                title: _('The autostart request failed.')
            }));
    }

    /**
     * Callback for when the start hidden pref (hidden) is toggled
     * (this._hidden::notify::active)
     */
    async _onStartupHiddenChanged() {
        /* If saved pref have not changed, return */
        if (this._hidden.active == settings.get_boolean('autostart-hidden'))
            return;

        /* Get autostart state */
        const autostart = settings.get_boolean('autostart');
        /* Request background permission and autostart new value to the portal */
        const success = await requestBackground(this, autostart, this._hidden.active);
        /* New boolean value depends on success and user choice */
        const newValue = (this._hidden.active && success)

        /* Update the saved the preference */
        settings.set_boolean('autostart-hidden', newValue);

        /* Update the widget back with the actual new value */
        this._hidden.freeze_notify();
        this._hidden.active = newValue;
        this._hidden.thaw_notify();

        /* If success was false, show a toast */
        if (!success)
            this.add_toast(new Adw.Toast({
                title: _('The autostart request failed.')
            }));
    }

    _onOpenAddAccount() {
        const dialog = new AccountDialog(null, { transient_for: this });
        dialog.present();
    }

    /**
     * Create a widget for each saved account
     * 
     * @param {Account} account The account object
     * @returns {Gtk.Widget} The widget representing the account
     */
    _createAccountRow(account) {
        const row = new Adw.ActionRow({
            title: account.displayName,
            activatable: true
        });

        const authError = new Gtk.Image({
            icon_name: 'dialog-error-symbolic'
        });

        authError.tooltip_text = _('Account authentication failed!');
        authError.add_css_class('error');

        row.add_suffix(authError);

        row.add_suffix(new Gtk.Image({
            icon_name: 'go-next-symbolic'
        }));

        account.bind_property('display-name', row, 'title', GObject.BindingFlags.SYNC_CREATE)
        account.bind_property('auth-failed', authError, 'visible', GObject.BindingFlags.SYNC_CREATE)

        row.connect('activated', () => {
            const dialog = new AccountDialog(account, { transient_for: this });
            dialog.present();
        });

        return row;
    }
};
