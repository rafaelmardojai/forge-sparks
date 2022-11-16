// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import Template from './window.blp' assert { type: 'uri' };
import Notification from './notification.js';
import GitHub from './github.js';
import AccountsManager from './accounts.js';

const FORGES = {
  'github': GitHub
}

const accounts = new AccountsManager();

class Window extends Adw.ApplicationWindow {

    /**
     * Crete a Window
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this.forges = {}; // Store accounts forge instances
        this.interval = 60; // Interval of the notifications requests

        // Set app initial state
        this._mainStack.set_visible_child_name('loading');
        this._spinner.start();

        // Notifications model
        this.model = new Gio.ListStore({item_type: Notification});
        // Unread Notifications filter and model
        let unreadExpression = new Gtk.PropertyExpression(Notification, null, 'unread');
        let unreadFilter = new Gtk.BoolFilter({expression: unreadExpression});
        let unreadModel = new Gtk.FilterListModel({
            model: this.model,
            filter: unreadFilter
        });
        unreadModel.connect('items-changed', (_pos, _rmv, _add) => {
            if (unreadModel.get_n_items() > 0) {
                this._notificationsStack.set_visible_child_name('list');
            } else {
                this._notificationsStack.set_visible_child_name('empty');
            }
        });

        // Bind ListBox with model
        this._notificationsList.bind_model(unreadModel, this._createNotificationRow.bind(this));

        // Suscribe to notifs
        this.suscribe();
    }

    async suscribe() {
        const savedAccounts = accounts.getAccounts();
        let newNotis = [];

        if (!savedAccounts.length) {
            this._mainStack.set_visible_child_name('setup');
            this._retryHandler = accounts.connect('items-changed', () => {
                this.suscribe();
            });
            return;
        }

        if (!this._retryHandler === undefined) {
            accounts.disconnect(this._retryHandler);
        }

        for (const id of savedAccounts) {
            if (!(id in this.forges) || this.forges[id] == undefined) {
                try {
                    const forgeName = accounts.getAccountSetting(id, 'forge');
                    const token = await accounts.getAccountToken(id);
                    this.forges[id] = new FORGES[forgeName](token);
                } catch (error) {
                    logError(error);
                }
            }

            try {
                let notifications = await this.forges[id].getNotifications(this);
                newNotis.push(...notifications);
            } catch (e) {
                logError(e);
            }
        }

        this.showNotifications(newNotis);

        GLib.timeout_add(GLib.PRIORITY_DEFAULT, this.interval * 1000, () => {
            this.suscribe();
            return GLib.SOURCE_REMOVE;
        });
    }

    showNotifications(notifications) {
        const app = this.get_application();

        // model.remove_all();
        for (const notification of notifications) {
            const found = false;
            const index = 0;

            if (found) {
                this.model.remove(index);
            }
            this.model.append(notification);
            if (notification.unread && !this.has_focus) {
                app.send_notification(null, notification.notification);
            }
        }

        this._mainStack.set_visible_child_name('notifications');
        if (this._spinner.spinning) {
            this._spinner.stop();
        }

        /*switch (response.status) {
            case 200:
                break;
            case 304:
                break;
            default:
                break;
        }*/
    }

    removeNotification(id) {
        for (const [notification, index] of this.model.entries()) {
            if (notification.id == id) {
                this.model.remove(index);
                break;
            }
        }
    }

    _createNotificationRow(notification) {
        const row = new Adw.ActionRow({
            title: notification.title,
            subtitle: notification.repository,
            icon_name: notification.iconName,
            title_lines: 1,
            activatable: true,
        });

        row.connect('activated', () => {
            Gtk.show_uri_full(this, notification.url, Gdk.CURRENT_TIME, null, (_obj, result) => {
                // TODO: Mark as read.
                const opened = Gtk.show_uri_full_finish(this, result);
                if (opened) {
                    let position = null;
                    this.model.find(notification, position);
                    if (position =! null) {
                        this.model.remove(position);
                    }
                }
            });
        });

        return row;
    }
};

export default GObject.registerClass(
    {
        Template,
        InternalChildren: [
            'mainStack', 'spinner', 'notificationsStack', 'notificationsList'
        ],
    },
    Window
);
