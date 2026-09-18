import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const themes=['safari','butterfly','princess','unicorn'];
const roles=['baby-background','baby-hero','mom-background','mom-hero','settings-preview'];
const darkPalettes={
  safari:[['#bfe7ff','#182b35'],['#e8f5dd','#263a31'],['#f8e9bd','#6a5a39'],['#d9c598','#302d24'],['#fffad2','#dfcf91'],['#fff4a6','#8a7442']],
  butterfly:[['#cfeeff','#18263d'],['#ece6ff','#332743'],['#ffe7f2','#4b293d'],['#f7efcf','#50472e'],['#fff9d9','#dad09c']],
  princess:[['#cfe5ff','#17233d'],['#dfd6ff','#302642'],['#ffd7df','#4a273b'],['#ffeabf','#51432b'],['#fff6c7','#e0cf99']],
  unicorn:[['#b8c9ff','#151f3f'],['#cfbfff','#2c2450'],['#f1c6f1','#43284d'],['#ffdce8','#4c2a41'],['#f8eac9','#4d452f'],['#fff9cb','#e1d59e'],['#ffeaa5','#9c854b']]
};
const roleViewBox={
  'baby-background':'0 0 1000 2200','baby-hero':'0 0 1000 860',
  'mom-background':'0 420 1000 1780','mom-hero':'0 360 1000 760','settings-preview':'0 0 1000 820'
};

function tune(source,theme,mode,role){
  let svg=source.replace(/viewBox="[^"]+"/,`viewBox="${roleViewBox[role]}"`)
    .replace(/aria-label="[^"]+"/,`aria-label="${theme} ${mode} ${role.replaceAll('-',' ')} illustration"`);
  if(mode==='dark') for(const [from,to] of darkPalettes[theme]) svg=svg.replaceAll(from,to);
  const tone=mode==='dark'
    ? '<rect width="1000" height="2200" fill="#070b13" opacity=".18"/>'
    : role.startsWith('mom-')?'<rect width="1000" height="2200" fill="#fffaf5" opacity=".10"/>':'';
  if(tone) svg=svg.replace(/(<rect width="1000" height="2200"[^>]*\/?>)/,`$1${tone}`);
  return svg;
}

for(const theme of themes){
  const source=fs.readFileSync(path.join(root,'assets/theme-composite',`${theme}.svg`),'utf8');
  for(const mode of ['light','dark']){
    const dir=path.join(root,'assets/themes-v2',theme,mode);fs.mkdirSync(dir,{recursive:true});
    for(const role of roles) fs.writeFileSync(path.join(dir,`${role}.svg`),tune(source,theme,mode,role));
  }
}
console.log(`Generated ${themes.length*2*roles.length} self-contained theme assets.`);
