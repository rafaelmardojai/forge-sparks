// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import GitHub from './github.js';
import { session } from './../util.js';


/**
 * Gitea has a GitHub compatible API, so we can basically just derive from our
 * GitHub class and tweak the buildURI method.
 */
export default class Gitea extends GitHub {

    static name = 'gitea';

    static prettyName = 'Gitea / Forgejo';

    static allowInstances = true;

    static defaultURL = 'codeberg.org';

    static get tokenText() {
        /* Gitea/Forgejo access token help */
        return _('To generate a new access token from your Gitea/Forgejo instance go to Settings → Applications and generate a new token.');
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
                const url = this.buildURI('notifications', {
                    'last_read_at': now.format_iso8601(),
                    'all': true
                });
                const message = super.createMessage('PUT', url);
                await session.send_and_read_async(message, GLib.PRIORITY_DEFAULT, null);

                /* If Reset-Content */
                return message.get_status() == '205';
            }
        } catch (e) {
            throw e;
        }
    }

    buildURI(path, query={}) {
        return Forge.buildURI(this.url, '/api/v1/' + path, query);
    }
};
