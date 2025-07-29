// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Secret from 'gi://Secret';

import { settings } from '../util.js';

import Account from './account.js';

/*
 * Secrets schema for saving accounts access tokens
 */
const SECRETS_SCHEMA = new Secret.Schema(pkg.name, Secret.SchemaFlags.NONE, {
    id: Secret.SchemaAttributeType.STRING,
});

/* Class for managing accounts. */
export default class AccountsManager extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'AccountsManager',
                Implements: [Gio.ListModel],
            },
            this,
        );
    }

    /* Create an AccountsManager */
    constructor() {
        super();

        /* This class is a singleton, return instance if already exists */
        if (typeof AccountsManager.instance === 'object') {
            return AccountsManager.instance;
        }

        this._accountsSettings =
            {}; /* Store accessed account settings instances */
        this._accounts =
            []; /* Private list storing the items of the list model */

        /* Populate model with saved accounts */
        for (const id of this.getAccounts()) {
            const settings = this._getAccountSettings(id);
            const account = new Account({ id: id });

            settings.bind(
                'forge',
                account,
                'forge',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings.bind('url', account, 'url', Gio.SettingsBindFlags.DEFAULT);
            settings.bind(
                'username',
                account,
                'username',
                Gio.SettingsBindFlags.DEFAULT,
            );
            settings.bind(
                'user-id',
                account,
                'user-id',
                Gio.SettingsBindFlags.DEFAULT,
            );

            this._accounts.push(account);
        }

        /* Save new instance reference and return it */
        AccountsManager.instance = this;
        return this;
    }

    /**
     * Get list model stored item type
     *
     * @alias get_item_type
     * @returns {GType} The list model object type
     */
    vfunc_get_item_type() {
        return Account.$gtype;
    }

    /**
     * Get item from list model
     *
     * @alias AccountsManager.get_item
     * @param {number} position Position of the item to get
     * @returns {Account|null} The account object or null if not objects
     * in the position
     */
    vfunc_get_item(position) {
        return this._accounts[position] || null;
    }

    /**
     * Get number of items in list model
     *
     * @alias get_n_items
     * @returns {number} The length of the list model
     */
    vfunc_get_n_items() {
        return this._accounts.length;
    }

    /**
     * Get ann account from the list model by its ID
     *
     * @param {string} id The account ID
     * @returns {Account|null}
     */
    getAccountByID(id) {
        for (const account of this._accounts) {
            if (account.id == id) {
                return account;
            }
        }
        return null;
    }

    /**
     * Gets the saved accounts
     *
     * @return {Array<string>} Accounts ids
     */
    getAccounts() {
        return settings.get_strv('accounts');
    }

    /**
     * If the user has more than one account
     *
     * @return {boolean} If true
     */
    isMultiple() {
        return this._accounts.length > 1;
    }

    /**
     * Save a new account in the secrets service and app settings
     *
     * @param  {string} forge Account forge name
     * @param  {string} url Account forge url
     * @param  {number} userId Account user ID
     * @param  {string} username Account username
     * @param  {string} token Account access token
     * @throws Throws an error if failed adding the account to secrets
     * @return {Promise<string>} The id of the new account
     */
    async saveAccount(forge, url, userId, username, token) {
        /* Account id for further identification */
        const id = GLib.uuid_string_random();
        /* Attributes for the secret */
        const attributes = {
            id: id,
        };
        const label = 'Access token for ' + url;

        try {
            /* Try storing token on secrets service */
            const success = await Secret.password_store(
                SECRETS_SCHEMA,
                attributes,
                Secret.COLLECTION_DEFAULT,
                label,
                token,
                null,
            );

            if (success) {
                /* Save account id in app settings */
                let accounts = settings.get_strv('accounts');
                accounts.push(id);
                settings.set_strv('accounts', accounts);

                /* Get account settings */
                const accountSettings = this._getAccountSettings(id);
                /* Save initial values */
                accountSettings.set_string('forge', forge);
                accountSettings.set_string('url', url);
                accountSettings.set_string('username', username);
                accountSettings.set_int('user-id', userId);

                /* Add to list model */
                const account = new Account({ id: id });
                accountSettings.bind(
                    'forge',
                    account,
                    'forge',
                    Gio.SettingsBindFlags.DEFAULT,
                );
                accountSettings.bind(
                    'url',
                    account,
                    'url',
                    Gio.SettingsBindFlags.DEFAULT,
                );
                accountSettings.bind(
                    'username',
                    account,
                    'username',
                    Gio.SettingsBindFlags.DEFAULT,
                );
                accountSettings.bind(
                    'user-id',
                    account,
                    'user-id',
                    Gio.SettingsBindFlags.DEFAULT,
                );
                this._accounts.push(account);
                this.items_changed(this._accounts.length - 1, 0, 1);

                return id;
            } else {
                throw "Couldn't save the token.";
            }
        } catch (error) {
            throw error;
        }
    }

    /**
     * Update account in the secrets service and app settings
     *
     * @param  {string} id Account id
     * @param  {string} url Account forge url
     * @param  {number} userId Account user ID
     * @param  {string} username Account username
     * @param  {string} token Account access token
     * @throws Throws an error if failed updating the account from secrets
     * @return {Promise<boolean>} If the account was successfully updated
     */
    async updateAccount(id, url, userId, username, token) {
        try {
            const label = 'Access token for ' + url;
            /* Remove previous secret */
            const successRemove = await Secret.password_clear(
                SECRETS_SCHEMA,
                { id: id },
                null,
            );

            /* Store new secret */
            const successAdd = await Secret.password_store(
                SECRETS_SCHEMA,
                { id: id },
                Secret.COLLECTION_DEFAULT,
                label,
                token,
                null,
            );

            /* Update settings */
            if (successRemove && successAdd) {
                const accountSettings = this._getAccountSettings(id);
                accountSettings.set_string('url', url);
                accountSettings.set_string('username', username);
                accountSettings.set_int('user-id', userId);

                return true;
            }

            return false;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove account from everywhere
     *
     * @param  {string} id Account id
     * @throws Throws an error if failed removing the account from secrets
     * @return {Promise<boolean>} If the account was successfully removed
     */
    async removeAccount(id) {
        try {
            /* Remove secret */
            const success = await Secret.password_clear(
                SECRETS_SCHEMA,
                { id: id },
                null,
            );

            /* Remove from app settings */
            if (success) {
                const accounts = settings.get_strv('accounts');
                const index = accounts.indexOf(id);
                if (index > -1) {
                    accounts.splice(index, 1);
                    settings.set_strv('accounts', accounts);

                    /* Update list model */
                    this._accounts.splice(index, 1);
                    this.items_changed(index, 1, 0);
                }
            }

            return success;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets an account setting value
     *
     * @param {string} id Account id
     * @param {string} setting Setting name
     * @return {string} The setting value
     */
    getAccountSetting(id, setting) {
        const accountSettings = this._getAccountSettings(id);
        return accountSettings.get_string(setting);
    }

    /**
     * Gets the account access token saved in the secrets service
     *
     * @param  {string} id Account id
     * @throws Throws an error if failed getting the token from secrets
     * @return {Promise<string>} The token
     */
    async getAccountToken(id) {
        try {
            const token = await Secret.password_lookup(
                SECRETS_SCHEMA,
                { id: id },
                null,
            );
            return token;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets the Gio.Settings instance for the account
     *
     * @param  {string} id Account id
     * @return {Gio.Settings} The instance of the account settings
     */
    _getAccountSettings(id) {
        if (!(id in this._accountsSettings)) {
            let path = settings.path;
            if (!path.endsWith('/')) {
                path += '/';
            }
            path += id + '/';

            this._accountsSettings[id] = new Gio.Settings({
                schema: pkg.name + '.account',
                path: path,
            });
        }
        return this._accountsSettings[id];
    }
}
