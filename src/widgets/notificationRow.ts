// SPDX-License-Identifier: MIT

import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk';

import { getResourceUri } from '../util.js';

interface ConstructorProps extends Partial<Gtk.ListBoxRow.ConstructorProps> {
    title: string;
    repo: string;
    account?: string;
    date: string;
    iconName: string;
    state: string | null;
}

interface Signals extends Gtk.ListBoxRow.SignalSignatures {
    activated: () => void;
}

/* Widget representing a notification */
export default class NotificationRow extends Gtk.ListBoxRow {
    declare connect: GObject.SignalMethods<this, Signals>['connect'];
    declare connect_after: GObject.SignalMethods<this, Signals>['connect_after'];
    declare emit: GObject.SignalMethods<this, Signals>['emit'];

    declare private readonly _iconStack: Gtk.Stack;
    declare private readonly _icon: Gtk.Image;

    declare private _title: string;
    declare private _date: string;
    declare private _repo: string;
    declare private _account: string | null;
    declare private _state: string | null;
    declare private _iconName: string;
    declare private _progress: boolean;

    /**
     * Parent for `activated` signal
     */
    private previousParent: Gtk.ListBox | null = null;

    private parentSignalHandler: number | null = null;

    static {
        GObject.registerClass(
            {
                Template: getResourceUri('widgets/notificationRow.ui'),
                InternalChildren: ['iconStack', 'icon'],
                Signals: {
                    activated: {},
                },
                Properties: {
                    title: GObject.ParamSpec.string('title', null, null, GObject.ParamFlags.READWRITE, ''),
                    date: GObject.ParamSpec.string('date', null, null, GObject.ParamFlags.READWRITE, ''),
                    repo: GObject.ParamSpec.string('repo', null, null, GObject.ParamFlags.READWRITE, ''),
                    account: GObject.ParamSpec.string('account', null, null, GObject.ParamFlags.READWRITE, null),
                    state: GObject.ParamSpec.string('state', null, null, GObject.ParamFlags.READWRITE, null),
                    'icon-name': GObject.ParamSpec.string('icon-name', null, null, GObject.ParamFlags.READWRITE, ''),
                    progress: GObject.ParamSpec.boolean('progress', null, null, GObject.ParamFlags.READWRITE, false),
                },
            },
            this,
        );
    }

    /**
     * Crete a NotificationRow
     */
    constructor(props: ConstructorProps) {
        super({ activatable: true, ...props });

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
    protected onParent() {
        if (this.previousParent != null) {
            if (this.parentSignalHandler) this.previousParent.disconnect(this.parentSignalHandler);
            this.previousParent = null;
        }

        if (this.parent != null) {
            this.parentSignalHandler = (this.parent as Gtk.ListBox).connect('row-activated', (_list, row) => {
                if (row === this) {
                    this.emit('activated');
                }
            });

            this.previousParent = this.parent as Gtk.ListBox;
        }
    }

    /**
     * Notification title
     */
    get title(): string {
        return this._title || '';
    }

    set title(value: string) {
        if (this._title === value) return;

        this._title = value;
        this.notify('title');
    }

    /**
     * Notification date
     */
    get date(): string {
        return this._date || '';
    }

    set date(value: string) {
        if (this._date === value) return;

        this._date = value;
        this.notify('date');
    }

    /**
     * Notification repository name
     */
    get repo(): string {
        return this._repo || '';
    }

    set repo(value: string) {
        if (this._repo === value) return;

        this._repo = value;
        this.notify('repo');
    }

    /**
     * Notification account name
     */
    get account(): string | null {
        return this._account || null;
    }

    set account(value: string) {
        if (this._account === value) return;

        this._account = value;
        this.notify('account');
    }

    /**
     * Notification state
     */
    get state(): string | null {
        return this._state || null;
    }

    set state(value: string) {
        if (this._state === value) return;

        this._state = value;
        this.notify('state');
    }

    /**
     * Notification icon name
     */
    get iconName(): string {
        return this._iconName || '';
    }

    set iconName(value: string) {
        if (this._iconName === value) return;

        this._iconName = value;
        this.notify('icon-name');
    }

    /**
     * Notification progress state
     */
    get progress(): boolean {
        return this._progress;
    }

    set progress(value: boolean) {
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
