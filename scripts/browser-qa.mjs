import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ROOT=process.cwd(),OUT=path.join(ROOT,'visual-audit');
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p==='/'||p==='')p='/index.html';p=decodeURIComponent(p).replace(/^\/+/, '');const file=path.join(ROOT,p);if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));

/* CI has chrome on PATH; a Mac keeps it inside an .app bundle and nothing is on PATH at all.
   Look in both places, or this gate can only ever run on the build machine - which is how a
   release can be cut from a laptop without the visual QA having run once. */
const onPath=['google-chrome','google-chrome-stable','chromium','chromium-browser'];
const bundles=[
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  `${process.env.HOME||''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge'
];
const named=onPath.find(c=>spawnSync('which',[c],{encoding:'utf8'}).status===0);
const exe=named?spawnSync('which',[named],{encoding:'utf8'}).stdout.trim():bundles.find(b=>b&&fs.existsSync(b));
if(!exe){server.close();throw new Error('Chrome/Chromium not available');}
let proc=null,debugPort=0;
for(const port of [9222,9223,9224]){
  const p=spawn(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage',`--remote-debugging-port=${port}`,`--user-data-dir=/tmp/milkflow-browser-qa-${process.pid}-${port}`,'--window-size=390,844','about:blank'],{stdio:'ignore'});
  let ready=false;
  for(let i=0;i<100&&!ready;i++){try{ready=(await fetch(`http://127.0.0.1:${port}/json/version`)).ok;}catch{}if(!ready)await sleep(100);}
  if(ready){proc=p;debugPort=port;break;}p.kill();
}
if(!proc){server.close();throw new Error('Could not start Chrome DevTools after 3 isolated attempts');}

let ws;
try{
  const appUrl='http://127.0.0.1:4173/?visual-audit=1#mom-home';
  const targetRes=await fetch(`http://127.0.0.1:${debugPort}/json/new?${encodeURIComponent(appUrl)}`,{method:'PUT'});
  if(!targetRes.ok)throw new Error(`Could not create app target (${targetRes.status})`);
  const target=await targetRes.json();if(!target.webSocketDebuggerUrl)throw new Error('App target has no DevTools websocket');
  ws=new WebSocket(target.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let seq=0;const pending=new Map();
  /* The harness measured layout on 190 views and never once looked at the console, so a page
     could throw on every render and still pass. Runtime.enable and Log.enable are already on;
     these two collectors are all that was missing. Log.entryAdded is where a failed image or
     stylesheet request surfaces, which is the only automatic check for a broken asset. */
  const consoleErrors=[],failedRequests=[];
  let where='boot';
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.method==='Runtime.exceptionThrown'){
      const d=m.params?.exceptionDetails||{};
      consoleErrors.push(`${where}: uncaught ${d.exception?.description||d.text||'exception'}`.slice(0,300));
    }
    if(m.method==='Runtime.consoleAPICalled'&&m.params?.type==='error'){
      const text=(m.params.args||[]).map(a=>a.description||a.value||'').join(' ').trim();
      if(text) consoleErrors.push(`${where}: console.error ${text}`.slice(0,300));
    }
    if(m.method==='Log.entryAdded'){
      const en=m.params?.entry||{};
      if(en.level==='error'&&en.source==='network'&&en.url) failedRequests.push(`${where}: ${en.url.split('/').slice(3).join('/')}`);
    }
    if(m.id&&pending.has(m.id)){const x=pending.get(m.id);pending.delete(m.id);m.error?x.reject(new Error(m.error.message)):x.resolve(m.result);}
  };
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evalJs=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'evaluation error');return r.result?.value;};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Log.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await sleep(2800);await evalJs("document.documentElement.classList.remove('mf-booting')");

  const routes=['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','development','doctor','more','settings','set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'];
  const momRoutes=new Set(['mom-home','mom-history','mom-trends','mom-stash']);
  const babyRoutes=new Set(['baby-home','baby-history','baby-trends','baby-growth','development','doctor']);
  /* One list, so the count the Appearance screen is checked against cannot drift from the
     worlds that actually exist. */
  const WORLDS=['safari','butterfly','princess','ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds'];
  const ICON_WORLDS=['safari','butterfly','princess'];
  const themes=[...WORLDS,'clean'];
  const expected=Object.fromEntries(WORLDS.map(t=>[t,`themes-v2/${t}/`]));
  /* The original three have illustrated per-action icon casts. New worlds use the stable
     semantic glyph fallback until their care-art cast is authored; scenery and motif still
     belong to the selected world. */
  const expectedIcons=Object.fromEntries(ICON_WORLDS.map(t=>[t,`care-icons/${t}/`]));
  const failures=[],report=[];
  async function reach(route){await evalJs(`location.hash=${JSON.stringify('#'+route)}`);for(let i=0;i<20;i++){await sleep(100);if(await evalJs('document.body.dataset.screen||""')===route)return true;}return false;}

  for(const theme of themes){
    await evalJs(`localStorage.setItem('milkflow-experience-theme-v1',${JSON.stringify(theme)});window.MilkFlowExperience?.apply?.(${JSON.stringify(theme)});window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:${JSON.stringify(theme)}}}))`);await sleep(180);
    for(const route of routes){
      if(!await reach(route)){failures.push(`${theme}/${route}: route did not render`);continue;}
      for(const mode of ['light','dark']){
        where=`${theme}/${mode}/${route}`;
        await evalJs(`document.documentElement.dataset.theme=${JSON.stringify(mode)};document.querySelector('.main')?.scrollTo(0,0)`);await sleep(170);
        const m=await evalJs(`(()=>{const v=document.getElementById('view'),n=document.getElementById('bottomNav'),main=document.querySelector('.main'),heroBaby=document.querySelector('.mf-animal-hero'),heroMom=document.querySelector('.mf-dream-hero'),head=document.querySelector('.page-head'),feed=document.querySelector('.mf-feed-card.milk'),pump=document.querySelector('.mf-dream-actions .quick-tile[data-mom="pump"] .tile-art');const vr=v?.getBoundingClientRect(),nr=n?.getBoundingClientRect();const icons=[...document.querySelectorAll('#bottomNav .ico,#bottomNav .gly')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}).length;const previewImages=[...document.querySelectorAll('#mfExperiencePanel .mf-experience-preview img')];const momCritical=[...document.querySelectorAll('.mf-dream-stats strong,.mf-dream-next strong,.mf-dream-metrics .metric strong,.mf-dream-journey .mf-journey-stop strong,.mf-dream-actions .quick-tile strong')];const darkReadable=momCritical.every(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x),c=s.color;return r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity||1)>=.9&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'});return{darkReadable,darkCriticalCount:momCritical.length,children:v?.children.length||0,height:vr?.height||0,mainWidth:main?.clientWidth||0,scrollWidth:main?.scrollWidth||0,navVisible:!!nr&&nr.width>250&&nr.bottom<=innerHeight+3&&nr.top<innerHeight,icons,padding:v?parseFloat(getComputedStyle(v).paddingBottom)||0:0,navHeight:nr?.height||0,realm:document.body.dataset.realm||'',bodyBg:getComputedStyle(document.body).backgroundImage,mainBg:main?getComputedStyle(main).backgroundImage:'',babyHeroBg:heroBaby?getComputedStyle(heroBaby).backgroundImage:'',momHeroBg:heroMom?getComputedStyle(heroMom).backgroundImage:'',momHeroBefore:heroMom?getComputedStyle(heroMom,'::before').content:'',momHeroAfter:heroMom?getComputedStyle(heroMom,'::after').content:'',babyHeroBefore:heroBaby?getComputedStyle(heroBaby,'::before').content:'',babyHeroAfter:heroBaby?getComputedStyle(heroBaby,'::after').content:'',pageHeadArt:head?getComputedStyle(head,'::after').backgroundImage:'',feedArt:feed?getComputedStyle(feed,'::after').backgroundImage:'',pumpArt:pump?getComputedStyle(pump,'::after').backgroundImage:'',feedIcon:document.querySelector('.mf-feed-card.milk .mf-care-art')?.getAttribute('src')||'',diaperIcon:document.querySelector('.mf-diaper-blob.wet .mf-care-art')?.getAttribute('src')||'',pumpIcon:document.querySelector('.mf-dream-actions .quick-tile[data-mom="pump"] .mf-care-art')?.getAttribute('src')||'',themeCards:document.querySelectorAll('#mfExperiencePanel .mf-experience-option').length,selected:document.querySelectorAll('#mfExperiencePanel [aria-pressed="true"]').length,previewImages:previewImages.length,loadedPreviews:previewImages.filter(x=>x.complete&&x.naturalWidth>0).length,settingsShortcuts:document.querySelectorAll('#mfSettingsShortcuts .mf-settings-row').length,settingsMotto:!!document.getElementById('mfSettingsMotto'),doctorTables:document.querySelectorAll('.qa-grid,.daily-table,.mf-print-table').length,babyHeroHeight:heroBaby?.getBoundingClientRect().height||0,babyPhotoWidth:document.querySelector('.mf-animal-profile .mf-profile-photo')?.getBoundingClientRect().width||0,babyTimingCount:document.querySelectorAll('.mf-baby-timing>span').length,babyFactBoxes:document.querySelectorAll('.mf-animal-hero .mf-hero-fact').length,themeLibraryCount:Object.keys(window.MilkFlowExperience?.library||{}).length,plannedThemeCount:Object.values(window.MilkFlowExperience?.library||{}).filter(t=>t.status!=='ready').length,fallbackFeedGlyphContained:(()=>{const p=document.querySelector('.mf-feed-card.milk .mf-care-mark'),g=p?.querySelector(':scope>svg');if(!p||!g)return true;const a=p.getBoundingClientRect(),b=g.getBoundingClientRect();return b.left>=a.left-1&&b.top>=a.top-1&&b.right<=a.right+1&&b.bottom<=a.bottom+1})(),fallbackCareSvgCount:document.querySelectorAll('.mf-feed-card .mf-care-mark>svg,.mf-diaper-blob .mf-care-mark>svg').length,diaperIconBadgeOverlap:(()=>{const a=document.querySelector('.mf-diaper-blob.wet .mf-care-mark')?.getBoundingClientRect(),b=document.querySelector('.mf-diaper-blob.wet>b')?.getBoundingClientRect();return!!(a&&b&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)})(),lastFeedHasClock:!!document.querySelector('.mf-last-feed-value>em'),lastFeedOverflow:(()=>{const e=document.querySelector('.mf-last-feed-value');return!!e&&e.scrollWidth>e.clientWidth+1})(),lastFeedWidth:document.querySelector('.mf-last-feed-value')?.getBoundingClientRect().width||0,lastFeedClockFont:(()=>{const e=document.querySelector('.mf-last-feed-value>em');return e?parseFloat(getComputedStyle(e).fontSize)||0:0})(),appearanceCareLeak:document.querySelectorAll('#mfExperiencePanel .mf-care-mark,#mfExperiencePanel .mf-feed-card,#mfExperiencePanel .mf-diaper-blob').length}})()`);
        if(m.children<1||m.height<40)failures.push(`${theme}/${mode}/${route}: blank view`);
        if(m.scrollWidth>m.mainWidth+2)failures.push(`${theme}/${mode}/${route}: horizontal overflow`);
        if(!m.navVisible||m.icons<4)failures.push(`${theme}/${mode}/${route}: bottom navigation/icons not visible`);
        if(m.padding<m.navHeight+15)failures.push(`${theme}/${mode}/${route}: content can sit behind bottom navigation`);
        if(route==='doctor'&&m.doctorTables<2)failures.push(`${theme}/${mode}/${route}: doctor summary structure missing`);
        if(theme==='safari'&&mode==='light'&&route==='doctor'){
          const pr=await evalJs(`(async()=>{const old=window.print;let called=0;window.print=()=>{called=performance.now()};const start=performance.now();let ok=false;try{ok=await window.MilkFlowDoctorPrint?.print?.()}catch{}const ms=called?called-start:9999;const built=!!document.getElementById('mfDoctorPrint');window.print=old;window.MilkFlowDoctorPrint?.teardown?.();return{ok:!!ok,ms,built}})()`);
          if(!pr?.ok||!pr?.built||pr.ms>700)failures.push(`${theme}/${mode}/${route}: Doctor Print is not promptly prepared ok=${pr?.ok} built=${pr?.built} ms=${Math.round(pr?.ms||9999)}`);
        }
        if(route==='baby-home'){
          if(m.babyHeroHeight>198)failures.push(`${theme}/${mode}/${route}: Baby hero too tall at ${m.babyHeroHeight.toFixed(1)}px; compact identity card budget is 198px`);
          if(m.babyPhotoWidth<124)failures.push(`${theme}/${mode}/${route}: Baby photo is too small at ${m.babyPhotoWidth.toFixed(1)}px`);
          if(m.babyTimingCount!==2)failures.push(`${theme}/${mode}/${route}: Baby hero should show exactly Last feed and Next feed timing facts`);
          if(m.babyFactBoxes!==0)failures.push(`${theme}/${mode}/${route}: old full-width Baby fact boxes returned (${m.babyFactBoxes})`);
          if(!m.fallbackFeedGlyphContained)failures.push(`${theme}/${mode}/${route}: fallback feed glyph escapes its icon carrier`);
          if(m.diaperIconBadgeOverlap)failures.push(`${theme}/${mode}/${route}: diaper care icon overlaps its count badge`);
          if(m.lastFeedHasClock&&(m.lastFeedOverflow||m.lastFeedWidth<100||m.lastFeedClockFont<11.5))failures.push(`${theme}/${mode}/${route}: Last feed elapsed + clock does not fit width=${m.lastFeedWidth.toFixed(1)} font=${m.lastFeedClockFont.toFixed(1)} overflow=${m.lastFeedOverflow}`);
          if(!iconArt&&theme!=='clean'&&m.fallbackCareSvgCount<6)failures.push(`${theme}/${mode}/${route}: fallback semantic care icons are incomplete (${m.fallbackCareSvgCount}/6)`);
        }
        if(route==='mom-home'&&mode==='dark'&&(m.darkCriticalCount<4||!m.darkReadable))failures.push(`${theme}/${mode}/${route}: critical Mom numbers/buttons are not visibly readable`);
        const art=expected[theme],iconArt=expectedIcons[theme],themedRealm=momRoutes.has(route)||babyRoutes.has(route);
        if(art&&themedRealm&&!m.mainBg.includes(art))failures.push(`${theme}/${mode}/${route}: selected world is missing from real page canvas (${art})`);
        if(art&&themedRealm&&!m.bodyBg.includes(art))failures.push(`${theme}/${mode}/${route}: selected world does not paint the device-safe-area background (${art})`);
        /* One artwork layer per screen. The hero used to carry a second crop of the same
           plate the page canvas already shows, which read as overlapping imagery; it is a
           solid surface now, so a plate reappearing there is a regression. */
        if(route==='baby-home'&&art&&m.babyHeroBg.includes('themes-v2/'))failures.push(`${theme}/${mode}/${route}: Baby hero is duplicating the page artwork layer`);
        if(route==='mom-home'&&art&&m.momHeroBg.includes('themes-v2/'))failures.push(`${theme}/${mode}/${route}: Mom hero is duplicating the page artwork layer`);
        if(art&&babyRoutes.has(route)&&route!=='baby-home'&&!m.pageHeadArt.includes(art))failures.push(`${theme}/${mode}/${route}: Baby page header is missing selected artwork`);
        if(art&&momRoutes.has(route)&&route!=='mom-home'&&!m.pageHeadArt.includes(art))failures.push(`${theme}/${mode}/${route}: Mom page header is missing selected artwork`);
        if(route==='mom-home'&&art&&![m.momHeroBefore,m.momHeroAfter].every(x=>!x||x==='none'||x==='normal'||x==='""'))failures.push(`${theme}/${mode}/${route}: Mom hero is rendering decorative/theme-name pseudo content`);
        if(route==='baby-home'&&art&&![m.babyHeroBefore,m.babyHeroAfter].every(x=>!x||x==='none'||x==='normal'||x==='""'))failures.push(`${theme}/${mode}/${route}: Baby hero is rendering decorative/theme-name pseudo content`);
        /* Every care box carries the selected world's own generated icon for that action. */
        if(route==='baby-home'&&iconArt&&!m.feedIcon.includes(`${iconArt}milk.svg`))failures.push(`${theme}/${mode}/${route}: Baby feed card icon is not ${iconArt}milk.svg (got ${m.feedIcon||'none'})`);
        if(route==='baby-home'&&iconArt&&!m.diaperIcon.includes(`${iconArt}wet.svg`))failures.push(`${theme}/${mode}/${route}: Baby diaper icon is not ${iconArt}wet.svg (got ${m.diaperIcon||'none'})`);
        if(route==='mom-home'&&iconArt&&!m.pumpIcon.includes(`${iconArt}pump.svg`))failures.push(`${theme}/${mode}/${route}: Mom pump tile icon is not ${iconArt}pump.svg (got ${m.pumpIcon||'none'})`);
        /* Appearance owns the currently complete worlds. The larger library is allowed to contain
           planned worlds, but they cannot appear here until their full asset package is ready. */
        if(route==='set-appearance'&&(m.themeCards!==WORLDS.length||m.selected!==1||m.previewImages!==WORLDS.length||m.loadedPreviews!==WORLDS.length||m.settingsShortcuts!==2))failures.push(`${theme}/${mode}/${route}: Appearance invalid cards=${m.themeCards} selected=${m.selected} previews=${m.loadedPreviews}/${m.previewImages} shortcuts=${m.settingsShortcuts}`);
        if(route==='set-appearance'&&(m.themeLibraryCount<10||m.plannedThemeCount!==1))failures.push(`${theme}/${mode}/${route}: theme library readiness is wrong library=${m.themeLibraryCount} planned=${m.plannedThemeCount}`);
        if(route==='set-appearance'&&m.appearanceCareLeak!==0)failures.push(`${theme}/${mode}/${route}: care controls leaked into theme preview (${m.appearanceCareLeak})`);
        /* Settings keeps the scene and its own list. The picker moved to Appearance, so asserting
           the cards here was asserting the duplication that was removed. */
        if(route==='settings'&&theme!=='clean'&&(!m.mainBg.includes(art)||m.themeCards!==0||m.settingsShortcuts!==0))failures.push(`${theme}/${mode}/${route}: Settings must not duplicate Appearance (cards=${m.themeCards} shortcuts=${m.settingsShortcuts})`);
        const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});const file=`${String(report.length+1).padStart(3,'0')}-${theme}-${mode}-${route}.png`;fs.writeFileSync(path.join(OUT,file),Buffer.from(shot.data,'base64'));report.push({theme,mode,route,file,...m});
      }
    }
  }
  /* Exercise the real Sleep UI once after screenshots: opening Sleep must offer Start,
     starting must persist active state and re-render a live timer, and ending must turn that
     state into one completed historical record rather than leaving an incomplete row. */
  await evalJs("localStorage.setItem('milkflow-experience-theme-v1','safari')");
  await reach('baby-home'); await sleep(120);
  await evalJs("document.querySelector('[data-sleep]')?.click()"); await sleep(80);
  const sleepStartUi=await evalJs(`!!document.querySelector('.sleep-start-main[data-sleep-start="0"]')`);
  if(!sleepStartUi)failures.push('sleep workflow: Sleep did not open the Start/Completed choice');
  await evalJs(`document.querySelector('.sleep-start-main[data-sleep-start="0"]')?.click()`); await sleep(140);
  const active=await evalJs(`(()=>{const s=JSON.parse(localStorage.getItem('milkflow-family-v4-state')||'{}');return{active:!!s.baby?.activeSleep,live:!!document.querySelector('.mf-care-ribbon button.sleep-live')}})()`);
  if(!active?.active||!active?.live)failures.push(`sleep workflow: starting did not persist/live-render active=${active?.active} live=${active?.live}`);
  await evalJs("document.querySelector('[data-sleep]')?.click()"); await sleep(80);
  if(!await evalJs("!!document.querySelector('[data-sleep-end]')"))failures.push('sleep workflow: running timer does not offer End sleep');
  await evalJs("document.querySelector('[data-sleep-end]')?.click()"); await sleep(180);
  const ended=await evalJs(`(()=>{const s=JSON.parse(localStorage.getItem('milkflow-family-v4-state')||'{}'),a=(s.babyEvents||[]).filter(e=>e.eventType==='sleep'&&e.captureMode==='timer');return{active:!!s.baby?.activeSleep,count:a.length,duration:a.at(-1)?.durationMinutes||0}})()`);
  if(ended?.active||ended?.count<1||ended?.duration<1)failures.push(`sleep workflow: End sleep did not create a completed timer record active=${ended?.active} count=${ended?.count} duration=${ended?.duration}`);

  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({failures,report},null,2));
  console.log(`Browser QA rendered ${report.length} route/theme/mode views.`);
  /* De-duplicated: one broken asset referenced by every theme is one defect, not 190. */
  const uniq=a=>[...new Set(a)];
  for(const err of uniq(consoleErrors.map(x=>x.replace(/^[^:]+: /,'')))) failures.push(`runtime error: ${err}`);
  for(const req of uniq(failedRequests.map(x=>x.replace(/^[^:]+: /,'')))) failures.push(`failed request: ${req}`);
  if(failures.length){console.error(`Browser QA failed:\n- ${failures.join('\n- ')}`);process.exitCode=1;}else console.log(`Browser QA passed ${report.length} views: nine selectable theme scenes on Mom/Baby/Settings, loaded previews, no hero theme labels, independent component art, navigation and light/dark surfaces are rendered from production build.`);
}finally{try{ws?.close();}catch{}proc?.kill();server.close();}
