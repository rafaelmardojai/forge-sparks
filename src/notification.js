// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import { gettext as _ } from 'gettext';

import issueIcon from './icons/issue-symbolic.svg' assert { type: 'icon' };
import mergeIcon from './icons/merge-symbolic.svg' assert { type: 'icon' };

class Notification extends GObject.Object {

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
        notification.add_button(_('Mark as Read'), 'app.mark-read');

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
};

export default GObject.registerClass(
    {
        GTypeName: 'Notification',
        Properties: {
            'id': GObject.ParamSpec.string(
                'id',
                'Id',
                'Notification identifier.',
                GObject.ParamFlags.READWRITE,
                null
            ),
            'type': GObject.ParamSpec.string(
                'type',
                'Type',
                'The type of the notification.',
                GObject.ParamFlags.READWRITE,
                null
            ),
            'unread': GObject.ParamSpec.boolean(
                'unread',
                'Unread',
                'If the notifications is unread.',
                GObject.ParamFlags.READWRITE,
                false
            ),
            'state': GObject.ParamSpec.string(
                'state',
                'State',
                'The state of the notification subject.',
                GObject.ParamFlags.READWRITE,
                null
            ),
            'title': GObject.ParamSpec.string(
                'title',
                'Title',
                'The title of the notification.',
                GObject.ParamFlags.READWRITE,
                null
            ),
            'repository': GObject.ParamSpec.string(
                'repository',
                'Repository',
                'The repository the notification belongs to.',
                GObject.ParamFlags.READWRITE,
                null
            ),
            'url': GObject.ParamSpec.string(
                'url',
                'URL',
                'The URL the notification should open.',
                GObject.ParamFlags.READWRITE,
                null
            )
        },
    },
    Notification
);