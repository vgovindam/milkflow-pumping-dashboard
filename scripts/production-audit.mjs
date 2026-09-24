import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const version=JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8')).version;
const fail=[];
const must=['index.html','styles.css','theme.css','component-theme.css','component-theme-core.css','experience-themes.css','experience-system.css','experience-components.css','doctor-summary.css','app.js','cross-device-alerts.js','experience-theme.js','sw.js','manifest.webmanifest','build-manifest.json','icon.svg','milkflow-family-v3-192.png'];
for(const f of must)if(!fs.existsSync(path.join(DIST,f)))fail.push(`missing dist/${f}`);
const themes=['safari','butterfly','princess'];
for(const theme of themes){
  if(!fs.existsSync(path.join(DIST,`assets/theme-icons/${theme}.svg`)))fail.push(`missing dist/assets/theme-icons/${theme}.svg`);
  for(const mode of ['light','dark'])for(const role of ['baby-background','baby-hero','mom-background','mom-hero','settings-preview']){
    const rel=`assets/themes-v2/${theme}/${mode}/${role}.svg`;if(!fs.existsSync(path.join(DIST,rel)))fail.push(`missing dist/${rel}`);
  }
}
const textFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:html|css|js|json|webmanifest|svg)$/.test(e.name))textFiles.push(p);}}
if(fs.existsSync(DIST))walk(DIST);
const combined=textFiles.map(p=>fs.readFileSync(p,'utf8')).join('\n');
if(/stable45-human\d+/i.test(combined))fail.push('legacy humanNN build identifier leaked into dist');
const index=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
for(const bad of ['component-theme-v2.css','component-theme-v3.css','experience-theme-v2.js','experience-theme-v3.js','experience-art-v2.css','jungle-theme.css'])if(index.includes(bad))fail.push(`legacy production entry referenced: ${bad}`);
if(!index.includes(`theme.css?v=${version}`)||!index.includes(`experience-theme.js?v=${version}`))fail.push('index.html does not use canonical versioned theme entrypoints');
if(!index.includes(`milkflow-family-v3-192.png?v=${version}`))fail.push('iPhone/browser icon is not versioned to the canonical v3 MilkFlow family artwork');
for(const legacyIcon of ['milkflow-family-apple-touch.png','milkflow-family-icon-192.png','milkflow-family-icon-512.png','milkflow-family-maskable-512.png'])if(index.includes(legacyIcon)||fs.existsSync(path.join(DIST,legacyIcon)))fail.push(`legacy app icon still ships in production: ${legacyIcon}`);
const themeEntry=fs.readFileSync(path.join(DIST,'theme.css'),'utf8');
if(!themeEntry.includes(`experience-components.css?v=${version}`))fail.push('canonical themed component stylesheet missing from deployed theme entry');
const experience=fs.readFileSync(path.join(DIST,'experience-theme.js'),'utf8');
const experienceCss=fs.readFileSync(path.join(DIST,'experience-system.css'),'utf8');
for(const theme of themes){
  if(!experience.includes(`assetSet('${theme}')`))fail.push(`${theme} asset matrix missing from deployed theme runtime`);
  if(!experience.includes(`theme-icons/${theme}.svg`))fail.push(`${theme} icon sprite missing from deployed theme runtime`);
  for(const mode of ['light','dark'])for(const role of ['baby-background','baby-hero','mom-background','mom-hero','settings-preview']){
    const rel=`assets/themes-v2/${theme}/${mode}/${role}.svg`,full=path.join(DIST,rel);
    const svg=fs.readFileSync(full,'utf8');
    if(svg.includes('<image ')||svg.includes('href="../'))fail.push(`${theme} scene still uses nested image/SVG dependencies`);
    if(svg.length<4500)fail.push(`${rel} fallback is too sparse`);
  }
}
if(experience.includes('theme-details/'))fail.push('deployed controller still stacks a separate detail SVG instead of using one self-contained scene');
if(experienceCss.includes('--mf-theme-detail'))fail.push('deployed theme CSS still depends on a separate detail layer');
if(experienceCss.includes('content:var(--mf-theme-name)'))fail.push('deployed theme CSS still renders theme-name hero badges');
for(const token of ['body[data-screen="settings"] .main','var(--mf-theme-baby-scene)','var(--mf-theme-mom-scene)','var(--mf-theme-baby-hero)','var(--mf-theme-mom-hero)','body[data-screen="baby-home"] .mf-animal-hero','body[data-screen="mom-home"] .mf-dream-hero','data-theme="dark"'])if(!experienceCss.includes(token))fail.push(`deployed immersive/light-dark theme contract missing: ${token}`);
const manifestPwa=JSON.parse(fs.readFileSync(path.join(DIST,'manifest.webmanifest'),'utf8'));
if(!manifestPwa.icons?.some(i=>i.src==='milkflow-family-v3-192.png'))fail.push('PWA manifest missing canonical v3 MilkFlow icon');
/* The icon set regressed once by omission rather than by breakage: only the 192 and the SVG
   were listed for copy, so a 512 and a maskable existed in the repo but never shipped, and
   Android upscaled a 192 for splash screens and letterboxed the launcher icon. Assert the
   whole set reaches dist/ and that the manifest still declares both purposes. */
for(const icon of ['milkflow-family-v3-192.png','icon-512.png','icon-maskable-512.png','apple-touch-icon.png','favicon.ico','icon.svg'])
  if(!fs.existsSync(path.join(DIST,icon)))fail.push(`app icon missing from production build: ${icon}`);
if(!manifestPwa.icons?.some(i=>i.sizes==='512x512'&&i.purpose!=='maskable'))fail.push('PWA manifest has no 512px icon for install/splash');
if(!manifestPwa.icons?.some(i=>i.purpose==='maskable'))fail.push('PWA manifest has no maskable icon for Android adaptive launchers');
if(!index.includes('apple-touch-icon.png?v='))fail.push('iOS home screen icon is not the purpose-built 180px asset');
for(const src of ['milkflow-family-icon-192.png','milkflow-family-icon-512.png','milkflow-family-maskable-512.png','milkflow-family-apple-touch.png'])if(manifestPwa.icons?.some(i=>i.src===src))fail.push(`PWA manifest still references legacy icon: ${src}`);
const sw=fs.readFileSync(path.join(DIST,'sw.js'),'utf8');
if(!sw.includes(`milkflow-v${version}`))fail.push('service-worker cache version does not match version.json');
if(!sw.includes("icon:'./milkflow-family-v3-192.png'"))fail.push('push notifications do not use the canonical v3 MilkFlow icon');
if(sw.includes('./assets/themes-v2/'))fail.push('service-worker install shell eagerly downloads the 40-asset theme matrix');
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
console.log(`Production audit passed for MilkFlow ${version}: detailed theme worlds, canonical v3 PWA artwork, dark-mode readability, service worker, data key, and notification contract are aligned.`);
