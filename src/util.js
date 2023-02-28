// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Xdp from 'gi://Xdp';
import XdpGtk4 from 'gi://XdpGtk4';
import { gettext as _, ngettext } from 'gettext';

const Format = imports.format;

export const settings = new Gio.Settings({
    schema_id: pkg.name,
    path: '/com/mardojai/ForgeSparks/',
});

export const session = new Soup.Session();
session.set_user_agent(`Forge Sparks v${pkg.version}`);

export const portal = new Xdp.Portal();

export function requestBackground(window, autostart=false) {
    /* Try getting parent */
    let parent = null;
    try {
        //parent = XdpGtk4.parent_new_gtk(window);
    } catch (error) {
        logError(error);
    }

    return new Promise((resolve) => {
        portal.request_background(
            parent,
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

export function setBackgroundStatus(message=_('Looking for new notifications.')) {
    if (typeof portal.set_background_status === 'function') {
        portal.set_background_status(message, null, (_portal, result) => {
            portal.set_background_status_finish(result);
        });
    }
}

/**
 * Get relative date string from GLib.DateTime
 * @param {GLib.DateTime} date
 * @returns {String}
 */
export function relativeDate(date) {
    const now = GLib.DateTime.new_now(date.get_timezone());
    const difference = date.difference(now);

    if (difference < 0) {
        /* microseconds to minutes */
        const minutes = Math.round(Math.abs(difference) / 6e+7);

        if (minutes < 1) {
            return _('now');
        }
        else if (minutes < 60) {
            return Format.vprintf(
                ngettext('%d minute ago', '%d minutes ago', minutes), [minutes]
            );
        }
        else if (minutes < 1440) {
            const hours = Math.round(minutes / 60);
            return Format.vprintf(
                ngettext('%d hour ago', '%d hours ago', hours), [hours]
            );
        }
        else if (minutes < 10080) {
            const days = Math.round(minutes / 1440);
            return Format.vprintf(
                ngettext('yesterday', '%d days ago', days), [days]
            );
        }
        else if (minutes < 40320) {
            const weeks = Math.round(minutes / 10080);
            return Format.vprintf(
                ngettext('%d week ago', '%d weeks ago', weeks), [weeks]
            );
        }
        else if (now.get_year() === date.get_year()) {
            const formattedDate = date.format('%d %b');
            return Format.vprintf(_('on %s'), [formattedDate]);
        }
        else {
            const formattedDate = date.format('%d %b, %Y');
            return Format.vprintf(_('on %s'), [formattedDate]);
        }
    }

    logError('Date is in the future!');
    return _('now');
}
