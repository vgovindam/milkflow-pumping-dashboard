import fs from 'node:fs';
import path from 'node:path';

/* One painting per realm per mode. Everything else is a crop of it.
 *
 * Each theme was shipping the same picture five or six times: the full source art, three
 * widths of a background crop, two widths of a hero crop, a second "generated" hero, and a
 * settings preview. 21.5MB across nine worlds, and seven of them had no responsive widths at
 * all - a phone downloaded the full-resolution painting.
 *
 * The background plate is the keeper. It already exists for every theme at three widths, and
 * the hero was only ever its top 40%, which CSS does with background-position. So the hero,
 * the preview and the page all point at one file, the browser caches it once, and they can no
 * longer drift apart.
 */
const ROOT = process.cwd();
const KEEP = /-background@(480|720|941)\.webp$/;
const base = path.join(ROOT, 'assets/themes-v2');
let freed = 0, removed = 0, kept = 0;

for(const theme of fs.readdirSync(base)){
  for(const mode of ['light', 'dark']){
    const dir = path.join(base, theme, mode);
    if(!fs.existsSync(dir)) continue;
    for(const file of fs.readdirSync(dir)){
      const full = path.join(dir, file);
      if(KEEP.test(file)){ kept++; continue; }
      freed += fs.statSync(full).size;
      fs.rmSync(full);
      removed++;
    }
    for(const realm of ['baby', 'mom'])
      for(const w of [480, 720, 941])
        if(!fs.existsSync(path.join(dir, `${realm}-background@${w}.webp`)))
          throw new Error(`${theme}/${mode} is missing ${realm}-background@${w}.webp — cannot consolidate onto a plate that is not there`);
  }
}
console.log(`Kept ${kept} plates, removed ${removed} redundant files, freed ${(freed / 1048576).toFixed(1)}MB.`);
