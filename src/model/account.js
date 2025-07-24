// SPDX-License-Identifier: MIT

import GObject from 'gi://GObject';

/* Object representing an account */
export default class Account extends GObject.Object {
    static {
        GObject.registerClass(
            {
                GTypeName: 'Account',
                Properties: {
                    'display-name': GObject.ParamSpec.string(
                        'display_name',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    id: GObject.ParamSpec.string(
                        'id',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    forge: GObject.ParamSpec.string(
                        'forge',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    url: GObject.ParamSpec.string(
                        'url',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    username: GObject.ParamSpec.string(
                        'username',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        null,
                    ),
                    'user-id': GObject.ParamSpec.int64(
                        'user_id',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        Number.MIN_SAFE_INTEGER,
                        Number.MAX_SAFE_INTEGER,
                        0,
                    ),
                    'auth-failed': GObject.ParamSpec.boolean(
                        'auth_failed',
                        null,
                        null,
                        GObject.ParamFlags.READWRITE,
                        false,
                    ),
                },
            },
            this,
        );
    }

    /* Create an Account */
    constructor(constructProperties = {}) {
        super(constructProperties);

        this.connect('notify::url', this._updateDisplayName.bind(this));
        this.connect('notify::username', this._updateDisplayName.bind(this));
    }

    /**
     * Account display name
     *
     * (username@instance.tld)
     *
     * @type {string}
     */
    get displayName() {
        return `${this._username}@${this._url}`;
    }

    /**
     * Notify displayName changed
     */
    _updateDisplayName(_obj, _pspec) {
        this.notify('display-name');
    }

    /**
     * Account ID from app settings
     *
     * @type {string}
     */
    get id() {
        if (this._id === undefined) this._id = null;

        return this._id;
    }

    set id(value) {
        if (this._id === value) return;

        this._id = value;
        this.notify('id');
    }

    /**
     * Account forge name
     *
     * @type {string}
     */
    get forge() {
        if (this._forge === undefined) this._forge = null;

        return this._forge;
    }

    set forge(value) {
        if (this._forge === value) return;

        this._forge = value;
        this.notify('forge');
    }

    /**
     * Account server URL
     *
     * @type {string}
     */
    get url() {
        if (this._url === undefined) this._url = null;

        return this._url;
    }

    set url(value) {
        if (this._url === value) return;

        this._url = value;
        this.notify('url');
    }

    /**
     * Account username
     *
     * @type {string}
     */
    get username() {
        if (this._username === undefined) this._username = null;

        return this._username;
    }

    set username(value) {
        if (this._username === value) return;

        this._username = value;
        this.notify('username');
    }

    /**
     * Account user ID
     *
     * @type {number}
     */
    get userId() {
        if (this._userId === undefined) this._userId = null;

        return this._userId;
    }

    set userId(value) {
        if (this._userId === value) return;

        this._userId = value;
        this.notify('user-id');
    }

    /**
     * If the account auth failed
     *
     * @type {boolean}
     */
    get authFailed() {
        return this._authFailed || false;
    }

    set authFailed(value) {
        this._authFailed = value;
        this.notify('auth-failed');
    }
}
