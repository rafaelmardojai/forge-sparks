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
     * Crete a Forge
     * @param {String} url The url of the forge
     * @param {String} token The access token
     */
    constructor(url, token) {
        this.url = url
        this.token = token
        this.modifiedSince = '';
        this.encoder = new TextEncoder()
        this.decoder = new TextDecoder('utf-8');
        // this.interval = 60;
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
     * Build a request URI from multiple parts
     * @param {String} uri The base URI (scheme + netloc)
     * @param {String} path The URI path
     * @param {Object} query The URI query
     * @returns {String} The resulting URI
     */
    buildURI(uri, path, query={}) {
        let queryString = Object.keys(query).map(key => key + '=' + query[key]).join('&').replace(' ', '+');

        if (queryString) {
            queryString = '?' + queryString;
        }

        return uri + path + queryString
    }
}