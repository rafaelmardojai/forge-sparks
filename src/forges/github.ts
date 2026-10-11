// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import { gettext as _ } from 'gettext';
import type { Endpoints } from '@octokit/types';

import Forge from './forge.js';
import Notification from '../model/notification.js';
import { session } from '../util.js';

const Format = imports.format;

type UserResponse = Endpoints['GET /user']['response']['data'];
type NotificationsResponse = Endpoints['GET /notifications']['response']['data'];
type IssueResponse = Endpoints['GET /repos/{owner}/{repo}/issues/{issue_number}']['response']['data'];
type PullRequestResponse = Endpoints['GET /repos/{owner}/{repo}/pulls/{pull_number}']['response']['data'];
type SubjectResponse = IssueResponse | PullRequestResponse;
type CommentsResponse = Endpoints['GET /repos/{owner}/{repo}/issues/comments/{comment_id}']['response']['data'];

interface SubjectInfo {
    url: string;
    state?: string;
    updated_at?: string;
}

interface NotificationDetails {
    id: string;
    type: string;
    unread: boolean;
    updatedAt: string;
    title: string;
    repository: string;
    url: string;
    accountName: string;
    state?: string;
}

export default class GitHub extends Forge {
    static identifier = 'github';

    static prettyName = 'GitHub';

    static allowInstances = true;

    static defaultURL = 'github.com';

    static scopes = ['notifications', 'read:user'];

    static get tokenText() {
        const tokenURL = 'https://github.com/settings/tokens';
        const tokenHelpURL =
            'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens#creating-a-personal-access-token-classic';

        /* GitHub access token help */
        let tokenText = Format.vprintf(
            _(
                'You can generate a new personal access token from <a href=\"%s\">GitHub developer settings</a>. For more information, see "<a href=\"%s\">Creating a personal access token</a>".',
            ),
            [tokenURL, tokenHelpURL],
        );
        tokenText += '\n\n';
        /* GitHub access token help */
        tokenText += _(
            'Forge Sparks requires a <b>classic</b> access token (for general use) with the <i>notifications</i> and <i>read:user</i> scopes granted.',
        );
        tokenText += ' ';
        /* GitHub access token help */
        tokenText += _(
            'If you’re working with private repositories, you’ll also need to grant the full <i>repo</i> scope.',
        );

        return tokenText;
    }

    async getUser(): Promise<[number, string]> {
        try {
            const url = this.buildURI('user');
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents<UserResponse>(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);

            if (message.get_status() == Soup.Status.UNAUTHORIZED) {
                throw 'FailedForgeAuth';
            } else if (message.get_status() == Soup.Status.FORBIDDEN) {
                throw 'FailedTokenScopes';
            } else if (message.get_status() != Soup.Status.OK) {
                throw 'Unexpected';
            } else if (!('login' in contents) || !('id' in contents)) {
                throw 'Unexpected';
            }

            /* Test notifications capabilities */
            const urlNotify = this.buildURI('notifications');
            const messageNotify = super.createMessage('GET', urlNotify);
            await session.send_and_read_async(messageNotify, GLib.PRIORITY_DEFAULT, null);
            if (messageNotify.get_status() == Soup.Status.FORBIDDEN) {
                /* Unauthorized, token scopes */
                throw 'FailedTokenScopes';
            }

            return [contents.id as number, contents.login];
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
            const contents = super.readContents<NotificationsResponse>(bytes);

            console.log(`${url} response resulted in ${message.get_status()}`);
            /* this.modifiedSince = headers.get_one('Last-Modified') ?? this.modifiedSince; */

            if (message.get_status() == Soup.Status.OK) {
                /* Get notifications from response */
                const notifications = await this.compileNotifications(contents);

                this.notifications.clear(); /* Clear list */

                /* Loop new notifications and populate the model */
                for (const notification of notifications) {
                    this.notifications.append(new Notification(notification));
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
                const url = this.buildURI(`/notifications/threads/${id}`);
                const message = super.createMessage('PATCH', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If Reset-Content */
                return message.get_status() == Soup.Status.RESET_CONTENT;
            } else {
                const now = GLib.DateTime.new_now_utc();
                const url = this.buildURI('notifications');
                const message = super.createMessage('PUT', url, {
                    last_read_at: now.format_iso8601(),
                    read: true,
                });
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If Accepted or Reset-Content */
                return (
                    message.get_status() == Soup.Status.ACCEPTED || message.get_status() == Soup.Status.RESET_CONTENT
                );
            }
        } catch (e) {
            throw e;
        }
    }

    /**
     * Compile notifications.
     *
     * This should happen in parallel so that information retrieval
     * doesn't take a lot of time.
     */
    private compileNotifications(items: NotificationsResponse): Promise<NotificationDetails[]> {
        const notifications: NotificationDetails[] = [];
        let count = items.length;

        return new Promise((resolve, reject) => {
            if (!items.length) {
                resolve(notifications);
            }

            for (const item of items) {
                try {
                    this.getSubjectInfo(item).then((info) => {
                        const notification: NotificationDetails = {
                            id: super.formatID(item.id),
                            type: item.subject.type,
                            unread: item.unread,
                            updatedAt: info.updated_at ?? item.updated_at,
                            title: item.subject.title,
                            repository: item.repository.full_name,
                            url: info.url,
                            accountName: this.accountName,
                        };
                        if (info.state) {
                            notification.state = info.state;
                        }
                        notifications.push(notification);

                        count--;
                        if (count === 0) {
                            resolve(notifications);
                        }
                    });
                } catch (e) {
                    count--;
                    console.error(e);
                }
            }
        });
    }

    /**
     * Get extra info from the notification subject
     *
     * @param notification The notification object from the response JSON
     * @throws Throws an error if failed making the request or reading the data
     */
    private async getSubjectInfo(notification: NotificationsResponse[number]): Promise<SubjectInfo> {
        /* Here we'll store the info */
        const info: SubjectInfo = {
            url: notification.repository.html_url,
            state: undefined,
            updated_at: undefined,
        };

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
            }
            return info;
        }

        /* Request the notification subject info from API  */
        try {
            const message = super.createMessage('GET', notification.subject.url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents<SubjectResponse>(bytes);

            if (message.get_status() == Soup.Status.OK) {
                info.state = contents.state;
                /* info.updated_at = contents.updated_at */
                info.url = contents.html_url;

                /* Get pull request state */
                if (notification.subject.type === 'PullRequest') {
                    if (contents.draft) {
                        info.state = 'draft';
                    }
                    if (contents.state == 'closed' && (contents as PullRequestResponse).merged_at == null) {
                        info.state = 'denied';
                    }
                }

                /* Get comment url */
                if (notification.reason != 'subscribed') {
                    if (notification.subject.type === 'Issue' || notification.subject.type === 'PullRequest') {
                        const url = await this.getCommentURL(notification.subject.latest_comment_url);
                        if (url) info.url = url;
                    }
                }

                /* Add notification referrer to url */
                /* Only if forge is GitHub */
                if ((this.constructor as typeof Forge).identifier === 'github') {
                    const referrer = this.getNotificationReferrerID(notification.id);
                    const n = info.url.lastIndexOf('#'); // Get hash position

                    if (n < 0) {
                        info.url += `?notification_referrer_id=${referrer}`;
                    } else {
                        info.url = `${info.url.substring(0, n)}?notification_referrer_id=${referrer}${info.url.substring(n)}`;
                    }
                }
            } else {
                /* Fallback URL if request failed, probably repo is private */
                if (notification.subject.type === 'PullRequest') {
                    info.url = `${notification.repository.html_url}/pulls`;
                } else if (notification.subject.type === 'Issue') {
                    info.url = `${notification.repository.html_url}/issues`;
                } else {
                    info.url = notification.repository.url;
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
     * e.g. https://github.com/user/repo/issues/1#issuecomment-1529954726
     *
     * @param url The url of the API to request the comments url
     * e.g https://api.github.com/repos/user/repo/issues/comments/1529954726
     * @throws Throws an error if failed making the request or reading the data
     */
    private async getCommentURL(url: string): Promise<string | null> {
        if (!url || url === null) return null;

        try {
            const message = super.createMessage('GET', url);
            const bytes = await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);
            const contents = super.readContents<CommentsResponse>(bytes);

            return contents.html_url;
        } catch (e) {
            throw e;
        }
    }

    /**
     * Get notification referrer ID
     *
     * Needed to show the notification shelf on GitHub's web UI
     *
     * Based on Daniel Lamando snippet
     * https://github.com/sindresorhus/notifier-for-github/issues/268
     *
     * @param id GitHub's Notification ID
     * @param version Version of the referrer ID
     */
    private getNotificationReferrerID(id: string, version: number = 1): string {
        switch (version) {
            case 2:
                /**
                 * This one doesn't seem to work.
                 * The leading bytes are probably dynamic or have changed.
                 */
                return 'NT_' + GLib.base64_encode(`\x93\x00\xCD\x9E\xB4\xB0${id}:${this.userId}`).replace(/=+$/, '');
            default:
                /* Old but still works */
                return GLib.base64_encode(`018:NotificationThread${id}:${this.userId}`);
        }
    }

    /**
     * Build a request URI from multiple parts
     *
     * This is a simplified version of Forge.buildURI with Github API url set as host
     *
     * @param path The URI path
     * @param query The URI query
     */
    buildURI(path: string, query: Record<string, any> = {}): string {
        return Forge.buildURI(`api.${this.url}`, path, query);
    }
}
