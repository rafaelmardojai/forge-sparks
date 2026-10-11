// SPDX-License-Identifier: MIT

import GObject from 'gi://GObject';

interface ConstructorProps extends Partial<GObject.Object.ConstructorProps> {
    id: string;
    forge?: string;
    url?: string;
    username?: string;
    userId?: number;
}

/**
 * Object representing an account
 */
export default class Account extends GObject.Object {
    declare private _id: string;
    declare private _forge: string | null;
    declare private _url: string | null;
    declare private _username: string | null;
    declare private _userId: number | null;
    declare private _authFailed: boolean;

    static {
        GObject.registerClass(
            {
                GTypeName: 'Account',
                Properties: {
                    'display-name': GObject.ParamSpec.string(
                        'display_name',
                        null,
                        null,
                        GObject.ParamFlags.READABLE,
                        null,
                    ),
                    id: GObject.ParamSpec.string('id', null, null, GObject.ParamFlags.READWRITE, null),
                    forge: GObject.ParamSpec.string('forge', null, null, GObject.ParamFlags.READWRITE, null),
                    url: GObject.ParamSpec.string('url', null, null, GObject.ParamFlags.READWRITE, null),
                    username: GObject.ParamSpec.string('username', null, null, GObject.ParamFlags.READWRITE, null),
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
    constructor({ id, ...params }: ConstructorProps) {
        super(params);

        this._id = id;

        this.connect('notify::url', this.updateDisplayName.bind(this));
        this.connect('notify::username', this.updateDisplayName.bind(this));
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
    private updateDisplayName(_obj: this, _param: GObject.ParamSpec) {
        this.notify('display-name');
    }

    /**
     * Account ID from app settings
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
     * Account forge name
     */
    get forge(): string | null {
        return this._forge;
    }

    set forge(value: string) {
        if (this._forge === value) return;

        this._forge = value;
        this.notify('forge');
    }

    /**
     * Account server URL
     */
    get url(): string | null {
        return this._url;
    }

    set url(value: string) {
        if (this._url === value) return;

        this._url = value;
        this.notify('url');
    }

    /**
     * Account username
     */
    get username(): string | null {
        return this._username;
    }

    set username(value: string) {
        if (this._username === value) return;

        this._username = value;
        this.notify('username');
    }

    /**
     * Account user ID
     */
    get userId(): number | null {
        return this._userId;
    }

    set userId(value: number) {
        if (this._userId === value) return;

        this._userId = value;
        this.notify('user-id');
    }

    /**
     * If the account auth failed
     */
    get authFailed(): boolean {
        return this._authFailed;
    }

    set authFailed(value: boolean) {
        this._authFailed = value;
        this.notify('auth-failed');
    }
}
