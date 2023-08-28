// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import Notification from '../model/notification.js';
import { session } from './../util.js';

const Format = imports.format;

const GITHUB_API = 'api.github.com';

export default class GitHub extends Forge {

    static name = 'github';

    static prettyName = 'GitHub';

    static allowInstances = false;

    static defaultURL = 'github.com';

    static get tokenText() {
        const tokenURL = 'https://github.com/settings/tokens';
        const tokenHelpURL = 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic';

        /* GitHub access token help */
        let tokenText = Format.vprintf(
            _('You can generate a new personal access token from <a href=\"%s\">GitHub developer settings</a>. For more information, see "<a href=\"%s\">Creating a personal access token</a>".'),
            [tokenURL, tokenHelpURL]
        );
        tokenText += '\n\n';
        /* GitHub access token help */
        tokenText += _('Forge Sparks requires a <b>classic</b> access token (for general use) with the <i>notifications</i> and <i>read:user</i> scopes granted.');
        tokenText += ' ';
        /* GitHub access token help */
        tokenText += _('If you’re working with private repositories, you’ll also need to grant the full <i>repo</i> scope.');

        return tokenText;
    }

    async getUser() {
        try {
            const url = this.buildURI('user');
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            if (message.get_status() == '401') {
                throw 'FailedForgeAuth';
            } else if (message.get_status() == '200') {
                if (!('login' in contents)) {
                    throw 'Unexpected'
                }
            }

            /* Test notifications capabilities */
            const urlNotify = this.buildURI('notifications');
            const messageNotify = super.createMessage('GET', urlNotify);
            await session.send_and_read_async(messageNotify, GLib.PRIORITY_DEFAULT, null);
            if (messageNotify.get_status() == '403') {
                /* Unauthorized, token scopes */
                throw 'FailedTokenScopes';
            }

            return contents.login;
        } catch (error) {
            throw error;
        }
    }

    async getNotifications() {
        try {
            const url = this.buildURI('notifications');
            const message = super.createMessage('GET', url);
            /* headers={'If-Modified-Since': this.modifiedSince} */

            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            log(`${url} response resulted in ${message.get_status()}`);
            /* this.modifiedSince = headers.get_one('Last-Modified') ?? this.modifiedSince; */

            if (message.get_status() == '200') {
                /* Show notifications */
                let notifications = [];

                for (const item of contents) {
                    const info = await this._getSubjectInfo(item);
                    const notification = new Notification({
                        id: super.formatID(item.id),
                        type: item.subject.type,
                        unread: item.unread,
                        updatedAt: ('updated_at' in info) ? info.updated_at : item.updated_at,
                        title: item.subject.title,
                        repository: item.repository.full_name,
                        url: info.url,
                        account_name: this.accountName
                    });
                    if (info.state) {
                        notification.state = info.state;
                    }
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
                const url = this.buildURI(`/notifications/threads/${id}`);
                const message = super.createMessage('PATCH', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If Reset-Content */
                return message.get_status() == '205';
            } else {
                const now = GLib.DateTime.new_now_utc();
                const url = this.buildURI('notifications');
                const message = super.createMessage('PUT', url, {
                    'last_read_at': now.format_iso8601(),
                    'read': true
                });
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If Accepted or Reset-Content */
                return message.get_status() == '202' || message.get_status() == '205';
            }
        } catch (e) {
            throw e;
        }
    }

    /**
     * Get extra info from the notification subject
     * 
     * @param {Object} notification The notification object from the response JSON
     * @throws Throws an error if failed making the request or reading the data 
     * @returns {Object.<string, string>} The object with the info
     */
    async _getSubjectInfo(notification) {
        const info = {}; /* Here we'll store the info */

        /* Early return for subjects that doesn't have the data that we want */
        if (
            notification.subject.type === 'RepositoryInvitation' ||
            notification.subject.type === 'RepositoryVulnerabilityAlert' ||
            !notification.subject.url
        ) {
            switch (notification.subject.type) {
                case 'RepositoryInvitation':
                    info.url = `${notification.repository.html_url}/invitations`;
                    break;
                case 'RepositoryVulnerabilityAlert':
                    info.url = `${notification.repository.html_url}/network/dependencies`;
                    break;
                case 'RepositoryDependabotAlertsThread':
                    info.url = `${notification.repository.html_url}/security/dependabot`;
                    break;
                case 'CheckSuite':
                    info.url = `${notification.repository.html_url}/actions`;
                    break;
                case 'Discussion':
                    /* https://github.com/orgs/community/discussions/15252 */
                    info.url = `${notification.repository.html_url}/discussions`;
                    break;
                default:
            }
            return info;
        }

        /* Request the notification subject info from API  */
        try {
            const message = super.createMessage('GET', notification.subject.url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            if (message.get_status() == '200') {
                info.state = contents.state
                /* info.updated_at = contents.updated_at */
                info.url = contents.html_url

                /* Get pull request state */
                if (notification.subject.type === 'PullRequest') {
                    if (contents.draft) {
                        info.state = 'draft';
                    }
                    if (contents.state == 'closed' && contents.merged_at == null) {
                        info.state = 'denied';
                    }
                }

                /* Get comment url */
                if (notification.reason != 'subscribed') {
                    if (notification.subject.type === 'Issue' || notification.subject.type === 'PullRequest') {
                        const url = await this._getCommentURL(notification.subject.latest_comment_url);
                        if (url)
                            info.url = url;
                    }
                }
            } else {
                /* Fallback URL if request failed, probably repo is private */
                if (notification.subject.type === 'PullRequest') {
                    info.url = `${notification.repository.html_url}/pulls`;
                } else if (notification.subject.type === 'Issue') {
                    info.url = `${notification.repository.html_url}/issues`;
                } else {
                    info.url = notification.repository.url
                }
            }

            return info;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Get latest comment url from Issue
     * 
     * @param {String} url The url of the API to request the comments url
     * e.g https://api.github.com/repos/user/repo/issues/comments/1529954726
     * @throws Throws an error if failed making the request or reading the data 
     * @returns {String | void} The HTML comment url.
     * e.g. https://github.com/user/repo/issues/1#issuecomment-1529954726
     */
    async _getCommentURL(url) {
        if (url === null)
            return;

        try {
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            return contents.html_url;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Build a request URI from multiple parts
     * 
     * This is a simplified version of Forge.buildURI with Github API url set as host
     * 
     * @param {String} path The URI path
     * @param {Object.<string, string>} query The URI query
     * @returns {String} The resulting URI
     */
    buildURI(path, query = {}) {
        return Forge.buildURI(GITHUB_API, path, query);
    }
};