// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import Template from './window.blp' assert { type: 'uri' };
import AllDone from './assets/alldone.svg';
import NotificationsModel from './notificationsModel.js';
import NotificationRow from './notificationRow.js';
import AccountsManager from './accounts.js';
import { settings, requestBackground, setBackgroundStatus } from './util.js';
import { FORGES, extractID } from './forges/index.js';

const accounts = new AccountsManager();

export default class Window extends Adw.ApplicationWindow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: [
                'mainStack', 'spinner', 'headerbar', 'scrolled', 'emptyPicture',
                'notificationsStack', 'notificationsList', 'markAsRead'
            ],
        }, this);
    }

    /**
     * Crete a Window
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this.forges = {}; // Store accounts forge instances
        this.interval = 60; // Interval of the notifications requests

        /* Set app initial state */
        this._mainStack.set_visible_child_name('loading');
        this._spinner.start();
        this._emptyPicture.set_resource(AllDone);
        this._scrolled.vadjustment.connect('value-changed', this._onScrollChanged.bind(this));

        /* Check accounts removal */
        accounts.connect('items-changed', () => {
            if (accounts.get_n_items() == 0) {
                this._mainStack.set_visible_child_name('setup');
            }
        });

        /* Notifications model */
        this.model = new NotificationsModel();
        this.notified = {};
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
        const model = new Gtk.SortListModel({
            model: this.model,
            sorter: new Gtk.NumericSorter({
                expression: expression,
                sort_order: Gtk.SortType.DESCENDING
            }),
        });

        /* Bind sorted model to list box */
        this._notificationsList.bind_model(model, this._createNotificationRow.bind(this));

        /* First run, background request */
        if (!settings.get_boolean('first-run')) {
            this._firstRun();
        } else {
            /* Subscribe to notifications */
            this.subscribe();
        }
    }

    _onWindowHide() {
        if (!this.visible) {
            setBackgroundStatus();
        }
    }

    _onScrollChanged(adjustment) {
        if (adjustment.value > 0) {
            this._headerbar.remove_css_class('flat');
        } else {
            this._headerbar.add_css_class('flat');
        }
    }

    async _firstRun() {
        const result = await requestBackground(this, false);
        settings.set_boolean('hide-on-close', result);
        settings.set_boolean('first-run', true);

        /* Continue, subscribe to notifications */
        this.subscribe();
    }

    async subscribe() {
        if (!accounts.get_n_items()) {
            this._mainStack.set_visible_child_name('setup');
            this._retryHandler = accounts.connect('items-changed', () => {
                this.subscribe();
            });
            return;
        }

        if (!this._retryHandler === undefined) {
            accounts.disconnect(this._retryHandler);
        }

        let newNotifications = [];
        for (var i = 0; i < accounts.get_n_items(); i++) {
            const account = accounts.get_item(i);

            if (!(account.id in this.forges) || this.forges[account.id] == undefined) {
                try {
                    const token = await accounts.getAccountToken(account.id);
                    this.forges[account.id] = new FORGES[account.forge](
                        account.url, token, account.id, account.displayName
                    );
                } catch (error) {
                    logError(error);
                }
            }

            try {
                let notifications = await this.forges[account.id].getNotifications(this);
                newNotifications.push(...notifications);
            } catch (error) {
                logError(error);
            }
        }

        newNotifications.reverse();
        this.showNotifications(newNotifications);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.interval * 1000, () => {
            this.subscribe();
            return GLib.SOURCE_REMOVE;
        });
    }

    showNotifications(notifications) {
        const app = this.get_application();

        this.model.clear(); // Clear list

        for (const notification of notifications) {
            this.model.prepend(notification);

            if (!notification.id in this.notified || this.notified[notification.id] != notification.updated_at) {
                if (!this.is_active) {
                    app.send_notification(`fs-${notification.id}`, notification.notification);
                }
                this.notified[notification.id] = notification.updated_at;
            }
        }

        this._mainStack.set_visible_child_name('notifications');
        if (this._spinner.spinning) {
            this._spinner.stop();
        }
    }

    async resolveNotification(id) {
        const app = this.get_application();
        /* Withdraw desktop notification */
        app.withdraw_notification(`fs-${id}`);

        /* Mark as read */
        const [account, notification] = extractID(id);
        const success = await this.forges[account].markAsRead(notification);
        if (success) {
            /* Remove it from window list */
            this.model.remove_by_id(id);
        }
    }

    async markAsReadAll() {
        /* Mark as read all notifs on all accounts */
        for (const id in this.forges) {
            try {
                await this.forges[id].markAsRead();
            } catch (error) {
                logError(error);
            }
        }
        this.model.clear();
    }

    _createNotificationRow(notification) {
        const row = new NotificationRow({
            title: notification.title,
            repo: notification.repository,
            icon_name: notification.iconName,
            activatable: true,
        });

        if (accounts.isMultiple()) {
            row.account = notification.account_name;
        }

        row.connect('activated', () => {
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
};
