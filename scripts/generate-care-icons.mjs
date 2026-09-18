/* Build the care-icon asset set.
 *
 * The design system lives in scripts/care-icons/ (palette, props, parts, cast). This file
 * only writes it to disk, so the drawing code stays reviewable and the build step stays
 * boring.
 *
 * Run:  npm run icons:care     (or: node scripts/generate-care-icons.mjs)
 * Out:  assets/care-icons/<theme>/<action>.svg
 *       assets/care-icons/<theme>/motif.svg      - the theme mascot, for section headers
 *       assets/care-icons/manifest.json
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ACTIONS, THEME_IDS, renderIcon, renderMascot, themeLabel} from './care-icons/index.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'assets/care-icons');

function main() {
  const manifest = {generated: new Date().toISOString(), actions: ACTIONS, themes: {}};
  let written = 0;
  for (const themeId of THEME_IDS) {
    const dir = path.join(OUT, themeId);
    fs.mkdirSync(dir, {recursive: true});
    manifest.themes[themeId] = {label: themeLabel(themeId), actions: ACTIONS.slice()};
    for (const action of ACTIONS) {
      fs.writeFileSync(path.join(dir, `${action}.svg`), renderIcon(themeId, action) + '\n');
      written++;
    }
    fs.writeFileSync(path.join(dir, 'motif.svg'), renderMascot(themeId) + '\n');
    written++;
  }
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Generated ${written} care icons across ${THEME_IDS.length} themes -> assets/care-icons/`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
