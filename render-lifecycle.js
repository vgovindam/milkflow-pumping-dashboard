(() => {
'use strict';

/*
 * Render lifecycle contract.
 *
 * app.js remains the only screen renderer. This module does three narrowly scoped jobs:
 * 1) publish one post-render event for other canonical controllers;
 * 2) reset the app's real mobile scroll container only when the route changes;
 * 3) replace a genuinely empty render with a small recovery surface instead of leaving
 *    the user on a blank page.
 *
 * It never rewrites DOM prototypes, never observes subtrees and never owns app data.
 */
let queued=false;
let lastScreen='';

function appScroller(){
  return matchMedia('(max-width:760px)').matches
    ? document.querySelector('.main')
    : document.scrollingElement;
}

function resetRouteScroll(){
  const main=document.querySelector('.main');
  if(main) main.scrollTop=0;
  if(document.scrollingElement) document.scrollingElement.scrollTop=0;
  window.scrollTo({top:0,left:0,behavior:'auto'});
}

function recoveryMarkup(screen){
  const baby=String(screen||'').startsWith('baby');
  return `<section class="mf-render-recovery" role="status">
    <div class="mf-render-recovery-icon" aria-hidden="true">↻</div>
    <div><strong>This screen did not finish loading.</strong><span>Your saved records are still on this device. Retry the screen or return home.</span></div>
    <button type="button" onclick="location.reload()">Retry</button>
    <button type="button" data-view="${baby?'baby-home':'mom-home'}">Home</button>
  </section>`;
}

function verifyScreen(screen){
  const view=document.getElementById('view');
  if(!view||document.documentElement.classList.contains('mf-booting'))return;
  if(view.firstElementChild)return;
  console.error('MilkFlow render invariant: empty #view',screen);
  view.innerHTML=recoveryMarkup(screen);
  resetRouteScroll();
}

function publish(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>{
    queued=false;
    const screen=document.body.dataset.screen||location.hash.slice(1)||'';
    const routeChanged=!!screen&&screen!==lastScreen;
    if(screen) lastScreen=screen;

    window.dispatchEvent(new CustomEvent('milkflow:base-rendered',{detail:{screen,routeChanged}}));

    if(routeChanged){
      /* Core UI listeners run from the event above in the same task/microtask checkpoint.
         Reset after that work so inserted home content cannot drag the old page offset back. */
      requestAnimationFrame(()=>{
        resetRouteScroll();
        requestAnimationFrame(resetRouteScroll);
      });
    }
    requestAnimationFrame(()=>verifyScreen(screen));
  });
}

function start(){
  const view=document.getElementById('view');
  if(!view||view.__milkflowLifecycle)return;
  view.__milkflowLifecycle=true;
  new MutationObserver(publish).observe(view,{childList:true});
  publish();
}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
window.addEventListener('pageshow',()=>{publish();requestAnimationFrame(()=>{const s=appScroller();if(s&&s.scrollTop<0)s.scrollTop=0;});});
})();
