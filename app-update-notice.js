(() => {
'use strict';

/* "MilkFlow update ready" used to appear twice for every deploy, and could not be got rid of.
 *
 * Both faults came from the same place: the banner was driven by service-worker EVENTS rather
 * than by whether this page is actually out of date. The worker calls skipWaiting(), so it
 * activates under the running page and fires controllerchange - banner one. The reload that
 * follows loads the new build, and the pageshow/visibilitychange handlers fired the banner
 * again on a page that was already current - banner two. There was no dismiss control either,
 * so a wrong banner sat on top of the tab bar until you gave in and reloaded.
 *
 * The version is the question, so the version is what we ask. A worker's cache is named for
 * the build it holds; if a cache exists for a build that is not the one this page is running,
 * an update really is ready. After the reload the two agree and nothing is shown.
 */

const PAGE_VERSION = String(window.MILKFLOW_BUILD?.version || '');
let dismissed = false;

function injectStyle(){
  if(document.getElementById('updateNoticeStyle'))return;
  const el=document.createElement('style');el.id='updateNoticeStyle';el.textContent=`
  .app-update-notice{position:fixed;left:50%;bottom:calc(124px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;width:min(92vw,430px);display:flex;align-items:center;gap:10px;padding:12px 12px 12px 15px;border-radius:18px;background:var(--ink);color:var(--on-ink,#fff);box-shadow:0 14px 38px rgba(20,25,40,.25)}
  .app-update-notice>div{flex:1 1 auto;min-width:0}
  .app-update-notice strong{display:block;font-size:.86rem}.app-update-notice span{display:block;margin-top:2px;font-size:.7rem;opacity:.78}
  .app-update-notice button{border:0;border-radius:12px;background:#fff;color:#222;padding:10px 13px;font:inherit;font-size:.76rem;font-weight:850;white-space:nowrap}
  .app-update-notice .aun-later{background:transparent;color:inherit;opacity:.72;padding:10px;font-size:1.1rem;line-height:1;font-weight:700}
  `;document.head.appendChild(el);
}

/* The build this page is running, against the builds the worker has cached. */
async function updateIsReady(){
  if(!PAGE_VERSION || !('caches' in window)) return false;
  try{
    const keys = await caches.keys();
    return keys.some(k => {
      const m = /^milkflow-v(.+)$/.exec(k);
      return m && m[1] !== PAGE_VERSION;
    });
  }catch{ return false; }
}

function show(){
  if(dismissed || document.getElementById('appUpdateNotice'))return;
  injectStyle();
  const box=document.createElement('div');box.id='appUpdateNotice';box.className='app-update-notice';
  box.innerHTML='<div><strong>MilkFlow update ready</strong><span>Update when you are finished entering data.</span></div>'
    + '<button type="button" class="aun-now">Update now</button>'
    + '<button type="button" class="aun-later" aria-label="Not now">×</button>';
  box.querySelector('.aun-now').addEventListener('click',()=>location.reload());
  /* Dismiss means dismiss. It comes back on the next launch, which is soon enough. */
  box.querySelector('.aun-later').addEventListener('click',()=>{dismissed=true;box.remove();});
  document.body.appendChild(box);
}

async function showIfStale(){
  if(await updateIsReady()) show();
}
async function check(){
  if(!('serviceWorker' in navigator))return;
  try{const reg=await navigator.serviceWorker.getRegistration();await reg?.update?.();}catch{}
  showIfStale();
}

if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',showIfStale);
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.ready;
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='activated')showIfStale();});
      });
    }catch{}
    showIfStale();
  });
  window.addEventListener('pageshow',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
}
})();
