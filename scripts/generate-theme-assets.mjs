import fs from 'node:fs';
import path from 'node:path';

/* Ten files per theme from one authored scene per mode.
 *
 * The five roles are crops of the same 1000x2200 composite, so a change to a scene moves all
 * of them together and they cannot drift apart. Light and dark are separate authored scenes:
 * the previous generation derived dark by replacing hex values in the light artwork, which
 * turned four different worlds into the same dark murk with the subject barely visible.
 */
const root = process.cwd();
const themes = ['deepspace', 'aurora', 'neonreef', 'crystalcity'];
const roles = ['baby-background', 'baby-hero', 'mom-background', 'mom-hero', 'settings-preview'];
const roleViewBox = {
  'baby-background': '0 0 1000 2200', 'baby-hero': '0 0 1000 860',
  'mom-background': '0 420 1000 1780', 'mom-hero': '0 360 1000 760', 'settings-preview': '0 0 1000 820'
};

function crop(source, theme, mode, role){
  return source
    .replace(/viewBox="[^"]+"/, `viewBox="${roleViewBox[role]}"`)
    .replace(/aria-label="[^"]+"/, `aria-label="${theme} ${mode} ${role.replaceAll('-', ' ')} illustration"`);
}

let written = 0;
for(const theme of themes){
  const scene = await import(`./theme-scenes/${theme}.mjs`);
  for(const mode of ['light', 'dark']){
    const source = scene[mode]();
    const dir = path.join(root, 'assets/themes-v2', theme, mode);
    fs.mkdirSync(dir, {recursive: true});
    for(const role of roles){
      fs.writeFileSync(path.join(dir, `${role}.svg`), crop(source, theme, mode, role));
      written++;
    }
  }
}
console.log(`Generated ${written} self-contained theme assets.`);
