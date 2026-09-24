import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const html=read('index.html');
const theme=read('theme.css');
const component=read('component-theme.css');
const experienceSystem=read('experience-system.css');
const build=read('scripts/build.mjs');
const problems=[];

const localStyles=[...html.matchAll(/<link[^>]+rel=["']stylesheet["'][^>]+href=["']([^"']+)["']/g)]
  .map(m=>m[1]).filter(x=>!/^https?:/.test(x)).map(x=>x.split('?')[0]);
const expected=['styles.css','theme.css','doctor-summary.css'];
if(JSON.stringify(localStyles)!==JSON.stringify(expected))problems.push(`index.html local stylesheet order must be exactly ${expected.join(', ')}; got ${localStyles.join(', ')}`);

for(const forbidden of ['component-theme-v2.css','component-theme-v3.css','experience-art-v2.css','jungle-theme.css','dark-contrast.css','layout-fixes.css','care-polish.css','baby-compact.css']){
  if(html.includes(forbidden)||theme.includes(forbidden))problems.push(`Legacy/patch stylesheet referenced in production: ${forbidden}`);
}
if(!theme.includes('component-theme.css')||!theme.includes('experience-system.css')||!theme.includes('experience-components.css')||!theme.includes('layer(milkflow-experience)'))problems.push('theme.css must be the canonical component + experience entrypoint with explicit experience-layer imports.');
if(!component.includes('@layer milkflow-core, milkflow-experience, milkflow-controls, milkflow-selection'))problems.push('component-theme.css is missing the explicit cascade-layer contract.');
const cssFiles=['styles.css','component-theme-core.css',component,'experience-system.css','experience-components.css'].map(x=>typeof x==='string'&&x.endsWith('.css')?read(x):x);
if(/(?:^|})\s*svg\s*\{[^}]*display\s*:\s*none/ims.test(cssFiles.join('\n')))problems.push('Global svg { display:none } rule is forbidden. Scope decorative artwork hiding to a component.');
if(/(?:component|experience|theme|layout|contrast|polish|fix)(?:ed|es)?[-_.](?:v\d+|new|final|fixed)\.css/i.test(theme))problems.push('Canonical theme entry cannot depend on version/final/fixed CSS filenames.');
if(/Element\.prototype\.innerHTML/.test([read('app-reliability.js'),read('core-ui.js'),read('experience-theme.js'),read('render-lifecycle.js')].join('\n')))problems.push('Global innerHTML monkey patch is forbidden.');
if(/subtree\s*:\s*true/.test(read('render-lifecycle.js')))problems.push('Broad subtree MutationObserver is forbidden in render-lifecycle.js.');

if(build.includes("'experience-themes.css'"))problems.push('Dead experience-themes.css must not ship in the production build.');
for(const themeId of ['safari','butterfly','princess']){
  const light=(experienceSystem.match(new RegExp(`:root\\[data-experience-theme="${themeId}"\\]\\s*\\{`,'g'))||[]).length;
  const dark=(experienceSystem.match(new RegExp(`:root\\[data-theme="dark"\\]\\[data-experience-theme="${themeId}"\\]\\s*\\{`,'g'))||[]).length;
  if(light!==1)problems.push(`Active theme ${themeId} must have exactly one light token block; found ${light}.`);
  if(dark!==1)problems.push(`Active theme ${themeId} must have exactly one dark token block; found ${dark}.`);
}
for(const stale of ['Nocturne','Tide','Ember','Meadow']){
  if(experienceSystem.includes(`--mf-theme-name:"${stale}"`))problems.push(`Retired theme label leaked into active theme tokens: ${stale}.`);
}

const importantFiles=['styles.css','component-theme-core.css','component-theme.css','experience-system.css','experience-components.css','doctor-summary.css'];
const importantCounts=Object.fromEntries(importantFiles.map(f=>[f,(read(f).match(/!important/g)||[]).length]));
const debt=Object.values(importantCounts).reduce((a,b)=>a+b,0);
const IMPORTANT_BASELINE=537;
if(debt>IMPORTANT_BASELINE)problems.push(`Runtime !important debt increased above baseline ${IMPORTANT_BASELINE}: ${debt}. Reduce or justify existing debt; do not add new override debt.`);
console.log(`CSS architecture audit: ${localStyles.length} production stylesheet entries; runtime !important debt=${debt}; by file=${JSON.stringify(importantCounts)}. New patch stylesheets are blocked.`);
if(problems.length){console.error(problems.map(x=>`- ${x}`).join('\n'));process.exit(1);}
