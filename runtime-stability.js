(() => {
'use strict';

/*
 * MilkFlow runtime stability layer.
 *
 * Several optional home-screen modules enhance the same #view after app.js renders it.
 * They intentionally observe #view so they can re-apply after navigation, but an observer
 * can otherwise react to its own DOM patch and start a replace -> observe -> replace loop.
 * On mobile that looks like tabs jumping or the screen continually re-laying out.
 *
 * Keep the observers useful, but suppress only rapid, identical mutation cycles. Real
 * navigation/state changes have a different mutation signature and still pass through.
 */
const NativeMutationObserver = window.MutationObserver;

function nodeKey(node){
  if(!node) return 'null';
  if(node.nodeType===3) return `#text:${String(node.textContent||'').slice(0,80)}`;
  if(node.nodeType!==1) return `#${node.nodeType}`;
  const id=node.id?`#${node.id}`:'';
  const cls=typeof node.className==='string'&&node.className
    ? `.${node.className.trim().split(/\s+/).slice(0,4).join('.')}`:'';
  return `${node.tagName||'EL'}${id}${cls}:${String(node.textContent||'').trim().slice(0,55)}`;
}
function targetKey(node){
  if(!node) return 'none';
  if(node.nodeType===3) node=node.parentElement;
  if(!node) return 'none';
  if(node.id) return `#${node.id}`;
  const cls=typeof node.className==='string'&&node.className
    ? `.${node.className.trim().split(/\s+/).slice(0,3).join('.')}`:'';
  return `${node.tagName||'NODE'}${cls}`;
}
function mutationSignature(records){
  return records.slice(0,20).map(r=>{
    const added=[...r.addedNodes].slice(0,8).map(nodeKey).join(',');
    const removed=[...r.removedNodes].slice(0,8).map(nodeKey).join(',');
    return `${r.type}@${targetKey(r.target)}+${added}-${removed}:${r.attributeName||''}`;
  }).join('|');
}

if(NativeMutationObserver && !window.__MILKFLOW_STABLE_MUTATION_OBSERVER__){
  class MilkFlowMutationObserver {
    constructor(callback){
      this._callback=callback;
      this._lastSignature='';
      this._lastAt=0;
      this._target=null;
      this._observer=new NativeMutationObserver((records)=>{
        // Only de-loop observers attached to the application view. Other browser/library
        // observers retain native behavior.
        if(this._target?.id!=='view'){
          this._callback(records,this);
          return;
        }
        const sig=mutationSignature(records);
        const t=performance.now();
        if(sig && sig===this._lastSignature && (t-this._lastAt)<900){
          return;
        }
        this._lastSignature=sig;
        this._lastAt=t;
        this._callback(records,this);
      });
    }
    observe(target,options){this._target=target;return this._observer.observe(target,options);}
    disconnect(){this._target=null;return this._observer.disconnect();}
    takeRecords(){return this._observer.takeRecords();}
  }
  window.MutationObserver=MilkFlowMutationObserver;
  window.__MILKFLOW_STABLE_MUTATION_OBSERVER__=true;
}

// Browser history restoration can fight app.js's deliberate scroll position during tab
// changes, especially in an installed iOS PWA. MilkFlow owns its navigation position.
try{if('scrollRestoration' in history) history.scrollRestoration='manual';}catch{}

function addStyles(){
  if(document.getElementById('mfRuntimeStabilityStyles')) return;
  const s=document.createElement('style');
  s.id='mfRuntimeStabilityStyles';
  s.textContent=`
    html{scroll-behavior:auto!important}
    #view{overflow-anchor:none}

    #bottomNav button,#personaTabs button,.side-nav button{touch-action:manipulation;-webkit-tap-highlight-color:transparent}
    body.mf-nav-settling #bottomNav button,body.mf-nav-settling #personaTabs button{transition:none!important}
  `;
  document.head.appendChild(s);
}

let navLockUntil=0;
function isPrimaryNav(el){
  return !!el?.closest?.('#bottomNav,#personaTabs,.side-nav');
}
function guardNavigation(e){
  const el=e.target?.closest?.('[data-view],[data-workspace]');
  if(!el||!isPrimaryNav(el)) return;
  const t=performance.now();
  if(t<navLockUntil){
    e.preventDefault();
    e.stopImmediatePropagation();
    return;
  }
  navLockUntil=t+260;
  document.body?.classList.add('mf-nav-settling');
  setTimeout(()=>document.body?.classList.remove('mf-nav-settling'),280);
}

// Capture first, before app.js sees accidental duplicate taps.
document.addEventListener('click',guardNavigation,true);

function settle(){
  document.body?.classList.remove('locked','mf-nav-settling');
  // A completed navigation should never leave a stale add-sheet scrim covering the new tab.
  if(!document.querySelector('dialog[open]')){
    document.getElementById('scrim')?.classList.remove('open');
    document.getElementById('sheet')?.classList.remove('open');
  }
}

if(document.readyState==='loading'){
  document.addEventListener('DOMContentLoaded',()=>{addStyles();setTimeout(settle,0);},{once:true});
}else{
  addStyles();setTimeout(settle,0);
}
window.addEventListener('pageshow',settle);
window.addEventListener('popstate',()=>setTimeout(settle,0));

window.MilkFlowRuntimeStability={version:'stable29'};
})();
