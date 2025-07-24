// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import Notification from './notification.js';

/* List model to store notifications */
export default class NotificationsList extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'NotificationsList',
                Implements: [Gio.ListModel],
            },
            this,
        );
    }

    /**
     * Crete a NotificationsList
     */
    constructor() {
        super();

        /* Private list to store notifications */
        this._notifications = [];
    }

    /**
     * Get list model stored item type
     *
     * @returns {GType} The list model object type
     */
    vfunc_get_item_type() {
        return Notification.$gtype;
    }

    /**
     * Get item from list model
     *
     * @param {number} position Position of the item to get
     * @returns {Number|null} The notification object or null if not objects
     * in the position
     */
    vfunc_get_item(position) {
        return this._notifications[position] || null;
    }

    /**
     * Get number of items in list model
     *
     * @returns {number} The length of the list model
     */
    vfunc_get_n_items() {
        return this._notifications.length;
    }

    /**
     * Clear the model
     */
    clear() {
        const removed = this._notifications.length;

        while (this._notifications.length) {
            this._notifications.pop();
        }

        this.items_changed(0, removed, 0);
    }

    /**
     * Append a new notification to the model
     *
     * @param {Notification} notification The notification to append
     */
    append(notification) {
        this._notifications.push(notification);
        this.items_changed(this._notifications.length - 1, 0, 1);
    }

    /**
     * Get a notifications by its ID
     *
     * @param {string} id The id of the notification to get
     * @returns {Notification}
     */
    getByID(id) {
        for (const notification of this._notifications) {
            if (notification.id == id) {
                return notification;
            }
        }
        return null;
    }

    /**
     * Remove a notifications by its ID
     *
     * @param {string} id The id of the notification to remove
     */
    removeByID(id) {
        let removeIndex = -1;
        for (const [i, notification] of this._notifications.entries()) {
            if (notification.id == id) {
                removeIndex = i;
                break;
            }
        }

        if (removeIndex != -1) {
            this._notifications.splice(removeIndex, 1);
            this.items_changed(removeIndex, 1, 0);
        }
    }
}
