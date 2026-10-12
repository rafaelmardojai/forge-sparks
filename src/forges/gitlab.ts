// SPDX-License-Identifier: MIT
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';

import type { SimpleUserSchema, TodoSchema } from '@gitbeaker/core';
import { gettext as _ } from 'gettext';

import Notification from '../model/notification.js';
import { session } from '../util.js';
import Forge from './forge.js';

export default class GitLab extends Forge {
    static identifier = 'gitlab';

    static prettyName = 'GitLab';

    static allowInstances = true;

    static defaultURL = 'gitlab.com';

    static scopes = ['api'];

    static get tokenText() {
        /* GitLab access token help */
        let tokenText = _(
            'To generate a new access token from your instance, go to Preferences → Access Tokens and generate a new token.',
        );
        tokenText += '\n\n';
        /* GitLab access token help */
        tokenText += _(
            'Forge Sparks needs <i>read_api</i> scope to read notifications or full <i>api</i> scope to also mark todos as done.',
        );

        return tokenText;
    }

    get authorization() {
        return 'Bearer ' + this.token;
    }

    async getUser(): Promise<[number, string]> {
        try {
            const url = this.buildURI('user');
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents<SimpleUserSchema>(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);

            if (message.get_status() == Soup.Status.UNAUTHORIZED) {
                throw 'FailedForgeAuth';
            } else if (message.get_status() == Soup.Status.FORBIDDEN) {
                throw 'FailedTokenScopes';
            } else if (message.get_status() != Soup.Status.OK) {
                throw 'Unexpected';
            } else if (!('username' in contents) || !('id' in contents)) {
                throw 'Unexpected';
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
            const contents = super.readContents<TodoSchema[]>(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);

            if (message.get_status() == Soup.Status.OK) {
                const notifications: Notification[] = [];
                this.notifications.clear();

                for (const item of contents) {
                    try {
                        notifications.push(
                            new Notification({
                                id: super.formatID(String(item.id)),
                                type: item.target_type,
                                unread: item.state === 'pending',
                                updatedAt: item.updated_at,
                                state: item.target.state as string,
                                title: item.target.title as string,
                                repository: item.project?.path_with_namespace ?? item.author.name,
                                url: item.target_url,
                                accountName: this.accountName,
                            }),
                        );
                        this.notifications.append(...notifications);
                    } catch (e) {
                        console.error(e);
                    }
                }
            } else if (message.get_status() == Soup.Status.UNAUTHORIZED) {
                /* Auth failed, revoked or expired token */
                throw 'FailedForgeAuth';
            } else if (message.get_status() == Soup.Status.FORBIDDEN) {
                /* Unauthorized, token scopes */
                throw 'FailedTokenScopes';
            } else {
                throw 'Unexpected';
            }
        } catch (e) {
            throw e;
        }
    }

    async markAsRead(id: string | null = null) {
        try {
            if (id != null) {
                const url = this.buildURI(`todos/${id}/mark_as_done`);
                const message = super.createMessage('POST', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If OK */
                return message.get_status() == Soup.Status.OK;
            } else {
                const url = this.buildURI('todos/mark_as_done');
                const message = super.createMessage('POST', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If No Content */
                return message.get_status() == Soup.Status.NO_CONTENT;
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
     * @param path The URI path
     * @param  query The URI query
     */
    buildURI(path: string, query: Record<string, any> = {}): string {
        return Forge.buildURI(this.url, '/api/v4/' + path, query);
    }
}
