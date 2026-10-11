// SPDX-License-Identifier: MIT
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import NotificationsList from '../model/notificationsList.js';

/**
 * Git Forges base class.
 */
export default abstract class Forge {
    /**
     * Name (identifier) of the forge.
     */
    static identifier = 'github';

    /**
     * Name of the forge for display.
     */
    static prettyName = 'Github';

    /**
     * If the forge allows setting an instance url.
     */
    static allowInstances = false;

    /**
     * Default URL (instance) for provider.
     */
    static defaultURL = 'example.com';

    /**
     * Scopes needed.
     */
    static scopes: string[] = [];

    /**
     * Help text on how to get an access token for this forge.
     */
    static tokenText: string;

    /**
     * URL passed when the class was instantiated, the same as
     * this.defaultURL if this.allowInstances is false.
     */
    url: string;

    /**
     * Account access token passed when the class was instantiated, used for
     * authentication.
     */
    token: string;

    /**
     * Account ID on Forge Sparks settings.
     */
    account: string | null;

    /**
     * Account user ID on Forge Sparks settings.
     */
    userId: number | null;

    /**
     * Account name (username@instance.tld).
     */
    accountName: string;

    /**
     * Model to store notifications.
     */
    notifications: NotificationsList;

    /**
     * Last modified date of the notifications list.
     */
    modifiedSince: string;

    /**
     * Text encoder.
     */
    encoder: TextEncoder;

    /**
     * Text decoder.
     */
    decoder: TextDecoder;

    /**
     * Crete a Forge
     *
     * @param url URL of the Forge instance
     * @param token Access token for the Forge instance
     * @param account Account ID on Forge Sparks settings
     * @param userId Account user ID on Forge Sparks settings
     * @param accountName Account name (username@instance.tld)
     */
    constructor(
        url: string,
        token: string,
        account: string | null = null,
        userId: number | null = null,
        accountName: string = '',
    ) {
        this.url = url;
        this.token = token;
        this.account = account;
        this.userId = userId;
        this.accountName = accountName;
        this.notifications = new NotificationsList();

        this.modifiedSince = '';
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8');
    }

    /**
     * Authorization header value
     *
     * @type {string}
     */
    get authorization() {
        return 'token ' + this.token;
    }

    /**
     * Get the username
     *
     * Get username from the logged in user.
     * Used for validating an access token when adding a new account.
     *
     * @throws {FailedTokenScopes} If the access token doesn't have the
     * notifications scope
     * @throws {FailedForgeAuth} The access token is not valid (401 status)
     * @throws {Unexpected} Got a response but could not find the username
     * @throws Any other error when making the request or reading the response
     */
    abstract getUser(): Promise<[number, string]>;

    /**
     * Get notifications
     *
     * Update the notifications model with the latest notifications.
     *
     * @throws {FailedForgeAuth} The access token is not valid (401 status)
     * @throws Will throw an error if some part of the process fails
     */
    abstract getNotifications(): Promise<void>;

    /**
     * Mark notifications as read
     *
     * @param id ID of the notification to mark as read or null if all should be marked.
     * @throws Will throw an error if some part of the process fails
     */
    abstract markAsRead(id?: string | null): Promise<boolean>;

    /**
     * Helper for creating Soup.Message
     *
     * Coverts data to JSON string and encodes it to bytes
     * Adds access token as Authorization http header
     * Adds UTC as Time-Zone http header
     *
     * @param method HTTP method for the message
     * @param url URL for the message
     * @param data Request body data
     * @param headers HTTP headers for the message
     */
    createMessage<T extends object>(
        method: string,
        url: string,
        data: T | null = null,
        headers: Record<string, string> = {},
    ): Soup.Message {
        const message = Soup.Message.new(method, url);

        // Add data
        if (data != null) {
            const content: string = JSON.stringify(data);
            const bytes = this.encoder.encode(content);
            message.set_request_body_from_bytes('application/json', new GLib.Bytes(bytes));
        }

        // Append provided headers
        Object.entries(headers).forEach(([key, value]) => {
            message.request_headers.append(key, value);
        });

        // Append auth header
        message.request_headers.append('Authorization', this.authorization);
        message.request_headers.append('Time-Zone', 'UTC');

        return message;
    }

    /**
     * Read the contents of a response
     *
     * Converts bytes to a JS Object
     *
     * @param bytes Bites to read content from
     */
    readContents<T = any>(bytes: GLib.Bytes): T {
        const contents = this.decoder.decode(bytes.get_data() as Uint8Array);
        let data = [];
        if (contents) {
            data = JSON.parse(contents);
        }
        return data;
    }

    /**
     * Create a more unique ID using the forge account ID
     *
     * @param id ID to make unique
     */
    formatID(id: string): string {
        return `${this.account}-${id}`;
    }

    /**
     * Build a request URI from multiple parts
     *
     * @param host The URI host
     * @param path The URI path
     * @param query The URI query
     */
    static buildURI<Q extends object = Record<string, any>>(host: string, path: string, query: Q = {} as Q): string {
        /* Prepend slash to the path if not present */
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        /* Generate query string from the query dictionary */
        let queryString: string | null = Object.keys(query)
            .map((key) => (query[key as keyof Q] ? key + '=' + query[key as keyof Q] : ''))
            .join('&')
            .replace(' ', '+');
        if (!queryString) {
            queryString = null;
        }

        /* Build a https URI with the elements */
        const uri = GLib.Uri.build(GLib.UriFlags.PARSE_RELAXED, 'https', null, host, -1, path, queryString, null);
        return uri.to_string();
    }
}
