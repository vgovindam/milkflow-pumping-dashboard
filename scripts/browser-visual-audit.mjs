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

const routes=['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','development','doctor','more','settings','set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'];
const themes=['storybook','jungle','clean'];
const failures=[];const report=[];
const initial=await evalJs(`(()=>({href:location.href,screen:document.body.dataset.screen||'',realm:document.body.dataset.realm||'',hash:location.hash,views:document.querySelectorAll('[data-view]').length,viewChildren:document.getElementById('view')?.children.length||0,text:(document.body.innerText||'').slice(0,160)}))()`);
console.log('Browser audit initial state:',JSON.stringify(initial));
if(!initial.href.startsWith('http://127.0.0.1:4173/')) failures.push(`audit harness attached to wrong page: ${initial.href}`);

async function reach(route){
  await evalJs(`location.hash=${JSON.stringify('#'+route)}`);
  for(let i=0;i<12;i++){
    await sleep(80);
    const s=await evalJs('document.body.dataset.screen||""');
    if(s===route)return true;
  }
  return false;
}

for(const theme of themes){
  await evalJs(`localStorage.setItem('milkflow-experience-theme-v1',${JSON.stringify(theme)});document.documentElement.dataset.experienceTheme=${JSON.stringify(theme)};window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:${JSON.stringify(theme)}}}))`);
  await sleep(100);
  for(const route of routes){
    const ok=await reach(route);
    if(!ok){const current=await evalJs('document.body.dataset.screen||""');failures.push(`${theme}/${route}: route not reachable (screen=${current||'unset'})`);continue;}
    for(const mode of ['light','dark']){
      await evalJs(`document.documentElement.dataset.theme=${JSON.stringify(mode)};document.querySelector('.main')?.scrollTo(0,0)`);await sleep(120);
      const metrics=await evalJs(`(()=>{const v=document.getElementById('view'),n=document.getElementById('bottomNav'),main=document.querySelector('.main');const vr=v?.getBoundingClientRect(),nr=n?.getBoundingClientRect();const icons=[...document.querySelectorAll('#bottomNav .ico,#bottomNav .gly')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>8&&r.height>8&&s.display!=='none'&&s.visibility!=='hidden'&&Number(s.opacity||1)>0}).length;const animals=[...document.querySelectorAll('.mf-animal-sticker')].map(x=>({art:x.classList.contains('has-theme-art'),svg:!!x.querySelector(':scope>svg'),img:!!x.querySelector(':scope>img.mf-theme-animal'),w:x.getBoundingClientRect().width}));const visibleText=[...document.querySelectorAll('#view h1,#view h2,#view h3,#view strong')].filter(x=>{const r=x.getBoundingClientRect(),s=getComputedStyle(x);return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'&&Number(s.opacity||1)>0}).length;const doctorTables=document.querySelectorAll('.qa-grid,.daily-table').length;return{screen:document.body.dataset.screen||'',realm:document.body.dataset.realm||'',viewChildren:v?.children.length||0,viewHeight:vr?.height||0,mainWidth:main?.clientWidth||0,scrollWidth:main?.scrollWidth||0,navVisible:!!nr&&nr.width>250&&nr.bottom<=innerHeight+2&&nr.top<innerHeight,navIcons:icons,visibleText,doctorTables,animals}})()`);
      if(metrics.viewChildren<1||metrics.viewHeight<40)failures.push(`${theme}/${mode}/${route}: empty view`);
      if(metrics.visibleText<1)failures.push(`${theme}/${mode}/${route}: no visible headings/content`);
      if(metrics.scrollWidth>metrics.mainWidth+2)failures.push(`${theme}/${mode}/${route}: horizontal overflow ${metrics.scrollWidth}>${metrics.mainWidth}`);
      if(!metrics.navVisible)failures.push(`${theme}/${mode}/${route}: bottom nav not visible`);
      if(metrics.navIcons<4)failures.push(`${theme}/${mode}/${route}: bottom nav icons missing (${metrics.navIcons})`);
      if(theme!=='clean'&&route==='baby-home'&&metrics.animals.some(a=>a.w>20&&!a.art&&!a.svg))failures.push(`${theme}/${mode}/${route}: themed animal artwork has no fallback`);
      if(route==='doctor'&&metrics.doctorTables<2)failures.push(`${theme}/${mode}/${route}: Doctor summary blocks not rendered`);
      const shot=await cdp('Page.captureScreenshot',{format:'png',fromSurface:true});
      const file=`${String(report.length+1).padStart(3,'0')}-${theme}-${mode}-${route}.png`;
      fs.writeFileSync(path.join(OUT,file),Buffer.from(shot.data,'base64'));report.push({theme,mode,route,file,...metrics});
    }
  }
}
fs.writeFileSync(path.join(OUT,'report.json'),JSON.stringify({initial,failures,report},null,2));
console.log(`Browser visual audit rendered ${report.length} route/theme/mode views.`);
if(failures.length){console.error(`Browser visual audit failed:\n- ${failures.join('\n- ')}`);process.exitCode=1;}else console.log('Browser visual audit passed: every Storybook, Jungle and Clean route rendered in light/dark mode with visible navigation, content, theme fallbacks and Doctor summary blocks.');
try{ws.close();}catch{}proc.kill();server.close();
