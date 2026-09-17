import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const DIST=path.join(ROOT,'dist');
const version=JSON.parse(fs.readFileSync(path.join(ROOT,'version.json'),'utf8')).version;
const fail=[];
const must=['index.html','styles.css','theme.css','component-theme.css','component-theme-core.css','experience-themes.css','experience-system.css','experience-components.css','doctor-summary.css','app.js','cross-device-alerts.js','experience-theme.js','sw.js','manifest.webmanifest','build-manifest.json'];
for(const f of must)if(!fs.existsSync(path.join(DIST,f)))fail.push(`missing dist/${f}`);
for(const theme of ['safari','butterfly','princess','unicorn'])for(const rel of [`assets/theme-icons/${theme}.svg`,`assets/theme-details/${theme}.svg`,`assets/theme-composite/${theme}.svg`])if(!fs.existsSync(path.join(DIST,rel)))fail.push(`missing dist/${rel}`);
const textFiles=[];
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else if(/\.(?:html|css|js|json|webmanifest|svg)$/.test(e.name))textFiles.push(p);}}
if(fs.existsSync(DIST))walk(DIST);
const combined=textFiles.map(p=>fs.readFileSync(p,'utf8')).join('\n');
if(/stable45-human\d+/i.test(combined))fail.push('legacy humanNN build identifier leaked into dist');
const index=fs.readFileSync(path.join(DIST,'index.html'),'utf8');
for(const bad of ['component-theme-v2.css','component-theme-v3.css','experience-theme-v2.js','experience-theme-v3.js','experience-art-v2.css','jungle-theme.css'])if(index.includes(bad))fail.push(`legacy production entry referenced: ${bad}`);
if(!index.includes(`theme.css?v=${version}`)||!index.includes(`experience-theme.js?v=${version}`))fail.push('index.html does not use canonical versioned theme entrypoints');
const themeEntry=fs.readFileSync(path.join(DIST,'theme.css'),'utf8');
if(!themeEntry.includes(`experience-components.css?v=${version}`))fail.push('canonical themed component stylesheet missing from deployed theme entry');
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
console.log(`Production audit passed for MilkFlow ${version}: canonical assets, independent theme components, service worker, data key, and notification contract are aligned.`);
