// SPDX-License-Identifier: MIT
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';

import Notification from './notification.js';

interface Signals extends GObject.Object.SignalSignatures, Gio.ListModel.SignalSignatures {}

/**
 * List model to store notifications
 */
export default class NotificationsList extends GObject.Object implements Gio.ListModel<Notification> {
    declare get_item: Gio.ListModel<Notification>['get_item'];
    declare get_item_type: Gio.ListModel<Notification>['get_item_type'];
    declare get_n_items: Gio.ListModel<Notification>['get_n_items'];

    declare connect: GObject.SignalMethods<this, Signals>['connect'];
    declare connect_after: GObject.SignalMethods<this, Signals>['connect_after'];
    declare emit: GObject.SignalMethods<this, Signals>['emit'];
    declare items_changed: (position: number, removed: number, added: number) => void;

    /**
     * Private list to store notifications
     */
    private notifications: Notification[] = [];

    /**
     * Map to store notifications by id
     */
    private byId: Map<string, Notification> = new Map();

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
    constructor(params?: Partial<GObject.Object.ConstructorProps>) {
        super(params);
    }

    /**
     * Get list model stored item type
     */
    vfunc_get_item_type() {
        return Notification.$gtype;
    }

    /**
     * Get item from list model
     */
    vfunc_get_item(position: number) {
        return this.notifications[position] || null;
    }

    /**
     * Get number of items in list model
     */
    vfunc_get_n_items() {
        return this.notifications.length;
    }

    /**
     * Clear the model
     */
    clear() {
        const removed = this.notifications.length;

        this.byId.clear();
        this.notifications.splice(0, removed);

        this.items_changed(0, removed, 0);
    }

    /**
     * Append a notification to the list
     */
    append(...notifications: Notification[]) {
        if (!notifications.length) return;

        this.notifications.splice(this.notifications.length - 1, 0, ...notifications);
        for (const notification of notifications) {
            this.byId.set(notification.id, notification);
        }

        this.items_changed(this.notifications.length - notifications.length, 0, notifications.length);
    }

    /**
     * Remove a notification from the list
     *
     * @param position The position of the notification to remove
     */
    remove(position: number) {
        const notification = this.notifications[position];

        this.byId.delete(notification.id);
        this.notifications.splice(position, 1);

        this.items_changed(position, 1, 0);
    }

    /**
     * Splice the notification list
     *
     * @param position The position to start at
     * @param removals The number of notifications to remove
     * @param additions The notifications to add
     */
    splice(position: number, removals: number, ...additions: Notification[]) {
        const removed = this.notifications.splice(position, removals);
        for (const notification of removed) {
            this.byId.delete(notification.id);
        }

        this.notifications.splice(position, 0, ...additions);
        for (const notification of additions) {
            this.byId.set(notification.id, notification);
        }

        this.items_changed(position, removed.length, additions.length);
    }

    /**
     * Remove a notification from the list by its ID
     */
    removeByID(id: string) {
        const notification = this.byId.get(id);
        if (!notification) return;

        const index = this.notifications.indexOf(notification);

        this.notifications.splice(index, 1);
        this.byId.delete(id);

        this.items_changed(index, 1, 0);
    }

    /**
     * Get a notification by its ID
     */
    getById(id: string) {
        return this.byId.get(id);
    }
}
