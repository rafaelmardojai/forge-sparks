// SPDX-License-Identifier: MIT

import { gettext as _ } from 'gettext';

import Forge from './forge.js';
import GitHub from './github.js';

/**
 * Gitea has a GitHub compatible API, so we can basically just derive from our
 * GitHub class and tweak the buildURI method.
 */
export default class Gitea extends GitHub {

    static name = 'gitea';

    static prettyName = 'Gitea / Forgejo';

    static allowInstances = true;

    static defaultURL = 'codeberg.org';

    buildURI(path, query={}) {
        return Forge.buildURI(this.url, '/api/v1/' + path, query);
    }
};
