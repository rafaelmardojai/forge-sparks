// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import issueIcon from './icons/issue-symbolic.svg' assert { type: 'icon' };
import mergeIcon from './icons/merge-symbolic.svg' assert { type: 'icon' };

export default class Notification extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'Notification',
            Properties: {
                'id': GObject.ParamSpec.string('id', null, null, GObject.ParamFlags.READWRITE, null),
                'type': GObject.ParamSpec.string('type', null, null, GObject.ParamFlags.READWRITE, null),
                'unread': GObject.ParamSpec.boolean('unread', null, null, GObject.ParamFlags.READWRITE, false),
                'updated_at': GObject.ParamSpec.string('updated_at', null, null, GObject.ParamFlags.READWRITE, null),
                'timestamp': GObject.ParamSpec.int64('timestamp', null, null, GObject.ParamFlags.READABLE, null),
                'state': GObject.ParamSpec.string('state', null, null, GObject.ParamFlags.READWRITE, null),
                'title': GObject.ParamSpec.string('title', null, null, GObject.ParamFlags.READWRITE, null),
                'repository': GObject.ParamSpec.string('repository', null, null, GObject.ParamFlags.READWRITE, null),
                'url': GObject.ParamSpec.string('url', null, null, GObject.ParamFlags.READWRITE, null),
                'account_name': GObject.ParamSpec.string('account_name', null, null, GObject.ParamFlags.READWRITE, null)
            },
        }, this);
    }

    /**
     * Crete a Notification
     */
    constructor(constructProperties = {}) {
        super(constructProperties);
    }

    /**
     * Gio.Notification for the Notification
     * @type {Gio.Notification} The notification
     */
    get notification() {
        const notification = new Gio.Notification();
        const icon = new Gio.ThemedIcon({name: 'info-symbolic'});

        notification.set_title(this.title);
        notification.set_body(this.repository);
        notification.set_icon(icon);

        notification.set_default_action_and_target(
            'app.open-notification',
            GLib.Variant.new_array(
                new GLib.VariantType('s'),
                [GLib.Variant.new_string(this.id), GLib.Variant.new_string(this.url)]
            )
        );

        const hidden = !Gtk.Application.get_default().get_active_window().visible
        if (hidden) {
            notification.add_button(_('Show Forge Sparks'), 'app.activate');
        }

        notification.add_button_with_target(
            _('Mark as Read'),
            'app.mark-read',
            GLib.Variant.new_string(this.id)
        );

        return notification;
    }

    /**
     * Icon name for the Notification
     * @type {String} The icon name
     */
    get iconName() {
        switch (this.type) {
            case 'Issue': return issueIcon;
            case 'PullRequest': return mergeIcon;
            default: return 'preferences-system-details-symbolic';
        }
    }

    get id() {
        if (this._id === undefined)
            this._id = null;

        return this._id;
    }

    set id(value) {
        if (this._id === value)
            return;

        this._id = value;
        this.notify('id');
    }

    get unread() {
        return this._unread;
    }

    set unread(value) {
        this._unread = value;
        this.notify('unread');
    }

    get updated_at() {
        if (this._updated_at === undefined)
            this._updated_at = null;

        return this._updated_at;
    }

    set updated_at(value) {
        if (this._updated_at === value)
            return;

        this._updated_at = value;
        this.notify('updated_at');
    }

    get datetime() {
        return GLib.DateTime.new_from_iso8601(
            this._updated_at,
            GLib.TimeZone.new_utc()
        );
    }

    get timestamp() {
        return this.datetime.to_unix();
    }

    get type() {
        if (this._type === undefined)
            this._type = null;

        return this._type;
    }

    set type(value) {
        if (this._type === value)
            return;

        this._type = value;
        this.notify('type');
    }

    get state() {
        if (this._state === undefined)
            this._state = null;

        return this._state;
    }

    set state(value) {
        if (this._state === value)
            return;

        this._state = value;
        this.notify('state');
    }

    get title() {
        if (this._title === undefined)
            this._title = null;

        return this._title;
    }

    set title(value) {
        if (this._title === value)
            return;

        this._title = value;
        this.notify('title');
    }

    get repository() {
        if (this._repository === undefined)
            this._repository = null;

        return this._repository;
    }

    set repository(value) {
        if (this._repository === value)
            return;

        this._repository = value;
        this.notify('repository');
    }

    get url() {
        if (this._url === undefined)
            this._url = null;

        return this._url;
    }

    set url(value) {
        if (this._url === value)
            return;

        this._url = value;
        this.notify('url');
    }

    get account_name() {
        if (this._account_name === undefined)
            this._account_name = null;

        return this._account_name;
    }

    set account_name(value) {
        if (this._account_name === value)
            return;

        this._account_name = value;
        this.notify('account_name');
    }
};
