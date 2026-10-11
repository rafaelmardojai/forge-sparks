// SPDX-License-Identifier: MIT
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';

import { gettext as _ } from 'gettext';

const DEFAULT_ICON = 'preferences-system-details-symbolic';

interface ConstructorProps extends Partial<GObject.Object.ConstructorProps> {
    id: string;
    type: string;
    unread: boolean;
    updatedAt: string;
    state?: string;
    title: string;
    repository: string;
    url: string;
    accountName: string;
}

/**
 * Notification object class
 */
export default class Notification extends GObject.Object {
    declare private _id: string;
    declare private _type: string;
    declare private _unread: boolean;
    declare private _updatedAt: string;
    declare private _state: string | null;
    declare private _title: string;
    declare private _repository: string;
    declare private _url: string;
    declare private _accountName: string;

    private _dateTime: GLib.DateTime | null = null;

    static {
        GObject.registerClass(
            {
                GTypeName: 'Notification',
                Properties: {
                    id: GObject.ParamSpec.string('id', null, null, GObject.ParamFlags.READWRITE, ''),
                    type: GObject.ParamSpec.string('type', null, null, GObject.ParamFlags.READWRITE, ''),
                    unread: GObject.ParamSpec.boolean('unread', null, null, GObject.ParamFlags.READWRITE, false),
                    'updated-at': GObject.ParamSpec.string('updated_at', null, null, GObject.ParamFlags.READWRITE, ''),
                    timestamp: GObject.ParamSpec.int64(
                        'timestamp',
                        null,
                        null,
                        GObject.ParamFlags.READABLE,
                        0,
                        Number.MAX_SAFE_INTEGER,
                    ),
                    state: GObject.ParamSpec.string('state', null, null, GObject.ParamFlags.READWRITE, null),
                    title: GObject.ParamSpec.string('title', null, null, GObject.ParamFlags.READWRITE, ''),
                    repository: GObject.ParamSpec.string('repository', null, null, GObject.ParamFlags.READWRITE, ''),
                    url: GObject.ParamSpec.string('url', null, null, GObject.ParamFlags.READWRITE, ''),
                    'account-name': GObject.ParamSpec.string(
                        'account_name',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        '',
                    ),
                },
            },
            this,
        );
    }

    /**
     * Crete a Notification
     */
    constructor(params: ConstructorProps) {
        super(params);
    }

    /**
     * Desktop Notification
     */
    get notification(): Gio.Notification {
        const notification = new Gio.Notification();
        const icon = new Gio.ThemedIcon({
            name: this.iconName != DEFAULT_ICON ? `${pkg.name}-${this.iconName}` : this.iconName,
        });

        notification.set_title(this.title);
        notification.set_body(this.repository);
        notification.set_icon(icon);

        notification.set_default_action_and_target(
            'app.open-notification',
            GLib.Variant.new_array(new GLib.VariantType('s'), [
                GLib.Variant.new_string(this.id),
                GLib.Variant.new_string(this.url),
            ]),
        );

        notification.add_button_with_target(_('Mark as Read'), 'app.mark-read', GLib.Variant.new_string(this.id));

        if (!(Gtk.Application.get_default() as Gtk.Application | null)?.get_active_window()?.visible) {
            notification.add_button(_('Show Forge Sparks'), 'app.activate');
        }

        return notification;
    }

    /**
     * Icon name for the Notification
     */
    get iconName(): string {
        switch (this.type) {
            case 'Issue':
                switch (this.state) {
                    case 'closed':
                        return 'issue-done-symbolic';
                    default:
                        return 'issue-symbolic';
                }
            case 'Pull':
            case 'PullRequest':
            case 'MergeRequest':
                switch (this.state) {
                    case 'closed':
                        return 'merge-merged-symbolic';
                    case 'draft':
                        return 'merge-draft-symbolic';
                    case 'denied':
                        return 'merge-denied-symbolic';
                    default:
                        return 'merge-symbolic';
                }
            case 'Discussion':
                return 'discussion-symbolic';
            case 'Release':
                return 'tag-symbolic';
            case 'Commit':
                return 'commit-symbolic';
            default:
                return DEFAULT_ICON;
        }
    }

    /**
     * Notification ID
     */
    get id(): string {
        return this._id;
    }

    set id(value: string) {
        if (this._id === value) return;

        this._id = value;
        this.notify('id');
    }

    /**
     * Notification type
     */
    get type(): string {
        return this._type;
    }

    set type(value: string) {
        if (this._type === value) return;

        this._type = value;
        this.notify('type');
    }

    /**
     * Notification unread state
     */
    get unread(): boolean {
        return this._unread;
    }

    set unread(value: boolean) {
        this._unread = value;
        this.notify('unread');
    }

    /**
     * Notification updated at date in ISO 8601 format
     */
    get updatedAt(): string {
        return this._updatedAt;
    }

    set updatedAt(value: string) {
        if (this._updatedAt === value) return;

        this._updatedAt = value;
        this.notify('updated-at');
    }

    /**
     * Notification datetime
     */
    get dateTime(): GLib.DateTime {
        if (!this._dateTime) {
            this._dateTime = GLib.DateTime.new_from_iso8601(this._updatedAt, GLib.TimeZone.new_utc());
        }

        return this._dateTime;
    }

    /**
     * Notification timestamp
     *
     * @type {number}
     */
    get timestamp(): number {
        return this.dateTime.to_unix();
    }

    /**
     * Notification state
     */
    get state(): string | null {
        return this._state;
    }

    set state(value: string) {
        if (this._state === value) return;

        this._state = value;
        this.notify('state');
    }

    /**
     * Notification title
     */
    get title(): string {
        return this._title;
    }

    set title(value: string) {
        if (this._title === value) return;

        this._title = value;
        this.notify('title');
    }

    /**
     * Notification repository name
     */
    get repository(): string {
        return this._repository;
    }

    set repository(value: string) {
        if (this._repository === value) return;

        this._repository = value;
        this.notify('repository');
    }

    /**
     * Notification url
     */
    get url(): string {
        return this._url;
    }

    set url(value: string) {
        if (this._url === value) return;

        this._url = value;
        this.notify('url');
    }

    /**
     * Notification account name
     */
    get accountName(): string {
        return this._accountName;
    }

    set accountName(value: string) {
        if (this._accountName === value) return;

        this._accountName = value;
        this.notify('account-name');
    }
}
