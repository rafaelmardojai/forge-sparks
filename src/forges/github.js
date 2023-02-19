// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import Notification from './../notification.js';
import { session } from './../util.js';

const GITHUB_API = 'api.github.com';

export default class GitHub extends Forge {

    static name = 'github';

    static prettyName = 'Github';

    static allowInstances = false;

    static defaultURL = 'github.com';

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
            message.request_headers.append('If-Modified-Since', this.modifiedSince);

            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const headers = message.response_headers;
            const contents = super.readContents(bytes);
            let notifications = [];

            for (const item of contents) {
                const info = await this.getSubjectInfo(item);
                const notification = new Notification({
                    id: item.id,
                    type: item.subject.type,
                    unread: item.unread,
                    title: item.subject.title,
                    repository: item.repository.full_name,
                    url: info.url,
                });
                if (info.state) {
                    notification.state = info.state;
                }
                notifications.push(notification);
            }

            //this.interval = headers.get_one('X-Poll-Interval') ?? this.interval;
            this.modifiedSince = headers.get_one('Last-Modified') ?? this.modifiedSince;
            log('Response resulted in ' + message.get_status());
            log(this.modifiedSince);

            return notifications;
        } catch (e) {
            throw e;
        }
    }

    async getSubjectInfo(notification) {
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
            info.url = contents.html_url

            if (!notification.reason == 'subscribed') {
                if (notification.subject.type === "Issue" || notification.subject.type === "PullRequest") {
                    const url = this.getCommentURL(notification.subject.latest_comment_url);
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

    async getCommentURL(url) {
        try {
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents(bytes);

            return contents.html_url;
        } catch (e) {
            throw e;
        }
    }

    buildURI(path, query={}) {
        return super.buildURI(GITHUB_API, path, query);
    }
};