// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import Template from './preferences.blp' assert { type: 'uri' };
import AccountsManager from './accounts.js';
import { settings, requestBackground } from './util.js';
import { FORGES } from './forges/index.js';

const accounts = new AccountsManager();

export default class PreferencesWindow extends Adw.PreferencesWindow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'background', 'startup','accountsList',
                'accountNew', 'forge', 'instance', 'accessToken', 'addAccountBtn',
                'accountEdit', 'accountEditTitle', 'instanceEdit', 'accessTokenEdit', 'saveAccountBtn', 'removeAccount',
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

        /* Load saved settings */
        this._background.enable_expansion = settings.get_boolean('hide-on-close')
        this._startup.active = settings.get_boolean('autostart')

        /* Populate forges list (Create account view) */
        const forgesList = new Gtk.StringList();
        for (const forge of this.forges) {
            forgesList.append(forge.prettyName)
        }
        this._forge.model = forgesList
    }

    async _onBackgroundChanged() {
        const success = await requestBackground(this, false);
        settings.set_boolean('hide-on-close', (this._background.enable_expansion && success));

        const app = Gtk.Application.get_default();
        app.window.hide_on_close = this._background.enable_expansion;
    }

    async _onStartupChanged() {
        const success = await requestBackground(this, this._startup.active);
        const result = (this._startup.active && success)

        settings.set_boolean('autostart', result);

        this._startup.freeze_notify();
        this._startup.active = result;
        this._startup.thaw_notify();
    }

    _onOpenAddAccount() {
        this.present_subpage(this._accountNew);
    }

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

        this._editing = account // Set account begin edited
        this._editing.token = token;
        this.present_subpage(this._accountEdit);
    }

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

    _getSeletedForge() {
        return this.forges[this._forge.selected].name
    }

    _allowInstances() {
        return this.forges[this._forge.selected].allowInstances;
    }

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

    _onForgeChanged() {
        /* Enable or disable instance URL entry */
        this._instance.sensitive = this._allowInstances();
    }

    /**
     * Validate and get GLib.Uri
     * @param {String} url URL to validate
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

    _onEntryChanged() {
        let valid = false;

        if (this._allowInstances()) {
            try {
                this._validateUrl(this._instance.text);
                this._instance.remove_css_class('error');
                valid = this._accessToken.text != '' && this._instance.text != '';
            } catch (error) {
                this._instance.add_css_class('error');
            }
        } else {
            valid = this._accessToken.text != '';
        }

        this._addAccountBtn.sensitive = valid;
    }

    _onEditEntryChanged() {
        /* Enable or disable Save account button */
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
                }
            } else {
                valid = tokenNotEmpty && tokenChanged;
            }

            this._saveAccountBtn.sensitive = valid;
        }
    }

    _errorText(error) {
        switch (error) {
            case 'FailedForgeAuth':
                return _("Couldn't authenticate the account");
            default:
                return _("Unexpected error when creating the account");
        }
    }

    async _onAddAccount() {
        try {
            this._accountNew.sensitive = false;

            const token = this._accessToken.text;
            const url = this._getInstanceURL();
            const forgeName = this._getSeletedForge();
            const forge = new FORGES[forgeName](url, token);
            const username = await forge.getUser();

            await accounts.saveAccount(
                forgeName,
                url,
                username,
                token
            );

            const toast = new Adw.Toast({ title: _("New account added successfully!") });
            this.add_toast(toast);
            this._onBack();
        } catch (error) {
            console.log(error);
            const errorToast = new Adw.Toast({ title: this._errorText(error) });
            this.add_toast(errorToast);
        } finally {
            this._accountNew.sensitive = true;
        }
    }

    async _onUpdateAccount() {
        this._accountEdit.sensitive = false;

        const forgeClass = FORGES[this._editing.forge];
        let newToken = this._accessTokenEdit.text;
        let newUrl = this._instanceEdit.text;
        if (!forgeClass.allowInstances) {
            newUrl = forgeClass.defaultURL;
        } else {
            newUrl = this._validateUrl(newUrl);
            newUrl = this._getUriHost(newUrl);
        }

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

                const toast = new Adw.Toast({ title: _("Account edited successfully!") });
                this.add_toast(toast);
                this._onBack();
            } catch (error) {
                console.log(error);
                const errorToast = new Adw.Toast({ title: this._errorText(error) });
                this.add_toast(errorToast);
            }
        }
        this._accountEdit.sensitive = true;
    }

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
