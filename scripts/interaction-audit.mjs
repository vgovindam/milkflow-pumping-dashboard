import fs from 'node:fs';

const read=p=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const familyChat=read('family-chat.js'),familyChatServer=read('functions/family-chat.js');
const app=read('app.js'),core=read('core-ui.js'),css=read('component-theme.css'),themeEntry=read('theme.css'),experienceCss=read('experience-system.css'),experienceComponents=read('experience-components.css'),experienceJs=read('experience-theme.js'),doctorJs=read('doctor-summary.js'),doctorCss=read('doctor-summary.css'),html=read('index.html'),lifecycle=read('render-lifecycle.js'),alerts=read('cross-device-alerts.js');
const failures=[];
const need=(scope,source,text)=>{if(!source.includes(text))failures.push(`${scope}: missing ${text}`);};

const routes=['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','development','doctor','more','settings','set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'];
const rendererBlock=app.slice(app.indexOf('const renderers={'),app.indexOf('const titles='));
for(const route of routes)if(!rendererBlock.includes(route))failures.push(`route renderer: ${route} is not wired`);

for(const text of ["const home=baby?'baby-home':'mom-home'","hist=baby?'baby-history':'mom-history'","trend=baby?'baby-trends':'mom-trends'",'class="add-tab" data-add',"tab('more','More'"])need('bottom navigation',app,text);
const clickBlock=app.slice(app.indexOf('function handleClick(e){'),app.indexOf("document.addEventListener('click',handleClick)"));
const selectors=['[data-close]','[data-workspace]','[data-view]','[data-back]','[data-add]','[data-history-mode]','[data-review-date]','[data-stage]','[data-milestone]','[data-pick]','[data-dismiss]','[data-theme-pick]','[data-bump]','[data-preset]','[data-when]','[data-record]','[data-edit-record]','[data-void-record]','[data-mom]','[data-feed]','[data-feed-type]','[data-diaper]','[data-growth]','[data-sleep]','[data-import]','[data-export]','[data-cloud-check]','[data-reminders]','[data-feed-reminders]','[data-auth]','[data-signout]','[data-print]','[data-mom-range]','[data-baby-range]','[data-baby-filter]','[data-trend-range]','[data-doctor-range]','[data-stash]'];
for(const selector of selectors)if(!clickBlock.includes(selector))failures.push(`click contract: no handler for ${selector}`);

for(const [dialog,form] of [['momDialog','momForm'],['diaperDialog','diaperForm'],['feedDialog','feedForm'],['growthDialog','growthForm'],['sleepDialog','sleepForm']]){need('dialog markup',html,`<dialog id="${dialog}"`);need('form submit',app,`$('${form}').addEventListener('submit'`);}
for(const text of ['data-mom="pump"','data-mom="nursing"','data-feed-type="nursing"','data-feed-type="expressed_milk"','data-feed-type="formula"','data-diaper="wet"','data-diaper="poop"','data-diaper="both"','data-sleep','data-growth'])need('home quick action',core+app,text);
for(const text of ['data-sleep-start','data-sleep-end','data-sleep-complete','function sleepPrediction(','function sleepReminderTick('])need('two-way sleep capture',app,text);
need('mixed diaper normalization',app,"if(s === 'mixed') return 'both'");
need('mixed diaper direct action',core,'data-diaper="both"');
need('diaper selected value',app,"setWhen('diaperTime',0); pickChoice('diaperKind',k)");
need('cascade layer order',css,'@layer milkflow-core, milkflow-experience, milkflow-controls, milkflow-selection;');
need('canonical theme composition',themeEntry,'experience-system.css');
need('canonical component theme composition',themeEntry,'experience-components.css');
need('canonical experience layer',themeEntry,'layer(milkflow-experience)');

for(const text of ["const KEY='milkflow-experience-theme-v1'","new Set(['safari','butterfly','princess','ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds','clean'])","const RETIRED={jungle:'safari'","const THEME_LIBRARY={","filter(([,t])=>t.status==='ready')",'data-experience-theme-pick="clean"'])need('experience theme controller',experienceJs,text);
for(const [key,title] of [['safari','Animal Kingdom'],['butterfly','Butterfly Garden'],['princess','Princess Palace'],['ocean','Ocean'],['celestial','Moon & Stars'],['woodland','Woodland Forest'],['safari-sunset','Safari Sunset'],['floral-meadow','Floral Meadow'],['cozy-clouds','Cozy Clouds']]){
  need('ready theme registry',experienceJs,`id:'${key}'`);
  need('ready theme title',experienceJs,`title:'${title}'`);
}
if(experienceJs.includes('MutationObserver'))failures.push('experience theme controller: observer loop is not allowed');
need('both modes published',experienceJs,'const SCENE_ROLES=');
for(const theme of ['safari','butterfly','princess']){
  need('painted theme asset matrix manifest',experienceJs,`assetSet('${theme}')`);
  need('painted theme icon manifest',experienceJs,`theme-icons/${theme}.svg`);
}
for(const theme of ['ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds'])
  need('vector theme asset matrix manifest',experienceJs,`vectorAssetSet('${theme}')`);
for(const text of ['--mf-theme-baby-scene','--mf-theme-mom-scene','--mf-theme-baby-hero','--mf-theme-mom-hero','body[data-screen="settings"] .main','body[data-screen="mom-home"] .mf-dream-hero','body[data-screen="baby-home"] .mf-animal-hero','.mf-dream-hero::before','.mf-dream-hero::after','content:none!important'])need('realm-wide experience surface',experienceJs+experienceCss,text);
if(experienceCss.includes('content:var(--mf-theme-name)'))failures.push('realm-wide experience surface: hero theme-name badges must not render');
if(experienceJs.includes('theme-details/'))failures.push('experience controller must use one self-contained scene, not stacked detail SVGs');
for(const text of ['--mf-icon-sprite','.mf-feed-card::after','.mf-diaper-blob::after','.mf-dream-actions .quick-tile','.mf-settings-theme-panel','.mf-settings-shortcuts','.mf-settings-motto'])need('independent themed components',experienceComponents,text);

need('canonical stylesheet loaded',html,'theme.css?v=__MILKFLOW_VERSION__');
need('canonical controller loaded',html,'experience-theme.js?v=__MILKFLOW_VERSION__');
need('cross-device alert module loaded',html,'cross-device-alerts.js?v=__MILKFLOW_VERSION__');
need('new iPhone icon',html,'milkflow-family-v3-192.png?v=__MILKFLOW_VERSION__');
for(const bad of ['component-theme-v3.css','experience-theme-v2.js','experience-theme-v3.js','experience-art-v2.css','jungle-theme.css'])if(html.includes(bad))failures.push(`legacy production entry loaded: ${bad}`);

/* The printed summary is a document a pediatrician reads: an identity block, the measures,
   the day-by-day log with a period total, and the footnote that says how the averages were
   worked out. It is built from the report model - never from the rendered screen. */
for(const text of ['mf-doctor-print','mf-print-table','mf-print-facts','At a glance','Day by day','mf-print-total','buildPrintDocument','mf-printing-report'])need('clinician doctor report',doctorJs+doctorCss,text);
for(const text of ['async function printReport()','await nextPaint();','print: printReport'])need('responsive clinician print flow',doctorJs,text);
need('app delegates clinician print',app,'printer?.print');
need('doctor component loaded',html,'doctor-summary.js?v=__MILKFLOW_VERSION__');
need('doctor stylesheet loaded',html,'doctor-summary.css?v=__MILKFLOW_VERSION__');
for(const text of ['function resetRouteScroll','function exactRouteControl','mf-render-recovery'])need('navigation recovery',lifecycle,text);
for(const text of ["STATE_KEY = 'milkflow-family-v4-state'",'function unionById','function commitRecord'])need('data preservation',app,text);
for(const text of ['milkflow-device-id-v1','sourceDeviceId',"collection('devices')"])need('cross-device alert identity',alerts,text);
for(const text of ["PENDING_KEY='milkflow-family-chat-pending-v1'",'recoverCloudRequest','recoverLegacyHistory','resumePending','retryRequest',"mode:'status'"])need('family chat recovery',familyChat,text);
for(const text of ["collection('familyChatRequests')","mode==='status'","status:'processing'","status:'completed'","${requestId}-user","${requestId}-assistant"])need('family chat server recovery',familyChatServer,text);
if(failures.length){console.error(`Interaction audit failed:\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`Interaction audit passed: ${routes.length} routes, ${selectors.length} delegated action families, nine selectable theme worlds, independent themed components, five entry forms, navigation recovery, notification identity, app branding, and data-preservation contracts.`);
