import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gdk from 'gi://Gdk';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { FORGES } from '../forges/index.js';
import AccountsManager from '../model/accountsManager.js';

import Template from './accountDialog.blp' with { type: 'uri' };

const accounts = new AccountsManager();

export default class AccountDialog extends Adw.Dialog {
    static {
        GObject.registerClass(
            {
                Template,
                InternalChildren: [
                    'forge',
                    'instance',
                    'accessToken',
                    'accessTokenHelp',
                    'removeAccount',
                    'saveBtn',
                    'toasts',
                    'page',
                    'titleWidget',
                ],
                Properties: {
                    editing: GObject.ParamSpec.boolean(
                        'editing',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                },
            },
            this,
        );
    }

    /**
     * Crete an AccountDialog
     */
    constructor(account = null, constructProperties = {}) {
        super(constructProperties);

        this._forges_ls = Object.values(FORGES);
        this._account = null;
        this._editing = false;
        this._userChangedInstance = false;

        this.connect('notify::editing', this._onEditing.bind(this));

        /* Setup edited account */
        if (account != null) {
            this._account = account;
            this._editing = true;
            this.notify('editing');

            this._loadSavedAccount();
        }

        /* Populate forges list (Create account view) */
        const forgesList = new Gtk.StringList();
        for (const forge of this._forges_ls) {
            forgesList.append(forge.prettyName);
        }
        this._forge.model = forgesList;
    }

    /**
     * If the form is editing an existing account
     *
     * @type {boolean}
     */
    get editing() {
        return this._editing;
    }

    /**
     * Change labels to the editing context
     */
    _onEditing() {
        if (this.editing) {
            this.title = _('Edit Account');
            this._saveBtn.label = _('Save');

            if (this._account != null)
                this._titleWidget.subtitle = this._account.displayName;
        }
    }

    /**
     * Load the account saved values
     */
    async _loadSavedAccount() {
        /* Load saved instance URL */
        if (this._allowInstances()) {
            this._instance.visible = true;
            this._instance.text = this._account.url;
        }

        /* Load saved token */
        const token = await accounts.getAccountToken(this._account.id);
        this._accessToken.text = token;

        /* Token help text */
        this._accessTokenHelp.label = FORGES[this._account.forge].tokenText;

        /* Save current account token */
        this._account.token = token;

        this._onEntryChanged();
    }

    /**
     * Get selected forge name from the new account view
     *
     * @returns {string} Fhe forge name
     */
    _getSeletedForge() {
        return this._forges_ls[this._forge.selected].name;
    }

    /**
     * Get if selected forge in new account view allows instances
     *
     * @returns {boolean} If it allows instances
     */
    _allowInstances() {
        if (this.editing) {
            return FORGES[this._account.forge].allowInstances;
        }
        return this._forges_ls[this._forge.selected].allowInstances;
    }

    /**
     * Get instance url set in the new account view.
     * Or forge default url if it doesn't allow instances
     *
     * @returns {string} If it allows instances
     */
    _getInstanceURL() {
        if (!this._allowInstances()) {
            return this._forges_ls[this._forge.selected].defaultURL;
        }

        const url = this._validateUrl(this._instance.text);
        const host = this._getUriHost(url);
        return host;
    }

    /**
     * Get host from GLib.Uri with the www removed
     *
     * @param {GLib.Uri} uri URL to get the host
     * @returns {string} The URI host
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
        this._instance.visible = this._allowInstances();
        /* Token help text */
        this._accessTokenHelp.label =
            this._forges_ls[this._forge.selected].tokenText;

        /* Entries may be different so validate again */
        this._onEntryChanged();

        /* Load default instance url */
        if (!this._userChangedInstance && this._account == null) {
            this._instance.text =
                this._forges_ls[this._forge.selected].defaultURL;
        }
    }

    /**
     * Validate and get GLib.Uri from url string
     *
     * @param {string} url URL to validate
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
     * Callback when user changes the instance entry
     *
     * Updates the _userChangedInstance value so we don't override the user input
     * when them change the selected forge.
     */
    _onInstanceChanged() {
        this._userChangedInstance =
            !this.editing &&
            this._instance.text !=
                this._forges_ls[this._forge.selected].defaultURL;
    }

    /**
     * Callback when any entry changes
     * Validate instance url and access token.
     *
     * Updates save button sensitivity after validating the values.
     */
    _onEntryChanged() {
        let valid = false;

        if (this.editing && this._account != null) {
            const instances = FORGES[this._account.forge].allowInstances;
            const urlChanged = this._account.url != this._instance.text;
            const tokenChanged = this._account.token != this._accessToken.text;
            const urlNotEmpty = this._instance.text != '';
            const tokenNotEmpty = this._accessToken.text != '';

            if (instances) {
                try {
                    this._validateUrl(this._instance.text);
                    this._instance.remove_css_class('error');
                    valid =
                        (urlNotEmpty && tokenNotEmpty && urlChanged) ||
                        (urlNotEmpty && tokenNotEmpty && tokenChanged);
                } catch (error) {
                    this._instance.add_css_class('error');
                    this._toasts.add_toast(
                        new Adw.Toast({
                            title: _('Invalid instance url.'),
                        }),
                    );
                }
            } else {
                valid = tokenNotEmpty && tokenChanged;
            }
        } else {
            if (this._allowInstances()) {
                try {
                    this._validateUrl(this._instance.text);
                    this._instance.remove_css_class('error');
                    valid =
                        this._accessToken.text != '' &&
                        this._instance.text != '';
                } catch (error) {
                    this._instance.add_css_class('error');
                    this._toasts.add_toast(
                        new Adw.Toast({
                            title: _('Invalid instance url.'),
                        }),
                    );
                }
            } else {
                valid = this._accessToken.text != '';
            }
        }

        this._saveBtn.sensitive = valid;
    }

    /**
     * Get error user visible text
     *
     * @returns {string} The error text
     */
    _errorText(error) {
        switch (error) {
            case 'FailedForgeAuth':
                return _('Couldn’t authenticate the account');
            case 'FailedTokenScopes':
                return _('The access token doesn’t have the needed scopes');
            default:
                return _('Unexpected error when creating the account');
        }
    }

    /**
     * Callback when the user clicks the cancel button.
     */
    _onCancel() {
        this.close();
    }

    /**
     * Callback when the user clicks the save button.
     */
    _onSave() {
        if (this.editing) {
            this._updateAccount();
        } else {
            this._addAccount();
        }
    }

    /**
     * Callback when the user adds an account.
     * Save account in settings.
     */
    async _addAccount() {
        try {
            /* Make the whole form insensitive */
            this._page.sensitive = false;

            /* Get form values */
            const token = this._accessToken.text;
            const url = this._getInstanceURL();
            const forgeName = this._getSeletedForge();

            /* Instantiate the class for the forge */
            const forge = new FORGES[forgeName](url, token);
            /* Try authenticating the user with access token */
            const [userId, username] = await forge.getUser();

            if (username != undefined) {
                /* Save account to settings */
                await accounts.saveAccount(
                    forgeName,
                    url,
                    userId,
                    username,
                    token,
                );
            }

            this.close();

            /* Reload notifications */
            Adw.Application.get_default()
                .lookup_action('reload')
                .activate(null);
        } catch (error) {
            console.log(error);
            this._toasts.add_toast(
                new Adw.Toast({
                    title: this._errorText(error),
                }),
            );
        } finally {
            this._page.sensitive = true;
        }
    }

    /**
     * Callback when the user saves an account new preferences.
     * Update account in settings.
     */
    async _updateAccount() {
        if (!this.editing) return;

        /* Make the whole form insensitive */
        this._page.sensitive = false;

        /* Get and validate from values */
        const forgeClass = FORGES[this._account.forge];
        let newToken = this._accessToken.text;
        let newUrl = this._instance.text;
        if (!forgeClass.allowInstances) {
            newUrl = forgeClass.defaultURL;
        } else {
            newUrl = this._validateUrl(newUrl);
            newUrl = this._getUriHost(newUrl);
        }

        /* Continue if some value has actually changed */
        if (newToken != this._account.token || newUrl != this._account.url) {
            try {
                const forge = new forgeClass(newUrl, newToken);
                const [userId, username] = await forge.getUser();

                await accounts.updateAccount(
                    this._account.id,
                    newUrl,
                    userId,
                    username,
                    newToken,
                );

                this.close();

                /* Reload notifications */
                Adw.Application.get_default()
                    .lookup_action('reload')
                    .activate(null);
            } catch (error) {
                console.log(error);
                this._toasts.add_toast(
                    new Adw.Toast({
                        title: this._errorText(error),
                    }),
                );
            }
        }

        this._page.sensitive = true;
    }

    /**
     * Callback when the user removes an account
     */
    async _onRemoveAccount() {
        if (!this.editing) return;

        const errorToast = new Adw.Toast({
            title: _('Unexpected error removing the account'),
        });
        try {
            const success = await accounts.removeAccount(this._account.id);
            if (!success) {
                this._toasts.add_toast(errorToast);
            } else {
                this.close();

                /* Reload notifications */
                Adw.Application.get_default()
                    .lookup_action('reload')
                    .activate(null);
            }
        } catch (error) {
            this._toasts.add_toast(errorToast);
        }
    }
}
