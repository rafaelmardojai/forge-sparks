// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { settings, requestBackground } from './util.js';
import { FORGES } from './forges/index.js';

import AccountsManager from './model/accountsManager.js';

import Template from './preferences.blp' assert { type: 'uri' };

const accounts = new AccountsManager();

export default class PreferencesWindow extends Adw.PreferencesWindow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'background', 'startup','accountsList', 'accountsStack',
                'accountNew', 'forge', 'instance', 'accessToken', 'accessTokenHelp', 'addAccountBtn',
                'accountEdit', 'accountEditTitle', 'instanceEdit', 'accessTokenEdit', 'accessTokenEditHelp',
                'saveAccountBtn', 'removeAccount',
            ],
        }, this);
    }

    /**
     * Crete a PreferencesWindow
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this.forges = Object.values(FORGES);
        this._editing = null; // Account begin edited

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

        /* Populate forges list (Create account view) */
        const forgesList = new Gtk.StringList();
        for (const forge of this.forges) {
            forgesList.append(forge.prettyName)
        }
        this._forge.model = forgesList
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
        /* Request background permission and possibly autostart to the portal */
        const success = await requestBackground(this, autostart);
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

        /* Request background permission and autostart new value to the portal */
        const success = await requestBackground(this, this._startup.active);
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
     * Present the new account view
     */
    _onOpenAddAccount() {
        this.present_subpage(this._accountNew);
    }

    /**
     * Present the edit account view
     * 
     * @param {Account} account The account to edit
     */
    async _onEditAccount(account) {
        this._accountEditTitle.subtitle = account.displayName;

        /* Load saved instance URL */
        if (FORGES[account.forge].allowInstances) {
            this._instanceEdit.visible = true;
            this._instanceEdit.text = account.url
        }

        /* Load saved token */
        const token = await accounts.getAccountToken(account.id);
        this._accessTokenEdit.text = token;

        /* Token help text */
        this._accessTokenEditHelp.label = FORGES[account.forge].tokenText

        this._editing = account // Set account begin edited
        this._editing.token = token; // Save current account token

        this.present_subpage(this._accountEdit);
    }

    /**
     * Go back to main preferences view
     * 
     * Also reset fields from edit and create account views 
     */
    _onBack() {
        this.close_subpage();

        /* Reset some widgets */
        this._saveAccountBtn.sensitive = false;
        this._addAccountBtn.sensitive = false;
        this._instance.text = '';
        this._accessToken.text = '';
        this._instanceEdit.visible = false;
        this._instanceEdit.text = '';
        this._accessTokenEdit.text = '';

        this._editing = null; // Reset any account begin edited
    }

    /**
     * Get selected forge name from the new account view 
     * 
     * @returns {String} Fhe forge name
     */
    _getSeletedForge() {
        return this.forges[this._forge.selected].name
    }

    /**
     * Get if selected forge in new account view allows instances
     * 
     * @returns {Boolean} If it allows instances
     */
    _allowInstances() {
        return this.forges[this._forge.selected].allowInstances;
    }

    /**
     * Get instance url set in the new account view.
     * Or forge default url if it doesn't allow instances
     * 
     * @returns {String} If it allows instances
     */
    _getInstanceURL() {
        if (!this._allowInstances()) {
            return this.forges[this._forge.selected].defaultURL;
        }

        const url = this._validateUrl(this._instance.text);
        const host = this._getUriHost(url);
        return host;
    }

    /**
     * Get host from GLib.Uri with the www removed
     * 
     * @param {GLib.Uri} uri URL to get the host
     * @returns {String} The URI host
     */
    _getUriHost(uri) {
        let host = uri.get_host();
        if (host.startsWith('www.')) {
            host = host.slice(4);
        }
        return host;
    }

    /**
     * Callback for when the selected forge changes in the add new account view
     */
    _onForgeChanged() {
        /* Enable or disable instance URL entry */
        this._instance.sensitive = this._allowInstances();
        /* Token help text */
        this._accessTokenHelp.label = this.forges[this._forge.selected].tokenText
    }

    /**
     * Validate and get GLib.Uri from url string
     * 
     * @param {String} url URL to validate
     * @trows Trows an error if GLib failed parsing the url
     * @returns {GLib.Uri} Parser URI
     */
    _validateUrl(url) {
        /* Force https */
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        try {
            const parse = GLib.Uri.parse(url, GLib.UriFlags.RELAXED);
            return parse;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Callback for when any entry changes in the add new account view.
     * Instance url and access token.
     * 
     * Updates add account button sensitivity after validating the values
     */
    _onEntryChanged() {
        let valid = false;

        if (this._allowInstances()) {
            try {
                this._validateUrl(this._instance.text);
                this._instance.remove_css_class('error');
                valid = this._accessToken.text != '' && this._instance.text != '';
            } catch (error) {
                this._instance.add_css_class('error');
                this.add_toast(new Adw.Toast({
                    title: _("Invalid instance url.")
                }));
            }
        } else {
            valid = this._accessToken.text != '';
        }

        this._addAccountBtn.sensitive = valid;
    }

    /**
     * Callback for when any entry changes in the edit account view.
     * Instance url and access token.
     * 
     * Updates save account button sensitivity after validating the values and
     * checking that at last one has changed.
     */
    _onEditEntryChanged() {
        if (this._editing != null) {
            let valid = false;
            const instances = FORGES[this._editing.forge].allowInstances;
            const urlChanged = this._editing.url != this._instanceEdit.text
            const tokenChanged = this._editing.token != this._accessTokenEdit.text;
            const urlNotEmpty = this._instanceEdit.text != ''
            const tokenNotEmpty = this._accessTokenEdit.text != ''

            if (instances) {
                try {
                    this._validateUrl(this._instanceEdit.text);
                    this._instanceEdit.remove_css_class('error');
                    valid = (
                        urlNotEmpty && tokenNotEmpty && urlChanged ||
                        urlNotEmpty && tokenNotEmpty && tokenChanged
                    );
                } catch (error) {
                    this._instanceEdit.add_css_class('error');
                    this.add_toast(new Adw.Toast({
                        title: _("Invalid instance url.")
                    }));
                }
            } else {
                valid = tokenNotEmpty && tokenChanged;
            }

            this._saveAccountBtn.sensitive = valid;
        }
    }

    /**
     * Get error user visible text
     * 
     * @returns {String} The error text
     */
    _errorText(error) {
        switch (error) {
            case 'FailedForgeAuth':
                return _("Couldn't authenticate the account");
            default:
                return _("Unexpected error when creating the account");
        }
    }

    /**
     * Callback when the user adds an account.
     * Save account in settings.
     */
    async _onAddAccount() {
        try {
            /* Make the whole form insensitive */
            this._accountNew.sensitive = false;

            /* Get form values */
            const token = this._accessToken.text;
            const url = this._getInstanceURL();
            const forgeName = this._getSeletedForge();

            /* Instantiate the class for the forge */
            const forge = new FORGES[forgeName](url, token);
            /* Try authenticating the user with access token */
            const username = await forge.getUser();
            /* Save account to settings */
            await accounts.saveAccount(
                forgeName,
                url,
                username,
                token
            );

            this.add_toast(new Adw.Toast({
                title: _("New account added successfully!")
            }));
            this._onBack();
        } catch (error) {
            console.log(error);
            this.add_toast(new Adw.Toast({
                title: this._errorText(error)
            }));
        } finally {
            this._accountNew.sensitive = true;
        }
    }

    /**
     * Callback when the user saves an account new preferences.
     * Update account in settings.
     */
    async _onUpdateAccount() {
        /* Make the whole form insensitive */
        this._accountEdit.sensitive = false;

        /* Get and validate from values */
        const forgeClass = FORGES[this._editing.forge];
        let newToken = this._accessTokenEdit.text;
        let newUrl = this._instanceEdit.text;
        if (!forgeClass.allowInstances) {
            newUrl = forgeClass.defaultURL;
        } else {
            newUrl = this._validateUrl(newUrl);
            newUrl = this._getUriHost(newUrl);
        }

        /* Continue if some value has actually changed */
        if (newToken != this._editing.token || newUrl != this._editing.url) {
            try {
                const forge = new forgeClass(newUrl, newToken);
                const username = await forge.getUser();

                await accounts.updateAccount(
                    this._editing.id,
                    newUrl,
                    username,
                    newToken
                );

                this.add_toast(new Adw.Toast({
                    title: _("Account edited successfully!")
                }));
                this._onBack();
            } catch (error) {
                console.log(error);
                this.add_toast(new Adw.Toast({
                    title: this._errorText(error)
                }));
            }
        }

        this._accountEdit.sensitive = true;
    }

    /**
     * Callback when the user removes an account
     */
    async _onRemoveAccount() {
        const errorToast = new Adw.Toast({ title: _("Unexpected error removing the account") });
        try {
            const success = await accounts.removeAccount(this._editing.id);
            if (!success) {
                this.add_toast(errorToast);
            }
        } catch (error) {
            this.add_toast(errorToast);
        }

        this._onBack();
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

        row.add_suffix(new Gtk.Image({
            icon_name: 'go-next-symbolic'
        }));

        row.connect('activated', () => {
            this._onEditAccount(account);
        });

        return row;
    }
};
