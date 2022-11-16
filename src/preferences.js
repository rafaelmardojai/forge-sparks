// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import Template from './preferences.blp' assert { type: 'uri' };
import GitHub from './github.js';
import AccountsManager from './accounts.js';
import { settings } from './util.js';

const accounts = new AccountsManager();

class PreferencesWindow extends Adw.PreferencesWindow {

    /**
     * Crete a PreferencesWindow
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this._accountsList.bind_model(accounts, this._createAccountRow.bind(this));
    }

    _onOpenAddAccount() {
        this.present_subpage(this._accountForm);
    }

    _onBackClick() {
        this.close_subpage();
    }

    _onTokenChanged() {
        this._addAccountBtn.sensitive = (this._accessToken.text != '');
    }

    async _onAddAccount() {
        try {
            this._accountForm.sensitive = false;

            const token = this._accessToken.text;
            const forge = new GitHub(token);
            const username = await forge.getUser();

            await accounts.saveAccount(
                'github',
                'github.com',
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
                        return _("Couldn't auth the account");
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
            'accountsList', 'accountForm', 'accessToken', 'addAccountBtn'
        ],
    },
    PreferencesWindow
);
