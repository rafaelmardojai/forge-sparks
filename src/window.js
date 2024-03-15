// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { settings, requestBackground, setBackgroundStatus, relativeDate } from './util.js';
import { FORGES, extractID } from './forges/index.js';

import AccountsManager from './model/accountsManager.js';
import NotificationsList from './model/notificationsList.js';

import AccountDialog from './widgets/accountDialog.js';
import NotificationRow from './widgets/notificationRow.js';

import AllDoneIllustration from './assets/alldone.svg';
import Template from './window.blp' with { type: 'uri' };
import HelpOverlayTemplate from './gtk/help-overlay.blp' with { type: 'resource' };

const Format = imports.format;

/* Get the accounts manager singleton instance */
const accounts = new AccountsManager();

/* Main application window */
export default class Window extends Adw.ApplicationWindow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'mainStack', 'spinner', 'headerbar','emptyPicture',
                'accountBanner', 'setupPage', 'notificationsStack', 'notificationsList',
                'markAsRead', 'markAsReadIcon', 'markAsReadSpinner',
            ],
        }, this);
    }

    /**
     * Crete a Window
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        /* Store accounts forge instances */
        this.forges = {};
        /* Interval of the notifications requests, in seconds */
        this.interval = 60;
        /* Fetching state */
        this.fetching = false;
        this.reFetch = false;
        /* Store app fail states */
        this.authFailed = null;
        this.authErrorNotified = false;

        /* Set help overlay */
        const help_overlay = Gtk.Builder.new_from_resource(HelpOverlayTemplate).get_object('help_overlay');
        this.set_help_overlay(help_overlay);

        /* Set app initial state */
        this._mainStack.set_visible_child_name('loading');
        this._spinner.start();
        this._setupPage.icon_name = pkg.name;
        this._emptyPicture.set_resource(AllDoneIllustration);

        /* Listen to accounts model changes */
        accounts.connect('items-changed', () => {
            /* Show setup view if not accounts configured */
            if (accounts.get_n_items() == 0) {
                this._mainStack.set_visible_child_name('setup');
                this._spinner.stop();
            }
        });

        /* Setup notifications model */
        this.model = new NotificationsList();
        this.notified = {}; /* Store notifications {id: timestamp} that have been notified */
        this.model.connect('items-changed', (_pos, _rmv, _add) => {
            if (this.model.get_n_items() > 0) {
                this._notificationsStack.set_visible_child_name('list');
            } else {
                this._notificationsStack.set_visible_child_name('empty');
            }
            this._markAsRead.visible = this.model.get_n_items() > 0;
        });

        /* Sort the model by timestamp */
        const expression = new Gtk.PropertyExpression(this.model.get_item_type(), null, 'timestamp');
        this.sortedModel = new Gtk.SortListModel({
            model: this.model,
            sorter: new Gtk.NumericSorter({
                expression: expression,
                sort_order: Gtk.SortType.DESCENDING
            }),
        });

        /* Bind sorted model to notifications list box */
        this._notificationsList.bind_model(this.sortedModel, this._createNotificationRow.bind(this));

        /* Add devel class */
        if (pkg.name.endsWith('Devel'))
            this.add_css_class('devel');

        /* First run, background request */
        if (!settings.get_boolean('first-run')) {
            this._firstRun();
        } else {
            /* Subscribe to notifications */
            this.subscribe();
        }
    }

    /**
     * Make first app run setup
     */
    async _firstRun() {
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
     * The timeout event source ID is stored in $this.subscribe_source.
     */
    async subscribe() {
        this.fetching = true;
        const app = this.get_application();

        /* If not accounts found, show setup view and return */
        if (!accounts.get_n_items()) {
            this._mainStack.set_visible_child_name('setup');
            /* Re-call this function if the account model changes in the future */
            this._retryHandler = accounts.connect('items-changed', () => {
                this.subscribe();
            });
            return;
        }

        if (!this._retryHandler === undefined) {
            accounts.disconnect(this._retryHandler);
        }

        if (!accounts.getAccounts().includes(this.authFailed)) {
            this._resolveTokenError();
        }

        let newNotifications = []; /* List to store new notifications */
        /* Loop accounts model */
        for (var i = 0; i < accounts.get_n_items(); i++) {
            const account = accounts.get_item(i);

            /* Init a corresponding forge instance for the account if isn't yet */
            if (!(account.id in this.forges) || this.forges[account.id] == undefined) {
                try {
                    const token = await accounts.getAccountToken(account.id);
                    this.forges[account.id] = new FORGES[account.forge](
                        account.url, token, account.id, account.userId, account.displayName
                    );

                    /* Fetch user ID for older accounts (Forge Sparks =< 0.2) */
                    if (account.userId === 0) {
                        const [userId, _username] = await this.forges[account.id].getUser();
                        account.userId = userId;  // Update user ID on account
                        this.forges[account.id].userId = userId;  // Update user ID on existing forge instance
                    }
                } catch (error) {
                    /* TODO: Notify the user that this failed */
                    log(error);
                }
            }

            /* Get notifications from forge */
            try {
                let notifications = await this.forges[account.id].getNotifications(this);
                newNotifications.push(...notifications);

                /* Reset failed state */
                if (this.authFailed == account.id) {
                    this._resolveTokenError(account);
                }

            } catch (error) {
                if (error === 'FailedForgeAuth') {
                    /* Update state */
                    this.authFailed = account.id;
                    account.authFailed = true;

                    /* Remove account from instances list */
                    delete this.forges[account.id];

                    /* Display error */
                    const title = Format.vprintf(
                        _('Account %s authentication failed!'), [account.displayName]
                    );
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
                        app.send_notification('forge-sparks-error-auth', notification);
                        this.authErrorNotified = true;
                    }
                } else {
                    log(error);
                }
            }
        }

        /* Show new notifications */
        this.showNotifications(newNotifications);

        if (!this.reFetch) {
            /* Add timeout to run this function again */
            this.subscribe_source = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.interval * 1000, () => {
                this.subscribe();
                return GLib.SOURCE_REMOVE;
            });
        } else {
            this.subscribe();
            this.reFetch = false;
        }

        this.fetching = false;
    }

    /**
     * Force notification retrieve
     */
    reload() {
        if (!this.fetching) {
            /* Remove current timeout */
            if (this.subscribe_source != undefined)
                GLib.Source.remove(this.subscribe_source);

            this.subscribe();
        } else {
            this.reFetch = true;
        }

        /* This might be after a user interaction, show the spinner */
        this._mainStack.set_visible_child_name('loading');
        this._spinner.start();
    }

    /**
     * Show notifications to the user
     * 
     * Updates notification model and sends desktop notifications
     * 
     * @param {Array<Notification>} notifications New notifications
     */
    showNotifications(notifications) {
        const app = this.get_application();

        this.model.clear(); /* Clear list */

        /* Loop new notifications and populate the model */
        for (const notification of notifications) {
            this.model.append(notification);
        }

        /* Loop sorted notifications model, so we can show them on order */
        for (var i = 0; i < this.sortedModel.get_n_items(); i++) {
            const notification = this.sortedModel.get_item(i);

            /* Only send notifications if the window is hidden or not focused */
            if (!this.visible || !this.is_active) {
                /* If notification hasn't been notified before or has changed
                   since last time, send desktop notification */
                if (!notification.id in this.notified || this.notified[notification.id] != notification.updatedAt) {
                    app.send_notification(`fs-${notification.id}`, notification.notification);
                }
            }

            /* Add notification id and timestamp to notified dict */
            this.notified[notification.id] = notification.updatedAt;
        }

        /* Stop loading view, and show notifications view */
        this._mainStack.set_visible_child_name('notifications');
        if (this._spinner.spinning) {
            this._spinner.stop();
        }
    }

    /**
     * Resolve a notification
     * 
     * Mark it as read and withdraw it from desktop inbox
     * 
     * @param {String} id  Notification ID
     */
    async resolveNotification(id) {
        const app = this.get_application();
        /* Withdraw desktop notification */
        app.withdraw_notification(`fs-${id}`);

        /* Mark as read */
        const [account, notification] = extractID(id);
        const success = await this.forges[account].markAsRead(notification);
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
        this._markAsReadSpinner.start();

        /* Mark as read all notifications on all accounts */
        for (const id in this.forges) {
            try {
                await this.forges[id].markAsRead();
            } catch (error) {
                /* TODO: Notify the user that this failed */
                logError(error);
            }
        }

        this.model.clear(); /* Clear list model */

        /* Revert ongoing progress status */
        this._markAsRead.sensitive = true;
        this._notificationsList.sensitive = true;
        this._markAsReadIcon.set_visible_child_name('icon');
        this._markAsReadSpinner.stop();
    }

    /**
     * Create a widget from a notification object
     * 
     * @param {Notification} notification The notification object
     * @returns {Gtk.WIdget} The widget representing a notification 
     */
    _createNotificationRow(notification) {
        /* Create widget from notification values */
        const row = new NotificationRow({
            title: notification.title,
            repo: notification.repository,
            date: relativeDate(notification.dateTime),
            icon_name: notification.iconName,
            activatable: true,
            state: notification.state,
        });

        /* Show account name on widget */
        if (accounts.isMultiple()) {
            row.account = notification.accountName;
        }

        /* Open link and mark as read when widget is activated */
        row.connect('activated', () => {
            /* Set progress state on widget */
            row.progress = true;
            row.sensitive = false;

            const action = this.get_application().lookup_action('open-notification');
            action.activate(
                GLib.Variant.new_array(
                    new GLib.VariantType('s'),
                    [GLib.Variant.new_string(notification.id), GLib.Variant.new_string(notification.url)]
                )
            );
        });

        return row;
    }

    /**
     * Callback for when the windows is hidden
     */
    _onWindowHide() {
        if (!this.visible) {
            /* Set app background status */
            setBackgroundStatus();
        }
    }

    /**
     * Open a dialog to add an account
     */
    _onNewAccount() {
        const dialog = new AccountDialog(null);
        dialog.present(this);
    }

    /**
     * Resolve token error
     * 
     * @param {Account | null} account Account to resolve
     */
    _resolveTokenError(account = null) {
        this.authFailed = null;
        this.authErrorNotified = false;
        if (account != null)
            account.authFailed = false;

        this._accountBanner.revealed = false;
        const app = this.get_application();
        app.withdraw_notification('forge-sparks-error-auth');
    }
};
