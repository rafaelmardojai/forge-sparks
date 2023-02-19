// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Secret from 'gi://Secret';

import { settings } from './util.js';

const SECRETS_SCHEMA = new Secret.Schema(
    pkg.name,
    Secret.SchemaFlags.NONE,
    {
        'id': Secret.SchemaAttributeType.STRING,
    }
);

/* Class for managing accounts. */
export default class AccountsManager extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'AccountsManager',
            Implements: [Gio.ListModel],
        }, this);
    }

    /* Create an AccountsManager */
    constructor() {
        super();

        if (typeof AccountsManager.instance === 'object') {
            return AccountsManager.instance;
        }

        this._accountsSettings = {};
        this._accounts = [];

        for (const id of this.getAccounts()) {
            this._accounts.push(new AccountObject(
                {
                    id: id,
                    forge: this.getAccountSetting(id, 'forge'),
                    url: this.getAccountSetting(id, 'url'),
                    username: this.getAccountSetting(id, 'username')
                }
            ));
        }

        AccountsManager.instance = this;
        return this;
    }

    vfunc_get_item_type() {
        return AccountObject.$gtype;
    }

    vfunc_get_item(position) {
        return this._accounts[position] || null;
    }

    vfunc_get_n_items() {
        return this._accounts.length;
    }

    /**
     * Gets the saved accounts
     * @return {Array<String>} Accounts ids
     */
    getAccounts() {
        return settings.get_strv('accounts');
    }

    /**
     * Save a new account in the secrets service and app settings
     * @param  {String} forge Account forge name
     * @param  {String} url Acount forge url
     * @param  {String} username Acount username
     * @param  {String} token Acount access token
     * @return {String} The id of the new account
     */
    async saveAccount(forge, url, username, token) {
        const id = GLib.uuid_string_random();
        const attributes = {
            'id': id,
        };
        const label = 'Access token for ' + url;

        try {
            const success = await Secret.password_store(
                SECRETS_SCHEMA,
                attributes,
                Secret.COLLECTION_DEFAULT,
                label,
                token,
                null
            );

            if (success) {
                // Save account id in app settings
                let accounts = settings.get_strv('accounts');
                accounts.push(id);
                settings.set_strv('accounts', accounts);

                // Get account settings
                const account_settings = this._getAccountSettings(id);
                // Save initial values
                account_settings.set_string('forge', forge);
                account_settings.set_string('url', url);
                account_settings.set_string('username', username);

                // Update ListModel
                this._accounts.push(new AccountObject({ id, forge, url, username }));
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
     * @param  {String} id Account id
     * @param  {String} url Acount forge url
     * @param  {String} username Acount username
     * @param  {String} token Acount access token
     * @return {Boolean} If the account was successfully updated
     */
    async updateAccount(id, url, username, token) {
        try {
            const label = 'Access token for ' + url;
            /* Remove previous secret */
            const successRemove = await Secret.password_clear(SECRETS_SCHEMA, { 'id': id }, null);

            /* Store new secret */
            const successAdd = await Secret.password_store(
                SECRETS_SCHEMA,
                { 'id': id },
                Secret.COLLECTION_DEFAULT,
                label,
                token,
                null
            );

            /* Update settings */
            if (successRemove && successAdd) {
                const account_settings = this._getAccountSettings(id);
                account_settings.set_string('url', url);
                account_settings.set_string('username', username);

                return true;
            }

            return false
        } catch (error) {
            throw error;
        }
    }

    /**
     * Remove account from everywhere
     * @param  {String} id Account id
     * @return {Boolean} If the account was successfully removed
     */
    async removeAccount(id) {
        try {
            /* Remove secret */
            const success = await Secret.password_clear(SECRETS_SCHEMA, { 'id': id }, null);

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
     * Gets the an account setting value
     * @param {String} id Account id
     * @param {PString} setting Setting name
     * @return {*} The setting value
     */
    getAccountSetting(id, setting) {
        const account_settings = this._getAccountSettings(id);
        return account_settings.get_string(setting);
    }

    /**
     * Gets the account access token saved in the secrets service
     * @param  {String} id Account id
     * @return {String} The token
     */
    async getAccountToken(id) {
        try {
            const token = await Secret.password_lookup(SECRETS_SCHEMA, { 'id': id }, null);
            return token;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets the Gio.Settings instance for the account
     * @param  {String} id Account id
     * @return {Gio.Settings} The instance of the account settings
     */
    _getAccountSettings(id) {
        if (!(id in this._accountsSettings)) {
            let path = settings.path;
            if (! path.endsWith('/')) {
                path += '/';
            }
            path += id + '/';

            this._accountsSettings[id] = new Gio.Settings({
                schema: pkg.name + '.account',
                path: path
            });
        }
        return this._accountsSettings[id];
    }
}

export class AccountObject extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'AccountObject',
            Properties: {
                'id': GObject.ParamSpec.string(
                    'id',
                    'id',
                    'The account id',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'forge': GObject.ParamSpec.string(
                    'forge',
                    'forge',
                    'The account forge',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'url': GObject.ParamSpec.string(
                    'url',
                    'url',
                    'The forge url',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'username': GObject.ParamSpec.string(
                    'username',
                    'username',
                    'The account username',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
            },
        }, this);
    }

    constructor(constructProperties = {}) {
        super(constructProperties);
    }

    get displayName() {
        return [this._username, this._url].join('@');
    }

    get id() {
        if (this._id === undefined)
            this._id = null;

        return this._id;
    }

    set id(value) {
        if (this._id === value)
            return;

        this._id = value;
        this.notify('id');
    }

    get forge() {
        if (this._forge === undefined)
            this._forge = null;

        return this._forge;
    }

    set forge(value) {
        if (this._forge === value)
            return;

        this._forge = value;
        this.notify('forge');
    }

    get url() {
        if (this._url === undefined)
            this._url = null;

        return this._url;
    }

    set url(value) {
        if (this._url === value)
            return;

        this._url = value;
        this.notify('url');
    }

    get username() {
        if (this._username === undefined)
            this._username = null;

        return this._username;
    }

    set username(value) {
        if (this._username === value)
            return;

        this._username = value;
        this.notify('username');
    }
};
