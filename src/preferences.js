// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import Template from './preferences.blp' assert { type: 'uri' };
import AccountsManager from './accounts.js';
import { settings } from './util.js';
import { FORGES } from './forges/index.js';

const accounts = new AccountsManager();

class PreferencesWindow extends Adw.PreferencesWindow {

    /**
     * Crete a PreferencesWindow
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this._accountsList.bind_model(accounts, this._createAccountRow.bind(this));

        this.forges = Object.values(FORGES);

        /* Populate forges list (Create account view) */
        const forgesList = new Gtk.StringList();
        for (const forge of this.forges) {
            forgesList.append(forge.prettyName)
        }
        this._forge.model = forgesList
    }

    _onOpenAddAccount() {
        this.present_subpage(this._accountForm);
    }

    _onBackClick() {
        this.close_subpage();
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

        return this._instance.text;
    }

    _onForgeChanged() {
        /* Enable or disable instance URL entry */
        this._instance.sensitive = this._allowInstances();
    }

    _onEntryChanged() {
        /* Enable or disable Add account button */
        this._addAccountBtn.sensitive = (
            this._accessToken.text != '' && !this._allowInstances()
            || this._accessToken.text != '' && this._instance.text != '' && this._allowInstances()
        );
    }

    async _onAddAccount() {
        try {
            this._accountForm.sensitive = false;

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

            this._accessToken.text = '';
            this.close_subpage();
        } catch (error) {
            console.log(error);
            const errorText = function() {
                switch (error) {
                    case 'FailedForgeAuth':
                        return _("Couldn't authenticate the account");
                    default:
                        return _("Unexpected error when creating the account");
                }
            }
            const errorToast = new Adw.Toast({ title: errorText() });
            this.add_toast(errorToast);
        } finally {
            this._accountForm.sensitive = true;
        }
    }

    _createAccountRow(account) {
        const row = new Adw.ActionRow({
            title: account.displayName,
        });

        return row;
    }

};

export default GObject.registerClass(
    {
        Template,
        InternalChildren: [
            'accountsList', 'accountForm', 'forge', 'instance', 'accessToken', 'addAccountBtn'
        ],
    },
    PreferencesWindow
);
