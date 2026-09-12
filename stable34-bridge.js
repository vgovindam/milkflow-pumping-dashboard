(() => {
'use strict';

/*
 * MilkFlow stable34r3 integration bridge.
 * Keeps stable34 attached after authenticated Firestore re-renders, reconciles all
 * visible "next pump" surfaces to one adaptive plan, adds compact rolling highlights,
 * protects mobile layout, adds a warm family-care color system, and provides a resilient chat route.
 *
 * Event-driven: no MutationObserver. The only render hook is the app's #view write.
 */
const STATE_KEY='milkflow-family-v4-state';
const BRIDGE_EVENT='milkflow:base-rendered';
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const round5=m=>Math.round(m/5)*5;
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const dateShift=days=>{const d=new Date(`${today()}T12:00:00`);d.setDate(d.getDate()+days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const to12=m=>{if(!Number.isFinite(m))return'—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return`${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;};
const esc=s=>String(s??'').replace(/[&<>\"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;',"'":'&#039;'}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};

function addStyles(){
  if(document.getElementById('mfStable34BridgeStyles'))return;
  const style=document.createElement('style');
  style.id='mfStable34BridgeStyles';
  style.textContent=`
    /* A calm family-care canvas: color separates meaning without turning the app into a toy. */
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .main{
      background:
        radial-gradient(circle at 90% 7%,rgba(198,167,255,.24),transparent 27%),
        radial-gradient(circle at 8% 28%,rgba(255,203,220,.18),transparent 25%),
        linear-gradient(180deg,#f9f5ff 0%,#f7f7fc 48%,#f1f7ff 100%);
    }
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .main{
      background:
        radial-gradient(circle at 90% 8%,rgba(167,220,255,.25),transparent 27%),
        radial-gradient(circle at 8% 36%,rgba(181,236,218,.20),transparent 25%),
        linear-gradient(180deg,#f3f9ff 0%,#f7f8fd 46%,#f1faf7 100%);
    }
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .topbar{background:rgba(249,245,255,.88)}
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .topbar{background:rgba(243,249,255,.88)}

    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .mom-hero{
      background:linear-gradient(135deg,#fff9fd 0%,#f6edff 48%,#e9efff 100%)!important;
      border-color:#e5d8fb!important;
    }
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .mf-core-plan{
      background:linear-gradient(135deg,#f7efff 0%,#f3f0ff 45%,#edf6ff 100%)!important;
      border-color:#ddd3f3!important;
    }
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .panel{
      background:linear-gradient(145deg,rgba(255,255,255,.90),rgba(244,240,255,.86))!important;
      border-color:#e3dcf1!important;
    }
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .schedule-card{background:#f6f3fc!important;border-color:#e8e0f4!important}
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .schedule-card.done{background:#e9f7f0!important;border-color:#cae9db!important}
    :root:not([data-theme="dark"]) body[data-screen="mom-home"] .schedule-card.mf-r2-next{background:#eee5ff!important;border-color:#cab5f2!important}

    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .timeline-card{
      background:linear-gradient(135deg,#f7fbff 0%,#edf8ff 50%,#eefaf5 100%)!important;
      border-color:#d8e9ef!important;
    }
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .panel{
      background:linear-gradient(145deg,rgba(255,255,255,.93),rgba(237,248,255,.82))!important;
      border-color:#dcebf2!important;
    }
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .mf-care-ribbon button:nth-child(1){background:#edf0ff!important;color:#565fad!important}
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .mf-care-ribbon button:nth-child(2){background:#fff0f5!important;color:#aa5576!important}
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .mf-care-ribbon button:nth-child(3){background:#eaf6ff!important;color:#397a9e!important}
    :root:not([data-theme="dark"]) body[data-screen="baby-home"] .mf-care-ribbon button:nth-child(4){background:#eaf8f2!important;color:#347d69!important}
    :root:not([data-theme="dark"]) .mf-profile-photo{box-shadow:0 0 0 4px rgba(255,255,255,.72),0 7px 18px rgba(62,67,95,.08)}

    .mf-feed-main{min-width:0!important;min-height:138px!important;padding:20px 20px 22px!important;border-radius:34px 48px 38px 44px / 40px 34px 46px 38px!important;overflow:hidden!important}
    .mf-feed-main strong,.mf-feed-main>span{display:block;max-width:76%;white-space:normal;overflow-wrap:anywhere}
    .mf-feed-main strong{line-height:1.08!important}.mf-feed-main>span{line-height:1.3!important;margin-top:5px!important;padding-bottom:1px}.mf-feed-main em{max-width:66%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mf-feed-side button,.mf-diaper-blob{min-width:0;overflow:hidden}.mf-feed-side strong,.mf-feed-side small,.mf-diaper-blob strong,.mf-diaper-blob span{overflow-wrap:anywhere}

    #syncFoot{display:none!important}

    .mf-r2-highlights{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;margin:10px 0 14px}
    .mf-r2-highlight{min-width:0;padding:11px 10px 10px;border-radius:18px;background:var(--surface,#fff);border:1px solid var(--line-soft,var(--line,#e8e6ee));box-shadow:0 5px 14px rgba(42,47,73,.035)}
    :root:not([data-theme="dark"]) .mf-r2-highlight.mom:nth-child(1){background:linear-gradient(145deg,#f3eaff,#ede9ff);border-color:#dfd1f4}
    :root:not([data-theme="dark"]) .mf-r2-highlight.mom:nth-child(2){background:linear-gradient(145deg,#fff0f5,#fbe9f3);border-color:#f0d9e5}
    :root:not([data-theme="dark"]) .mf-r2-highlight.mom:nth-child(3){background:linear-gradient(145deg,#ebf8f4,#e6f4ff);border-color:#d5ebe4}
    :root:not([data-theme="dark"]) .mf-r2-highlight.baby:nth-child(1){background:linear-gradient(145deg,#e7f5ff,#e9f3ff);border-color:#d4e8f5}
    :root:not([data-theme="dark"]) .mf-r2-highlight.baby:nth-child(2){background:linear-gradient(145deg,#f2ecff,#eeeaff);border-color:#dfd7f1}
    :root:not([data-theme="dark"]) .mf-r2-highlight.baby:nth-child(3){background:linear-gradient(145deg,#e7f8f1,#eef9e9);border-color:#d3ebdf}
    .mf-r2-highlight>span{display:block;color:var(--muted,#74798a);font-size:9px;font-weight:800;letter-spacing:.02em}
    .mf-r2-highlight>strong{display:block;margin-top:3px;font:800 18px var(--display,inherit);letter-spacing:-.025em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    .mf-r2-highlight>small{display:block;margin-top:3px;color:var(--muted,#74798a);font-size:8.5px;line-height:1.3}
    .mf-r2-bar{height:4px;border-radius:999px;background:rgba(255,255,255,.68);overflow:hidden;margin-top:7px}.mf-r2-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--mom,#7653c6),#b16cce);width:var(--p)}
    .schedule-strip .schedule-card.mf-r2-next{outline:2px solid color-mix(in srgb,var(--mom,#7653c6) 42%,transparent)}
    .schedule-card .mf-r2-plan-status{font-size:13px;font-weight:900;line-height:1}
    .timeline-card{overflow:hidden}.timeline-track{isolation:isolate}.timeline-track .mf-day-elapsed{position:absolute;z-index:0;left:0;top:0;bottom:0;border-radius:inherit;background:linear-gradient(90deg,rgba(122,91,205,.12),rgba(66,160,196,.14),rgba(76,181,149,.10));pointer-events:none}.timeline-track .tl-dot,.timeline-track .tl-now{z-index:2}

    @media(max-width:700px){
      .mf-chat-panel{right:8px!important;left:8px!important;width:auto!important;bottom:calc(142px + env(safe-area-inset-bottom))!important;height:min(560px,calc(100svh - 176px))!important;max-height:calc(100svh - 176px)!important;border-radius:20px!important}
      .mf-chat-head{position:relative;z-index:3;flex:0 0 auto}.mf-chat-body{min-height:0!important}.mf-chat-msg{max-width:91%!important}.mf-chat-close{flex:0 0 42px;width:42px!important;height:42px!important}.mf-chat-compose{padding-bottom:max(10px,env(safe-area-inset-bottom))!important}
    }
    @media(max-width:390px){
      .mf-feed-main strong,.mf-feed-main>span{max-width:72%}
      .mf-r2-highlights{gap:6px}.mf-r2-highlight{padding:9px 8px}.mf-r2-highlight>strong{font-size:15px}.mf-r2-highlight>small{font-size:8px}
    }
  `;
  document.head.appendChild(style);
}

function highlight(label,value,sub,tone,barPct=null){
  return `<article class="mf-r2-highlight ${tone}"><span>${esc(label)}</span><strong>${esc(value)}</strong><small>${esc(sub)}</small>${barPct==null?'':`<div class="mf-r2-bar" aria-hidden="true"><i style="--p:${clamp(barPct,0,100)}%"></i></div>`}</article>`;
}
function livePumps(s){return(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);}
function pumpsOn(s,d){return livePumps(s).filter(e=>e.date===d).sort((a,b)=>String(a.time).localeCompare(String(b.time)));}
function momTotal(s,d){
  const logged=pumpsOn(s,d).reduce((n,e)=>n+(Number(e.amountMl)||0),0),override=Number(s.dailyOverrides?.[d]);
  return Number.isFinite(override)?Math.max(logged,override):logged;
}
function momHighlights(s,p){
  const total=momTotal(s,today()),goal=Number(s.profile?.dailyGoalMl)||760,past=[];
  for(let i=1;i<=7;i++){const v=momTotal(s,dateShift(-i));if(v>0)past.push(v);}
  const avg=past.length?Math.round(past.reduce((a,b)=>a+b,0)/past.length):0,pct=goal?Math.round(total/goal*100):0;
  return highlight('Milk today',`${Math.round(total)} mL`,`${p.actual?.length||0} of ${p.target||6} pumps`,'mom')
    +highlight('Daily goal',`${pct}%`,`of ${Math.round(goal)} mL`,'mom',pct)
    +highlight('7-day avg',avg?`${avg} mL`:'—','completed days','mom');
}

function activeBabyEvents(s){
  const id=s.baby?.id||'saahas-2026';
  return(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e.babyId||e.babyId===id));
}
function diaperKind(e){
  const x=String(e?.subtype||'').toLowerCase();
  return x==='poop'||x==='dirty'?'poop':x==='both'||x==='mixed'?'both':'wet';
}
function babyHighlights(s){
  const ev=activeBabyEvents(s),d=today(),day=ev.filter(e=>e.date===d),feeds=day.filter(e=>e.eventType==='feeding');
  const bottleOz=feeds.reduce((n,e)=>n+(Number(e.amountOz??e.amount_oz)||0),0);
  const nursing=day.filter(e=>e.eventType==='nursing').length,diapers=day.filter(e=>e.eventType==='diaper');
  const wet=diapers.filter(e=>diaperKind(e)==='wet').length,poop=diapers.filter(e=>diaperKind(e)==='poop').length,both=diapers.filter(e=>diaperKind(e)==='both').length;
  const byDay=new Map();
  for(const e of ev){
    if(e.eventType!=='feeding'||e.date===d)continue;
    const oz=Number(e.amountOz??e.amount_oz)||0;
    if(oz>0)byDay.set(e.date,(byDay.get(e.date)||0)+oz);
  }
  const all=[...byDay.entries()].filter(([date,v])=>date<d&&v>0).sort((a,b)=>a[0].localeCompare(b[0]));
  const allAvg=all.length?all.reduce((n,[,v])=>n+v,0)/all.length:0,recentVals=all.slice(-7).map(([,v])=>v);
  const recentAvg=recentVals.length?recentVals.reduce((a,b)=>a+b,0)/recentVals.length:allAvg,usual=recentAvg||allAvg,pct=usual?Math.round(bottleOz/usual*100):0;
  return highlight('Milk today',`${bottleOz.toFixed(1)} oz`,`${feeds.length} bottles${nursing?` · ${nursing} nursing`:''}`,'baby')
    +highlight('Vs usual',usual?`${pct}%`:'—',usual?`${recentAvg.toFixed(1)} oz recent${allAvg?` · ${allAvg.toFixed(1)} overall`:''}`:'Builds from logged feeds','baby')
    +highlight('Diapers',String(diapers.length),`${wet} wet · ${poop} poopy · ${both} mixed`,'baby');
}

function correctedPlan(raw){
  if(!raw||!Array.isArray(raw.future)||!raw.future.length||!(raw.remaining>0))return raw;
  const now=new Date(),nowM=now.getHours()*60+now.getMinutes(),first=Number(raw.future[0]);
  if(!Number.isFinite(first)||first>=nowM-10)return raw;
  const target=Number(raw.target)||6,minGap=target===5?180:150,remaining=Math.max(1,Number(raw.remaining)||raw.future.length);
  const last=raw.last||raw.actual?.at?.(-1),lastM=mins(last?.time);
  let next=round5(Math.max(nowM+5,Number.isFinite(lastM)?lastM+minGap:nowM+5));
  const end=target===5?1440:1445,room=Math.max(0,end-next),natural=target===5?240:195;
  const step=remaining>1?clamp(Math.round(room/(remaining-1)),minGap,natural):0,future=[next];
  for(let i=1;i<remaining;i++)future.push(round5(next+step*i));
  return {...raw,future,source:'actual',last};
}

let plannerInstalled=false;
function installPlannerReconciler(){
  if(plannerInstalled||!window.MilkFlowDynamicPump?.getPlan)return;
  plannerInstalled=true;
  const api=window.MilkFlowDynamicPump,original={
    getPlan:api.getPlan.bind(api),
    previewTarget:api.previewTarget?.bind(api),
    setTodayTarget:api.setTodayTarget?.bind(api),
    setTodayNextTime:api.setTodayNextTime?.bind(api),
    clearTodayNextTime:api.clearTodayNextTime?.bind(api)
  };
  api.getPlan=()=>correctedPlan(original.getPlan());
  if(original.previewTarget)api.previewTarget=n=>correctedPlan(original.previewTarget(n));
  if(original.setTodayTarget)api.setTodayTarget=n=>correctedPlan(original.setTodayTarget(n));
  if(original.setTodayNextTime)api.setTodayNextTime=v=>correctedPlan(original.setTodayNextTime(v));
  if(original.clearTodayNextTime)api.clearTodayNextTime=()=>correctedPlan(original.clearTodayNextTime());
}

function syncMomPlan(){
  if(document.body.dataset.screen!=='mom-home')return;
  installPlannerReconciler();
  const p=window.MilkFlowDynamicPump?.getPlan?.();
  if(!p)return;
  const view=document.getElementById('view'),hero=view?.querySelector('.mom-hero');if(!view||!hero)return;

  let hi=document.getElementById('mfR2MomHighlights');
  if(!hi){hi=document.createElement('section');hi.id='mfR2MomHighlights';hi.className='mf-r2-highlights';hero.insertAdjacentElement('afterend',hi);}
  hi.innerHTML=momHighlights(read(),p);

  const chip=hero.querySelector('.chips .chip');
  if(chip)chip.textContent=p.future?.[0]?`Next ${to12(p.future[0])}`:'Pump target complete';

  const core=document.getElementById('mfCorePlan');
  if(core){
    const next=p.future?.length?`${to12(p.future[0]-10)}–${to12(p.future[0]+10)}`:'Target reached for today';
    const last=p.last||p.actual?.at?.(-1);
    core.innerHTML=`<div class="mf-core-plan-head"><strong>Today’s live plan</strong><span>${p.actual?.length||0} of ${p.target||6} done</span></div><div class="mf-core-next">${esc(next)}</div><div class="mf-core-sub">${last?`Updated from your ${to12(mins(last.time))} pump. If a planned time passes, the next session moves forward and the rest of today reflows.`:'Uses your saved baseline until today’s first pump is logged.'}</div>${p.future?.length?`<div class="mf-core-times">${p.future.map((m,i)=>`<span class="mf-core-time ${i===0?'next':''}">${to12(m)}</span>`).join('')}</div>`:''}`;
  }

  const strip=view.querySelector('.schedule-strip');
  if(strip){
    const actual=(p.actual||[]).map(e=>({kind:'done',time:mins(e.time),amount:Number(e.amountMl)||0}));
    const future=(p.future||[]).map((m,i)=>({kind:i===0?'next':'planned',time:m}));
    strip.innerHTML=[...actual,...future].filter(r=>Number.isFinite(r.time)).sort((a,b)=>a.time-b.time).map(r=>{
      const cls=r.kind==='done'?'done':r.kind==='next'?'mf-r2-next':'',status=r.kind==='done'?'✓':r.kind==='next'?'→':'○';
      const sub=r.kind==='done'?`${r.amount} mL`:r.kind==='next'?'Next · adjusts with your day':'Planned';
      return`<div class="schedule-card ${cls}"><div class="mf-r2-plan-status">${status}</div><strong>${to12(r.time)}</strong><small>${sub}</small></div>`;
    }).join('');
  }

  const s=read(),photo=s.profile?.momPhoto||'',hint=document.querySelector('#mfMomProfileLine .mf-photo-hint');
  if(photo&&hint)hint.remove();
}

function syncBabyHighlights(){
  if(document.body.dataset.screen!=='baby-home')return;
  const box=document.getElementById('mfCoreBaby'),profile=box?.querySelector('.mf-profile-line');if(!box||!profile)return;
  let hi=document.getElementById('mfR2BabyHighlights');
  if(!hi){hi=document.createElement('section');hi.id='mfR2BabyHighlights';hi.className='mf-r2-highlights';profile.insertAdjacentElement('afterend',hi);}
  hi.innerHTML=babyHighlights(read());

  const s=read(),photo=s.baby?.photo||'',small=profile.querySelector('.mf-profile-copy>small');
  if(photo&&small){
    const txt=small.textContent||'',clean=txt.replace(/\s*·?\s*Tap (?:the )?photo(?: spot)? to (?:change it|add one).*$/i,'').trim();
    if(clean)small.textContent=clean;else small.remove();
  }
}

function enhanceBabyRhythm(){
  if(document.body.dataset.screen!=='baby-home')return;
  const track=document.querySelector('.timeline-card .timeline-track');if(!track)return;
  let elapsed=track.querySelector('.mf-day-elapsed');
  if(!elapsed){elapsed=document.createElement('div');elapsed.className='mf-day-elapsed';track.prepend(elapsed);}
  const now=new Date(),pct=Math.max(0,Math.min(100,(now.getHours()*60+now.getMinutes())/1440*100));
  elapsed.style.width=`${pct.toFixed(2)}%`;
}

function enhance(){
  addStyles();installPlannerReconciler();
  requestAnimationFrame(()=>{syncMomPlan();syncBabyHighlights();enhanceBabyRhythm();});
}

function installViewRenderBridge(){
  if(window.__milkflowStable34ViewBridge)return;
  const desc=Object.getOwnPropertyDescriptor(Element.prototype,'innerHTML');if(!desc?.get||!desc?.set)return;
  window.__milkflowStable34ViewBridge=true;
  Object.defineProperty(Element.prototype,'innerHTML',{
    configurable:desc.configurable,enumerable:desc.enumerable,get:desc.get,
    set(value){
      desc.set.call(this,value);
      if(this.id==='view')queueMicrotask(()=>{window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));enhance();});
    }
  });
}

function installFamilyChatTransport(){
  if(window.__milkflowStable34FetchBridge)return;
  const nativeFetch=window.fetch?.bind(window);if(!nativeFetch)return;
  window.__milkflowStable34FetchBridge=true;
  window.fetch=async function(input,init){
    const cfg=window.MILKFLOW_CONFIG||{},primary=String(cfg.familyChatEndpoint||''),url=typeof input==='string'?input:(input?.url||'');
    if(!primary||url!==primary)return nativeFetch(input,init);
    const endpoints=[primary,...(Array.isArray(cfg.familyChatEndpoints)?cfg.familyChatEndpoints:[])].map(String).filter((v,i,a)=>v&&a.indexOf(v)===i);
    let lastResponse=null,lastError=null;
    for(const endpoint of endpoints){
      try{
        const res=await nativeFetch(endpoint,init);lastResponse=res;
        if(res.ok||![404,408,425,429,500,502,503,504].includes(res.status))return res;
      }catch(err){lastError=err;}
    }
    if(lastResponse)return lastResponse;
    throw lastError||new TypeError('MilkFlow family chat is temporarily unreachable');
  };
}

installViewRenderBridge();
installFamilyChatTransport();
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{enhance();window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));},{once:true});
else{enhance();window.dispatchEvent(new CustomEvent(BRIDGE_EVENT));}
window.addEventListener(BRIDGE_EVENT,enhance);
window.addEventListener('milkflow:chat-data',enhance);
window.addEventListener('milkflow:coach-change',enhance);
window.addEventListener('storage',e=>{if(e.key===STATE_KEY||e.key==='milkflow-pumping-coach-v1')enhance();});
setInterval(()=>{if(document.body.dataset.screen==='mom-home'||document.body.dataset.screen==='baby-home')enhance();},60000);
})();