// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import AccountsManager from './model/accountsManager.js';
import AccountDialog from './widgets/accountDialog.js';

import Template from './accountsWindow.blp' assert { type: 'uri' };

const accounts = new AccountsManager();

export default class AccountsWindow extends Adw.Window {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'accountsList', 'accountsStack',
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
