// SPDX-License-Identifier: MIT

import Gio from 'gi://Gio';
import Soup from 'gi://Soup';

export const settings = new Gio.Settings({
  schema_id: pkg.name,
  path: '/com/mardojai/ForgeSparks/',
});

export const session = new Soup.Session();
session.set_user_agent(`Forge Sparks v${pkg.version}`);
