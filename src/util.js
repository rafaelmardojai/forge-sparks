// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Soup from 'gi://Soup';
import Xdp from 'gi://Xdp';
import XdpGtk4 from 'gi://XdpGtk4';
import { gettext as _, ngettext } from 'gettext';

const Format = imports.format;

/**
 * App Settings instance
 */
export const settings = new Gio.Settings({
    schema_id: pkg.name,
    path: '/com/mardojai/ForgeSparks/',
});

/**
 * Soup Session instance for all app requests
 */
export const session = new Soup.Session();
session.set_user_agent(`Forge Sparks v${pkg.version}`);

/**
 * Desktop Portal instance
 */
export const portal = new Xdp.Portal();

/**
 * Request background portal
 * 
 * @param {Gtk.window} window The window making the request
 * @param {Boolean} autostart If autostart should be requested as well
 * @param {Boolean} hidden If autostart should de done hidden. Depends on
 * autostart being true. Adds the --hidden flag to the app command.
 * @returns {Boolean} If request was successful
 */
export function requestBackground(window, autostart=false, hidden=false) {
    /* Try getting parent from window */
    let parent = null;
    try {
        /* parent = XdpGtk4.parent_new_gtk(window); */
        /* FIXME: gdk_wayland_toplevel_export_handle: assertion 'GDK_IS_WAYLAND_TOPLEVEL (toplevel)' failed */
    } catch (error) {
        console.error(error);
    }

    return new Promise((resolve) => {

        let command = ['forge-sparks'];
        if (autostart && hidden)
            command.push('--hidden');

        portal.request_background(
            parent,
            (autostart) ? _('Allow running Forge Sparks on background.') : _('Allow running Forge Sparks on startup.'),
            command,
            (autostart) ? Xdp.BackgroundFlags.AUTOSTART : Xdp.BackgroundFlags.NONE,
            null,
            (_portal, result) => {
                try {
                    const success = portal.request_background_finish(result);
                    resolve(success);
                } catch (e) {
                    if (e.code !== Gio.IOErrorEnum.CANCELLED) {
                        console.error(e);
                    }
                    resolve(false);
                }
            }
        )
    });
}

/**
 * Set background status message
 * 
 * @param {String} message
 */
export function setBackgroundStatus(message=_('Monitoring new notifications')) {
    if (Xdp.Portal.running_under_sandbox()) {
        portal.set_background_status(message, null, (portal, result) => {
            portal.set_background_status_finish(result);
        });
    }
}

/**
 * Get relative date string from GLib.DateTime
 * 
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
                /* Translators: relative date */
                ngettext('%d minute ago', '%d minutes ago', minutes), [minutes]
            );
        }
        else if (minutes < 1440) {
            const hours = Math.round(minutes / 60);
            return Format.vprintf(
                /* Translators: relative date */
                ngettext('%d hour ago', '%d hours ago', hours), [hours]
            );
        }
        else if (minutes < 10080) {
            const days = Math.round(minutes / 1440);
            return Format.vprintf(
                /* Translators: relative date */
                ngettext('yesterday', '%d days ago', days), [days]
            );
        }
        else if (minutes < 40320) {
            const weeks = Math.round(minutes / 10080);
            return Format.vprintf(
                /* Translators: relative date */
                ngettext('%d week ago', '%d weeks ago', weeks), [weeks]
            );
        }
        else if (now.get_year() === date.get_year()) {
            const formattedDate = date.format('%b %d');
            /* Translators: relative date, %s is date formatted as "May 01, 2022" */
            return Format.vprintf(_('on %s'), [formattedDate]);
        }
        else {
            const formattedDate = date.format('%d %b, %Y');
            return Format.vprintf(_('on %s'), [formattedDate]);
        }
    }

    console.error('Date is in the future!');
    return _('now');
}
