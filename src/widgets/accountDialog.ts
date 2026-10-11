import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import { getResourceUri } from '../util.js';
import { FORGES } from '../forges/index.js';
import AccountsManager from '../model/accountsManager.js';
import Account from '../model/account.js';
import Forge from '../forges/forge.js';

interface ConstructorProps extends Partial<Adw.Dialog.ConstructorProps> {
    account?: Account | null;
}

const accounts = new AccountsManager();

export default class AccountDialog extends Adw.Dialog {
    declare private _forge: Adw.ComboRow;
    declare private _instance: Adw.EntryRow;
    declare private _accessToken: Adw.PasswordEntryRow;
    declare private _accessTokenHelp: Adw.ButtonContent;
    declare private _removeAccount: Gtk.Button;
    declare private _saveBtn: Gtk.Button;
    declare private _toasts: Adw.ToastOverlay;
    declare private _page: Adw.PreferencesPage;
    declare private _titleWidget: Adw.WindowTitle;

    declare private _editing: boolean;

    private forges_ls: (typeof Forge)[];
    private account: Account | null;
    private accountToken: string | null = null;
    private userChangedInstance: boolean = false;

    static {
        GObject.registerClass(
            {
                Template: getResourceUri('widgets/accountDialog.ui'),
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
                    editing: GObject.ParamSpec.boolean('editing', null, null, GObject.ParamFlags.READABLE, false),
                },
            },
            this,
        );
    }

    /**
     * Crete an AccountDialog
     */
    constructor({ account = null, ...props }: ConstructorProps = {}) {
        super(props);

        this.forges_ls = Object.values(FORGES);
        this.account = account;

        this.connect('notify::editing', this.onEditing.bind(this));

        /* Setup edited account */
        if (this.account != null) {
            this._editing = true;
            this.notify('editing');

            this.loadSavedAccount();
        }

        /* Populate forges list (Create account view) */
        const forgesList = new Gtk.StringList();
        for (const forge of this.forges_ls) {
            forgesList.append(forge.prettyName);
        }
        this._forge.model = forgesList;
    }

    /**
     * If the form is editing an existing account
     */
    get editing(): boolean {
        return this._editing;
    }

    /**
     * Change labels to the editing context
     */
    private onEditing() {
        if (this.editing) {
            this.title = _('Edit Account');
            this._saveBtn.label = _('Save');

            if (this.account != null) this._titleWidget.subtitle = this.account.displayName;
        }
    }

    /**
     * Load the account saved values
     */
    private async loadSavedAccount() {
        if (!this.account) return;

        /* Load saved instance URL */
        if (this.allowInstances()) {
            this._instance.visible = true;
            this._instance.text = this.account.url ?? '';
        }

        /* Load saved token */
        const token = await accounts.getAccountToken(this.account.id);
        this._accessToken.text = token;

        /* Token help text */
        this._accessTokenHelp.label = FORGES[this.account.forge as string].tokenText;

        /* Save current account token */
        this.accountToken = token;

        this.onEntryChanged();
    }

    /**
     * Get selected forge name from the new account view
     */
    private getSelectedForge(): string {
        return this.forges_ls[this._forge.selected].identifier;
    }

    /**
     * Get if selected forge in new account view allows instances
     */
    private allowInstances(): boolean {
        if (this.editing) {
            return FORGES[this.account?.forge as string].allowInstances;
        }
        return this.forges_ls[this._forge.selected].allowInstances;
    }

    /**
     * Get instance url set in the new account view.
     * Or forge default url if it doesn't allow instances
     */
    private getInstanceURL(): string {
        if (!this.allowInstances()) {
            return this.forges_ls[this._forge.selected].defaultURL;
        }

        const url = this.validateUrl(this._instance.text);
        const host = this.getUriHost(url);
        return host;
    }

    /**
     * Get host from GLib.Uri with the www removed
     */
    private getUriHost(uri: GLib.Uri): string {
        let host = uri.get_host();
        if (host?.startsWith('www.')) {
            host = host.slice(4);
        }
        return host as string;
    }

    /**
     * Callback for when the selected forge changes in the add new account view
     */
    protected onForgeChanged() {
        /* Enable or disable instance URL entry */
        this._instance.visible = this.allowInstances();
        /* Token help text */
        this._accessTokenHelp.label = this.forges_ls[this._forge.selected].tokenText;

        /* Entries may be different so validate again */
        this.onEntryChanged();

        /* Load default instance url */
        if (!this.userChangedInstance && this.account == null) {
            this._instance.text = this.forges_ls[this._forge.selected].defaultURL;
        }
    }

    /**
     * Validate and get GLib.Uri from url string
     *
     * @param url URL to validate
     * @trows Trows an error if GLib failed parsing the url
     * @returns Parsed URI
     */
    private validateUrl(url: string): GLib.Uri {
        /* Force https */
        if (!/^https?:\/\//i.test(url)) {
            url = 'https://' + url;
        }

        try {
            const parse = GLib.Uri.parse(url, GLib.UriFlags.PARSE_RELAXED);
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
    protected onInstanceChanged() {
        this.userChangedInstance =
            !this.editing && this._instance.text != this.forges_ls[this._forge.selected].defaultURL;
    }

    /**
     * Callback when any entry changes
     * Validate instance url and access token.
     *
     * Updates save button sensitivity after validating the values.
     */
    private onEntryChanged() {
        let valid = false;

        if (this.editing && this.account != null) {
            const instances = FORGES[this.account.forge as string].allowInstances;
            const urlChanged = this.account.url != this._instance.text;
            const tokenChanged = this.accountToken != this._accessToken.text;
            const urlNotEmpty = this._instance.text != '';
            const tokenNotEmpty = this._accessToken.text != '';

            if (instances) {
                try {
                    this.validateUrl(this._instance.text);
                    this._instance.remove_css_class('error');
                    valid =
                        (urlNotEmpty && tokenNotEmpty && urlChanged) || (urlNotEmpty && tokenNotEmpty && tokenChanged);
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
            if (this.allowInstances()) {
                try {
                    this.validateUrl(this._instance.text);
                    this._instance.remove_css_class('error');
                    valid = this._accessToken.text != '' && this._instance.text != '';
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
     */
    private errorText(error: string): string {
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
    protected onCancel() {
        this.close();
    }

    /**
     * Callback when the user clicks the save button.
     */
    protected onSave() {
        if (this.editing) {
            this.updateAccount();
        } else {
            this.addAccount();
        }
    }

    /**
     * Callback when the user adds an account.
     * Save account in settings.
     */
    private async addAccount() {
        try {
            /* Make the whole form insensitive */
            this._page.sensitive = false;

            /* Get form values */
            const token = this._accessToken.text;
            const url = this.getInstanceURL();
            const forgeName = this.getSelectedForge();

            /* Instantiate the class for the forge */
            const forge = new FORGES[forgeName](url, token);
            /* Try authenticating the user with access token */
            const [userId, username] = await forge.getUser();

            if (username != undefined) {
                /* Save account to settings */
                await accounts.saveAccount(forgeName, url, userId, username, token);
            }

            this.close();

            /* Reload notifications */
            Adw.Application.get_default()?.lookup_action('reload')?.activate(null);
        } catch (error) {
            console.log(error);
            this._toasts.add_toast(
                new Adw.Toast({
                    title: this.errorText(error as any),
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
    private async updateAccount() {
        if (!this.editing || !this.account) return;

        /* Make the whole form insensitive */
        this._page.sensitive = false;

        /* Get and validate from values */
        const forgeClass = FORGES[this.account.forge as string];
        let newToken = this._accessToken.text;
        let newUrl = this._instance.text;
        if (!forgeClass.allowInstances) {
            newUrl = forgeClass.defaultURL;
        } else {
            const newUri = this.validateUrl(newUrl);
            newUrl = this.getUriHost(newUri);
        }

        /* Continue if some value has actually changed */
        if (newToken != this.accountToken || newUrl != this.account.url) {
            try {
                const forge = new forgeClass(newUrl, newToken);
                const [userId, username] = await forge.getUser();

                await accounts.updateAccount(this.account.id, newUrl, userId, username, newToken);

                this.close();

                /* Reload notifications */
                Adw.Application.get_default()?.lookup_action('reload')?.activate(null);
            } catch (error) {
                console.log(error);
                this._toasts.add_toast(
                    new Adw.Toast({
                        title: this.errorText(error as any),
                    }),
                );
            }
        }

        this._page.sensitive = true;
    }

    /**
     * Callback when the user removes an account
     */
    protected async onRemoveAccount() {
        if (!this.editing || !this.account) return;

        const errorToast = new Adw.Toast({
            title: _('Unexpected error removing the account'),
        });
        try {
            const success = await accounts.removeAccount(this.account.id);
            if (!success) {
                this._toasts.add_toast(errorToast);
            } else {
                this.close();

                /* Reload notifications */
                Adw.Application.get_default()?.lookup_action('reload')?.activate(null);
            }
        } catch (error) {
            this._toasts.add_toast(errorToast);
        }
    }
}
