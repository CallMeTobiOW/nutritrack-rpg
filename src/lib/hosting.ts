/**
 * Where the app lives. NutriTrack moved from GitHub Pages to Vercel in v0.6.0.
 *
 * Both addresses are built from the same code. The old GitHub Pages copy keeps
 * working (it holds the player's data until they move it), and shows a guide
 * to the new address. A new address is a new origin on iPhone, so saved data
 * does not follow on its own: it moves with a backup file.
 */
export const NEW_HOME_URL = 'https://nutritrack-rpg.vercel.app/';

/** True when running on the old GitHub Pages address. */
export function isLegacyHost(hostname: string = typeof location === 'undefined' ? '' : location.hostname): boolean {
  return hostname.endsWith('.github.io');
}

/** The new address without the protocol, for display ("nutritrack-rpg.vercel.app"). */
export const NEW_HOME_LABEL = NEW_HOME_URL.replace(/^https?:\/\//, '').replace(/\/$/, '');
