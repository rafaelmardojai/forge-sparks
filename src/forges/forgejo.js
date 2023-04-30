// SPDX-License-Identifier: MIT

import GLib from 'gi://GLib';
import { gettext as _ } from 'gettext';

import Forge from './forge.js';
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

    static name = 'forgejo';

    static prettyName = 'Forgejo';

    static allowInstances = true;

    static defaultURL = 'codeberg.org';

    static get tokenText() {
        /* Forgejo access token help */
        return _('To generate a new access token from your Forgejo instance go to Settings → Applications and generate a new token.');
    }
};
