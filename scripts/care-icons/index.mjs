/* MilkFlow care-icon design system.
 *
 *   icon(theme, action) = disc(theme) + character(theme.cast[action]) + propBadge(action)
 *
 * Two layers with two jobs:
 *   - the CHARACTER is the theme. Safari gets savannah babies, Butterfly gets garden bugs,
 *     Princess gets royal pets, Unicorn gets storybook creatures. It is what a two-year-old
 *     looks at.
 *   - the PROP BADGE is the meaning. It is the same bottle, drop and tin in every theme, in
 *     the theme's darkest ink on a near-white badge, so the icon is still readable at a
 *     glance and still passes contrast when the theme changes.
 *
 * Adding a theme is one palette entry plus one cast file; adding an action is one prop plus
 * one character per cast. Nothing downstream changes: the output paths are stable.
 */
import {palette} from './palette.mjs';
import {ACTIONS, placeProp} from './props.mjs';
import {BADGE} from './parts.mjs';
import safari from './cast/safari.mjs';
import butterfly from './cast/butterfly.mjs';
import princess from './cast/princess.mjs';
import unicorn from './cast/unicorn.mjs';

export {ACTIONS};

const CASTS = {safari, butterfly, princess, unicorn};
export const THEME_IDS = Object.keys(CASTS);

function colors(themeId, character) {
  const p = palette(themeId);
  return {...character, ink: p.ink, blush: character.blush || p.blush};
}

function disc(themeId, gid) {
  const p = palette(themeId);
  return {
    def: `<linearGradient id="${gid}" x1="0" y1="0" x2="0.62" y2="1"><stop offset="0" stop-color="${p.disc[0]}"/><stop offset="1" stop-color="${p.disc[1]}"/></linearGradient>`,
    shape: `<circle cx="32" cy="32" r="31" fill="url(#${gid})"/>`
  };
}

/** The semantic prop on its own badge, bottom-right, always on a near-white plate. */
function propBadge(themeId, action) {
  const p = palette(themeId);
  return [
    `<circle cx="${BADGE.cx}" cy="${BADGE.cy}" r="${BADGE.r + 1.1}" fill="${p.disc[1]}" fill-opacity=".85"/>`,
    `<circle cx="${BADGE.cx}" cy="${BADGE.cy}" r="${BADGE.r}" fill="${p.badge}"/>`,
    placeProp(action, p.ink, BADGE)
  ].join('');
}

function svg(label, body, defs) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${label}">
  <defs>${defs}</defs>
  ${body}
</svg>`;
}

export function renderIcon(themeId, action) {
  const theme = CASTS[themeId];
  if (!theme) throw new Error(`Unknown care-icon theme: ${themeId}`);
  const character = theme.cast[action];
  if (!character) throw new Error(`Theme ${themeId} has no character for action: ${action}`);
  const gid = `d-${themeId}-${action}`;
  const d = disc(themeId, gid);
  const label = `${character.name} — ${action}`;
  return svg(label, [d.shape, character.render(colors(themeId, character)), propBadge(themeId, action)].join('\n  '), d.def);
}

/** The theme's mascot with no prop: used for section headers and theme pickers. */
export function renderMascot(themeId) {
  const theme = CASTS[themeId];
  if (!theme) throw new Error(`Unknown care-icon theme: ${themeId}`);
  const gid = `m-${themeId}`;
  const d = disc(themeId, gid);
  const c = colors(themeId, theme.mascot);
  return svg(`${theme.label} mascot`, [d.shape, `<g transform="translate(2.4 3.4) scale(1.08)" transform-origin="32 32">${theme.mascot.render(c)}</g>`].join('\n  '), d.def);
}

export function themeLabel(themeId) {
  return CASTS[themeId]?.label || themeId;
}
