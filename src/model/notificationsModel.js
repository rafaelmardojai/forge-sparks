// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import Notification from './notification.js';
import NotificationsList from './notificationsList.js';
import { extractID } from '../forges/index.js';

/* List model to store notifications */
export default class NotificationsModel extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'NotificationsModel',
                Implements: [Gio.ListModel],
            },
            this,
        );
    }

    /**
     * Crete a NotificationsModel
     */
    constructor() {
        super();

        /* Mapping of account id to notification models */
        this._models = new Map();

        /* Model that concentrates forge's instances notification models */
        this._modelsModel = new Gio.ListStore(NotificationsList.$gtype);

        /* Flatten list model to access all notifications */
        this._notifications = new Gtk.FlattenListModel({
            model: this._modelsModel,
        });

        /* Sort the model by timestamp */
        this._sortedModel = new Gtk.SortListModel({
            model: this._notifications,
            sorter: new Gtk.NumericSorter({
                expression: new Gtk.PropertyExpression(
                    Notification.$gtype,
                    null,
                    'timestamp',
                ),
                sort_order: Gtk.SortType.DESCENDING,
            }),
        });

        /* Forward items-changed signal */
        this._sortedModel.connect('items-changed', (_model, pos, rmv, add) => {
            this.items_changed(pos, rmv, add);
        });
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
        return this._sortedModel.get_item(position);
    }

    /**
     * Get number of items in list model
     *
     * @returns {number} The length of the list model
     */
    vfunc_get_n_items() {
        return this._sortedModel.get_n_items();
    }

    /**
     * Add a new model to the list
     *
     * @param {string} id The id of the model to add
     * @param {Gio.ListModel} model The model to add
     */
    addModel(id, model) {
        if (this._models.has(id)) return;

        this._models.set(id, model);
        this._modelsModel.append(model);
    }

    /**
     * Remove a model from the list
     *
     * @param {string} id The id of the model to remove
     */
    removeModel(id) {
        const model = this._models.get(id);
        const index = this._modelsModel.find(model);

        this._modelsModel.remove(index);
        this._models.delete(id);
    }

    /**
     * Get a notifications by its ID
     *
     * @param {string} id The id of the notification to get
     * @returns {Notification}
     */
    getByID(id) {
        const [account, _] = extractID(id);
        const model = this._models.get(account);

        return model.getById(id);
    }

    /**
     * Remove a notifications by its ID
     *
     * @param {string} id The id of the notification to remove
     */
    removeByID(id) {
        console.log(`Removing notification ${id}`);
        const [account, _] = extractID(id);
        const model = this._models.get(account);

        return model.removeByID(id);
    }
}
