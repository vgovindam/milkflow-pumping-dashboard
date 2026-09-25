import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
function run(cmd,args,{cwd=ROOT}={}){
  const r=spawnSync(cmd,args,{cwd,stdio:'inherit',encoding:'utf8'});
  if(r.status!==0)throw new Error(`${cmd} ${args.join(' ')} failed with ${r.status}`);
}
const js=[
  'insights-engine.js','app.js','app-reliability.js','cross-device-alerts.js','core-ui.js','experience-theme.js','render-lifecycle.js','plan-reliability.js','network-reliability.js','ai-coach-client.js','app-update-notice.js','family-chat.js','doctor-summary.js','release-info.js','sw.template.js',
  'functions/index.js','functions/index-entry.js','functions/family-chat.js','functions/pump-context.js','functions/cross-device-alerts.js'
];
for(const file of js){if(!fs.existsSync(path.join(ROOT,file)))throw new Error(`Missing required JavaScript: ${file}`);run(process.execPath,['--check',file]);}
run(process.execPath,['scripts/ui-audit.mjs']);
run(process.execPath,['scripts/interaction-audit.mjs']);
const insights=fs.readFileSync(path.join(ROOT,'insights-engine.js'),'utf8');
const app=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
const core=fs.readFileSync(path.join(ROOT,'core-ui.js'),'utf8');
const baseStyles=fs.readFileSync(path.join(ROOT,'styles.css'),'utf8');
const alerts=fs.readFileSync(path.join(ROOT,'cross-device-alerts.js'),'utf8');
const experience=fs.readFileSync(path.join(ROOT,'experience-theme.js'),'utf8');
const experienceSystem=fs.readFileSync(path.join(ROOT,'experience-system.css'),'utf8');
const themedComponents=fs.readFileSync(path.join(ROOT,'experience-components.css'),'utf8');
const themeEntry=fs.readFileSync(path.join(ROOT,'theme.css'),'utf8');
const componentTheme=fs.readFileSync(path.join(ROOT,'component-theme.css'),'utf8');
const indexHtml=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const manifestPwa=JSON.parse(fs.readFileSync(path.join(ROOT,'manifest.webmanifest'),'utf8'));
const swTemplate=fs.readFileSync(path.join(ROOT,'sw.template.js'),'utf8');
{
  const sandbox={window:{}}; vm.createContext(sandbox); vm.runInContext(insights,sandbox,{filename:'insights-engine.js'});
  const engine=sandbox.window.MilkFlowInsights;
  if(!engine?.mom||!engine?.baby)throw new Error('Interpretation engine did not expose Mom and Baby models.');
  const mom=engine.mom({
    days:[500,510,520,530,610,620,630,640].map((totalMl,i)=>({date:'2026-09-'+String(i+1).padStart(2,'0'),totalMl})),
    sessions:[
      {date:'2026-09-05',time:'06:00',amountMl:190},{date:'2026-09-05',time:'10:30',amountMl:150},
      {date:'2026-09-06',time:'06:05',amountMl:195},{date:'2026-09-06',time:'10:35',amountMl:155}
    ],
    bands:[{label:'Morning',value:500},{label:'Afternoon',value:240}]
  });
  if(!mom.observations?.length||!mom.education?.[0]?.source?.url)throw new Error('Mom interpretation lacks observations or source provenance.');
  if(mom.observations[0].value!=='Higher')throw new Error('Mom interpretation failed to identify a clearly higher recent pattern.');
  const sparse=engine.baby({rows:[{feeds:1,bottleOz:3,wetTotal:1,diapers:1,sleepMin:40,logged:true}],ageDays:70,feedingPreference:'mostly_breastfed'});
  if(sparse.observations?.[1]?.value!=='Learning')throw new Error('Baby interpretation must not overstate sparse data.');
  const baby=engine.baby({
    rows:Array.from({length:8},(_,i)=>({feeds:i<4?6:7,bottleOz:i<4?16:18,wetTotal:i<4?5:6,diapers:i<4?6:7,sleepMin:600,logged:true})),
    ageDays:70,feedingPreference:'mostly_breastfed'
  });
  if(!baby.education?.some(x=>x.source?.id==='aap-safe-sleep'))throw new Error('Infant education should include safe-sleep provenance.');
  for(const model of [mom,baby]){
    if(!/educational guidance only/i.test(model.disclaimer||''))throw new Error('Interpretation model is missing the clinician disclaimer.');
    if(model.education?.some(x=>!x.source?.reviewed||!/^https:\/\//.test(x.source?.url||'')))throw new Error('Education source is missing URL/review metadata.');
  }
}
/* Sleep capture is two-way: start/end timer plus completed-entry fallback. Predictions are
   computed from this family's completed logs and active timers never enter historical totals. */
for(const token of ['activeSleep: null','function sleepPrediction(','function activeSleep(','function sleepStart(','async function sleepEnd(','function sleepReminderTick(','data-sleep-start','data-sleep-end','data-sleep-complete'])
  if(!app.includes(token))throw new Error(`Sleep workflow contract missing: ${token}`);
if(!app.includes("eventType==='sleep' && (+e.durationMinutes||0)>0"))throw new Error('Active/incomplete sleep must not be counted as a completed historical sleep.');
if(!core.includes('sleep-live'))throw new Error('Baby Home does not expose a running sleep timer.');
/* Print construction must finish before the native dialog is invoked. */
const doctorPrint=fs.readFileSync(path.join(ROOT,'doctor-summary.js'),'utf8');
for(const token of ['async function printReport()','await nextPaint();','window.print();','print: printReport'])
  if(!doctorPrint.includes(token))throw new Error(`Doctor print responsiveness contract missing: ${token}`);
if(!app.includes('printer?.print'))throw new Error('Doctor Print button is not delegated to the prepared report flow.');

if(!app.includes("STATE_KEY = 'milkflow-family-v4-state'")&&!app.includes("STATE_KEY='milkflow-family-v4-state'"))throw new Error('Data-contract check failed: canonical localStorage state key changed.');
if(!app.includes('function unionById'))throw new Error('Data-contract check failed: merge-by-id logic missing.');
if(!core.includes("const STATE_KEY='milkflow-family-v4-state'"))throw new Error('Core UI is not bound to the canonical state key.');
for(const token of ['milkflow-device-id-v1','sourceDeviceId',"collection('devices')"]){if(!alerts.includes(token))throw new Error(`Cross-device alert contract missing: ${token}`);}
const familyChat=fs.readFileSync(path.join(ROOT,'family-chat.js'),'utf8');
const familyChatServer=fs.readFileSync(path.join(ROOT,'functions/family-chat.js'),'utf8');
for(const token of ["PENDING_KEY='milkflow-family-chat-pending-v1'",'recoverCloudRequest','recoverLegacyHistory','resumePending','retryRequest',"mode:'status'",'requestId'])if(!familyChat.includes(token))throw new Error(`Family chat recovery contract missing: ${token}`);
for(const token of ["collection('familyChatRequests')", "mode==='status'", "status:'processing'", "status:'completed'", "${requestId}-user", "${requestId}-assistant"] )if(!familyChatServer.includes(token))throw new Error(`Family chat server recovery contract missing: ${token}`);

/* Three original themes use painted responsive plates; the six new worlds use authored,
   self-contained SVG scenes until a later art pass adds raster plates. Both are real runtime
   packages and both must provide separate Baby/Mom and light/dark scenes. */
const paintedThemes=['safari','butterfly','princess'];
const vectorThemes=['ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds'];
for(const theme of paintedThemes){
  const icons=`assets/theme-icons/${theme}.svg`;
  if(!fs.existsSync(path.join(ROOT,icons)))throw new Error(`Theme asset contract missing: ${icons}`);
  for(const mode of ['light','dark'])for(const role of ['baby-background','baby-hero','mom-background','mom-hero','settings-preview']){
    const scene=`assets/themes-v2/${theme}/${mode}/${role}.svg`;
    if(!fs.existsSync(path.join(ROOT,scene)))throw new Error(`Theme asset contract missing: ${scene}`);
    const svg=fs.readFileSync(path.join(ROOT,scene),'utf8');
    if(svg.includes('<image ')||svg.includes('href="../'))throw new Error(`${scene} must be fully self-contained.`);
    if(svg.length<4500)throw new Error(`${scene} fallback is too sparse to stand in for the plate.`);
  }
  for(const [role,widths] of [['baby-background',[480,720,941]],['baby-hero',[640,941]],['mom-background',[480,720,941]],['mom-hero',[640,941]]])
    for(const mode of ['light','dark'])for(const w of widths){
      const plate=`assets/themes-v2/${theme}/${mode}/${role}@${w}.webp`;
      const full=path.join(ROOT,plate);
      if(!fs.existsSync(full))throw new Error(`Painted plate missing: ${plate}`);
      if(fs.statSync(full).size<4000)throw new Error(`${plate} is too small to be a painted plate`);
    }
  for(const [role,w] of [['baby-background',941],['mom-background',941]]){
    const light=fs.readFileSync(path.join(ROOT,`assets/themes-v2/${theme}/light/${role}@${w}.webp`));
    const dark=fs.readFileSync(path.join(ROOT,`assets/themes-v2/${theme}/dark/${role}@${w}.webp`));
    if(light.equals(dark))throw new Error(`${theme}/${role} ships the same file for light and dark`);
  }
  if(!experience.includes(`assetSet('${theme}')`))throw new Error(`Theme manifest is not using the ${theme} painted asset matrix.`);
  if(!experience.includes(`theme-icons/${theme}.svg`))throw new Error(`Theme manifest is not using independent ${theme} icon sprite.`);
}
for(const theme of vectorThemes){
  const motif=`assets/theme-icons/${theme}-motif.svg`;
  if(!fs.existsSync(path.join(ROOT,motif)))throw new Error(`Vector theme motif missing: ${motif}`);
  for(const mode of ['light','dark'])for(const realm of ['baby','mom']){
    const scene=`assets/themes-v2/${theme}/${mode}/${realm}-background.svg`;
    const full=path.join(ROOT,scene);
    if(!fs.existsSync(full))throw new Error(`Vector theme scene missing: ${scene}`);
    const svg=fs.readFileSync(full,'utf8');
    if(svg.includes('<image ')||svg.includes('href="../'))throw new Error(`${scene} must be self-contained.`);
    if(svg.length<1600||!svg.includes('<linearGradient')||(!svg.includes('<path')&&!svg.includes('<ellipse')))throw new Error(`${scene} does not contain enough authored scene structure.`);
  }
  if(!experience.includes(`assetSet('${theme}')`))throw new Error(`Theme manifest is not using the ${theme} painted asset matrix.`);
  if(!experience.includes(`id:'${theme}',status:'ready'`))throw new Error(`${theme} is not promoted to a ready theme.`);
}
for(const token of ['--mf-icon-sprite','.mf-feed-card::after','.mf-diaper-blob::after','.mf-dream-actions .quick-tile','.mf-settings-theme-panel','.mf-settings-shortcuts'])if(!themedComponents.includes(token))throw new Error(`Independent theme component contract missing: ${token}`);
/* Appearance is ONE screen: the world picker, light/dark and sounds together. Settings keeps
   a single row that leads there. The picker used to be injected into both, with a separate
   Dark Mode row beside it - three places to change how the app looks. */
for(const token of ['Choose your family world','Make this little adventure yours','mf-preview-scene'])if(!experience.includes(token))throw new Error(`Appearance contract missing: ${token}`);
if(!experience.includes("if(screen!=='set-appearance')return;"))throw new Error('The world picker must live on Appearance only');
if(experience.includes("data-view=\"set-reminders\""))throw new Error('Appearance must not duplicate rows the Settings list already has');
/* The Baby single-layer contract: legacy decorative pseudo-elements stay suppressed. The
   card's own geometry is no longer pinned here - it moved next to the component in
   core-ui.js, where it needs no !important, so pinning pixel values in theme.css would
   only reintroduce the override this refactor removed. */
for(const token of ['.mf-animal-hero::before','.mf-animal-hero::after','.mf-feed-card::before','.mf-diaper-blob::before','.mf-animal-checkin::before','display:none!important','visibility:hidden!important'])if(!themeEntry.includes(token))throw new Error(`Single-layer Baby visual contract missing: ${token}`);
/* Quick-log card geometry has exactly one owner: the component's own stylesheet in
   core-ui.js, stated once per breakpoint and with no !important. Re-pinning it from a theme
   or experience file is what produced the override chain this architecture replaced. */
for(const [name,css] of [['theme.css',themeEntry],['experience-system.css',experienceSystem],['experience-components.css',themedComponents]])
  if(/\.mf-(feed-card|diaper-blob)\{[^}]*(padding|min-height|border-radius)\s*:[^;}]*!important/.test(css))
    throw new Error(`Quick-log card geometry is re-pinned in ${name}; it belongs to the component in core-ui.js`);
if(/\.mf-feed-card\{[^}]*!important/.test(core))throw new Error('Quick-log card geometry must not need !important inside its own component stylesheet');
if(!core.includes('height:117px;min-height:117px')||!core.includes('flex:0 0 88px;min-height:88px')||!core.includes('class="mf-tile-picture"')||!core.includes('class="mf-tile-copy"'))
  throw new Error('Feed and diaper illustrations need distinct short picture boxes with labels below.');
if(!core.includes('width:72px;height:72px')||!core.includes('width:62px;height:62px'))
  throw new Error('Theme art must fit inside the picture box at the intended smaller scale.');
if(core.includes('mf-tile-detail')||!core.includes('<strong>Mixed</strong><b>${st.both}</b></span></span></button>'))
  throw new Error('Diaper tiles must have one label line only.');
if(!core.includes('.rows .row[data-care-kind]')||!core.includes('background-image:linear-gradient(130deg,color-mix(in srgb,var(--care-fill) 44%'))
  throw new Error('Recent care entries need full-row activity palette fills.');
if(!fs.readFileSync(path.join(ROOT,'scripts/care-icons/parts.mjs'),'utf8').includes('r: 13, scale: 0.70'))
  throw new Error('The semantic care-action badges must remain large enough to recognize.');
if(!baseStyles.includes('.mobile-workspace{gap:3px;padding:3px;background:var(--line-soft);border-radius:999px')||!experienceSystem.includes('overflow:hidden;border-radius:999px'))
  throw new Error('The Mom/Baby persona switch must retain rounded outer corners.');

/* Care icons are a generated design system resolved through one registry, with the built-in
   semantic glyph as the fallback, so a missing asset degrades instead of breaking. */
if(!experience.includes('function careIcon('))throw new Error('Theme registry does not expose careIcon');
if(!core.includes('MilkFlowExperience?.careIcon'))throw new Error('Baby care cards do not resolve icons from the theme registry');
if(!app.includes('MilkFlowExperience?.careIcon'))throw new Error('Mom action tiles do not resolve icons from the theme registry');
if(!core.includes('CARE_GLYPH'))throw new Error('Care icon fallback glyph map is missing');
/* American English is the app's voice. "nappy" reached the printed doctor summary once. */
for(const [file,text] of [['app.js',app],['core-ui.js',core],['doctor-summary.js',fs.readFileSync(path.join(ROOT,'doctor-summary.js'),'utf8')]])
  for(const word of ['nappies','nappy','colour','centred','behaviour'])
    if(new RegExp(`(?<![A-Za-z-])${word}(?![A-Za-z-])`,'i').test(text.replace(/\bnappy\b(?=\))/g,'')))
      throw new Error(`${file}: use American spelling - found "${word}"`);
{
  /* The care icons are an illustrated cast, one character per action per theme, composed from
     shared parts so the set stays consistent. A theme is a cast file plus a palette entry. */
  const iconDir=path.join(ROOT,'scripts/care-icons');
  for(const f of ['index.mjs','palette.mjs','props.mjs','parts.mjs','cast/safari.mjs','cast/butterfly.mjs','cast/princess.mjs','cast/worlds.mjs'])
    if(!fs.existsSync(path.join(iconDir,f)))throw new Error(`Care icon design system is missing: scripts/care-icons/${f}`);
  const manifest=JSON.parse(fs.readFileSync(path.join(ROOT,'assets/care-icons/manifest.json'),'utf8'));
  for(const theme of ['safari','butterfly','princess','ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds'])
    if(!manifest.themes?.[theme]?.label)throw new Error(`Care icon manifest has no cast label for ${theme} - run node scripts/generate-care-icons.mjs`);
}
{
  const iconRoot=path.join(ROOT,'assets/care-icons');
  const actions=['milk','nurse','formula','wet','poop','mixed','pump'];
  for(const theme of ['safari','butterfly','princess','ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds']){
    for(const action of [...actions,'motif'])
      if(!fs.existsSync(path.join(iconRoot,theme,`${action}.svg`)))
        throw new Error(`Generated care icon missing: ${theme}/${action}.svg - run node scripts/generate-care-icons.mjs`);
  }
}
for(const token of ['.mf-dream-hero::before','.mf-dream-hero::after','content:none!important','var(--mf-theme-baby-scene)','var(--mf-theme-mom-scene)','var(--mf-theme-baby-hero)','var(--mf-theme-mom-hero)','body[data-screen="settings"] .main','body[data-screen="baby-home"] .mf-animal-hero','body[data-screen="mom-home"] .mf-dream-hero','color:var(--mf-world-text)!important'])if(!experienceSystem.includes(token))throw new Error(`Theme scene/contrast contract missing: ${token}`);
if(experienceSystem.includes('content:var(--mf-theme-name)'))throw new Error('Theme names must not be rendered as hero badges.');
if(experienceSystem.includes('--mf-theme-detail')||experience.includes('theme-details/'))throw new Error('Runtime theme composition must use one self-contained scene, not stacked detail/backdrop files.');
for(const token of ['.metric strong','.panel-head button','.round-action'])if(!componentTheme.includes(token))throw new Error(`Dark readability contract missing: ${token}`);
for(const token of ['.mf-hero-facts','.mf-dream-next','.mf-dream-metrics .metric strong','.mf-dream-journey .mf-journey-stop strong'])if(!experienceSystem.includes(token))throw new Error(`Mom dark readability contract missing: ${token}`);
if(!indexHtml.includes('milkflow-family-v3-192.png?v=__MILKFLOW_VERSION__'))throw new Error('Canonical v3 MilkFlow icon is not wired to iPhone/browser entry points.');
if(!manifestPwa.icons?.some(i=>i.src==='milkflow-family-v3-192.png'))throw new Error('Canonical v3 MilkFlow icon is missing from manifest.');
if(!swTemplate.includes("icon:'./milkflow-family-v3-192.png'"))throw new Error('Push notification icon is not the canonical v3 MilkFlow artwork.');

console.log('MilkFlow test suite passed: syntax, data and notification contracts, nine selectable theme worlds, canonical v3 app icon wiring, dark-mode number/button readability, Settings experience, and single-layer ownership.');
