(() => {
'use strict';

let sawControllerChange=false;

function injectStyle(){
  if(document.getElementById('updateNoticeStyle'))return;
  const el=document.createElement('style');el.id='updateNoticeStyle';el.textContent=`
  .app-update-notice{position:fixed;left:50%;bottom:calc(84px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:9999;width:min(92vw,430px);display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 13px 12px 15px;border-radius:18px;background:var(--ink);color:var(--on-ink,#fff);box-shadow:0 14px 38px rgba(20,25,40,.25)}
  .app-update-notice strong{display:block;font-size:.86rem}.app-update-notice span{display:block;margin-top:2px;font-size:.7rem;opacity:.78}.app-update-notice button{border:0;border-radius:12px;background:#fff;color:#222;padding:10px 13px;font:inherit;font-size:.76rem;font-weight:850;white-space:nowrap}
  `;document.head.appendChild(el);
}
function show(){
  if(document.getElementById('appUpdateNotice'))return;
  injectStyle();
  const box=document.createElement('div');box.id='appUpdateNotice';box.className='app-update-notice';
  box.innerHTML='<div><strong>MilkFlow update ready</strong><span>Update when you are finished entering data.</span></div><button type="button">Update now</button>';
  box.querySelector('button').addEventListener('click',()=>location.reload());
  document.body.appendChild(box);
}
async function check(){
  if(!('serviceWorker' in navigator))return;
  try{const reg=await navigator.serviceWorker.getRegistration();await reg?.update?.();}catch{}
}
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('controllerchange',()=>{sawControllerChange=true;show();});
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.ready;
      reg.addEventListener('updatefound',()=>{
        const worker=reg.installing;if(!worker)return;
        worker.addEventListener('statechange',()=>{if(worker.state==='installed'&&navigator.serviceWorker.controller)show();});
      });
    }catch{}
  });
  window.addEventListener('pageshow',check);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){check();if(sawControllerChange)show();}});
}
})();
