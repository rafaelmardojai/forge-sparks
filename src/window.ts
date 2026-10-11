// SPDX-License-Identifier: MIT
import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import Forge from './forges/forge.js';
import { FORGES, extractID } from './forges/index.js';
import type Account from './model/account.js';
import AccountsManager from './model/accountsManager.js';
import type Notification from './model/notification.js';
import NotificationsModel from './model/notificationsModel.js';
import { settings, requestBackground, setBackgroundStatus, relativeDate, getResourceUri } from './util.js';
import AccountDialog from './widgets/accountDialog.js';
import NotificationRow from './widgets/notificationRow.js';

const Format = imports.format;

/* Get the accounts manager singleton instance */
const accounts = new AccountsManager();

/* Main application window */
export default class Window extends Adw.ApplicationWindow {
    declare private _mainStack: Gtk.Stack;
    declare private _headerbar: Adw.HeaderBar;
    declare private _emptyPicture: Gtk.Picture;
    declare private _accountBanner: Adw.Banner;
    declare private _setupPage: Adw.StatusPage;
    declare private _notificationsStack: Gtk.Stack;
    declare private _notificationsList: Gtk.ListBox;
    declare private _markAsRead: Gtk.Button;
    declare private _markAsReadIcon: Gtk.Stack;

    /**
     * Store accounts forge instances.
     */
    private forges: Map<string, Forge> = new Map();

    /**
     * Interval of the notifications requests, in seconds.
     */
    private interval: number = 60;

    /**
     * Model for the notifications list.
     */
    private model: NotificationsModel;

    /**
     * Notifications that have been notified to the user.
     */
    private notified: Record<string, string>;

    /** Store the fetching state */
    private fetching: boolean = false;
    private reFetch: boolean = false;

    /** Store app fail states */
    private authFailed: string | null = null;
    private authErrorNotified: boolean = false;
    private fetchError: boolean = false;
    private networkError: boolean = false;

    /** Store the source of the notifications subscription timeout */
    private subscribeSource: number | null = null;

    /** Store the handler of the notifications retry signal */
    private retryHandler: number | null = null;

    static {
        GObject.registerClass(
            {
                Template: getResourceUri('window.ui'),
                InternalChildren: [
                    'mainStack',
                    'headerbar',
                    'emptyPicture',
                    'accountBanner',
                    'setupPage',
                    'notificationsStack',
                    'notificationsList',
                    'markAsRead',
                    'markAsReadIcon',
                ],
            },
            this,
        );
    }

    /**
     * Crete a Window
     */
    constructor(params?: Partial<Adw.ApplicationWindow.ConstructorProps>) {
        super(params);

        /* Set app initial state */
        this._mainStack.set_visible_child_name('loading');
        this._setupPage.icon_name = pkg.name;
        this._emptyPicture.set_resource(getResourceUri('assets/alldone.svg'));

        /* Listen to accounts model changes */
        accounts.connect('items-changed', () => {
            /* Show setup view if not accounts configured */
            if (accounts.get_n_items() == 0) {
                this._mainStack.set_visible_child_name('setup');
            }
        });

        /* Setup notifications model */
        this.model = new NotificationsModel();
        this.model.connect('items-changed', (_pos, _rmv, _add) => {
            if (this.model.get_n_items() > 0) {
                this._notificationsStack.set_visible_child_name('list');
            } else {
                this._notificationsStack.set_visible_child_name('empty');
            }
            this._markAsRead.visible = this.model.get_n_items() > 0;
        });

        /* Saved notifications from previous session */
        this.notified = settings.get_value('notified').deepUnpack<Record<string, string>>();

        /* Bind sorted model to notifications list box */
        this._notificationsList.bind_model(this.model, this.createNotificationRow.bind(this));

        /* Add devel class */
        if (pkg.name.endsWith('Devel')) this.add_css_class('devel');

        /* First run, background request */
        if (!settings.get_boolean('first-run')) {
            this.firstRun();
        } else {
            /* Subscribe to notifications */
            this.subscribe();
        }
    }

    /**
     * Make first app run setup
     */
    private async firstRun() {
        /* Ask for background permission to the portal */
        const result = await requestBackground(this, false);
        /* Save result as the hide-on-close setting value.
           We want this setting to be true by default if the portal request success */
        settings.set_boolean('hide-on-close', result);
        /* Set first-run setting to true so we don't tun this code again */
        settings.set_boolean('first-run', true);

        /* Continue, subscribe to notifications */
        this.subscribe();
    }

    /**
     * Run notifications getter task.
     *
     * This is a recursive function with a timeout set by $this.interval.
     * The timeout event source ID is stored in $this.subscribeSource.
     */
    public async subscribe() {
        this.fetching = true;
        this.fetchError = false;
        this.networkError = false;

        const app = this.get_application();

        if (this.retryHandler != null) {
            accounts.disconnect(this.retryHandler);
        }

        /* Resolve token error */
        if (this.authFailed && !accounts.getAccounts().includes(this.authFailed)) {
            this.resolveTokenError();
        }

        /* If not accounts found, show setup view and return */
        if (!accounts.get_n_items()) {
            this._mainStack.set_visible_child_name('setup');
            /* Re-call this function if the account model changes in the future */
            this.retryHandler = accounts.connect('items-changed', () => {
                this.subscribe();
            });
            return;
        }

        /* Loop accounts model */
        for (var i = 0; i < accounts.get_n_items(); i++) {
            const account = accounts.get_item(i) as Account;

            /* Init a corresponding forge instance for the account if isn't yet */
            if (!(account.id in this.forges) || this.forges.get(account.id) === undefined) {
                try {
                    const token = await accounts.getAccountToken(account.id);
                    const instance = new FORGES[account.forge as string](
                        account.url as string,
                        token,
                        account.id,
                        account.userId,
                        account.displayName,
                    );

                    this.forges.set(account.id, instance);
                    this.model.addModel(account.id, instance);

                    /* Fetch user ID for older accounts (Forge Sparks =< 0.2) */
                    if (account.userId === 0) {
                        const [userId, _username] = await instance.getUser();
                        account.userId = userId; // Update user ID on account
                        instance.userId = userId; // Update user ID on existing forge instance
                    }
                } catch (error) {
                    /* TODO: Notify the user that this failed */
                    console.error(error);
                }
            }

            /* Get notifications from forge */
            try {
                await this.forges.get(account.id)?.getNotifications();

                /* Reset failed state */
                if (this.authFailed == account.id) {
                    this.resolveTokenError(account);
                }
            } catch (error) {
                this.fetchError = true;
                if (error instanceof GLib.Error) {
                    if (
                        error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.NETWORK_UNREACHABLE) ||
                        error.matches(Gio.IOErrorEnum, Gio.IOErrorEnum.TIMED_OUT) ||
                        error.matches(Gio.ResolverError, Gio.ResolverError.NOT_FOUND)
                    ) {
                        this.networkError = true;
                    }
                    console.error(error);
                } else if (error === 'FailedForgeAuth') {
                    /* Update state */
                    this.authFailed = account.id;
                    account.authFailed = true;

                    /* Remove account from instances list */
                    this.forges.delete(account.id);

                    /* Display error */
                    const title = Format.vprintf(_('Account %s authentication failed!'), [account.displayName]);
                    const description = _('The token may have been revoked or expired.');

                    /* Show error banner */
                    this._accountBanner.title = title + '\n' + description;
                    this._accountBanner.revealed = true;

                    /* Send notification */
                    if (!this.is_active && !this.authErrorNotified) {
                        const notification = new Gio.Notification();
                        notification.set_title(title);
                        notification.set_body(description);
                        notification.set_default_action('app.activate');
                        notification.add_button(_('Accounts'), 'app.accounts');
                        app?.send_notification('forge-sparks-error-auth', notification);
                        this.authErrorNotified = true;
                    }
                } else {
                    console.error(error);
                }
            }
        }

        /* Show notifications */
        this._mainStack.set_visible_child_name('notifications');
        if (!this.networkError) this.sendNotifications();

        if (!this.reFetch) {
            /* Add timeout to run this function again */
            this.subscribeSource = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, this.interval, () => {
                this.subscribe();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this.reFetch = false;
            this.subscribe();
        }

        this.fetching = false;
    }

    /**
     * Force notification retrieve
     */
    public reload() {
        if (!this.fetching) {
            /* Remove current timeout */
            if (this.subscribeSource != null) {
                GLib.Source.remove(this.subscribeSource);
                this.subscribeSource = null;
            }

            this.subscribe();
        } else {
            this.reFetch = true;
        }

        /* This might be after a user interaction, show the spinner */
        this._mainStack.set_visible_child_name('loading');
    }

    /**
     * Send desktop notifications for all notifications
     */
    private sendNotifications() {
        const app = this.get_application();
        const notified: typeof this.notified = {};

        /* Loop sorted notifications model, so we can show them on order */
        for (var i = 0; i < this.model.get_n_items(); i++) {
            const notification = this.model.get_item(i) as Notification;

            /* Only send notifications if the window is hidden or not focused */
            if (!this.visible || !this.is_active) {
                /* If notification hasn't been notified before or has changed
                   since last time, send desktop notification */
                if (!(notification.id in this.notified) || this.notified[notification.id] != notification.updatedAt) {
                    app?.send_notification(`fs-${notification.id}`, notification.notification);
                }
            }

            /* Add notification id and timestamp to notified dict */
            notified[notification.id] = notification.updatedAt;
        }

        if (!this.fetchError) {
            this.notified = notified;
            /* Save notified ids so if the app restarts we don't notify again */
            settings.set_value('notified', new GLib.Variant('a{ss}', this.notified));
        }
    }

    /**
     * Resolve a notification
     *
     * Mark it as read and withdraw it from desktop inbox
     */
    public async resolveNotification(id: string) {
        const app = this.get_application();
        /* Withdraw desktop notification */
        app?.withdraw_notification(`fs-${id}`);

        /* Mark as read */
        const [account, notification] = extractID(id);
        const success = await this.forges.get(account)?.markAsRead(notification);
        if (success) {
            /* Remove it from list model */
            this.model.removeByID(id);
        }
    }

    /**
     * Mark all notifications as read
     */
    async markAsReadAll() {
        /* Set ongoing progress status */
        this._markAsRead.sensitive = false;
        this._notificationsList.sensitive = false;
        this._markAsReadIcon.set_visible_child_name('spinner');

        /* Mark as read all notifications on all accounts */
        for (const id in this.forges) {
            try {
                await this.forges.get(id)?.markAsRead();
            } catch (error) {
                /* TODO: Notify the user that this failed */
                console.error(error);
            }
        }

        this.model.clear(); /* Clear list model */

        /* Revert ongoing progress status */
        this._markAsRead.sensitive = true;
        this._notificationsList.sensitive = true;
        this._markAsReadIcon.set_visible_child_name('icon');
    }

    /**
     * Create a widget from a notification object
     */
    private createNotificationRow(notification: Notification): Gtk.Widget {
        /* Create widget from notification values */
        const row = new NotificationRow({
            title: notification.title,
            repo: notification.repository,
            date: relativeDate(notification.dateTime),
            iconName: notification.iconName,
            state: notification.state,
        });

        /* Show account name on widget */
        if (accounts.isMultiple()) {
            row.account = notification.accountName;
        }

        /* Open link and mark as read when widget is activated */
        row.connect('activated', (row) => {
            /* Set progress state on widget */
            row.progress = true;

            const action = this.get_application()?.lookup_action('open-notification');
            action?.activate(
                GLib.Variant.new_array(new GLib.VariantType('s'), [
                    GLib.Variant.new_string(notification.id),
                    GLib.Variant.new_string(notification.url),
                ]),
            );
        });

        return row;
    }

    /**
     * Callback for when the windows is hidden
     */
    public onWindowHide() {
        if (!this.visible) {
            /* Set app background status */
            setBackgroundStatus();
        }
    }

    /**
     * Open a dialog to add an account
     */
    protected onNewAccount() {
        const dialog = new AccountDialog();
        dialog.present(this);
    }

    /**
     * Resolve token error
     */
    private resolveTokenError(account: Account | null = null) {
        this.authFailed = null;
        this.authErrorNotified = false;
        if (account != null) account.authFailed = false;

        this._accountBanner.revealed = false;
        this.get_application()?.withdraw_notification('forge-sparks-error-auth');
    }
}
