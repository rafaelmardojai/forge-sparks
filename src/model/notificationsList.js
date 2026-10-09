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

        /* Map to store notifications by id */
        this._byId = new Map();
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
     * @returns {number|null} The notification object or null if not objects
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

        this._byId.clear();
        this._notifications.splice(0, removed);

        this.items_changed(0, removed, 0);
    }

    /**
     * Append a notification to the list
     *
     * @param {Notification} notification The notification to append
     */
    append(notification) {
        this._notifications.push(notification);
        this._byId.set(notification.id, notification);

        this.items_changed(this._notifications.length - 1, 0, 1);
    }

    /**
     * Remove a notification from the list
     *
     * @param {number} position The position of the notification to remove
     */
    remove(position) {
        const notification = this._notifications[position];

        this._byId.delete(notification.id);
        this._notifications.splice(position, 1);

        this.items_changed(position, 1, 0);
    }

    /**
     * Remove a notification from the list by its ID
     *
     * @param {string} id The ID of the notification to remove
     */
    removeByID(id) {
        const notification = this._byId.get(id);
        if (!notification) return;

        const index = this._notifications.indexOf(notification);

        this._notifications.splice(index, 1);
        this._byId.delete(id);

        this.items_changed(index, 1, 0);
    }

    /**
     * Get a notification by its ID
     *
     * @param {string} id The ID of the notification to get
     * @returns {Notification} The notification with the given ID
     */
    getById(id) {
        return this._byId.get(id);
    }
}
