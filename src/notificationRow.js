// SPDX-License-Identifier: MIT

import Adw from 'gi://Adw';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import Template from './notificationRow.blp' assert { type: 'uri' };

export default class NotificationRow extends Gtk.ListBoxRow {

    static {
        GObject.registerClass({
            Template,
            InternalChildren: ['iconStack', 'spinner'],
            Signals: {
                'activated': {},
            },
            Properties: {
                'title': GObject.ParamSpec.string(
                    'title',
                    'Title',
                    'Notification identifier.',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'icon-name': GObject.ParamSpec.string(
                    'icon-name',
                    'Icon Name',
                    'Notification identifier.',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'repo': GObject.ParamSpec.string(
                    'repo',
                    'Repo',
                    'Notification identifier.',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'account': GObject.ParamSpec.string(
                    'account',
                    'Account',
                    'Notification identifier.',
                    GObject.ParamFlags.READWRITE,
                    null
                ),
                'progress': GObject.ParamSpec.boolean(
                    'progress',
                    'Progress',
                    'Notification identifier.',
                    GObject.ParamFlags.READWRITE,
                    false
                )
            }
        }, this);
    }

    /**
     * Crete a Window
     */
    constructor(constructProperties = {}) {
        super(constructProperties);
    }

    _onParent() {
        if (this.parent != null) {
            this.parent.connect('row-activated', (_list, row) => {
                if (row === this) {
                    this.emit('activated');
                }
            });
        }
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

    get iconName() {
        if (this._iconName === undefined)
            this._iconName = null;

        return this._iconName;
    }

    set iconName(value) {
        if (this._iconName === value)
            return;

        this._iconName = value;
        this.notify('icon-name');
    }

    get repo() {
        if (this._repo === undefined)
            this._repo = null;

        return this._repo;
    }

    set repo(value) {
        if (this._repo === value)
            return;

        this._repo = value;
        this.notify('repo');
    }

    get account() {
        if (this._account === undefined)
            this._account = null;

        return this._account;
    }

    set account(value) {
        if (this._account === value)
            return;

        this._account = value;
        this.notify('account');
    }

    get progress() {
        return this._progress;
    }

    set progress(value) {
        this._progress = value;
        this.notify('progress');

        if (this._progress) {
            this._iconStack.set_visible_child_name('spinner');
            this._spinner.start();
        } else {
            this._iconStack.set_visible_child_name('icon');
            this._spinner.stop();
        }
    }
};
