// SPDX-License-Identifier: MIT
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import type Forge from '../forges/forge.js';
import { extractID } from '../forges/index.js';
import Notification from './notification.js';
import NotificationsList from './notificationsList.js';

interface Signals extends GObject.Object.SignalSignatures, Gio.ListModel.SignalSignatures {}

/* List model to store notifications */
export default class NotificationsModel extends GObject.Object implements Gio.ListModel<Notification> {
    declare get_item: Gio.ListModel<Notification>['get_item'];
    declare get_item_type: Gio.ListModel<Notification>['get_item_type'];
    declare get_n_items: Gio.ListModel<Notification>['get_n_items'];

    declare connect: GObject.SignalMethods<this, Signals>['connect'];
    declare connect_after: GObject.SignalMethods<this, Signals>['connect_after'];
    declare emit: GObject.SignalMethods<this, Signals>['emit'];
    declare items_changed: (position: number, removed: number, added: number) => void;

    /**
     * Mapping of account id to notification models.
     */
    private models: Map<string, NotificationsList> = new Map();

    private modelsModel: Gio.ListStore<NotificationsList>;
    private sortedModel: Gtk.SortListModel<Notification>;

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
    constructor(params?: Partial<GObject.Object.ConstructorProps>) {
        super(params);

        /* Model that concentrates forge's instances notification models */
        this.modelsModel = new Gio.ListStore({ item_type: NotificationsList.$gtype });

        /* Flatten list model to access all notifications */
        const notifications = new Gtk.FlattenListModel<Notification>({
            model: this.modelsModel,
        });

        /* Sort the model by timestamp */
        this.sortedModel = new Gtk.SortListModel({
            model: notifications,
            sorter: new Gtk.NumericSorter({
                expression: Gtk.PropertyExpression.new(Notification.$gtype, null, 'timestamp'),
                sort_order: Gtk.SortType.DESCENDING,
            }),
        });

        /* Forward items-changed signal */
        this.sortedModel.connect('items-changed', (_model, pos, rmv, add) => {
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
     */
    vfunc_get_item(position: number) {
        return this.sortedModel.get_item(position);
    }

    /**
     * Get number of items in list model
     */
    vfunc_get_n_items() {
        return this.sortedModel.get_n_items();
    }

    /**
     * Add a new model to the list
     */
    addModel(id: string, forge: Forge) {
        if (this.models.has(id)) return;

        this.models.set(id, forge.notifications);
        this.modelsModel.append(forge.notifications);
    }

    /**
     * Remove a model from the list
     */
    removeModel(id: string) {
        const model = this.models.get(id);

        if (model) {
            const [found, index] = this.modelsModel.find(model);

            if (found) {
                this.modelsModel.remove(index);
                this.models.delete(id);
            }
        }
    }

    /**
     * Get a notifications by its ID
     */
    getByID(id: string): Notification | null {
        const [account, _] = extractID(id);
        const model = this.models.get(account);

        return model?.getById(id) ?? null;
    }

    /**
     * Remove a notifications by its ID
     */
    removeByID(id: string) {
        const [account, _] = extractID(id);
        const model = this.models.get(account);

        model?.removeByID(id);
    }

    /**
     * Clear all notifications
     */
    clear() {
        this.models.forEach((model) => model.clear());
    }
}
