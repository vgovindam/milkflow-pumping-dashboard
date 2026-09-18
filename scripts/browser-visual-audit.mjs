import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';

const ROOT=process.cwd();
const OUT=path.join(ROOT,'visual-audit');
fs.rmSync(OUT,{recursive:true,force:true});fs.mkdirSync(OUT,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webmanifest':'application/manifest+json','.json':'application/json'};
const server=http.createServer((req,res)=>{let p=new URL(req.url,'http://localhost').pathname;if(p==='/'||p==='')p='/index.html';p=decodeURIComponent(p).replace(/^\/+/, '');const file=path.join(ROOT,p);if(!file.startsWith(ROOT)||!fs.existsSync(file)||fs.statSync(file).isDirectory()){res.writeHead(404);res.end('not found');return;}res.writeHead(200,{'content-type':mime[path.extname(file)]||'application/octet-stream','cache-control':'no-store'});fs.createReadStream(file).pipe(res);});
await new Promise(r=>server.listen(4173,'127.0.0.1',r));

const candidates=['google-chrome','google-chrome-stable','chromium','chromium-browser'];
const chrome=candidates.find(c=>spawnSync('which',[c],{encoding:'utf8'}).status===0);
if(!chrome){console.error('Browser visual audit failed: Chrome/Chromium not available');process.exitCode=1;server.close();process.exit();}
const exe=spawnSync('which',[chrome],{encoding:'utf8'}).stdout.trim();
const proc=spawn(exe,['--headless=new','--no-sandbox','--disable-gpu','--disable-dev-shm-usage','--remote-debugging-port=9222','--user-data-dir=/tmp/milkflow-visual-audit','--window-size=390,844','about:blank'],{stdio:'ignore'});

let debugging=false;
for(let i=0;i<60&&!debugging;i++){
  try{const r=await fetch('http://127.0.0.1:9222/json/version');debugging=r.ok;}catch{}
  if(!debugging)await sleep(100);
}
if(!debugging){proc.kill();server.close();throw new Error('Could not start Chrome DevTools');}

const appUrl='http://127.0.0.1:4173/?visual-audit=1#mom-home';
const targetRes=await fetch(`http://127.0.0.1:9222/json/new?${encodeURIComponent(appUrl)}`,{method:'PUT'});
if(!targetRes.ok){proc.kill();server.close();throw new Error(`Could not create app page target (${targetRes.status})`);}
const target=await targetRes.json();
const wsUrl=target.webSocketDebuggerUrl;
if(!wsUrl){proc.kill();server.close();throw new Error('App target has no DevTools websocket');}

const ws=new WebSocket(wsUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
let seq=0;const pending=new Map();
ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id&&pending.has(m.id)){const {resolve,reject}=pending.get(m.id);pending.delete(m.id);m.error?reject(new Error(m.error.message)):resolve(m.result);}};
const cdp=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});ws.send(JSON.stringify({id,method,params}));});
const evalJs=async expression=>{const r=await cdp('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw new Error(r.exceptionDetails.text||'evaluation error');return r.result?.value;};

await cdp('Page.enable');await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true,screenWidth:390,screenHeight:844});
await sleep(3200);
await evalJs("document.documentElement.classList.remove('mf-booting')");

const allRoutes=['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','development','doctor','more','settings','set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'];
const passes=[
  {theme:'safari',routes:allRoutes},
  {theme:'clean',routes:allRoutes},
  {theme:'butterfly',routes:['baby-home','set-appearance']},
  {theme:'princess',routes:['baby-home','set-appearance']},
  {theme:'unicorn',routes:['baby-home','set-appearance']},
];
const themeAsset={safari:'themes-v2/safari/',butterfly:'themes-v2/butterfly/',princess:'themes-v2/princess/',unicorn:'themes-v2/unicorn/'};
const failures=[];const report=[];
const initial=await evalJs(`(()=>({href:location.href,screen:document.body.dataset.screen||'',realm:document.body.dataset.realm||'',hash:location.hash,views:document.querySelectorAll('[data-view]').length,viewChildren:document.getElementById('view')?.children.length||0,text:(document.body.innerText||'').slice(0,160)}))()`);
console.log('Browser audit initial state:',JSON.stringify(initial));
if(!initial.href.startsWith('http://127.0.0.1:4173/')) failures.push(`audit harness attached to wrong page: ${initial.href}`);

async function reach(route){
  await evalJs(`location.hash=${JSON.stringify('#'+route)}`);
  for(let i=0;i<14;i++){
    await sleep(90);
    const s=await evalJs('document.body.dataset.screen||""');
    if(s===route)return true;
  }
  return false;
}

for(const pass of passes){
  const theme=pass.theme;
  await evalJs(`localStorage.setItem('milkflow-experience-theme-v1',${JSON.stringify(theme)});document.documentElement.dataset.experienceTheme=${JSON.stringify(theme)};window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:${JSON.stringify(theme)}}}))`);
  await sleep(220);
  for(const route of pass.routes){
    const ok=await reach(route);
    if(!ok){const current=await evalJs('document.body.dataset.screen||""');failures.push(`${theme}/${route}: route not reachable (screen=${current||'unset'})`);continue;}
    for(const mode of ['light','dark']){
      await evalJs(`document.documentElement.dataset.theme=${JSON.stringify(mode)};document.querySelector('.main')?.scrollTo(0,0)`);await sleep(240);
      const metrics=await evalJs(`(()=>{
        const v=document.getElementById('view'),n=document.getElementById('bottomNav'),main=document.querySelector('.main');
        const vr=v?.getBoundingClientRect(),nr=n?.getBoundingClientRect();
        const icons=[...document.querySelectorAll('#bottomNav .ico,#bottomNav .gly')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}).length;
        const visibleText=[...document.querySelectorAll('#view h1,#view h2,#view h3,#view strong')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity||1)>0}).length;
        const doctorTables=document.querySelectorAll('.qa-grid,.daily-table').length;
        const paddingBottom=v?parseFloat(getComputedStyle(v).paddingBottom)||0:0;
        const navHeight=nr?.height||0;
        const backgroundImage=main?getComputedStyle(main).backgroundImage:'';
        const previews=[...document.querySelectorAll('#mfExperiencePanel .mf-experience-preview img')].map(img=>({src:img.getAttribute('src')||'',naturalWidth:img.naturalWidth||0,w:img.getBoundingClientRect().width,h:img.getBoundingClientRect().height,fit:getComputedStyle(img).objectFit}));
        const cards=document.querySelectorAll('#mfExperiencePanel .mf-experience-option').length;
        const selected=document.querySelectorAll('#mfExperiencePanel [aria-pressed="true"]').length;
        const diaper=[...document.querySelectorAll('.mf-diaper-blob')].map(x=>{const r=x.getBoundingClientRect(),b=x.querySelector('b'),br=b?.getBoundingClientRect(),p=getComputedStyle(x,'::before');const left=parseFloat(p.left)||0,width=parseFloat(p.width)||0;return{kind:[...x.classList].find(k=>['wet','poop','both'].includes(k))||'',iconRight:r.left+left+width,badgeLeft:br?.left||0,gap:(br?.left||0)-(r.left+left+width),w:r.width};});
        const feed=[...document.querySelectorAll('.mf-feed-card')].map(x=>{const r=x.getBoundingClientRect(),strong=x.querySelector('strong')?.getBoundingClientRect(),p=getComputedStyle(x,'::before');const top=parseFloat(p.top)||0,height=parseFloat(p.height)||0;return{kind:[...x.classList].find(k=>['milk','nurse','formula'].includes(k))||'',iconBottom:r.top+top+height,textTop:strong?.top||0,gap:(strong?.top||0)-(r.top+top+height),w:r.width};});
        return{screen:document.body.dataset.screen||'',realm:document.body.dataset.realm||'',theme:document.documentElement.dataset.experienceTheme||'',viewChildren:v?.children.length||0,viewHeight:vr?.height||0,mainWidth:main?.clientWidth||0,scrollWidth:main?.scrollWidth||0,navVisible:!!nr&&nr.width>250&&nr.bottom<=innerHeight+2&&nr.top<innerHeight,navIcons:icons,visibleText,doctorTables,paddingBottom,navHeight,backgroundImage,previews,cards,selected,diaper,feed};
      })()`);
      if(metrics.viewChildren<1||metrics.viewHeight<40)failures.push(`${theme}/${mode}/${route}: empty view`);
      if(metrics.visibleText<1)failures.push(`${theme}/${mode}/${route}: no visible headings/content`);
      if(metrics.scrollWidth>metrics.mainWidth+2)failures.push(`${theme}/${mode}/${route}: horizontal overflow ${metrics.scrollWidth}>${metrics.mainWidth}`);
      if(!metrics.navVisible)failures.push(`${theme}/${mode}/${route}: bottom nav not visible`);
      if(metrics.navIcons<4)failures.push(`${theme}/${mode}/${route}: bottom nav icons missing (${metrics.navIcons})`);
      if(metrics.paddingBottom<metrics.navHeight+20)failures.push(`${theme}/${mode}/${route}: view bottom padding ${metrics.paddingBottom}px does not safely clear ${metrics.navHeight}px nav`);
      if(route==='doctor'&&metrics.doctorTables<2)failures.push(`${theme}/${mode}/${route}: Doctor summary blocks not rendered`);
      if(route==='baby-home'&&themeAsset[theme]&&!metrics.backgroundImage.includes(themeAsset[theme])) failures.push(`${theme}/${mode}/${route}: expected ${themeAsset[theme]} is not the active page background`);
      if(route==='baby-home'&&theme==='safari'){
        for(const d of metrics.diaper){if(d.w>20&&d.gap<7)failures.push(`${theme}/${mode}/${route}: ${d.kind} diaper badge crowds semantic icon (${d.gap.toFixed(1)}px gap)`);}
        for(const f of metrics.feed){if(f.w>20&&f.gap<5)failures.push(`${theme}/${mode}/${route}: ${f.kind} feed icon crowds its title (${f.gap.toFixed(1)}px gap)`);}
      }
      if(route==='set-appearance'){
        if(metrics.cards!==4)failures.push(`${theme}/${mode}/${route}: expected 4 artwork theme cards, found ${metrics.cards}`);
        if(metrics.previews.length!==4||metrics.previews.some(p=>p.naturalWidth<1||p.w<90||p.h<70||p.fit!=='cover')) failures.push(`${theme}/${mode}/${route}: theme previews are missing, poorly sized, or not cover-cropped`);
        if(metrics.selected!==1)failures.push(`${theme}/${mode}/${route}: expected one selected experience option, found ${metrics.selected}`);
      }
      const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});
      const file=`${String(report.length+1).padStart(3,'0')}-${theme}-${mode}-${route}.png`;
      fs.writeFileSync(path.join(OUT,file),Buffer.from(shot.data,'base64'));report.push({theme,mode,route,file,...metrics});
    }
  }
}
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({initial,failures,report},null,2));
console.log(`Browser visual audit rendered ${report.length} route/theme/mode views.`);
if(failures.length){console.error(`Browser visual audit failed:\n- ${failures.join('\n- ')}`);process.exitCode=1;}else console.log('Browser visual audit passed: navigation clears content, Safari feed/diaper artwork does not overlap, theme preview art loads/crops correctly, all core routes render in light/dark mode, and every visual world renders on Baby Home/Appearance.');
try{ws.close();}catch{}proc.kill();server.close();
