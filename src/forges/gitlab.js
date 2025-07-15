// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import Notification from '../model/notification.js';
import { session } from './../util.js';

export default class GitLab extends Forge {

    static name = 'gitlab';

    static prettyName = 'GitLab';

    static allowInstances = true;

    static defaultURL = 'gitlab.com';

    static scopes = ['api'];

    static get tokenText() {
        /* GitLab access token help */
        let tokenText = _('To generate a new access token from your instance, go to Preferences → Access Tokens and generate a new token.');
        tokenText += '\n\n';
        /* GitLab access token help */
        tokenText += _('Forge Sparks needs <i>read_api</i> scope to read notifications or full <i>api</i> scope to also mark todos as done.');

        return tokenText;
    }

    get authorization() {
        return 'Bearer ' + this.token;
    }

    async getUser() {
        try {
            const url = this.buildURI('user');
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);

            if (message.get_status() == '401') {
                throw 'FailedForgeAuth';
            } else if (message.get_status() == '403') {
                throw 'FailedTokenScopes';
            } else if (message.get_status() != '200') {
                throw 'Unexpected'
            } else if (!('username' in contents) || !('id' in contents)) {
                throw 'Unexpected'
            }

            return [contents.id, contents.username];
        } catch (error) {
            throw error;
        }
    }

    async getNotifications() {
        try {
            const url = this.buildURI('todos');
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);

            if (message.get_status() == '200') {
                /* Show notifications */
                let notifications = [];

                for (const item of contents) {
                    const notification = new Notification({
                        id: super.formatID(item.id),
                        type: item.target_type,
                        unread: (item.state === 'pending'),
                        updatedAt: item.updated_at,
                        state: item.target.state,
                        title: item.target.title,
                        repository: item.project.path_with_namespace,
                        url: item.target_url,
                        account_name: this.accountName
                    });
                    notifications.push(notification);
                }

                return notifications;
            } else if (message.get_status() == '401') {
                /* Auth failed, revoked or expired token */
                throw 'FailedForgeAuth';
            } else if (message.get_status() == '403') {
                /* Unauthorized, token scopes */
                throw 'FailedTokenScopes';
            } else {
                throw 'Unexpected'
            }
        } catch (e) {
            throw e;
        }
    }

    async markAsRead(id = null) {
        try {
            if (id != null) {
                const url = this.buildURI(`todos/${id}/mark_as_done`);
                const message = super.createMessage('POST', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If OK */
                return message.get_status() == '200';
            } else {
                const url = this.buildURI('todos/mark_as_done');
                const message = super.createMessage('POST', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If No Content */
                return message.get_status() == '204';
            }
        } catch (e) {
            throw e;
        }
    }

    /**
     * Build a request URI from multiple parts
     * 
     * This is a simplified version of Forge.buildURI with passed instance url
     * set as host and api v4 prepended to path
     * 
     * @param {String} path The URI path
     * @param {Object.<string, string>} query The URI query
     * @returns {String} The resulting URI
     */
    buildURI(path, query = {}) {
        return Forge.buildURI(this.url, '/api/v4/' + path, query);
    }
};