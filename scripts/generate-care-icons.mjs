/* MilkFlow care icon design system.
 *
 * Every care action icon is COMPOSED, not drawn one-off: a semantic base shape (what the
 * button does) rendered in a theme palette, with a small theme motif. That keeps meaning
 * constant across themes while letting each world look like itself, and it means adding a
 * fifth theme is a palette entry rather than six more hand-drawn files.
 *
 *   icon(theme, action) = disc(theme.disc) + base[action](theme.ink) + motif[theme]
 *
 * Run:  node scripts/generate-care-icons.mjs
 * Out:  assets/care-icons/<theme>/<action>.svg  +  assets/care-icons/manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/care-icons');

/* ---------------------------------------------------------------- actions --
 * The semantic layer. These shapes never change with the theme: a bottle is a bottle in
 * Safari and in Princess. Coordinates are a 64x64 box with the mark inside roughly 14..50.
 */
export const ACTIONS = ['milk', 'nurse', 'formula', 'wet', 'poop', 'mixed', 'pump'];

const BASE = {
  milk: ink => `
    <rect x="25" y="9" width="14" height="7" rx="3.5" fill="${ink}"/>
    <path d="M27.5 17.5h9v3.2h-9z" fill="${ink}"/>
    <path d="M25.6 22.2q6.4-3 12.8 0a6.6 6.6 0 0 1 3.2 5.7v16.4a7.4 7.4 0 0 1-7.4 7.4h-4.4a7.4 7.4 0 0 1-7.4-7.4V27.9a6.6 6.6 0 0 1 3.2-5.7Z" fill="${ink}"/>
    <path d="M23.6 33.4h16.8v3.1H23.6zM27.4 40.6h9.2v2.6h-9.2z" fill="#fff" fill-opacity=".62"/>`,

  nurse: ink => `
    <circle cx="23.6" cy="19.4" r="7.2" fill="${ink}"/>
    <path d="M10.6 51.4c0-9.4 5.6-15.6 13-15.6 3.3 0 6.3 1.2 8.6 3.4l-4.4 5a6.6 6.6 0 0 0-4.2-1.5c-3.3 0-5.7 3-5.7 8.7Z" fill="${ink}"/>
    <circle cx="41.4" cy="31.6" r="6.1" fill="${ink}"/>
    <path d="M30.8 51.4c0-6.3 4.6-10.8 10.6-10.8s10.6 4.5 10.6 10.8Z" fill="${ink}"/>
    <path d="M33.4 45.2a11 11 0 0 1 8-3.2" stroke="#fff" stroke-opacity=".55" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,

  formula: ink => `
    <rect x="18.4" y="13.6" width="27.2" height="8" rx="2.6" fill="${ink}"/>
    <path d="M21.2 23.4h21.6v20.8a7.2 7.2 0 0 1-7.2 7.2h-7.2a7.2 7.2 0 0 1-7.2-7.2Z" fill="${ink}"/>
    <path d="M25 30.6h14v6.2H25z" fill="#fff" fill-opacity=".62"/>
    <path d="M27.4 41.8h9.2v2.6h-9.2z" fill="#fff" fill-opacity=".4"/>`,

  wet: ink => `
    <path d="M32 10.4c7.4 9.6 13.4 16 13.4 22.2a13.4 13.4 0 0 1-26.8 0c0-6.2 6-12.6 13.4-22.2Z" fill="${ink}"/>
    <path d="M25.4 33.8c0 4 2.2 7 5.6 8.1" stroke="#fff" stroke-opacity=".55" stroke-width="2.6" fill="none" stroke-linecap="round"/>`,

  poop: ink => `
    <path d="M32 13.6c5.2 1.1 6.6 4.3 5.3 7.4h2.1c5.2 0 8.6 3.1 8.6 6.6 0 1.7-.7 3.2-2 4.5 4.1 1.1 6.4 3.8 6.4 6.8 0 4.2-4.6 7.5-10.4 7.5H22c-5.8 0-10.4-3.3-10.4-7.5 0-3 2.3-5.7 6.4-6.8a6 6 0 0 1-2-4.5c0-3.5 3.4-6.6 8.6-6.6h2.1c-1.3-3.1.1-6.3 5.3-7.4Z" fill="${ink}"/>
    <circle cx="26" cy="33.4" r="2.2" fill="#fff" fill-opacity=".62"/>
    <circle cx="38" cy="33.4" r="2.2" fill="#fff" fill-opacity=".62"/>`,

  pump: ink => `
    <path d="M13.6 21.4h30.8a2.6 2.6 0 0 1 2.4 3.6l-5.6 13.4a3.4 3.4 0 0 0-.3 1.3v1.1H17.1v-1.1a3.4 3.4 0 0 0-.3-1.3l-5.6-13.4a2.6 2.6 0 0 1 2.4-3.6Z" fill="${ink}"/>
    <path d="M24.4 42.6h9.2a5.4 5.4 0 0 1 5.4 5.4v3.4a2 2 0 0 1-2 2H21a2 2 0 0 1-2-2V48a5.4 5.4 0 0 1 5.4-5.4Z" fill="${ink}"/>
    <path d="M29 26.6c2.1 2.7 3.8 4.8 3.8 6.6a3.8 3.8 0 0 1-7.6 0c0-1.8 1.7-3.9 3.8-6.6Z" fill="#fff" fill-opacity=".66"/>`,

  mixed: ink => `
    <path d="M22.6 10.6c5.3 6.9 9.6 11.5 9.6 15.9a9.6 9.6 0 0 1-19.2 0c0-4.4 4.3-9 9.6-15.9Z" fill="${ink}"/>
    <path d="M41.4 27.4c3.4.7 4.3 2.8 3.5 4.8h1.4c3.4 0 5.6 2 5.6 4.3 0 1.1-.5 2.1-1.3 2.9 2.7.7 4.2 2.5 4.2 4.4 0 2.8-3 4.9-6.8 4.9H31.8c-3.8 0-6.8-2.1-6.8-4.9 0-1.9 1.5-3.7 4.2-4.4a3.9 3.9 0 0 1-1.3-2.9c0-2.3 2.2-4.3 5.6-4.3h1.4c-.8-2 .1-4.1 3.5-4.8Z" fill="${ink}"/>
    <path d="M17.6 26.8c0 2.9 1.6 5 4 5.8" stroke="#fff" stroke-opacity=".5" stroke-width="2.2" fill="none" stroke-linecap="round"/>`
};

/* ----------------------------------------------------------------- themes --
 * The expressive layer. `disc` stays deliberately pale: the icon should read as a mark on a
 * card, not as a second block of colour competing with the card and the page artwork.
 */
export const THEMES = {
  safari:    {disc:['#FDF3E2','#F5E1BE'], ink:'#7C4A1C', motif:'leaf'},
  butterfly: {disc:['#FBF1F8','#EDDFF4'], ink:'#6A3D7C', motif:'butterfly'},
  princess:  {disc:['#FDF1F3','#F7DFE7'], ink:'#8E3A58', motif:'crown'},
  unicorn:   {disc:['#F4EFFD','#E5E1FB'], ink:'#53408D', motif:'sparkle'}
};

/* Motifs sit in the upper-right quadrant, which every base shape leaves clear, so the
   signature never competes with the mark for the same pixels. */
const MOTIF = {
  leaf: ink => `<path d="M55.6 9.4c0 7.2-4.1 11.8-10.4 11.8 0-7.2 4.1-11.8 10.4-11.8Z" fill="${ink}" fill-opacity=".46"/><path d="M45.6 21.6c1.5-4.1 4.1-7.7 7.7-10.1" stroke="${ink}" stroke-opacity=".6" stroke-width="1.8" fill="none" stroke-linecap="round"/>`,
  butterfly: ink => `<path d="M51.4 9.8c3.6 0 6 2.2 6 5s-2.4 4.6-6 4.6Zm-1.9 0c-3.6 0-6 2.2-6 5s2.4 4.6 6 4.6Z" fill="${ink}" fill-opacity=".46"/><path d="M50.4 8.6v12" stroke="${ink}" stroke-opacity=".6" stroke-width="1.8" stroke-linecap="round"/>`,
  crown: ink => `<path d="M43.6 21.4 41.4 9l5.3 4.3 4.6-6.5 4.6 6.5L61.2 9l-2.2 12.4Z" fill="${ink}" fill-opacity=".46"/>`,
  sparkle: ink => `<path d="M51 6.6l2.3 6 6 2.3-6 2.3-2.3 6-2.3-6-6-2.3 6-2.3Z" fill="${ink}" fill-opacity=".48"/>`
};

/* The same motif, centred and full size, used as a section-header mark. Section headers
   previously showed an unrelated stock animal (a whale on Trends, a fox on Doctor) that
   belonged to no theme. */
export function renderMotif(themeId) {
  const t = THEMES[themeId];
  if (!t) throw new Error(`Unknown theme: ${themeId}`);
  const gid = `m-${themeId}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${themeId} motif">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="${t.disc[0]}"/><stop offset="1" stop-color="${t.disc[1]}"/>
  </linearGradient></defs>
  <circle cx="32" cy="32" r="31" fill="url(#${gid})"/>
  <g transform="translate(-19.5 12.5) scale(1.85)" transform-origin="51 15">${MOTIF[t.motif](t.ink).trim()}</g>
</svg>`;
}

export function renderIcon(themeId, action) {
  const t = THEMES[themeId];
  if (!t) throw new Error(`Unknown theme: ${themeId}`);
  if (!BASE[action]) throw new Error(`Unknown action: ${action}`);
  const gid = `d-${themeId}-${action}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64" role="img" aria-label="${action} (${themeId})">
  <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0.6" y2="1">
    <stop offset="0" stop-color="${t.disc[0]}"/><stop offset="1" stop-color="${t.disc[1]}"/>
  </linearGradient></defs>
  <circle cx="32" cy="32" r="31" fill="url(#${gid})"/>
  ${MOTIF[t.motif](t.ink).trim()}
  ${BASE[action](t.ink).trim()}
</svg>`;
}

function main() {
  const manifest = {generated: new Date().toISOString(), actions: ACTIONS, themes: {}};
  let written = 0;
  for (const themeId of Object.keys(THEMES)) {
    const dir = path.join(OUT, themeId);
    fs.mkdirSync(dir, {recursive: true});
    manifest.themes[themeId] = ACTIONS.slice();
    for (const action of ACTIONS) {
      fs.writeFileSync(path.join(dir, `${action}.svg`), renderIcon(themeId, action) + '\n');
      written++;
    }
    fs.writeFileSync(path.join(dir, 'motif.svg'), renderMotif(themeId) + '\n');
    written++;
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated ${written} care icons across ${Object.keys(THEMES).length} themes -> assets/care-icons/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
