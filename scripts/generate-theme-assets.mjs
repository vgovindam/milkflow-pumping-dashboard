import fs from 'node:fs';
import path from 'node:path';
import {WORLDS, WORLD_IDS} from './theme-scenes/worlds.mjs';

/* Ten files per world from one authored field per mode.
 *
 * The five roles are crops of the same 1000x2200 composite, so a palette change moves all of
 * them together and they cannot drift apart. Light and dark are separately authored: deriving
 * one from the other by pushing colours around is what turned four different worlds into the
 * same murk last time.
 */
const root = process.cwd();
const roles = ['baby-background', 'baby-hero', 'mom-background', 'mom-hero', 'settings-preview'];
const roleViewBox = {
  'baby-background': '0 0 1000 2200', 'baby-hero': '0 0 1000 860',
  'mom-background': '0 420 1000 1780', 'mom-hero': '0 360 1000 760', 'settings-preview': '0 0 1000 820'
};

function crop(source, theme, mode, role){
  return source
    .replace(/viewBox="[^"]+"/, `viewBox="${roleViewBox[role]}"`)
    .replace(/aria-label="[^"]+"/, `aria-label="${theme} ${mode} ${role.replaceAll('-', ' ')} background"`);
}

let written = 0;
for(const theme of WORLD_IDS){
  for(const mode of ['light', 'dark']){
    const source = WORLDS[theme][mode]();
    const dir = path.join(root, 'assets/themes-v2', theme, mode);
    fs.mkdirSync(dir, {recursive: true});
    for(const role of roles){
      fs.writeFileSync(path.join(dir, `${role}.svg`), crop(source, theme, mode, role));
      written++;
    }
  }
}
console.log(`Generated ${written} self-contained theme backgrounds.`);
