// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

/* Git Forge base class. */
export default class Forge {
    /**
     * Name (identifier) of the forge
     */
    static name = 'github';

    /**
     * Name of the forge for display
     */
    static prettyName = 'Github';

    /**
     * If the forge allows setting an instance url
     */
    static allowInstances = false;

    /**
     * Default URL (instance) for provider
     */
    static defaultURL = 'example.com';

    /**
     * Scopes needed
     *
     * @type {Array<String>}
     */
    static scopes = [];

    /**
     * Help text on how to get an access token for this forge
     */
    static tokenText;

    /**
     * Crete a Forge
     *
     * @param {String} url The url of the forge
     * @param {String} token The access token
     * @param {String} account Account ID associated to the instance
     * @param {Number} userId Account user ID associated to the instance
     * @param {String} accountName Account name associated to the instance
     */
    constructor(url, token, account = null, userId = null, accountName = '') {
        /**
         * URL passed when the class was instantiated, the same as
         * this.defaultURL if this.allowInstances is false
         */
        this.url = url;

        /**
         * Account access token passed when the class was instantiated, used for
         * authentication
         */
        this.token = token;

        /**
         * Account ID on Forge Sparks settings
         */
        this.account = account;

        /**
         * Account user ID on Forge Sparks settings
         */
        this.userId = userId;

        /**
         * Account name (username@instance.tld)
         */
        this.accountName = accountName;

        this.modifiedSince = '';
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8');
    }

    /**
     * Authorization header value
     *
     * @type {String}
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
     * @returns {Array<Number, String>} The id and username
     */
    async getUser() {}

    /**
     * Get notifications
     *
     * Get all unread notifications for the logged in user
     *
     * @throws {FailedForgeAuth} The access token is not valid (401 status)
     * @throws Will throw an error if some part of the process fails
     * @returns {Array<Notification>} The notifications
     */
    async getNotifications() {}

    /**
     * Mark notifications as read
     *
     * @param {String|Number|null} id ID of the notification to mark as read
     * or null if all should be marked.
     * @throws Will throw an error if some part of the process fails
     * @returns {Boolean} If the operation was successful
     */
    async markAsRead(id = null) {}

    /**
     * Helper for creating Soup.Message
     *
     * Coverts data to JSON string and encodes it to bytes
     * Adds access token as Authorization http header
     * Adds UTC as Time-Zone http header
     *
     * @param {String} method HTTP method for the message
     * @param {String} url URL for the message
     * @param {Object} data Request body data
     * @param {Object.<string, string>} headers HTTP headers for the message
     * @returns {Soup.Message}
     */
    createMessage(method, url, data = {}, headers = {}) {
        const message = Soup.Message.new(method, url);

        // Add data
        data = JSON.stringify(data);
        const bytes = this.encoder.encode(data);
        message.set_request_body_from_bytes(
            'application/json',
            new GLib.Bytes(bytes),
        );

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
     * @param {GLib.Bytes} bytes Bites to read content from
     * @returns {Object}
     */
    readContents(bytes) {
        const contents = this.decoder.decode(bytes.get_data());
        let data = [];
        if (contents) {
            data = JSON.parse(contents);
        }
        return data;
    }

    /**
     * Create a more unique ID using the forge account ID
     *
     * @param {String|Number} id ID to make unique
     * @returns {String}
     */
    formatID(id) {
        return `${this.account}-${id}`;
    }

    /**
     * Build a request URI from multiple parts
     *
     * @param {String} host The URI host
     * @param {String} path The URI path
     * @param {Object.<string, string>} query The URI query
     * @returns {String} The resulting URI
     */
    static buildURI(host, path, query = {}) {
        /* Prepend slash to the path if not present */
        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        /* Generate query string from the query dictionary */
        var queryString = Object.keys(query)
            .map((key) => key + '=' + query[key])
            .join('&')
            .replace(' ', '+');
        if (!queryString) {
            queryString = null;
        }

        /* Build a https URI with the elements */
        const uri = GLib.Uri.build(
            GLib.UriFlags.PARSE_RELAXED,
            'https',
            null,
            host,
            -1,
            path,
            queryString,
            null,
        );

        return uri.to_string();
    }
}
