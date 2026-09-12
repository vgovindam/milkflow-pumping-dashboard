(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
let timer=null,patching=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const when=e=>`${e?.date||''}${e?.time||''}`;
const live=s=>(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate).sort((a,b)=>when(a).localeCompare(when(b)));
function to12(t){if(!t)return '';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);return `${((h+11)%12)+1}:${pad(m)} ${h>=12?'PM':'AM'}`;}
function since(e){if(!e?.date)return '';const d=new Date(`${e.date}T${e.time||'00:00'}:00`),diff=Date.now()-d.getTime();if(!Number.isFinite(diff)||diff<0)return '';const m=Math.round(diff/60000);if(m<2)return 'just now';if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return m%60?`${h}h ${m%60}m ago`:`${h}h ago`;return `${Math.round(h/24)}d ago`;}
function ageLabel(b){if(!b)return '';const bd=new Date(`${b}T12:00:00`),nd=new Date(`${today()}T12:00:00`);const days=Math.floor((nd-bd)/86400000);if(!Number.isFinite(days)||days<0)return '';if(days<14)return `${days} days old`;if(days<70)return `${Math.floor(days/7)} weeks old`;let m=(nd.getFullYear()-bd.getFullYear())*12+(nd.getMonth()-bd.getMonth());if(nd.getDate()<bd.getDate())m--;return m<24?`${m} months old`:`${Math.floor(m/12)}y ${m%12}m`;}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Good night';}
function fmtSleep(m){m=Math.round(Number(m)||0);if(!m)return '—';const h=Math.floor(m/60),r=m%60;return h?(r?`${h}h ${r}m`:`${h}h`):`${r}m`;}
function feedDetail(e){if(!e)return 'No feed logged yet';if(e.eventType==='nursing'){const m=Number(e.durationMinutes??e.totalMinutes)||0;return `Nursing${m?` · ${m} min`:''}`;}const oz=Number(e.amountOz)||0;return `${oz?oz.toFixed(1):'—'} oz ${e.feedingType==='formula'?'formula':'breast milk'}`;}
function diaperDetail(e){if(!e)return 'No diaper logged yet';const x=String(e.subtype||'').toLowerCase();return x==='both'||x==='mixed'?'Mixed diaper':x==='poop'||x==='dirty'?'Poopy diaper':'Wet diaper';}
function nextFeed(s,last){if(!s.reminders?.feedEnabled||!last?.date||!last?.time)return null;const gap=Number(s.reminders.feedGapMin)||180,d=new Date(new Date(`${last.date}T${last.time}:00`).getTime()+gap*60000),diff=Math.round((d-Date.now())/60000);if(!Number.isFinite(diff))return null;return {label:diff<=0?`Feed due ${Math.abs(diff)}m ago`:`Next feed around ${to12(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}`,due:diff<=0};}

function stats(s){
  const ev=live(s),d=today(),day=ev.filter(e=>e.date===d);
  const feeds=day.filter(e=>e.eventType==='feeding'),nursing=day.filter(e=>e.eventType==='nursing'),diapers=day.filter(e=>e.eventType==='diaper'),sleep=day.filter(e=>e.eventType==='sleep');
  const bottleOz=feeds.reduce((n,e)=>n+(Number(e.amountOz)||0),0),sleepMin=sleep.reduce((n,e)=>n+(Number(e.durationMinutes)||0),0);
  const lastFeed=[...ev].reverse().find(e=>e.eventType==='feeding'||e.eventType==='nursing');
  const lastDiaper=[...ev].reverse().find(e=>e.eventType==='diaper');
  const lastSleep=[...ev].reverse().find(e=>e.eventType==='sleep');
  return {ev,day,feeds,nursing,diapers,sleep,bottleOz,sleepMin,lastFeed,lastDiaper,lastSleep};
}
function icon(name){
  const p={
    feed:'<path d="M20 8h8v5l4 5a7 7 0 0 1 1.5 4.3V38a6 6 0 0 1-6 6h-7a6 6 0 0 1-6-6V22.3A7 7 0 0 1 16 18l4-5Z"/><path d="M19 8h10M18 29h12"/>',
    diaper:'<path d="M10 15c8 5 20 5 28 0v16c-5 7-9 10-14 10s-9-3-14-10Z"/><path d="M17 19v16M31 19v16"/>',
    sleep:'<path d="M37 31A15 15 0 1 1 21 9a12 12 0 0 0 16 22Z"/><path d="m37 9 1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5Z"/>',
    growth:'<path d="M9 14h30v20H9Z"/><path d="M15 14v7M21 14v4M27 14v7M33 14v4"/>',
    history:'<path d="M10 25a14 14 0 1 0 4-10"/><path d="M10 11v9h9"/><path d="M25 18v8l6 3"/>'
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${p[name]||p.feed}</svg>`;
}
function fallbackBaby(){return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="mfBabyG" x1="10" y1="5" x2="92" y2="96"><stop stop-color="#dff7ff"/><stop offset=".55" stop-color="#dcf7ef"/><stop offset="1" stop-color="#ece2ff"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#mfBabyG)"/><path d="M31 48c1-15 10-25 23-25 12 0 22 10 22 24 0 17-10 29-26 29-15 0-25-11-25-27 0-7 2-13 6-18" fill="none" stroke="#4686a7" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="49" r="2.8" fill="#4686a7"/><circle cx="60" cy="49" r="2.8" fill="#4686a7"/><path d="M43 61c5 4 11 4 16 0M42 24c3-8 13-10 19-4" fill="none" stroke="#4686a7" stroke-width="3.5" stroke-linecap="round"/></svg>`;}

function style(){
  if(document.getElementById('mfBabyModernStyles'))return;
  const x=document.createElement('style');x.id='mfBabyModernStyles';x.textContent=`
  .mf-baby-modern #view>.baby-stage,.mf-baby-modern #view>.act-strip,.mf-baby-modern #view>.feed-cta,.mf-baby-modern #view>.orb-row,.mf-baby-modern #view>.pill-row,.mf-baby-modern #view>.ring-row{display:none!important}
  .mf-baby-modern #view{max-width:1020px}
  .mf-baby-modern-home{display:grid;gap:14px;margin-bottom:18px}
  .mf-baby-hero{position:relative;overflow:hidden;border:0;border-radius:31px;padding:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--baby-soft) 55%,var(--surface)),color-mix(in srgb,var(--feed) 48%,var(--surface)));display:flex;align-items:center;gap:18px;min-height:176px}
  .mf-baby-hero:after{content:'';position:absolute;width:190px;height:190px;border-radius:50%;right:-76px;bottom:-110px;background:color-mix(in srgb,var(--baby) 8%,transparent)}
  .mf-baby-photo{position:relative;z-index:2;width:94px;height:94px;flex:0 0 auto;border-radius:50%;overflow:hidden;background:transparent}.mf-baby-photo img,.mf-baby-photo svg{width:100%;height:100%;display:block;object-fit:cover}
  .mf-baby-copy{position:relative;z-index:2;min-width:0;flex:1}.mf-baby-kicker{font-size:11px;font-weight:800;color:var(--baby-ink);margin-bottom:6px}.mf-baby-copy h2{font:800 30px var(--display);letter-spacing:-.04em;margin:0 0 6px;line-height:1.05}.mf-baby-copy p{margin:0;color:var(--muted);font-size:12px;font-weight:650;line-height:1.45}.mf-baby-due{display:inline-flex;margin-top:12px;border-radius:999px;padding:7px 10px;background:color-mix(in srgb,var(--surface) 72%,transparent);font-size:10.5px;font-weight:800;color:var(--ink-2)}.mf-baby-due.due{color:var(--danger);background:var(--danger-soft)}
  .mf-care-actions{display:grid;grid-template-columns:repeat(4,1fr);gap:9px}.mf-care-action{border:0;border-radius:22px;min-height:96px;padding:12px 8px;background:var(--surface);display:grid;place-items:center;align-content:center;gap:8px;color:var(--ink);box-shadow:none}.mf-care-action svg{width:32px;height:32px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}.mf-care-action strong{font-size:11.5px;font-weight:800}.mf-care-action.feed{color:var(--feed-ink);background:color-mix(in srgb,var(--feed) 72%,var(--surface))}.mf-care-action.diaper{color:var(--wet-ink);background:color-mix(in srgb,var(--wet) 72%,var(--surface))}.mf-care-action.sleep{color:var(--sleep-ink);background:color-mix(in srgb,var(--sleep) 68%,var(--surface))}.mf-care-action.growth{color:var(--growth-ink);background:color-mix(in srgb,var(--growth) 67%,var(--surface))}
  .mf-diaper-pick{display:none;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:-5px}.mf-diaper-pick.open{display:grid}.mf-diaper-pick button{min-height:42px;border:0;border-radius:15px;font:inherit;font-size:11.5px;font-weight:800}.mf-diaper-pick button:nth-child(1){background:var(--wet);color:var(--wet-ink)}.mf-diaper-pick button:nth-child(2){background:var(--poop);color:var(--poop-ink)}.mf-diaper-pick button:nth-child(3){background:var(--mixed);color:var(--mixed-ink)}
  .mf-care-today{padding:20px 2px 5px}.mf-care-today-head{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-bottom:13px}.mf-care-today-head h3{font:800 21px var(--display);letter-spacing:-.025em;margin:0}.mf-care-today-head button{border:0;background:transparent;color:var(--baby-ink);font:inherit;font-size:11px;font-weight:800;padding:6px 0}.mf-care-numbers{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;padding-bottom:2px}.mf-care-numbers::-webkit-scrollbar{display:none}.mf-care-number{flex:1 0 132px;border-radius:19px;background:color-mix(in srgb,var(--surface) 82%,var(--surface-2));padding:14px}.mf-care-number small,.mf-care-number strong,.mf-care-number span{display:block}.mf-care-number small{font-size:9px;color:var(--muted);font-weight:800}.mf-care-number strong{font-size:20px;font-weight:850;margin-top:4px;letter-spacing:-.025em}.mf-care-number span{font-size:9.5px;color:var(--muted);font-weight:650;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mf-last-care{margin-top:12px;padding:14px 15px;border-radius:19px;background:var(--surface);display:flex;align-items:center;justify-content:space-between;gap:12px}.mf-last-care div{min-width:0}.mf-last-care small,.mf-last-care strong{display:block}.mf-last-care small{font-size:9.5px;color:var(--muted);font-weight:800;margin-bottom:4px}.mf-last-care strong{font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mf-last-care span{font-size:10.5px;color:var(--muted);font-weight:700;white-space:nowrap}
  .mf-baby-modern .timeline-card{border:0!important;box-shadow:none!important;border-radius:24px!important;background:color-mix(in srgb,var(--surface) 85%,var(--surface-2))!important;margin-top:2px;padding:17px 18px 13px}.mf-baby-modern .timeline-track{border:0!important;opacity:.78;height:27px}.mf-baby-modern .timeline-head strong{font-size:16px}.mf-baby-modern #view>.panel{border:0;background:transparent;box-shadow:none;padding:4px 0;border-radius:0}.mf-baby-modern #view>.panel .panel-head h3{font-size:20px;letter-spacing:-.025em}.mf-baby-modern #view>.panel .rows{background:var(--surface);border-radius:21px;overflow:hidden}.mf-baby-modern #view>.panel .row{border:0;border-bottom:1px solid var(--line-soft);border-radius:0;box-shadow:none;background:transparent}.mf-baby-modern #view>.panel .row:last-child{border-bottom:0}
  :root[data-theme="dark"] .mf-baby-hero{background:linear-gradient(145deg,#15242c,#172a27 58%,#211d30)}
  @media(max-width:760px){body.mf-baby-modern{padding-bottom:calc(88px + env(safe-area-inset-bottom))}.mf-baby-modern .view{padding:14px 15px 34px}.mf-baby-modern .topbar{background:color-mix(in srgb,var(--bg) 88%,transparent);border-bottom:0}.mf-baby-hero{padding:20px 18px;border-radius:28px;min-height:158px;gap:14px}.mf-baby-photo{width:80px;height:80px}.mf-baby-copy h2{font-size:26px}.mf-care-action{min-height:86px;border-radius:20px}.mf-care-action svg{width:29px;height:29px}.mf-care-number{flex-basis:124px}.mf-baby-modern .mf-chat-btn{bottom:calc(92px + env(safe-area-inset-bottom))}}
  @media(max-width:390px){.mf-care-actions{grid-template-columns:repeat(2,1fr)}.mf-care-action{min-height:78px}.mf-baby-photo{width:72px;height:72px}.mf-baby-copy h2{font-size:23px}}
  `;document.head.appendChild(x);
}

function render(){
  if(patching)return;patching=true;
  try{
    style();const isBaby=location.hash==='#baby-home'||document.body.dataset.screen==='baby-home';document.body.classList.toggle('mf-baby-modern',isBaby);
    if(!isBaby){document.getElementById('mfBabyModernHome')?.remove();return;}
    const view=document.getElementById('view');if(!view)return;
    const s=read(),b=s.baby||{},st=stats(s),name=b.name||'Baby',age=ageLabel(b.birthDate),due=nextFeed(s,st.lastFeed);
    const feedCount=st.feeds.length+st.nursing.length;
    const latest=[...st.ev].reverse()[0];
    const latestText=!latest?'Nothing logged yet':latest.eventType==='feeding'?feedDetail(latest):latest.eventType==='nursing'?feedDetail(latest):latest.eventType==='diaper'?diaperDetail(latest):latest.eventType==='sleep'?`Sleep · ${fmtSleep(latest.durationMinutes)}`:latest.eventType==='growth'?'Growth updated':latest.eventType==='milestone'?(latest.milestoneText||'Milestone'):'Care logged';
    const headline=st.lastFeed?`Fed ${since(st.lastFeed)}`:`${name}’s day`;
    const photo=b.photo?`<img src="${esc(b.photo)}" alt="${esc(name)}">`:fallbackBaby();
    const html=`<section id="mfBabyModernHome" class="mf-baby-modern-home">
      <section class="mf-baby-hero">
        <div class="mf-baby-photo">${photo}</div>
        <div class="mf-baby-copy"><div class="mf-baby-kicker">${greet()}, ${esc(name)}${age?` · ${esc(age)}`:''}</div><h2>${esc(headline)}</h2><p>${st.lastFeed?esc(feedDetail(st.lastFeed)):'Use the quick actions below to start today.'}</p>${due?`<span class="mf-baby-due ${due.due?'due':''}">${esc(due.label)}</span>`:''}</div>
      </section>
      <section class="mf-care-actions" aria-label="Quick Baby care actions">
        <button type="button" class="mf-care-action feed" data-feed>${icon('feed')}<strong>Feed</strong></button>
        <button type="button" class="mf-care-action diaper" data-mf-diaper-menu>${icon('diaper')}<strong>Diaper</strong></button>
        <button type="button" class="mf-care-action sleep" data-sleep>${icon('sleep')}<strong>Sleep</strong></button>
        <button type="button" class="mf-care-action growth" data-growth>${icon('growth')}<strong>Growth</strong></button>
      </section>
      <div id="mfDiaperPick" class="mf-diaper-pick"><button type="button" data-diaper="wet">Wet</button><button type="button" data-diaper="poop">Poopy</button><button type="button" data-diaper="both">Mixed</button></div>
      <section class="mf-care-today">
        <div class="mf-care-today-head"><h3>Today</h3><button type="button" data-view="baby-history">See history</button></div>
        <div class="mf-care-numbers">
          <article class="mf-care-number"><small>Feeds</small><strong>${feedCount}</strong><span>${st.bottleOz?`${st.bottleOz.toFixed(1)} oz in bottles`:st.nursing.length?`${st.nursing.length} nursing`:feedCount?'logged today':'nothing yet'}</span></article>
          <article class="mf-care-number"><small>Diapers</small><strong>${st.diapers.length}</strong><span>${st.lastDiaper?diaperDetail(st.lastDiaper):'nothing yet'}</span></article>
          <article class="mf-care-number"><small>Sleep</small><strong>${fmtSleep(st.sleepMin)}</strong><span>${st.sleep.length?`${st.sleep.length} ${st.sleep.length===1?'sleep':'sleeps'}`:'nothing yet'}</span></article>
        </div>
        <div class="mf-last-care"><div><small>Latest care</small><strong>${esc(latestText)}</strong></div><span>${latest?`${to12(latest.time)} · ${since(latest)}`:'—'}</span></div>
      </section>
    </section>`;
    const old=document.getElementById('mfBabyModernHome'),wrap=document.createElement('div');wrap.innerHTML=html;const node=wrap.firstElementChild;
    if(old)old.replaceWith(node);else view.prepend(node);
  }finally{patching=false;}
}
function later(){clearTimeout(timer);timer=setTimeout(render,80);}

document.addEventListener('click',e=>{const b=e.target.closest('[data-mf-diaper-menu]');if(b){e.preventDefault();e.stopPropagation();document.getElementById('mfDiaperPick')?.classList.toggle('open');}});
window.addEventListener('storage',e=>{if(e.key===STATE_KEY)later();});window.addEventListener('hashchange',later);window.addEventListener('pageshow',later);
const mount=()=>{new MutationObserver(later).observe(document.getElementById('view')||document.body,{childList:true,subtree:true});render();};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
