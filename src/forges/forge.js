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
     * Name for display of the forge
     */
    static prettyName = 'Github';

    /**
     * If the forge allow setting an instance url
     */
    static allowInstances = false;

    /**
     * Default URL (instance) for provider
     */
    static defaultURL = 'example.com';

    /**
     * Help text on how to get an access token for this forge
     */
    static tokenText;

    /**
     * Crete a Forge
     * @param {String} url The url of the forge
     * @param {String} token The access token
     * @param {String} account Account ID associated to the instance
     * @param {String} accountName Account name associated to the instance
     */
    constructor(url, token, account=null, accountName='') {
        this.url = url;
        this.token = token;
        this.account = account;
        this.accountName = accountName;
        this.modifiedSince = '';
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder('utf-8');
    }

    /**
     * Get the username
     * @returns {String} The username
     */
    async getUser() {

    }

    /**
     * Get notifications
     * @returns {Array<Notification>} The notifications
     */
    async getNotifications() {

    }

    /**
     * Mark notifications as read
     * @param {String|Number|null} id ID of the notification to mark as read
     * or null if all should be marked.
     * @returns {Boolean} If the operation was successful
     */
    async markAsRead(id=null) {

    }

    /**
     * Helper for creating Soup.Message
     * @param {String} method HTTP method for the message
     * @param {String} url URL for the message
     * @param {Object} headers HTTP headers for the message
     * @returns {Soup.Message}
     */
    createMessage(method, url, data={}, headers={}) {
        const message = Soup.Message.new(method, url);

        // Add data
        data = JSON.stringify(data);
        const bytes = this.encoder.encode(data);
        message.set_request_body_from_bytes(
            'application/json',
            new GLib.Bytes(bytes)
        );

        // Append provided headers
        Object.entries(headers).forEach(([key, value]) => {
            message.request_headers.append(key, value);
        });
        // Append auth header
        message.request_headers.append('Authorization', 'token ' + this.token);
        message.request_headers.append('Time-Zone', 'UTC');

        return message;
    }

    /**
     * Read the contents of a response
     * @param {GLib.Bytes} bytes Bites to read content from
     */
    readContents(bytes) {
        const contents = this.decoder.decode(bytes.get_data());
        let data = [];
        //console.log(contents);
        if (contents) {
            data = JSON.parse(contents);
        }
        return data;
    }

    /**
     * Create a more unique ID using the forge account ID
     * @param {String|Number} id ID to make unique
     * @returns {String}
     */
    formatID(id) {
        return `${this.account}-${id}`;
    }

    /**
     * Build a request URI from multiple parts
     * @param {String} host The URI host
     * @param {String} path The URI path
     * @param {Object.<string, string>} query The URI query
     * @returns {String} The resulting URI
     */
    static buildURI(host, path, query={}) {

        if (!path.startsWith('/')) {
            path = '/' + path;
        }

        var queryString = Object.keys(query).map(key => key + '=' + query[key]).join('&').replace(' ', '+');
        if (!queryString) {
            queryString = null
        }

        const uri = GLib.Uri.build(
            GLib.UriFlags.PARSE_RELAXED,
            'https',
            null,
            host,
            -1,
            path,
            queryString,
            null
        );

        return uri.to_string();
    }
}