// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';
import { gettext as _ } from 'gettext';

import issueIcon from '../icons/issue-symbolic.svg' assert { type: 'icon' };
import doneIcon from '../icons/issue-done-symbolic.svg' assert { type: 'icon' };
import mergeIcon from '../icons/merge-symbolic.svg' assert { type: 'icon' };
import draftIcon from '../icons/merge-draft-symbolic.svg' assert { type: 'icon' };
import deniedIcon from '../icons/merge-denied-symbolic.svg' assert { type: 'icon' };
import mergedIcon from '../icons/merge-merged-symbolic.svg' assert { type: 'icon' };
import discussionIcon from '../icons/discussion-symbolic.svg' assert { type: 'icon' };

/* Notification object class */
export default class Notification extends GObject.Object {

    static {
        GObject.registerClass({
            GTypeName: 'Notification',
            Properties: {
                'id': GObject.ParamSpec.string('id', null, null, GObject.ParamFlags.READWRITE, null),
                'type': GObject.ParamSpec.string('type', null, null, GObject.ParamFlags.READWRITE, null),
                'unread': GObject.ParamSpec.boolean('unread', null, null, GObject.ParamFlags.READWRITE, false),
                'updated-at': GObject.ParamSpec.string('updated_at', null, null, GObject.ParamFlags.READWRITE, null),
                'timestamp': GObject.ParamSpec.int64('timestamp', null, null, GObject.ParamFlags.READABLE, null),
                'state': GObject.ParamSpec.string('state', null, null, GObject.ParamFlags.READWRITE, null),
                'title': GObject.ParamSpec.string('title', null, null, GObject.ParamFlags.READWRITE, null),
                'repository': GObject.ParamSpec.string('repository', null, null, GObject.ParamFlags.READWRITE, null),
                'url': GObject.ParamSpec.string('url', null, null, GObject.ParamFlags.READWRITE, null),
                'account-name': GObject.ParamSpec.string('account_name', null, null, GObject.ParamFlags.READWRITE, null)
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
     * 
     * @type {Gio.Notification}
     */
    get notification() {
        const notification = new Gio.Notification();
        const icon = new Gio.ThemedIcon({name: `${pkg.name}-${this.iconName}`});

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

        notification.add_button_with_target(
            _('Mark as Read'),
            'app.mark-read',
            GLib.Variant.new_string(this.id)
        );

        const hidden = !Gtk.Application.get_default().get_active_window().visible
        if (hidden) {
            notification.add_button(_('Show Forge Sparks'), 'app.activate');
        }

        return notification;
    }

    /**
     * Icon name for the Notification
     * 
     * @type {String}
     */
    get iconName() {
        switch (this.type) {
            case 'Issue':
                switch (this.state) {
                    case 'closed':
                        return doneIcon;
                    default:
                        return issueIcon;
                }
            case 'PullRequest':
                switch (this.state) {
                    case 'closed':
                        return mergedIcon;
                    case 'draft':
                        return draftIcon;
                    case 'denied':
                        return deniedIcon;
                    default:
                        return mergeIcon;
                }
            case 'Discussion':
                return discussionIcon;
            default: return 'preferences-system-details-symbolic';
        }
    }

    /**
     * Notification ID
     * 
     * @type {String}
     */
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

    /**
     * Notification type
     * 
     * @type {String}
     */
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

    /**
     * Notification unread state
     * 
     * @type {Boolean}
     */
    get unread() {
        return this._unread;
    }

    set unread(value) {
        this._unread = value;
        this.notify('unread');
    }

    /**
     * Notification updated at date in ISO 8601 format
     * 
     * @type {String}
     */
    get updatedAt() {
        if (this._updatedAt === undefined)
            this._updatedAt = null;

        return this._updatedAt;
    }

    set updatedAt(value) {
        if (this._updatedAt === value)
            return;

        this._updatedAt = value;
        this.notify('updated-at');
    }

    /**
     * Notification datetime
     * 
     * @type {GLib.DateTime}
     */
    get dateTime() {
        if (this._dateTime === undefined)
            this._dateTime = GLib.DateTime.new_from_iso8601(
                this._updatedAt,
                GLib.TimeZone.new_utc()
            );

        return this._dateTime;
    }

    /**
     * Notification timestamp
     * 
     * @type {Number}
     */
    get timestamp() {
        return this.dateTime.to_unix();
    }

    /**
     * Notification state
     * 
     * @type {String}
     */
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

    /**
     * Notification title
     * 
     * @type {String}
     */
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

    /**
     * Notification repository name
     * 
     * @type {String}
     */
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

    /**
     * Notification url
     * 
     * @type {String}
     */
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

    /**
     * Notification account name
     * 
     * @type {String}
     */
    get accountName() {
        if (this._accountName === undefined)
            this._accountName = null;

        return this._accountName;
    }

    set accountName(value) {
        if (this._accountName === value)
            return;

        this._accountName = value;
        this.notify('account-name');
    }
};
