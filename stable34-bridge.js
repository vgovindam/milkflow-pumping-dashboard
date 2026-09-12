(() => {
'use strict';

/*
 * Stable34 integration bridge.
 * Purpose: keep the canonical stable34 home composition attached after app.js performs
 * an authenticated Firestore re-render, and harden the family-chat transport on mobile.
 * This is event-driven: no MutationObserver and no polling loop.
 */
const STATE_KEY='milkflow-family-v4-state';
const BRIDGE_EVENT='milkflow:base-rendered';
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const to12=t=>{const m=mins(t);if(!Number.isFinite(m))return '—';const h=Math.floor(m/60),mm=m%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;};
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};

function addStyles(){
  if(document.getElementById('mfStable34BridgeStyles'))return;
  const style=document.createElement('style');
  style.id='mfStable34BridgeStyles';
  style.textContent=`
    /* Keep the expressive stable34 shapes, but make their content physically safe. */
    .mf-feed-main{
      min-width:0!important;
      min-height:138px!important;
      padding:20px 20px 22px!important;
      border-radius:34px 48px 38px 44px / 40px 34px 46px 38px!important;
      overflow:hidden!important;
    }
    .mf-feed-main strong,.mf-feed-main>span{display:block;max-width:76%;white-space:normal;overflow-wrap:anywhere}
    .mf-feed-main strong{line-height:1.08!important}
    .mf-feed-main>span{line-height:1.3!important;margin-top:5px!important;padding-bottom:1px}
    .mf-feed-main em{max-width:66%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mf-feed-side button,.mf-diaper-blob{min-width:0;overflow:hidden}
    .mf-feed-side strong,.mf-feed-side small,.mf-diaper-blob strong,.mf-diaper-blob span{overflow-wrap:anywhere}

    /* Sync status belongs in Settings; keep mobile Home focused on care. */
    #syncFoot{display:none!important}

    /* Make the existing day rhythm communicate progress, not just isolated dots. */
    .timeline-card{overflow:hidden}
    .timeline-track{isolation:isolate}
    .timeline-track .mf-day-elapsed{position:absolute;z-index:0;left:0;top:0;bottom:0;border-radius:inherit;background:linear-gradient(90deg,rgba(122,91,205,.10),rgba(66,160,196,.10));pointer-events:none}
    .timeline-track .tl-dot,.timeline-track .tl-now{z-index:2}
    .mf-day-summary{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:8px 0 10px;color:var(--muted,#6f7484);font-size:11px;line-height:1.35}
    .mf-day-summary strong{color:var(--ink,#202235);font-weight:850}
    .mf-day-chip{display:inline-flex;align-items:center;gap:5px;padding:5px 8px;border-radius:999px;background:var(--surface-2,#f5f5fa);white-space:nowrap}
    .mf-day-chip i{width:7px;height:7px;border-radius:50%;display:block;background:#45a0c3}
    .mf-day-chip.diaper i{background:#55a28b}.mf-day-chip.nurse i{background:#8b71cf}

    /* Chat must stay fully reachable inside an iPhone/PWA viewport. */
    @media(max-width:700px){
      .mf-chat-panel{
        right:8px!important;left:8px!important;width:auto!important;
        bottom:calc(142px + env(safe-area-inset-bottom))!important;
        height:min(560px,calc(100svh - 176px))!important;
        max-height:calc(100svh - 176px)!important;
        border-radius:20px!important;
      }
      .mf-chat-head{position:relative;z-index:3;flex:0 0 auto}
      .mf-chat-body{min-height:0!important}
      .mf-chat-msg{max-width:91%!important}
      .mf-chat-close{flex:0 0 42px;width:42px!important;height:42px!important}
      .mf-chat-compose{padding-bottom:max(10px,env(safe-area-inset-bottom))!important}
    }
    @media(max-width:390px){
      .mf-feed-main strong,.mf-feed-main>span{max-width:72%}
      .mf-day-summary{font-size:10px;gap:6px}
    }
  `;
  document.head.appendChild(style);
}

function enhanceBabyRhythm(){
  if(document.body.dataset.screen!=='baby-home')return;
  const card=document.querySelector('.timeline-card');
  if(!card)return;
  const state=read(),id=state.baby?.id||'saahas-2026',d=today();
  const events=(Array.isArray(state.babyEvents)?state.babyEvents:[])
    .filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&e?.date===d&&(!e.babyId||e.babyId===id)&&e?.time)
    .sort((a,b)=>String(a.time).localeCompare(String(b.time)));
  const feed=events.filter(e=>e.eventType==='feeding').length;
  const nurse=events.filter(e=>e.eventType==='nursing').length;
  const diaper=events.filter(e=>e.eventType==='diaper').length;
  const last=events.at(-1);
  let summary=card.querySelector('.mf-day-summary');
  if(!summary){
    summary=document.createElement('div');summary.className='mf-day-summary';
    card.querySelector('.timeline-head')?.insertAdjacentElement('afterend',summary);
  }
  const careTotal=feed+nurse;
  summary.innerHTML=`<span><strong>Day so far</strong></span><span class="mf-day-chip"><i></i>${careTotal} feed${careTotal===1?'':'s'}</span><span class="mf-day-chip diaper"><i></i>${diaper} diaper${diaper===1?'':'s'}</span>${nurse?`<span class="mf-day-chip nurse"><i></i>${nurse} nursing</span>`:''}<span>${last?`Last care ${to12(last.time)}`:'Nothing logged yet'}</span>`;
  const track=card.querySelector('.timeline-track');
  if(track){
    let elapsed=track.querySelector('.mf-day-elapsed');
    if(!elapsed){elapsed=document.createElement('div');elapsed.className='mf-day-elapsed';track.prepend(elapsed);}
    const now=new Date(),pct=Math.max(0,Math.min(100,(now.getHours()*60+now.getMinutes())/1440*100));
    elapsed.style.width=`${pct.toFixed(2)}%`;
  }
}

function enhance(){addStyles();requestAnimationFrame(enhanceBabyRhythm);}

/*
 * app.js replaces #view during Firestore snapshot reconciliation. stable34's canonical
 * home controller runs after navigation events, so an authenticated re-render could
 * replace its composition a few seconds after load. Convert the actual #view render
 * boundary into the same navigation signal the controller already consumes.
 */
function installViewRenderBridge(){
  if(window.__milkflowStable34ViewBridge)return;
  const desc=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');
  if(!desc?.get||!desc?.set)return;
  window.__milkflowStable34ViewBridge=true;
  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:desc.configurable,
    enumerable:desc.enumerable,
    get:desc.get,
    set(value){
      desc.set.call(this,value);
      if(this.id==='view'){
        queueMicrotask(()=>{
          window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));
          // app.js ignores same-route hashchange; core-ui uses it as its existing render hook.
          window.dispatchEvent(new Event('hashchange'));
          enhance();
        });
      }
    }
  });
}

/* Retry the deployed Cloud Run route only when the Firebase alias is unreachable/server-failing. */
function installFamilyChatTransport(){
  if(window.__milkflowStable34FetchBridge)return;
  const nativeFetch=window.fetch?.bind(window);if(!nativeFetch)return;
  window.__milkflowStable34FetchBridge=true;
  window.fetch=async function(input,init){
    const cfg=window.MILKFLOW_CONFIG||{},primary=String(cfg.familyChatEndpoint||'');
    const url=typeof input==='string'?input:(input?.url||'');
    if(!primary||url!==primary)return nativeFetch(input,init);
    const endpoints=[primary,...(Array.isArray(cfg.familyChatEndpoints)?cfg.familyChatEndpoints:[])]
      .map(String).filter((v,i,a)=>v&&a.indexOf(v)===i);
    let lastResponse=null,lastError=null;
    for(const endpoint of endpoints){
      try{
        const res=await nativeFetch(endpoint,init);
        lastResponse=res;
        if(res.ok||![404,408,425,429,500,502,503,504].includes(res.status))return res;
      }catch(err){lastError=err;}
    }
    if(lastResponse)return lastResponse;
    throw lastError||new TypeError('MilkFlow family chat is temporarily unreachable');
  };
}

installViewRenderBridge();
installFamilyChatTransport();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhance();window.dispatchEvent(new Event('hashchange'));},{once:true});
else{enhance();window.dispatchEvent(new Event('hashchange'));}
window.addEventListener(BRIDGE_EVENT,enhance);
window.addEventListener('milkflow:chat-data',enhance);
})();
