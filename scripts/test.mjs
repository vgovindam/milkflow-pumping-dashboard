import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(cmd,args,{cwd=ROOT}={}){
  const r=spawnSync(cmd,args,{cwd,stdio:'inherit',encoding:'utf8'});
  if(r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed with ${r.status}`);
}
const js=[
  'app.js','app-reliability.js','cross-device-alerts.js','core-ui.js','experience-theme.js','render-lifecycle.js','plan-reliability.js','network-reliability.js','ai-coach-client.js','app-update-notice.js','family-chat.js','doctor-summary.js','release-info.js','sw.template.js',
  'functions/index.js','functions/index-entry.js','functions/family-chat.js','functions/pump-context.js','functions/cross-device-alerts.js'
];
for(const file of js){if(!fs.existsSync(path.join(ROOT,file)))throw new Error(`Missing required JavaScript: ${file}`);run(process.execPath,['--check',file]);}
run(process.execPath,['scripts/ui-audit.mjs']);
run(process.execPath,['scripts/interaction-audit.mjs']);
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'core-ui.js'),'utf8');
const alerts=fs.readFileSync(path.join(ROOT,'cross-device-alerts.js'),'utf8');
const experience=fs.readFileSync(path.join(ROOT,'experience-theme.js'),'utf8');
const experienceSystem=fs.readFileSync(path.join(ROOT,'experience-system.css'),'utf8');
const themedComponents=fs.readFileSync(path.join(ROOT,'experience-components.css'),'utf8');
const themeEntry=fs.readFileSync(path.join(ROOT,'theme.css'),'utf8');
if(!app.includes("STATE_KEY = 'milkflow-family-v4-state'")&&!app.includes("STATE_KEY='milkflow-family-v4-state'"))throw new Error('Data-contract check failed: canonical localStorage state key changed.');
if(!app.includes('function unionById'))throw new Error('Data-contract check failed: merge-by-id logic missing.');
if(!core.includes("const STATE_KEY='milkflow-family-v4-state'"))throw new Error('Core UI is not bound to the canonical state key.');
for(const token of ['milkflow-device-id-v1','sourceDeviceId',"collection('devices')"]){if(!alerts.includes(token))throw new Error(`Cross-device alert contract missing: ${token}`);}

const themeAssets={safari:'safari-world.svg',butterfly:'butterfly-garden.svg',princess:'princess-palace.svg',unicorn:'unicorn-dreams.svg'};
for(const [theme,baseFile] of Object.entries(themeAssets)){
  for(const rel of [`assets/themes/${baseFile}`,`assets/theme-details/${theme}.svg`,`assets/theme-icons/${theme}.svg`])if(!fs.existsSync(path.join(ROOT,rel)))throw new Error(`Theme asset contract missing: ${rel}`);
  if(!experience.includes(`assets/themes/${baseFile}`))throw new Error(`Theme manifest is not using self-contained ${theme} base scene.`);
  if(!experience.includes(`theme-details/${theme}.svg`))throw new Error(`Theme manifest is not layering ${theme} detail art.`);
  if(!experience.includes(`theme-icons/${theme}.svg`))throw new Error(`Theme manifest is not using independent ${theme} icon sprite.`);
  if(!experienceSystem.includes(`assets/themes/${baseFile}`))throw new Error(`Theme CSS fallback is not using self-contained ${theme} base scene.`);
  if(!experienceSystem.includes(`theme-details/${theme}.svg`))throw new Error(`Theme CSS fallback is not using ${theme} detail layer.`);
}
for(const token of ['--mf-icon-sprite','.mf-feed-card::after','.mf-diaper-blob::after','.mf-dream-actions .quick-tile','.mf-settings-theme-panel','.mf-settings-shortcuts','.mf-settings-motto'])if(!themedComponents.includes(token))throw new Error(`Independent theme component contract missing: ${token}`);
for(const token of ['Choose a theme','Make this little adventure yours','Profile &amp; Personalization','Different themes.','mf-preview-base','mf-preview-detail'])if(!experience.includes(token))throw new Error(`Settings storybook contract missing: ${token}`);
for(const token of ['.mf-animal-hero::before','.mf-animal-hero::after','.mf-feed-card::before','.mf-diaper-blob::before','.mf-animal-checkin::before','display:none!important','visibility:hidden!important','min-height:136px!important','padding:78px 11px 15px!important'])if(!themeEntry.includes(token))throw new Error(`Single-layer Baby visual contract missing: ${token}`);
for(const token of ['.mf-dream-hero::before','.mf-dream-hero::after','content:none!important','var(--mf-theme-detail),var(--mf-theme-art)','background-image:linear-gradient(180deg,rgba(255,255,255,.04)','background-image:linear-gradient(180deg,rgba(5,8,13,.34)','color:var(--mf-world-text)!important','body[data-screen="settings"] .main'])if(!experienceSystem.includes(token))throw new Error(`Theme scene/contrast contract missing: ${token}`);
if(experienceSystem.includes('content:var(--mf-theme-name)'))throw new Error('Theme names must not be rendered as hero badges.');
if(experience.includes('theme-composite/'))throw new Error('Theme previews/runtime must not depend on nested-resource composite SVGs.');
console.log('MilkFlow test suite passed: syntax, UI contracts, self-contained visible theme scenes, layered details, no hero theme labels, light/dark contrast, single-layer ownership, Settings experience, data preservation, and notification identity.');
