// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';

import Notification from './notification.js';

export default class NotificationsModel extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'NotificationsModel',
            Implements: [Gio.ListModel],
        }, this);
    }

    /**
     * Crete a NotificationsModel
     */
    constructor() {
        super();

        /* Store notifications */
        this._notifications = [];
    }

    /**
     * Get notifications GType
     */
    vfunc_get_item_type() {
        return Notification.$gtype;
    }

    /**
     * Get notification by given position
     * @param {Number} position The position of the notification to get
     * @returns {Notification}
     */
    vfunc_get_item(position) {
        return this._notifications[position] || null;
    }

    /**
     * Get the number of notifications in the model
     * @returns {Number}
     */
    vfunc_get_n_items() {
        return this._notifications.length;
    }

    /**
     * Clear the model
     */
    clear() {
        const removed = this._notifications.length;
        this._notifications.length = 0;
        this.items_changed(0, removed, 0);
    }

    /**
     * Prepend a new notification to the model
     * @param {Notification} notification The notification to append
     */
    prepend(notification) {
        this._notifications.unshift(notification);
        this.items_changed(0, 0, 1);
    }

    /**
     * Get a notifications by its ID
     * @param {String} id The id of the notification to get
     * @returns {Notification}
     */
    get_by_id(id) {
        for (const notification of this._notifications){
            if (notification.id == id) {
                return notification;
            }
        }
        return null;
    }

    /**
     * Remove a notifications by its ID
     * @param {String} id The id of the notification to remove
     */
    remove_by_id(id) {
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
};
