// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import Soup from 'gi://Soup';
import Xdp from 'gi://Xdp';
// import XdpGtk4 from 'gi://XdpGtk4';
import { gettext as _ } from 'gettext';

export const settings = new Gio.Settings({
    schema_id: pkg.name,
    path: '/com/mardojai/ForgeSparks/',
});

export const session = new Soup.Session();
session.set_user_agent(`Forge Sparks v${pkg.version}`);

export const portal = new Xdp.Portal();

export function requestBackground(window, autostart=false) {
    // const parent = XdpGtk4.parent_new_gtk(window);

    return new Promise((resolve) => {
        portal.request_background(
            null, // parent
            (autostart) ? _('Allow running Forge Sparks on background.') : _('Allow running Forge Sparks on startup.'),
            ['forge-sparks'],
            (autostart) ? Xdp.BackgroundFlags.AUTOSTART : Xdp.BackgroundFlags.NONE,
            null,
            (_portal, result) => {
                try {
                    const success = portal.request_background_finish(result);
                    resolve(success);
                } catch (e) {
                    if (e.code !== Gio.IOErrorEnum.CANCELLED) {
                        logError(e);
                    }
                    resolve(false);
                }
            }
        )
    });
}
