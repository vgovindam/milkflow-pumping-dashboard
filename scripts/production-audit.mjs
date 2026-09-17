import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const version=JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8')).version;
const fail=[];
const must=['index.html','styles.css','theme.css','component-theme.css','component-theme-core.css','experience-themes.css','experience-system.css','experience-components.css','doctor-summary.css','app.js','cross-device-alerts.js','experience-theme.js','sw.js','manifest.webmanifest','build-manifest.json','icon.svg','milkflow-family-icon-192.png','milkflow-family-icon-512.png','milkflow-family-maskable-512.png','milkflow-family-apple-touch.png'];
for(const f of must)if(!fs.existsSync(path.join(DIST,f)))fail.push(`missing dist/${f}`);
const themes=['safari','butterfly','princess','unicorn'];
for(const theme of themes)for(const rel of [`assets/theme-composite/${theme}.svg`,`assets/theme-icons/${theme}.svg`])if(!fs.existsSync(path.join(DIST,rel)))fail.push(`missing dist/${rel}`);
const textFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:html|css|js|json|webmanifest|svg)$/.test(e.name))textFiles.push(p);}}
if(fs.existsSync(DIST))walk(DIST);
const combined=textFiles.map(p=>fs.readFileSync(p,'utf8')).join('\n');
if(/stable45-human\d+/i.test(combined))fail.push('legacy humanNN build identifier leaked into dist');
const index=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
for(const bad of ['component-theme-v2.css','component-theme-v3.css','experience-theme-v2.js','experience-theme-v3.js','experience-art-v2.css','jungle-theme.css'])if(index.includes(bad))fail.push(`legacy production entry referenced: ${bad}`);
if(!index.includes(`theme.css?v=${version}`)||!index.includes(`experience-theme.js?v=${version}`))fail.push('index.html does not use canonical versioned theme entrypoints');
if(!index.includes(`milkflow-family-apple-touch.png?v=${version}`))fail.push('iPhone Home Screen icon is not versioned to the new MilkFlow family artwork');
const themeEntry=fs.readFileSync(path.join(DIST,'theme.css'),'utf8');
if(!themeEntry.includes(`experience-components.css?v=${version}`))fail.push('canonical themed component stylesheet missing from deployed theme entry');
const experience=fs.readFileSync(path.join(DIST,'experience-theme.js'),'utf8');
const experienceCss=fs.readFileSync(path.join(DIST,'experience-system.css'),'utf8');
for(const theme of themes){
  const rel=`assets/theme-composite/${theme}.svg`;
  const full=path.join(DIST,rel);
  if(!experience.includes(`theme-composite/${theme}.svg`)||!experienceCss.includes(rel))fail.push(`${theme} self-contained detailed scene missing from deployed theme runtime`);
  if(!experience.includes(`theme-icons/${theme}.svg`))fail.push(`${theme} icon sprite missing from deployed theme runtime`);
  if(fs.existsSync(full)){
    const svg=fs.readFileSync(full,'utf8');
    if(svg.includes('<image ')||svg.includes('href="../'))fail.push(`${theme} scene still uses nested image/SVG dependencies`);
    if(!svg.includes('viewBox="0 0 1000 2200"')||svg.length<4500)fail.push(`${theme} scene is not the detailed vertical production artwork`);
  }
}
if(experience.includes('theme-details/'))fail.push('deployed controller still stacks a separate detail SVG instead of using one self-contained scene');
if(experienceCss.includes('--mf-theme-detail'))fail.push('deployed theme CSS still depends on a separate detail layer');
if(experienceCss.includes('content:var(--mf-theme-name)'))fail.push('deployed theme CSS still renders theme-name hero badges');
for(const token of ['body[data-screen="settings"] .main','var(--mf-theme-art)','body[data-screen="baby-home"] .mf-animal-hero','body[data-screen="mom-home"] .mf-dream-hero','data-theme="dark"'])if(!experienceCss.includes(token))fail.push(`deployed immersive/light-dark theme contract missing: ${token}`);
const manifestPwa=JSON.parse(fs.readFileSync(path.join(DIST,'manifest.webmanifest'),'utf8'));
for(const src of ['milkflow-family-icon-192.png','milkflow-family-icon-512.png','milkflow-family-maskable-512.png','milkflow-family-apple-touch.png'])if(!manifestPwa.icons?.some(i=>i.src===src))fail.push(`PWA manifest missing new branded icon: ${src}`);
const sw=fs.readFileSync(path.join(DIST,'sw.js'),'utf8');
if(!sw.includes(`milkflow-v${version}`))fail.push('service-worker cache version does not match version.json');
const manifest=JSON.parse(fs.readFileSync(path.join(DIST,'build-manifest.json'),'utf8'));
if(manifest.version!==version)fail.push('build-manifest version mismatch');
if(!fs.readFileSync(path.join(DIST,'app.js'),'utf8').includes('milkflow-family-v4-state'))fail.push('canonical state key missing from production app.js');
if(!fs.readFileSync(path.join(DIST,'cross-device-alerts.js'),'utf8').includes('milkflow-device-id-v1'))fail.push('cross-device notification identity missing from production');
for(const ref of [...index.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m=>m[1])){
  if(/^https?:/.test(ref))continue;
  const rel=ref.split('?')[0].split('#')[0].replace(/^\.\//,'');
  if(rel&&!fs.existsSync(path.join(DIST,rel)))fail.push(`broken index reference: ${ref}`);
}
if(fail.length){console.error(fail.map(x=>`- ${x}`).join('\n'));process.exit(1);}
console.log(`Production audit passed for MilkFlow ${version}: detailed self-contained theme worlds, independent components, branded PWA icons, light/dark contract, service worker, data key, and notification contract are aligned.`);
