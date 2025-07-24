// SPDX-License-Identifier: MIT

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import Template from './notificationRow.blp' with { type: 'uri' };

/* Widget representing a notification */
export default class NotificationRow extends Gtk.ListBoxRow {
    static {
        GObject.registerClass(
            {
                Template,
                InternalChildren: ['iconStack', 'icon'],
                Signals: {
                    activated: {},
                },
                Properties: {
                    title: GObject.ParamSpec.string(
                        'title',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    date: GObject.ParamSpec.string(
                        'date',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    repo: GObject.ParamSpec.string(
                        'repo',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    account: GObject.ParamSpec.string(
                        'account',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    state: GObject.ParamSpec.string(
                        'state',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    'icon-name': GObject.ParamSpec.string(
                        'icon-name',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    progress: GObject.ParamSpec.boolean(
                        'progress',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                },
            },
            this,
        );
    }

    /**
     * Crete a NotificationRow
     */
    constructor(constructProperties = {}) {
        super(constructProperties);

        /* Parent for `activated` signal */
        this._previous_parent = null;

        /* Add a css class to the icon depending on the notification state */
        switch (this.state) {
            case 'open':
            case 'opened':
                this._icon.add_css_class('accent');
                break;
            case 'closed':
                this._icon.add_css_class('closed');
                break;
            case 'draft':
                this._icon.add_css_class('dim-label');
                break;
            case 'denied':
                this._icon.add_css_class('error');
                break;
        }
    }

    /**
     * Callback for when the widget is set a parent
     *
     * Make our row behave like a Adw.ActionRow, we can't derive from it because
     * we need more control over the row layout.
     */
    _onParent() {
        if (this._previous_parent != null) {
            this._previous_parent.disconnect(this._parent_signal_handler);
            this._previous_parent = null;
        }

        if (this.parent != null) {
            this._parent_signal_handler = this.parent.connect(
                'row-activated',
                (_list, row) => {
                    if (row === this) {
                        this.emit('activated');
                    }
                },
            );

            this._previous_parent = this.parent;
        }
    }

    /**
     * Notification title
     *
     * @type {string}
     */
    get title() {
        if (this._title === undefined) this._title = null;

        return this._title;
    }

    set title(value) {
        if (this._title === value) return;

        this._title = value;
        this.notify('title');
    }

    /**
     * Notification date
     *
     * @type {string}
     */
    get date() {
        if (this._date === undefined) this._date = null;

        return this._date;
    }

    set date(value) {
        if (this._date === value) return;

        this._date = value;
        this.notify('date');
    }

    /**
     * Notification repository name
     *
     * @type {string}
     */
    get repo() {
        if (this._repo === undefined) this._repo = null;

        return this._repo;
    }

    set repo(value) {
        if (this._repo === value) return;

        this._repo = value;
        this.notify('repo');
    }

    /**
     * Notification account name
     *
     * @type {string}
     */
    get account() {
        if (this._account === undefined) this._account = null;

        return this._account;
    }

    set account(value) {
        if (this._account === value) return;

        this._account = value;
        this.notify('account');
    }

    /**
     * Notification state
     *
     * @type {string}
     */
    get state() {
        if (this._state === undefined) this._state = null;

        return this._state;
    }

    set state(value) {
        if (this._state === value) return;

        this._state = value;
        this.notify('state');
    }

    /**
     * Notification icon name
     *
     * @type {string}
     */
    get iconName() {
        if (this._iconName === undefined) this._iconName = null;

        return this._iconName;
    }

    set iconName(value) {
        if (this._iconName === value) return;

        this._iconName = value;
        this.notify('icon-name');
    }

    /**
     * Notification progress state
     *
     * @type {boolean}
     */
    get progress() {
        return this._progress;
    }

    set progress(value) {
        this._progress = value;
        this.notify('progress');

        /* When is set to true, show spinner; when false, show icon */
        if (this._progress) {
            this._iconStack.set_visible_child_name('spinner');
        } else {
            this._iconStack.set_visible_child_name('icon');
        }
    }
}
