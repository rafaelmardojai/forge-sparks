// SPDX-License-Identifier: MIT
import { gettext as _ } from 'gettext';

import Gitea from './gitea.js';

/**
 * Forgejo implementation
 *
 * Forgejo and Gitea have compatible API, so we can basically just derive from
 * our Gitea class.
 *
 * We keep them separate just in case things change in the future.
 */
export default class Forgejo extends Gitea {
    static identifier = 'forgejo';

    static prettyName = 'Forgejo';

    static allowInstances = true;

    static defaultURL = 'codeberg.org';

    static scopes = ['read:issue', 'write:notification', 'read:user', 'read:repository'];

    static get tokenText() {
        /* Forgejo access token help */
        let tokenText = _(
            'To generate a new access token from your instance, go to Settings → Applications and generate a new token.',
        );
        tokenText += '\n\n';
        /* Forgejo access token help */
        tokenText += _(
            'Forge Sparks requires the <i>read:issue</i>, <i>write:notification</i>, <i>read:user</i> and <i>read:repository</i> scopes granted.',
        );

        return tokenText;
    }
}
