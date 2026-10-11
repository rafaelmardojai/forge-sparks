// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Secret from 'gi://Secret';

import { settings } from '../util.js';

import Account from './account.js';

interface Signals extends GObject.Object.SignalSignatures, Gio.ListModel.SignalSignatures {}

/*
 * Secrets schema for saving accounts access tokens
 */
const SECRETS_SCHEMA = new Secret.Schema(pkg.name, Secret.SchemaFlags.NONE, {
    id: Secret.SchemaAttributeType.STRING,
} as any);

/**
 * Class for managing accounts.
 */
export default class AccountsManager extends GObject.Object implements Gio.ListModel<Account> {
    declare get_item: Gio.ListModel<Account>['get_item'];
    declare get_item_type: Gio.ListModel<Account>['get_item_type'];
    declare get_n_items: Gio.ListModel<Account>['get_n_items'];

    declare connect: GObject.SignalMethods<this, Signals>['connect'];
    declare connect_after: GObject.SignalMethods<this, Signals>['connect_after'];
    declare emit: GObject.SignalMethods<this, Signals>['emit'];
    declare items_changed: (position: number, removed: number, added: number) => void;

    static instance: AccountsManager | null = null;

    /**
     * Store accessed account settings instances.
     */
    private accountsSettings: Map<string, Gio.Settings> = new Map();

    /**
     * Private list storing the items of the list model.
     */
    private accounts: Account[] = [];

    /**
     * Map of accounts by id.
     */
    private byId: Map<string, Account> = new Map();

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
    constructor(params?: Partial<GObject.Object.ConstructorProps>) {
        super(params);

        /* This class is a singleton, return instance if already exists */
        if (AccountsManager.instance) {
            return AccountsManager.instance;
        }

        /* Populate model with saved accounts */
        for (const id of this.getAccounts()) {
            const settings = this.getAccountSettings(id);
            const account = new Account({ id: id });

            settings.bind('forge', account, 'forge', Gio.SettingsBindFlags.DEFAULT);
            settings.bind('url', account, 'url', Gio.SettingsBindFlags.DEFAULT);
            settings.bind('username', account, 'username', Gio.SettingsBindFlags.DEFAULT);
            settings.bind('user-id', account, 'user-id', Gio.SettingsBindFlags.DEFAULT);

            this.accounts.push(account);
        }

        /* Save new instance reference and return it */
        AccountsManager.instance = this;
        return this;
    }

    /**
     * Get list model stored item type
     */
    vfunc_get_item_type() {
        return Account.$gtype;
    }

    /**
     * Get item from list model
     */
    vfunc_get_item(position: number) {
        return this.accounts[position] || null;
    }

    /**
     * Get number of items in list model
     */
    vfunc_get_n_items() {
        return this.accounts.length;
    }

    /**
     * Get ann account from the list model by its ID
     */
    getAccountByID(id: string): Account | null {
        return this.byId.get(id) || null;
    }

    /**
     * Gets the saved accounts
     */
    getAccounts(): string[] {
        return settings.get_strv('accounts');
    }

    /**
     * If the user has more than one account
     */
    isMultiple(): boolean {
        return this.accounts.length > 1;
    }

    /**
     * Save a new account in the secrets service and app settings
     *
     * @param forge Account forge name
     * @param url Account forge url
     * @param userId Account user ID
     * @param username Account username
     * @param token Account access token
     * @throws Throws an error if failed adding the account to secrets
     * @returns The account ID
     */
    async saveAccount(forge: string, url: string, userId: number, username: string, token: string): Promise<string> {
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
                const accountSettings = this.getAccountSettings(id);
                /* Save initial values */
                accountSettings.set_string('forge', forge);
                accountSettings.set_string('url', url);
                accountSettings.set_string('username', username);
                accountSettings.set_int('user-id', userId);

                /* Add to list model */
                const account = new Account({ id: id });
                accountSettings.bind('forge', account, 'forge', Gio.SettingsBindFlags.DEFAULT);
                accountSettings.bind('url', account, 'url', Gio.SettingsBindFlags.DEFAULT);
                accountSettings.bind('username', account, 'username', Gio.SettingsBindFlags.DEFAULT);
                accountSettings.bind('user-id', account, 'user-id', Gio.SettingsBindFlags.DEFAULT);
                this.accounts.push(account);
                this.byId.set(id, account);
                this.items_changed(this.accounts.length - 1, 0, 1);

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
     * @param id Account id
     * @param url Account forge url
     * @param userId Account user ID
     * @param username Account username
     * @param token Account access token
     * @throws Throws an error if failed updating the account from secrets
     * @returns True if the account was updated
     */
    async updateAccount(id: string, url: string, userId: number, username: string, token: string): Promise<boolean> {
        try {
            const label = 'Access token for ' + url;
            /* Remove previous secret */
            const successRemove = await Secret.password_clear(SECRETS_SCHEMA, { id: id }, null);

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
                const accountSettings = this.getAccountSettings(id);
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
     * @param id Account id
     * @throws Throws an error if failed removing the account from secrets
     * @return If the account was successfully removed
     */
    async removeAccount(id: string): Promise<boolean> {
        try {
            /* Remove secret */
            const success = await Secret.password_clear(SECRETS_SCHEMA, { id: id }, null);

            /* Remove from app settings */
            if (success) {
                const accounts = settings.get_strv('accounts');
                const index = accounts.indexOf(id);
                if (index > -1) {
                    accounts.splice(index, 1);
                    settings.set_strv('accounts', accounts);

                    /* Update list model */
                    this.accounts.splice(index, 1);
                    this.byId.delete(id);
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
     * @param id Account id
     * @param setting Setting name
     * @return The setting value
     */
    getAccountSetting(id: string, setting: string): string {
        const accountSettings = this.getAccountSettings(id);
        return accountSettings.get_string(setting);
    }

    /**
     * Gets the account access token saved in the secrets service
     *
     * @param id Account id
     * @throws Throws an error if failed getting the token from secrets
     * @return The token
     */
    async getAccountToken(id: string): Promise<string> {
        try {
            const token = await Secret.password_lookup(SECRETS_SCHEMA, { id: id }, null);
            return token;
        } catch (error) {
            throw error;
        }
    }

    /**
     * Gets the Gio.Settings instance for the account
     */
    private getAccountSettings(id: string): Gio.Settings {
        if (!this.accountsSettings.has(id)) {
            let path = settings.path;
            if (!path.endsWith('/')) {
                path += '/';
            }
            path += id + '/';

            this.accountsSettings.set(
                id,
                new Gio.Settings({
                    schema: pkg.name + '.account',
                    path: path,
                }),
            );
        }

        return this.accountsSettings.get(id) as Gio.Settings;
    }
}
