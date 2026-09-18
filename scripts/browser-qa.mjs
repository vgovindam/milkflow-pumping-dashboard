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

const candidates=['google-chrome','google-chrome-stable','chromium','chromium-browser'];
const chrome=candidates.find(c=>spawnSync('which',[c],{encoding:'utf8'}).status===0);
if(!chrome){server.close();throw new Error('Chrome/Chromium not available');}
const exe=spawnSync('which',[chrome],{encoding:'utf8'}).stdout.trim();
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
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const x=pending.get(m.id);pending.delete(m.id);m.error?x.reject(new Error(m.error.message)):x.resolve(m.result);}};
  const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
  const evalJs=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'evaluation error');return r.result?.value;};
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
  await sleep(2800);await evalJs("document.documentElement.classList.remove('mf-booting')");

  const routes=['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','development','doctor','more','settings','set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'];
  const momRoutes=new Set(['mom-home','mom-history','mom-trends','mom-stash']);
  const babyRoutes=new Set(['baby-home','baby-history','baby-trends','baby-growth','development','doctor']);
  const themes=['safari','butterfly','princess','unicorn','clean'];
  const expected={safari:'theme-composite/safari.svg',butterfly:'theme-composite/butterfly.svg',princess:'theme-composite/princess.svg',unicorn:'theme-composite/unicorn.svg'};
  const expectedIcons={safari:'theme-icons/safari.svg',butterfly:'theme-icons/butterfly.svg',princess:'theme-icons/princess.svg',unicorn:'theme-icons/unicorn.svg'};
  const failures=[],report=[];
  async function reach(route){await evalJs(`location.hash=${JSON.stringify('#'+route)}`);for(let i=0;i<20;i++){await sleep(100);if(await evalJs('document.body.dataset.screen||""')===route)return true;}return false;}

  for(const theme of themes){
    await evalJs(`localStorage.setItem('milkflow-experience-theme-v1',${JSON.stringify(theme)});window.MilkFlowExperience?.apply?.(${JSON.stringify(theme)});window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:${JSON.stringify(theme)}}}))`);await sleep(180);
    for(const route of routes){
      if(!await reach(route)){failures.push(`${theme}/${route}: route did not render`);continue;}
      for(const mode of ['light','dark']){
        await evalJs(`document.documentElement.dataset.theme=${JSON.stringify(mode)};document.querySelector('.main')?.scrollTo(0,0)`);await sleep(170);
        const m=await evalJs(`(()=>{const v=document.getElementById('view'),n=document.getElementById('bottomNav'),main=document.querySelector('.main'),heroBaby=document.querySelector('.mf-animal-hero'),heroMom=document.querySelector('.mf-dream-hero'),head=document.querySelector('.page-head'),feed=document.querySelector('.mf-feed-card.milk'),pump=document.querySelector('.mf-dream-actions .quick-tile[data-mom="pump"] .tile-art');const vr=v?.getBoundingClientRect(),nr=n?.getBoundingClientRect();const icons=[...document.querySelectorAll('#bottomNav .ico,#bottomNav .gly')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}).length;const previewImages=[...document.querySelectorAll('#mfExperiencePanel .mf-experience-preview img')];const momCritical=[...document.querySelectorAll('.mf-dream-progress strong,.mf-dream-next button,.mf-dream-metrics .metric strong,.mf-dream-journey .mf-journey-stop strong,.mf-dream-actions .quick-tile strong')];const darkReadable=momCritical.every(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x),c=s.color;return r.width>1&&r.height>1&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity||1)>=.9&&c!=='rgba(0, 0, 0, 0)'&&c!=='transparent'});return{darkReadable,darkCriticalCount:momCritical.length,children:v?.children.length||0,height:vr?.height||0,mainWidth:main?.clientWidth||0,scrollWidth:main?.scrollWidth||0,navVisible:!!nr&&nr.width>250&&nr.bottom<=innerHeight+3&&nr.top<innerHeight,icons,padding:v?parseFloat(getComputedStyle(v).paddingBottom)||0:0,navHeight:nr?.height||0,realm:document.body.dataset.realm||'',mainBg:main?getComputedStyle(main).backgroundImage:'',babyHeroBg:heroBaby?getComputedStyle(heroBaby).backgroundImage:'',momHeroBg:heroMom?getComputedStyle(heroMom).backgroundImage:'',momHeroBefore:heroMom?getComputedStyle(heroMom,'::before').content:'',momHeroAfter:heroMom?getComputedStyle(heroMom,'::after').content:'',babyHeroBefore:heroBaby?getComputedStyle(heroBaby,'::before').content:'',babyHeroAfter:heroBaby?getComputedStyle(heroBaby,'::after').content:'',pageHeadArt:head?getComputedStyle(head,'::after').backgroundImage:'',feedArt:feed?getComputedStyle(feed,'::after').backgroundImage:'',pumpArt:pump?getComputedStyle(pump,'::after').backgroundImage:'',themeCards:document.querySelectorAll('#mfExperiencePanel .mf-experience-option').length,selected:document.querySelectorAll('#mfExperiencePanel [aria-pressed="true"]').length,previewImages:previewImages.length,loadedPreviews:previewImages.filter(x=>x.complete&&x.naturalWidth>0).length,settingsShortcuts:document.querySelectorAll('#mfSettingsShortcuts .mf-settings-row').length,settingsMotto:!!document.getElementById('mfSettingsMotto'),doctorTables:document.querySelectorAll('.qa-grid,.daily-table,.mf-print-table').length}})()`);
        if(m.children<1||m.height<40)failures.push(`${theme}/${mode}/${route}: blank view`);
        if(m.scrollWidth>m.mainWidth+2)failures.push(`${theme}/${mode}/${route}: horizontal overflow`);
        if(!m.navVisible||m.icons<4)failures.push(`${theme}/${mode}/${route}: bottom navigation/icons not visible`);
        if(m.padding<m.navHeight+15)failures.push(`${theme}/${mode}/${route}: content can sit behind bottom navigation`);
        if(route==='doctor'&&m.doctorTables<2)failures.push(`${theme}/${mode}/${route}: doctor summary structure missing`);
        if(route==='mom-home'&&mode==='dark'&&(m.darkCriticalCount<4||!m.darkReadable))failures.push(`${theme}/${mode}/${route}: critical Mom numbers/buttons are not visibly readable`);
        const art=expected[theme],iconArt=expectedIcons[theme],themedRealm=momRoutes.has(route)||babyRoutes.has(route);
        if(art&&themedRealm&&!m.mainBg.includes(art))failures.push(`${theme}/${mode}/${route}: selected world is missing from real page canvas (${art})`);
        if(route==='baby-home'&&art&&!m.babyHeroBg.includes(art))failures.push(`${theme}/${mode}/${route}: selected world is missing from Baby hero`);
        if(route==='mom-home'&&art&&!m.momHeroBg.includes(art))failures.push(`${theme}/${mode}/${route}: selected world is missing from Mom hero`);
        if(art&&babyRoutes.has(route)&&route!=='baby-home'&&!m.pageHeadArt.includes(art))failures.push(`${theme}/${mode}/${route}: Baby page header is missing selected artwork`);
        if(art&&momRoutes.has(route)&&route!=='mom-home'&&!m.pageHeadArt.includes(art))failures.push(`${theme}/${mode}/${route}: Mom page header is missing selected artwork`);
        if(route==='mom-home'&&art&&![m.momHeroBefore,m.momHeroAfter].every(x=>!x||x==='none'||x==='normal'||x==='""'))failures.push(`${theme}/${mode}/${route}: Mom hero is rendering decorative/theme-name pseudo content`);
        if(route==='baby-home'&&art&&![m.babyHeroBefore,m.babyHeroAfter].every(x=>!x||x==='none'||x==='normal'||x==='""'))failures.push(`${theme}/${mode}/${route}: Baby hero is rendering decorative/theme-name pseudo content`);
        if(route==='baby-home'&&iconArt&&!m.feedArt.includes(iconArt))failures.push(`${theme}/${mode}/${route}: independent Baby component icon is not using ${iconArt}`);
        if(route==='mom-home'&&iconArt&&!m.pumpArt.includes(iconArt))failures.push(`${theme}/${mode}/${route}: independent Mom component icon is not using ${iconArt}`);
        if(route==='set-appearance'&&(m.themeCards!==4||m.selected!==1||m.previewImages!==4||m.loadedPreviews!==4))failures.push(`${theme}/${mode}/${route}: theme selector previews invalid cards=${m.themeCards} selected=${m.selected} images=${m.previewImages} loaded=${m.loadedPreviews}`);
        if(route==='settings'&&theme!=='clean'&&(!m.mainBg.includes(art)||m.themeCards!==4||m.selected!==1||m.previewImages!==4||m.loadedPreviews!==4||m.settingsShortcuts!==4||!m.settingsMotto))failures.push(`${theme}/${mode}/${route}: immersive Settings invalid cards=${m.themeCards} selected=${m.selected} previews=${m.loadedPreviews}/${m.previewImages} shortcuts=${m.settingsShortcuts} motto=${m.settingsMotto}`);
        const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});const file=`${String(report.length+1).padStart(3,'0')}-${theme}-${mode}-${route}.png`;fs.writeFileSync(path.join(OUT,file),Buffer.from(shot.data,'base64'));report.push({theme,mode,route,file,...m});
      }
    }
  }
  fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({failures,report},null,2));
  console.log(`Browser QA rendered ${report.length} route/theme/mode views.`);
  if(failures.length){console.error(`Browser QA failed:\n- ${failures.join('\n- ')}`);process.exitCode=1;}else console.log('Browser QA passed 190 views: self-contained theme scenes on Mom/Baby/Settings, loaded previews, no hero theme labels, independent component art, navigation and light/dark surfaces are rendered from production build.');
}finally{try{ws?.close();}catch{}proc?.kill();server.close();}
