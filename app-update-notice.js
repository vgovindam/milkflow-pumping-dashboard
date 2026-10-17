(() => {
'use strict';

/* Compare the running page with the published worker script. A semantic version may stay the
 * same across a hotfix, so build commit is the stronger identity; version remains the fallback.
 * sw.js is excluded from the worker fetch handler, so this request reaches the published build. */

const PAGE_VERSION=String(window.MILKFLOW_BUILD?.version||'');
const PAGE_COMMIT=String(window.MILKFLOW_BUILD?.commit||'');
const SW_URL=new URL('./sw.js',document.baseURI).href;
let publishedVersion='';
let publishedCommit='';
let dismissed=false;

function injectStyle(){
  if(document.getElementById('updateNoticeStyle'))return;
  const el=document.createElement('style');el.id='updateNoticeStyle';el.textContent=`
  .app-update-notice{position:fixed;left:50%;bottom:calc(124px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;width:min(92vw,430px);display:flex;align-items:center;gap:10px;padding:12px 12px 12px 15px;border-radius:18px;background:var(--ink);color:var(--on-ink,#fff);box-shadow:0 14px 38px rgba(20,25,40,.25)}
  .app-update-notice>div{flex:1 1 auto;min-width:0}.app-update-notice strong{display:block;font-size:.86rem}.app-update-notice span{display:block;margin-top:2px;font-size:.7rem;opacity:.78}.app-update-notice button{border:0;border-radius:12px;background:#fff;color:#222;padding:10px 13px;font:inherit;font-size:.76rem;font-weight:850;white-space:nowrap}.app-update-notice .aun-later{background:transparent;color:inherit;opacity:.72;padding:10px;font-size:1.1rem;line-height:1;font-weight:700}
  `;document.head.appendChild(el);
}
async function updateIsReady(){
  if(!PAGE_VERSION&&!PAGE_COMMIT)return false;
  try{
    const url=new URL(SW_URL);url.searchParams.set('version-check',String(Date.now()));
    const response=await fetch(url.href,{cache:'no-store'});if(!response.ok)return false;
    const source=await response.text();
    const versionMatch=source.match(/^const VERSION=['"]milkflow-v([^'"]+)['"];/m);
    const commitMatch=source.match(/^const BUILD_COMMIT=['"]([^'"]+)['"];/m);
    publishedVersion=versionMatch?.[1]||'';publishedCommit=commitMatch?.[1]||'';
    if(publishedCommit&&PAGE_COMMIT&&publishedCommit!==PAGE_COMMIT)return true;
    return !!(publishedVersion&&PAGE_VERSION&&publishedVersion!==PAGE_VERSION);
  }catch{return false;}
}
function show(){
  if(dismissed||document.getElementById('appUpdateNotice'))return;injectStyle();
  const box=document.createElement('div');box.id='appUpdateNotice';box.className='app-update-notice';
  box.innerHTML='<div><strong>MilkFlow update ready</strong><span>A newer app build is available. Update when you are finished entering data.</span></div><button type="button" class="aun-now">Update now</button><button type="button" class="aun-later" aria-label="Not now">×</button>';
  box.querySelector('.aun-now').addEventListener('click',async event=>{const button=event.currentTarget;button.disabled=true;try{const reg=await navigator.serviceWorker.getRegistration();await Promise.race([reg?.update?.(),new Promise(resolve=>setTimeout(resolve,2500))]);}catch{}const url=new URL(location.href);url.searchParams.set('milkflow-update',publishedCommit||publishedVersion||String(Date.now()));location.replace(url.href);});
  box.querySelector('.aun-later').addEventListener('click',()=>{dismissed=true;box.remove();});document.body.appendChild(box);
}
async function showIfStale(){if(await updateIsReady())show();}
async function check(){if(!('serviceWorker'in navigator))return;const inspection=showIfStale();try{const reg=await navigator.serviceWorker.getRegistration();reg?.update?.().catch(()=>{});}catch{}await inspection;}
if('serviceWorker'in navigator){navigator.serviceWorker.addEventListener('controllerchange',showIfStale);window.addEventListener('load',async()=>{try{const reg=await navigator.serviceWorker.ready;reg.addEventListener('updatefound',()=>{const worker=reg.installing;if(!worker)return;worker.addEventListener('statechange',()=>{if(worker.state==='activated')showIfStale();});});}catch{}showIfStale();});window.addEventListener('pageshow',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});}
})();
