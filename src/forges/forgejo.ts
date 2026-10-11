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
}
