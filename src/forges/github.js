// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import Notification from './../notification.js';
import { session } from './../util.js';

const GITHUB_API = 'api.github.com';

export default class GitHub extends Forge {

    static name = 'github';

    static prettyName = 'GitHub';

    static allowInstances = false;

    static defaultURL = 'github.com';

    static get tokenText() {
        const tokenURL = 'https://github.com/settings/tokens';
        const tokenHelpURL = 'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/creating-a-personal-access-token';

        /* GitHub access token help */
        let tokenText = _('You can generate a new personal access token going to <a href=\"%s\">GitHub developer settings</a>. For more information, see "<a href=\"%s\">Creating a personal access token</a>".')
        .format(tokenURL, tokenHelpURL);
        tokenText += '\n\n';
        /* GitHub access token help */
        tokenText += _('Forge Sparks requirers a <b>classic</b> access token (for general use) with the <i>notifications</i> and <i>read:user</i> scopes granted.');

        return tokenText;
    }

    async getUser() {
        try {
            const url = this.buildURI('user');
            const message = super.createMessage('GET', url);

            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            if (!('login' in contents)) {
                if (message.get_status() == '401') {
                    throw 'FailedForgeAuth';
                } else {
                    throw 'Unexpected'
                }
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
            // message.request_headers.append('If-Modified-Since', this.modifiedSince);

            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            // const headers = message.response_headers;
            const contents = super.readContents(bytes);
            let notifications = [];

            for (const item of contents) {
                const info = await this._getSubjectInfo(item);
                const notification = new Notification({
                    id: super.formatID(item.id),
                    type: item.subject.type,
                    unread: item.unread,
                    updated_at: ('updated_at' in info) ? info.updated_at : item.updated_at,
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

            // this.modifiedSince = headers.get_one('Last-Modified') ?? this.modifiedSince;
            log('Response resulted in ' + message.get_status());

            return notifications;
        } catch (e) {
            throw e;
        }
    }

    async _getSubjectInfo(notification) {
        const info = {};
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
                    info.url = `${notification.repository.html_url}/discussions`;
                    break;
                default:
            }
            return info;
        }

        try {
            const message = super.createMessage('GET', notification.subject.url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);
            info.state = contents.state
            info.updated_at = contents.updated_at
            info.url = contents.html_url

            if (notification.reason != 'subscribed') {
                if (notification.subject.type === 'Issue' || notification.subject.type === 'PullRequest') {
                    const url = await this._getCommentURL(notification.subject.latest_comment_url);
                    if (url) {
                        info.url = url
                    }
                }
            }

            return info;
        } catch (e) {
            throw e;
        }
    }

    async _getCommentURL(url) {
        try {
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            return contents.html_url;
        } catch (e) {
            throw e;
        }
    }

    async markAsRead(id=null) {
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

    buildURI(path, query={}) {
        return Forge.buildURI(GITHUB_API, path, query);
    }
};