(() => {
'use strict';

/* app.js owns rendering. This adapter only publishes a lifecycle event when #view's
   direct screen content is replaced. It does not rewrite DOM APIs or own any UI. */
let queued=false;
function publish(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{queued=false;window.dispatchEvent(new CustomEvent('milkflow:base-rendered'));});
}
function start(){
  const view=document.getElementById('view');
  if(!view||view.__milkflowLifecycle)return;
  view.__milkflowLifecycle=true;
  new MutationObserver(publish).observe(view,{childList:true});
  publish();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('pageshow',publish);
})();
