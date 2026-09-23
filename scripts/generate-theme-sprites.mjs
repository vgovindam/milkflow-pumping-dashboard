import fs from 'node:fs';
import path from 'node:path';
import {palette} from './care-icons/palette.mjs';

/* The 800x100 strip behind --mf-icon-sprite.
 *
 * Eight 100x100 cells, indexed by background-position in experience-components.css:
 * milk, nurse, formula, wet, poop, mixed, pump, nursing. It is the same cast as the care
 * icons, without the disc or the prop badge, because here the character is decoration on a
 * card that already says what it is. Generated rather than drawn so a cast change cannot
 * leave the strip showing last season's animals.
 */
const root = process.cwd();
const themes = ['deepspace', 'aurora', 'neonreef', 'crystalcity'];
const CELLS = ['milk', 'nurse', 'formula', 'wet', 'poop', 'mixed', 'pump', 'nurse'];

for(const theme of themes){
  const cast = (await import(`./care-icons/cast/${theme}.mjs`)).default;
  const p = palette(theme);
  const cells = CELLS.map((action, i) => {
    const character = cast.cast[action];
    const c = {...character, ink: p.ink, blush: character.blush || p.blush};
    /* Each character is drawn in its own 64x64 space, so the cell is a translate plus a
       scale that fits the head comfortably inside 100x100 with a little air. */
    return `<g transform="translate(${i * 100} 0) scale(1.5625)"><g transform="translate(2.4 3.2)">${character.render(c)}</g></g>`;
  }).join('\n');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 100" aria-hidden="true">\n${cells}\n</svg>\n`;
  fs.mkdirSync(path.join(root, 'assets/theme-icons'), {recursive: true});
  fs.writeFileSync(path.join(root, 'assets/theme-icons', `${theme}.svg`), svg);
}
console.log(`Generated ${themes.length} theme sprite strips.`);
