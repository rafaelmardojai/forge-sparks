// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { getResourceUri } from '../util.js';
import AccountsManager from '../model/accountsManager.js';
import AccountDialog from './accountDialog.js';
import Account from '../model/account.js';

const accounts = new AccountsManager();

export default class AccountsDialog extends Adw.Dialog {
    declare private _accountsList: Gtk.ListBox;
    declare private _accountsStack: Gtk.Stack;

    static {
        GObject.registerClass(
            {
                Template: getResourceUri('widgets/accountsDialog.ui'),
                InternalChildren: ['accountsList', 'accountsStack'],
            },
            this,
        );
    }

    /**
     * Crete a PreferencesDialog
     */
    constructor(props?: Partial<Adw.Dialog.ConstructorProps>) {
        super(props);

        /* Bind accounts list */
        this._accountsList.bind_model(accounts, this.createAccountRow.bind(this));

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

    protected onOpenAddAccount() {
        const dialog = new AccountDialog();
        dialog.present(this);
    }

    /**
     * Create a widget for each saved account
     */
    private createAccountRow(account: Account): Gtk.Widget {
        const row = new Adw.ActionRow({
            title: account.displayName,
            activatable: true,
        });

        const authError = new Gtk.Image({
            icon_name: 'dialog-error-symbolic',
        });

        authError.tooltip_text = _('Account authentication failed!');
        authError.add_css_class('error');

        row.add_suffix(authError);

        row.add_suffix(
            new Gtk.Image({
                icon_name: 'go-next-symbolic',
            }),
        );

        account.bind_property('display-name', row, 'title', GObject.BindingFlags.SYNC_CREATE);
        account.bind_property('auth-failed', authError, 'visible', GObject.BindingFlags.SYNC_CREATE);

        row.connect('activated', () => {
            const dialog = new AccountDialog({ account });
            dialog.present(this);
        });

        return row;
    }
}
