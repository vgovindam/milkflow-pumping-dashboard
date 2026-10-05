import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';

const ROOT=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
// Reopening an edit dialog can deliver the previous close event afterward. Saving must keep
// the original record id, and a missing edit target must fail instead of appending a row.
{
  const source=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  const start=source.indexOf('function findRecord('),end=source.indexOf('// --------------------------------------------------------- number entry',start);
  const listenerStart=source.indexOf("['momDialog','diaperDialog','feedDialog','growthDialog','sleepDialog'].forEach(id => $(id)?.addEventListener('close'",end);
  const listenerEnd=source.indexOf('\n\nfunction bindViewInputs',listenerStart);
  if(start<0||end<0||listenerStart<0||listenerEnd<0)throw new Error('Edit record contract moved; update its regression test.');
  const record={id:'existing-pump',type:'pump',amountMl:90,createdAt:'2026-09-20T10:00:00Z'};
  const dialogs=Object.fromEntries(['momDialog','diaperDialog','feedDialog','growthDialog','sleepDialog'].map(id=>[id,{
    open:false,dataset:{},classList:{contains:()=>false},addEventListener(type,callback){this.onClose=callback;}
  }]));
  const ctx=vm.createContext({S:{entries:[record],babyEvents:[]},$:id=>dialogs[id],toast:()=>{}});
  vm.runInContext(source.slice(start,end)+'\n'+source.slice(listenerStart,listenerEnd),ctx,{filename:'edit-regression.js'});
  const d=dialogs.momDialog;d.open=true;d.classList.contains=cls=>cls==='is-edit';
  vm.runInContext("editing={kind:'mom',id:'existing-pump'};setDialogEditTarget('momDialog',editing)",ctx);
  d.onClose(); // stale close from the prior dialog arrives after this edit opens
  const changed=vm.runInContext("commitRecord(S.entries,{id:'new-id',type:'pump',amountMl:120,createdAt:'new'})",ctx);
  if(ctx.S.entries.length!==1||changed!==record||record.id!=='existing-pump'||record.amountMl!==120)
    throw new Error('Editing a pump appended a duplicate instead of updating the existing record.');
  delete d.dataset.editKind;delete d.dataset.editId;
  const rejected=vm.runInContext("commitRecord(S.entries,{id:'other-id',type:'pump',amountMl:125})",ctx);
  if(rejected!==null||ctx.S.entries.length!==1)throw new Error('An edit with a missing target created a duplicate.');
  d.open=false;d.onClose();d.classList.contains=()=>false;
  vm.runInContext("commitRecord(S.entries,{id:'actual-new-entry',type:'pump',amountMl:70})",ctx);
  if(ctx.S.entries.length!==2)throw new Error('Creating a new entry stopped working after an edit.');

  // Edit forms render only fields relevant to the entry type. Filling a missing field
  // previously threw before the edit target was recorded, then Save rejected the entry.
  let fields={};
  ctx.$=id=>dialogs[id]||fields[id]||null;
  ctx.closeOverlays=()=>{for(const dialog of Object.values(dialogs)){dialog.open=false;dialog.classList.contains=()=>false;}};
  ctx.today=()=> '2026-09-27';
  ctx.now=()=> '18:00';
  ctx.openMomDialog=()=>{const dialog=dialogs.momDialog;dialog.open=true;dialog.classList.contains=cls=>cls==='is-edit';};
  ctx.openFeedDialog=()=>{const dialog=dialogs.feedDialog;dialog.open=true;dialog.classList.contains=cls=>cls==='is-edit';};
  ctx.pickChoice=(id,value)=>{fields[id].value=value;};
  const nursingMom={id:'mom-nursing',type:'nursing',date:'2026-09-25',time:'11:30',durationMin:18,side:'left',note:'test'};
  const milk={id:'baby-milk',eventType:'feeding',feedingType:'expressed_milk',date:'2026-09-25',time:'12:15',amountOz:3};
  const formula={id:'baby-formula',eventType:'feeding',feedingType:'formula',date:'2026-09-25',time:'13:15',amountOz:2};
  const nursingBaby={id:'baby-nursing',eventType:'nursing',date:'2026-09-25',time:'14:30',durationMinutes:17,side:'right'};
  ctx.S.entries.push(nursingMom);
  ctx.S.babyEvents.push(milk,formula,nursingBaby);
  const scenarios=[
    {kind:'mom',record:record,keys:['momDate','momTime','momAmount','momDuration','momNote'],check:'momAmount',expected:120,list:'entries',value:'amountMl'},
    {kind:'mom',record:nursingMom,keys:['momDate','momTime','momDuration','momNote','momSide'],check:'momDuration',expected:18,list:'entries',value:'durationMin'},
    {kind:'baby',record:milk,keys:['feedDate','feedTime','feedAmount'],check:'feedAmount',expected:3,list:'babyEvents',value:'amountOz'},
    {kind:'baby',record:formula,keys:['feedDate','feedTime','feedAmount'],check:'feedAmount',expected:2,list:'babyEvents',value:'amountOz'},
    {kind:'baby',record:nursingBaby,keys:['feedDate','feedTime','feedDuration','feedSide'],check:'feedDuration',expected:17,list:'babyEvents',value:'durationMinutes'}
  ];
  for(const {kind,record:original,keys,check,expected,list,value} of scenarios){
    fields=Object.fromEntries(keys.map(key=>[key,{value:''}]));
    const before=ctx.S[list].length;
    vm.runInContext(`editRecord(${JSON.stringify(kind)},${JSON.stringify(original.id)})`,ctx);
    if(+fields[check].value!==expected)throw new Error(`Editing ${original.id} failed to fill its visible field.`);
    const changed=vm.runInContext(`commitRecord(S.${list},{id:'new-id',${value}:${expected+1},createdAt:'new'})`,ctx);
    if(changed!==original||changed.id!==original.id||ctx.S[list].length!==before||changed[value]!==expected+1)
      throw new Error(`Saving ${original.id} lost the original entry or created a duplicate.`);
  }
}
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
  const partialDay=engine.baby({
    rows:[
      ...Array.from({length:8},(_,i)=>({complete:true,feeds:i<4?6:7,bottleOz:i<4?16:18,wetTotal:i<4?5:6,diapers:i<4?6:7,sleepMin:600,logged:true})),
      {complete:false,feeds:1,bottleOz:2,wetTotal:1,diapers:1,sleepMin:60,logged:true}
    ],
    ageDays:70,feedingPreference:'mostly_breastfed'
  });
  const partialBottle=partialDay.observations.find(x=>x.label==='Bottle volume');
  if(partialBottle?.value!=='Higher')throw new Error('An incomplete current day must not depress completed-day bottle-volume comparisons.');
  if(!/completed days/i.test(partialDay.summary||''))throw new Error('Baby insight copy must explain that full-day comparisons exclude the incomplete current day.');
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

/* Every world is one painted plate per realm per mode, at three widths, and every role is a
   crop of it.
   There used to be two packages here - painted themes with hero and preview files of their
   own, and vector themes with SVG scenes - plus three asset-set functions in the controller to
   match. Seven of the nine worlds ended up on the one with no responsive widths, so a phone
   pulled the full-resolution painting, and the hero was a second file holding the top of the
   same picture, which the browser cached twice and which could drift from the page behind it. */
const WORLDS=['safari','butterfly','princess','ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds'];
for(const theme of WORLDS){
  for(const mode of ['light','dark'])for(const realm of ['baby','mom'])for(const w of [480,720,941]){
    const plate=`assets/themes-v2/${theme}/${mode}/${realm}-background@${w}.webp`;
    const full=path.join(ROOT,plate);
    if(!fs.existsSync(full))throw new Error(`Theme plate missing: ${plate}`);
    if(fs.statSync(full).size<4000)throw new Error(`${plate} is too small to be a painted plate`);
  }
  /* Baby and Mom are separate worlds within one theme, and light is not dark with the lamps
     turned down. Four distinct files, or one of those distinctions is not real. */
  const seen=new Map();
  for(const mode of ['light','dark'])for(const realm of ['baby','mom']){
    const key=fs.readFileSync(path.join(ROOT,`assets/themes-v2/${theme}/${mode}/${realm}-background@941.webp`)).toString('base64').slice(0,64);
    if(seen.has(key))throw new Error(`${theme}: ${mode}/${realm} ships the same plate as ${seen.get(key)}`);
    seen.set(key,`${mode}/${realm}`);
  }
  if(!experience.includes(`assetSet('${theme}')`))throw new Error(`Theme manifest is not using the ${theme} asset set.`);
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
if(!core.includes('width:72px;height:72px')||!core.includes('width:60px;height:60px'))
  throw new Error('Theme art must fit inside the picture box at the intended smaller scale.');
if(core.includes('mf-tile-detail')||!core.includes('${careMark(\'mixed\')}<b class="mf-tile-count">${st.both}</b></span><span class="mf-tile-copy"><strong>Mixed</strong>'))
  throw new Error('Diaper counts belong in the picture box and labels must have one line.');
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
if(!experience.includes('function careAtlas(')||!core.includes('MilkFlowExperience?.careAtlas')||!app.includes('MilkFlowExperience?.careAtlas'))
  throw new Error('Mom and Baby tiles must share the illustrated theme atlas registry.');
if(!themedComponents.includes('background-size:400% 200%')||!themedComponents.includes('.mf-care-sprite.mixed{background-position:33.3333% 100%}'))
  throw new Error('Care atlas must expose the correct eight separate actions and motif.');
if(!core.includes('font:720 15px/1.2 var(--display)')||!core.includes('.mf-dream-actions .quick-tile strong{font-size:15px'))
  throw new Error('Care captions must remain subordinate to the illustrated tile.');
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
    const atlas=path.join(ROOT,'assets/care-atlas',`${theme}.webp`);
    if(!fs.existsSync(atlas)||fs.statSync(atlas).size<100000)throw new Error(`Missing generated ${theme} care atlas`);
    for(const action of [...actions,'motif'])
      if(!fs.existsSync(path.join(iconRoot,theme,`${action}.svg`)))
        throw new Error(`Generated care icon missing: ${theme}/${action}.svg - run node scripts/generate-care-icons.mjs`);
  }
}
for(const token of ['.mf-dream-hero::before','.mf-dream-hero::after','content:none','var(--mf-theme-baby-scene)','var(--mf-theme-mom-scene)','var(--mf-theme-baby-hero)','var(--mf-theme-mom-hero)','body[data-screen="settings"] .main','body[data-screen="baby-home"] .mf-animal-hero','body[data-screen="mom-home"] .mf-dream-hero','color:var(--mf-world-text)'])if(!experienceSystem.includes(token))throw new Error(`Theme scene/contrast contract missing: ${token}`);
if(experienceSystem.includes('content:var(--mf-theme-name)'))throw new Error('Theme names must not be rendered as hero badges.');
if(experienceSystem.includes('--mf-theme-detail')||experience.includes('theme-details/'))throw new Error('Runtime theme composition must use one self-contained scene, not stacked detail/backdrop files.');
for(const token of ['.metric strong','.panel-head button','.round-action'])if(!componentTheme.includes(token))throw new Error(`Dark readability contract missing: ${token}`);
for(const token of ['.mf-hero-facts','.mf-dream-next','.mf-dream-metrics .metric strong','.mf-dream-journey .mf-journey-stop strong'])if(!experienceSystem.includes(token))throw new Error(`Mom dark readability contract missing: ${token}`);
if(!indexHtml.includes('milkflow-family-v3-192.png?v=__MILKFLOW_VERSION__'))throw new Error('Canonical v3 MilkFlow icon is not wired to iPhone/browser entry points.');
if(!manifestPwa.icons?.some(i=>i.src==='milkflow-family-v3-192.png'))throw new Error('Canonical v3 MilkFlow icon is missing from manifest.');
if(!swTemplate.includes("icon:'./milkflow-family-v3-192.png'"))throw new Error('Push notification icon is not the canonical v3 MilkFlow artwork.');


/* A restored home-screen app can be older than the published worker even when its local
   caches contain only the old version. The update banner must compare against the network. */
{
  const source=fs.readFileSync(path.join(ROOT,'app-update-notice.js'),'utf8');
  const events={},nodes=new Map(),buttons=new Map();
  const element=()=>({id:'',querySelector(sel){
    if(!buttons.has(sel))buttons.set(sel,{disabled:false,addEventListener(type,fn){this[type]=fn}});
    return buttons.get(sel);
  }});
  const reg={update:async()=>{}};
  let requested='',reloaded='';
  const context={
    URL,setTimeout,
    window:{MILKFLOW_BUILD:{version:'2.21.4'},addEventListener(type,fn){events[type]=fn}},
    navigator:{serviceWorker:{ready:Promise.resolve(reg),getRegistration:async()=>reg,addEventListener(type,fn){events[type]=fn}}},
    document:{baseURI:'https://example.com/milkflow/',hidden:false,createElement:element,
      getElementById:id=>nodes.get(id)||null,
      head:{appendChild:el=>nodes.set(el.id,el)},body:{appendChild:el=>nodes.set(el.id,el)},
      addEventListener(type,fn){events[type]=fn}},
    location:{href:'https://example.com/milkflow/#baby-home',replace(url){reloaded=url}},
    fetch:async(url,options)=>{requested=String(url);if(options?.cache!=='no-store')throw new Error('Version lookup used the cache');
      return {ok:true,text:async()=>"const VERSION='milkflow-v2.21.5';"};}
  };
  vm.runInNewContext(source,context,{filename:'app-update-notice.js'});
  await events.pageshow();
  if(!requested.includes('/sw.js?version-check=')||!nodes.has('appUpdateNotice'))
    throw new Error('A restored older app did not detect the published release.');
  await buttons.get('.aun-now').click({currentTarget:buttons.get('.aun-now')});
  if(!reloaded.includes('milkflow-update=2.21.5')||!reloaded.endsWith('#baby-home'))
    throw new Error('Update action did not navigate to the new build while preserving the route.');
}

/* Stability release regression guards. */
{
  const appSource=fs.readFileSync(path.join(ROOT,'app.js'),'utf8');
  if(!appSource.includes("if(document.visibilityState === 'visible') return false;"))throw new Error('Foreground system notifications must be suppressed.');
  if(appSource.includes('initCloud(); tickReminders(); setInterval(tickReminders,60000);'))throw new Error('Reminder engine must not fire immediately on app open.');
  if(/setTimeout\\(tickReminders,0\\)/.test(appSource))throw new Error('Saving a care record must not immediately replay the reminder engine.');
  const themeSource=fs.readFileSync(path.join(ROOT,'experience-theme.js'),'utf8');
  if(!themeSource.includes("?value.mode:'off'"))throw new Error('Automatic theme rotation must default to off.');
  const experienceCss=fs.readFileSync(path.join(ROOT,'experience-system.css'),'utf8');
  if(!experienceCss.includes('data-first stability release'))throw new Error('Data-first visual contract is missing.');
}

console.log('MilkFlow test suite passed: syntax, data and notification contracts, nine selectable theme worlds, canonical v3 app icon wiring, dark-mode number/button readability, Settings experience, and single-layer ownership.');
