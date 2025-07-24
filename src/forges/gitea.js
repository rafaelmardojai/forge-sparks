// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import GitHub from './github.js';
import { session } from './../util.js';

/**
 * Gitea implementation
 *
 * Gitea has a GitHub compatible API, so we can basically just derive from our
 * GitHub class and tweak some mothods.
 */
export default class Gitea extends GitHub {
    static name = 'gitea';

    static prettyName = 'Gitea';

    static allowInstances = true;

    static defaultURL = 'gitea.com';

    static scopes = ['read:issue', 'write:notification', 'read:user'];

    static get tokenText() {
        /* Gitea access token help */
        let tokenText = _(
            'To generate a new access token from your instance, go to Settings → Applications and generate a new token.',
        );
        tokenText += '\n\n';
        /* Gitea access token help */
        tokenText += _(
            'Forge Sparks requires the <i>read:issue</i>, <i>write:notification</i> and <i>read:user</i> scopes granted.',
        );

        return tokenText;
    }

    async markAsRead(id = null) {
        /**
         * Gitea differs from GitHub's markAsRead, params are url queries
         */
        try {
            if (id != null) {
                const url = this.buildURI(`/notifications/threads/${id}`);
                const message = super.createMessage('PATCH', url);
                await session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                );

                /* If Reset-Content */
                return message.get_status() == '205';
            } else {
                const now = GLib.DateTime.new_now_utc();
                const url = this.buildURI('notifications', {
                    last_read_at: now.format_iso8601(),
                    all: true,
                });
                const message = super.createMessage('PUT', url);
                await session.send_and_read_async(
                    message,
                    GLib.PRIORITY_DEFAULT,
                    null,
                );

                /* If Reset-Content */
                return message.get_status() == '205';
            }
        } catch (e) {
            throw e;
        }
    }

    /**
     * Build a request URI from multiple parts
     *
     * This is a simplified version of Forge.buildURI with passed instance url
     * set as host and api v1 prepended to path
     *
     * @param {string} path The URI path
     * @param {Object.<string, string>} query The URI query
     * @returns {string} The resulting URI
     */
    buildURI(path, query = {}) {
        return Forge.buildURI(this.url, '/api/v1/' + path, query);
    }
}
