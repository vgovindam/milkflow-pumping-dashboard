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
const componentTheme=fs.readFileSync(path.join(ROOT,'component-theme.css'),'utf8');
const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const manifestPwa=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
const swTemplate=fs.readFileSync(path.join(ROOT,'sw.template.js'),'utf8');
if(!app.includes("STATE_KEY = 'milkflow-family-v4-state'")&&!app.includes("STATE_KEY='milkflow-family-v4-state'"))throw new Error('Data-contract check failed: canonical localStorage state key changed.');
if(!app.includes('function unionById'))throw new Error('Data-contract check failed: merge-by-id logic missing.');
if(!core.includes("const STATE_KEY='milkflow-family-v4-state'"))throw new Error('Core UI is not bound to the canonical state key.');
for(const token of ['milkflow-device-id-v1','sourceDeviceId',"collection('devices')"]){if(!alerts.includes(token))throw new Error(`Cross-device alert contract missing: ${token}`);}
const familyChat=fs.readFileSync(path.join(ROOT,'family-chat.js'),'utf8');
const familyChatServer=fs.readFileSync(path.join(ROOT,'functions/family-chat.js'),'utf8');
for(const token of ["PENDING_KEY='milkflow-family-chat-pending-v1'",'recoverCloudRequest','recoverLegacyHistory','resumePending','retryRequest',"mode:'status'",'requestId'])if(!familyChat.includes(token))throw new Error(`Family chat recovery contract missing: ${token}`);
for(const token of ["collection('familyChatRequests')", "mode==='status'", "status:'processing'", "status:'completed'", "${requestId}-user", "${requestId}-assistant"] )if(!familyChatServer.includes(token))throw new Error(`Family chat server recovery contract missing: ${token}`);

const themes=['safari','butterfly','princess','unicorn'];
for(const theme of themes){
  const scene=`assets/theme-composite/${theme}.svg`,icons=`assets/theme-icons/${theme}.svg`;
  for(const rel of [scene,icons])if(!fs.existsSync(path.join(ROOT,rel)))throw new Error(`Theme asset contract missing: ${rel}`);
  const svg=fs.readFileSync(path.join(ROOT,scene),'utf8');
  if(svg.includes('<image ')||svg.includes('href="../'))throw new Error(`${scene} must be fully self-contained; nested SVG/image references are not allowed.`);
  if(!svg.includes('viewBox="0 0 1000 2200"'))throw new Error(`${scene} must remain a tall 1000x2200 immersive world.`);
  if(svg.length<4500)throw new Error(`${scene} is too sparse to qualify as the detailed production backdrop.`);
  if(!experience.includes(`theme-composite/${theme}.svg`))throw new Error(`Theme manifest is not using detailed ${theme} scene.`);
  if(!experience.includes(`theme-icons/${theme}.svg`))throw new Error(`Theme manifest is not using independent ${theme} icon sprite.`);
  if(!experienceSystem.includes(`theme-composite/${theme}.svg`))throw new Error(`Theme CSS is not using detailed ${theme} scene.`);
}
for(const token of ['--mf-icon-sprite','.mf-feed-card::after','.mf-diaper-blob::after','.mf-dream-actions .quick-tile','.mf-settings-theme-panel','.mf-settings-shortcuts','.mf-settings-motto'])if(!themedComponents.includes(token))throw new Error(`Independent theme component contract missing: ${token}`);
for(const token of ['Choose a theme','Make this little adventure yours','Profile &amp; Personalization','Different themes.','mf-preview-scene'])if(!experience.includes(token))throw new Error(`Settings storybook contract missing: ${token}`);
for(const token of ['.mf-animal-hero::before','.mf-animal-hero::after','.mf-feed-card::before','.mf-diaper-blob::before','.mf-animal-checkin::before','display:none!important','visibility:hidden!important','min-height:136px!important','padding:78px 11px 15px!important'])if(!themeEntry.includes(token))throw new Error(`Single-layer Baby visual contract missing: ${token}`);
for(const token of ['.mf-dream-hero::before','.mf-dream-hero::after','content:none!important','var(--mf-theme-art)','body[data-screen="settings"] .main','body[data-screen="baby-home"] .mf-animal-hero','body[data-screen="mom-home"] .mf-dream-hero','color:var(--mf-world-text)!important'])if(!experienceSystem.includes(token))throw new Error(`Theme scene/contrast contract missing: ${token}`);
if(experienceSystem.includes('content:var(--mf-theme-name)'))throw new Error('Theme names must not be rendered as hero badges.');
if(experienceSystem.includes('--mf-theme-detail')||experience.includes('theme-details/'))throw new Error('Runtime theme composition must use one self-contained scene, not stacked detail/backdrop files.');
for(const token of ['.metric strong','.panel-head button','.round-action'])if(!componentTheme.includes(token))throw new Error(`Dark readability contract missing: ${token}`);
for(const token of ['.mf-dream-progress strong','.mf-dream-next button','.mf-dream-metrics .metric strong','.mf-dream-journey .mf-journey-stop strong'])if(!experienceSystem.includes(token))throw new Error(`Mom dark readability contract missing: ${token}`);
if(!indexHtml.includes('milkflow-family-v3-192.png?v=__MILKFLOW_VERSION__'))throw new Error('Canonical v3 MilkFlow icon is not wired to iPhone/browser entry points.');
if(!manifestPwa.icons?.some(i=>i.src==='milkflow-family-v3-192.png'))throw new Error('Canonical v3 MilkFlow icon is missing from manifest.');
if(!swTemplate.includes("icon:'./milkflow-family-v3-192.png'"))throw new Error('Push notification icon is not the canonical v3 MilkFlow artwork.');

console.log('MilkFlow test suite passed: syntax, data and notification contracts, four detailed theme worlds, canonical v3 app icon wiring, dark-mode number/button readability, Settings experience, and single-layer ownership.');
