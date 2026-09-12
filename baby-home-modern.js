(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
let timer=null,patching=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const when=e=>`${e?.date||''}${e?.time||''}`;
function to12(t){if(!t)return '';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);return `${((h+11)%12)+1}:${pad(m)} ${h>=12?'PM':'AM'}`;}
function since(e){if(!e?.date)return '';const d=new Date(`${e.date}T${e.time||'00:00'}:00`),diff=Date.now()-d.getTime();if(!Number.isFinite(diff)||diff<0)return '';const m=Math.round(diff/60000);if(m<2)return 'just now';if(m<60)return `${m}m ago`;const h=Math.floor(m/60);if(h<24)return m%60?`${h}h ${m%60}m ago`:`${h}h ago`;return `${Math.round(h/24)}d ago`;}
function ageLabel(b){if(!b)return '';const bd=new Date(`${b}T12:00:00`),nd=new Date(`${today()}T12:00:00`);const days=Math.floor((nd-bd)/86400000);if(!Number.isFinite(days)||days<0)return '';if(days<14)return `${days} days old`;if(days<70)return `${Math.floor(days/7)} weeks old`;let m=(nd.getFullYear()-bd.getFullYear())*12+(nd.getMonth()-bd.getMonth());if(nd.getDate()<bd.getDate())m--;return m<24?`${m} months old`:`${Math.floor(m/12)}y ${m%12}m`;}
function greet(){const h=new Date().getHours();return h<12?'Good morning':h<17?'Good afternoon':h<21?'Good evening':'Good night';}
function cutoffDate(days){const d=new Date();d.setDate(d.getDate()-days);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function activeEvents(s){
  const id=s.baby?.id||'saahas-2026';
  return (Array.isArray(s.babyEvents)?s.babyEvents:[])
    .filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e?.babyId||e.babyId===id))
    .sort((a,b)=>when(a).localeCompare(when(b)));
}
function diaperKind(e){const x=String(e?.subtype||'').toLowerCase();return x==='poop'||x==='dirty'?'poop':x==='both'||x==='mixed'?'both':'wet';}
function nursingMinutes(e){return Number(e?.durationMinutes??e?.totalMinutes??e?.duration_minutes??e?.total_minutes)||0;}
function fallbackBaby(){return `<svg viewBox="0 0 100 100" aria-hidden="true"><defs><linearGradient id="mfBabyG2" x1="8" y1="7" x2="92" y2="94"><stop stop-color="#e1f8ff"/><stop offset=".5" stop-color="#ddf7ef"/><stop offset="1" stop-color="#ede5ff"/></linearGradient></defs><circle cx="50" cy="50" r="48" fill="url(#mfBabyG2)"/><path d="M31 48c1-15 10-25 23-25 12 0 22 10 22 24 0 17-10 29-26 29-15 0-25-11-25-27 0-7 2-13 6-18" fill="none" stroke="#4d8dad" stroke-width="4" stroke-linecap="round"/><circle cx="42" cy="49" r="2.8" fill="#4d8dad"/><circle cx="60" cy="49" r="2.8" fill="#4d8dad"/><path d="M43 61c5 4 11 4 16 0M42 24c3-8 13-10 19-4" fill="none" stroke="#4d8dad" stroke-width="3.5" stroke-linecap="round"/></svg>`;}
function icon(name){
  const p={
    nursing:'<path d="M17 17c0-5 3-8 7-8s7 3 7 8-3 8-7 8-7-3-7-8Z"/><path d="M10 41c1-9 6-14 14-14s13 5 14 14"/><path d="M30 27c7 0 11 4 11 10"/><circle cx="36" cy="26" r="5"/>',
    wet:'<path d="M24 7c6 7 11 13 11 20a11 11 0 1 1-22 0c0-7 5-13 11-20Z"/>',
    poop:'<path d="M24 9c4 1 5 4 4 7h2c5 0 8 3 8 7 0 2-.7 3-2 5 4 1 6 4 6 7 0 4-4 7-9 7H15c-5 0-9-3-9-7 0-3 2-6 6-7-1-2-2-3-2-5 0-4 3-7 8-7h2c-1-4 1-7 4-7Z"/><path d="M19 31h.1M29 31h.1"/>',
    both:'<path d="M17 7c4 5 8 10 8 14a8 8 0 1 1-16 0c0-4 4-9 8-14Z"/><path d="M33 20c3 1 4 3 3 5h1c4 0 6 2 6 5 0 1-.4 2-1 3 2 1 3 3 3 5 0 3-3 5-7 5H27c-4 0-7-2-7-5 0-2 1-4 3-5-.6-1-1-2-1-3 0-3 2-5 6-5h1c-.5-3 1-5 4-5Z"/>'
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${p[name]||p.nursing}</svg>`;
}
function stats(s){
  const ev=activeEvents(s),d=today(),day=ev.filter(e=>e.date===d);
  const nursing=day.filter(e=>e.eventType==='nursing');
  const diapers=day.filter(e=>e.eventType==='diaper');
  const lastNursing=[...ev].reverse().find(e=>e.eventType==='nursing');
  const lastDiaper=[...ev].reverse().find(e=>e.eventType==='diaper');
  const wet=diapers.filter(e=>diaperKind(e)==='wet').length;
  const poop=diapers.filter(e=>diaperKind(e)==='poop').length;
  const both=diapers.filter(e=>diaperKind(e)==='both').length;
  const nurseMin=nursing.reduce((n,e)=>n+nursingMinutes(e),0);
  return {ev,day,nursing,diapers,lastNursing,lastDiaper,wet,poop,both,nurseMin};
}
function usage(s){
  const from=cutoffDate(30),ev=activeEvents(s).filter(e=>e.date>=from);
  const count={nursing:0,wet:0,poop:0,both:0};
  for(const e of ev){
    if(e.eventType==='nursing')count.nursing++;
    else if(e.eventType==='diaper')count[diaperKind(e)]++;
  }
  const base=[
    {key:'nursing',label:'Breastfeed',sub:'Log nursing',action:'data-feed-type="nursing"',tone:'nursing'},
    {key:'wet',label:'Wet',sub:'Log diaper',action:'data-diaper="wet"',tone:'wet'},
    {key:'poop',label:'Poopy',sub:'Log diaper',action:'data-diaper="poop"',tone:'poop'},
    {key:'both',label:'Mixed',sub:'Wet + poopy',action:'data-diaper="both"',tone:'both'}
  ];
  const priority={nursing:4,wet:3,poop:2,both:1};
  return base.sort((a,b)=>(count[b.key]-count[a.key])||(priority[b.key]-priority[a.key])).map((x,i)=>({...x,count:count[x.key],top:i===0}));
}
function style(){
  if(document.getElementById('mfBabyModernStylesV2'))return;
  document.getElementById('mfBabyModernStyles')?.remove();
  const x=document.createElement('style');x.id='mfBabyModernStylesV2';x.textContent=`
  .mf-baby-modern #view>.baby-stage,.mf-baby-modern #view>.act-strip,.mf-baby-modern #view>.feed-cta,.mf-baby-modern #view>.orb-row,.mf-baby-modern #view>.pill-row,.mf-baby-modern #view>.ring-row,.mf-baby-modern #view>.timeline-card{display:none!important}
  .mf-baby-modern #view{max-width:1020px}.mf-baby-modern-home{display:grid;gap:14px;margin-bottom:19px}
  .mf-baby-hero{position:relative;overflow:hidden;border:0;border-radius:31px;padding:24px;background:linear-gradient(145deg,color-mix(in srgb,var(--baby-soft) 60%,var(--surface)),color-mix(in srgb,var(--feed) 42%,var(--surface)));display:flex;align-items:center;gap:18px;min-height:164px}
  .mf-baby-hero:after{content:'';position:absolute;width:190px;height:190px;border-radius:50%;right:-80px;bottom:-120px;background:color-mix(in srgb,var(--baby) 7%,transparent)}
  .mf-baby-photo{position:relative;z-index:2;width:92px;height:92px;flex:0 0 auto;border-radius:50%;overflow:hidden}.mf-baby-photo img,.mf-baby-photo svg{width:100%;height:100%;display:block;object-fit:cover}.mf-baby-copy{position:relative;z-index:2;min-width:0;flex:1}.mf-baby-kicker{font-size:11px;font-weight:800;color:var(--baby-ink);margin-bottom:6px}.mf-baby-copy h2{font:800 30px var(--display);letter-spacing:-.04em;margin:0 0 6px;line-height:1.05}.mf-baby-copy p{margin:0;color:var(--muted);font-size:12px;font-weight:650;line-height:1.45}
  .mf-baby-grid-title{display:flex;align-items:end;justify-content:space-between;gap:12px;padding:2px 2px 0}.mf-baby-grid-title h3{margin:0;font:800 21px var(--display);letter-spacing:-.025em}.mf-baby-grid-title small{font-size:10px;color:var(--muted);font-weight:700}
  .mf-care-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.mf-care-action{position:relative;border:0;border-radius:24px;min-height:118px;padding:16px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;box-shadow:none;color:var(--ink)}.mf-care-action svg{position:absolute;right:13px;top:13px;width:46px;height:46px;fill:none;stroke:currentColor;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round;opacity:.84}.mf-care-action strong{font-size:17px;font-weight:850;letter-spacing:-.02em}.mf-care-action span{font-size:10.5px;font-weight:700;opacity:.7;margin-top:3px}.mf-care-action em{position:absolute;left:12px;top:12px;font-size:8px;font-style:normal;font-weight:850;letter-spacing:.03em;text-transform:uppercase;padding:5px 7px;border-radius:999px;background:rgba(255,255,255,.48)}
  .mf-care-action.nursing{color:var(--baby-ink);background:linear-gradient(145deg,color-mix(in srgb,var(--feed) 74%,var(--surface)),color-mix(in srgb,var(--baby-soft) 70%,var(--surface)))}.mf-care-action.wet{color:var(--wet-ink);background:color-mix(in srgb,var(--wet) 74%,var(--surface))}.mf-care-action.poop{color:var(--poop-ink);background:color-mix(in srgb,var(--poop) 76%,var(--surface))}.mf-care-action.both{color:var(--mixed-ink);background:color-mix(in srgb,var(--mixed) 70%,var(--surface))}.mf-care-action:active{transform:scale(.985)}
  .mf-care-today{padding:12px 2px 4px}.mf-care-today-head{display:flex;align-items:end;justify-content:space-between;gap:12px;margin-bottom:11px}.mf-care-today-head h3{font:800 21px var(--display);letter-spacing:-.025em;margin:0}.mf-care-today-head button{border:0;background:transparent;color:var(--baby-ink);font:inherit;font-size:11px;font-weight:800;padding:6px 0}.mf-care-numbers{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.mf-care-number{border-radius:18px;background:color-mix(in srgb,var(--surface) 84%,var(--surface-2));padding:13px 11px;min-width:0}.mf-care-number small,.mf-care-number strong,.mf-care-number span{display:block}.mf-care-number small{font-size:8.5px;color:var(--muted);font-weight:800}.mf-care-number strong{font-size:19px;font-weight:850;margin-top:4px;letter-spacing:-.025em}.mf-care-number span{font-size:8.5px;color:var(--muted);font-weight:650;margin-top:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .mf-last-care{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:11px}.mf-last-care-card{padding:14px 15px;border-radius:18px;background:var(--surface)}.mf-last-care-card small,.mf-last-care-card strong,.mf-last-care-card span{display:block}.mf-last-care-card small{font-size:9px;color:var(--muted);font-weight:800;margin-bottom:4px}.mf-last-care-card strong{font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.mf-last-care-card span{font-size:9.5px;color:var(--muted);font-weight:700;margin-top:3px}
  .mf-baby-modern #view>.panel{border:0;background:transparent;box-shadow:none;padding:4px 0;border-radius:0}.mf-baby-modern #view>.panel .panel-head h3{font-size:20px;letter-spacing:-.025em}.mf-baby-modern #view>.panel .rows{background:var(--surface);border-radius:21px;overflow:hidden}.mf-baby-modern #view>.panel .row{border:0;border-bottom:1px solid var(--line-soft);border-radius:0;box-shadow:none;background:transparent}.mf-baby-modern #view>.panel .row:last-child{border-bottom:0}
  :root[data-theme="dark"] .mf-baby-hero{background:linear-gradient(145deg,#15242c,#172a27 58%,#211d30)}
  @media(max-width:760px){body.mf-baby-modern{padding-bottom:calc(88px + env(safe-area-inset-bottom))}.mf-baby-modern .view{padding:14px 15px 34px}.mf-baby-modern .topbar{background:color-mix(in srgb,var(--bg) 88%,transparent);border-bottom:0}.mf-baby-hero{padding:20px 18px;border-radius:28px;min-height:150px;gap:14px}.mf-baby-photo{width:78px;height:78px}.mf-baby-copy h2{font-size:25px}.mf-care-action{min-height:108px;border-radius:22px}.mf-care-action svg{width:42px;height:42px}.mf-care-numbers{grid-template-columns:repeat(2,1fr)}.mf-baby-modern .mf-chat-btn{bottom:calc(92px + env(safe-area-inset-bottom))}}
  `;document.head.appendChild(x);
}
function render(){
  if(patching)return;patching=true;
  try{
    style();const isBaby=location.hash==='#baby-home'||document.body.dataset.screen==='baby-home';document.body.classList.toggle('mf-baby-modern',isBaby);
    if(!isBaby){document.getElementById('mfBabyModernHome')?.remove();return;}
    const view=document.getElementById('view');if(!view)return;
    const s=read(),st=stats(s),name=s.baby?.name||'Baby',age=ageLabel(s.baby?.birthDate),photo=s.baby?.photo?`<img src="${esc(s.baby.photo)}" alt="${esc(name)}">`:fallbackBaby();
    const lastN=st.lastNursing,lastD=st.lastDiaper;
    const actions=usage(s);
    const actionHtml=actions.map(a=>`<button type="button" class="mf-care-action ${a.tone}" ${a.action}>${a.top?'<em>Most used</em>':''}${icon(a.key)}<strong>${a.label}</strong><span>${a.sub}</span></button>`).join('');
    const node=document.createElement('div');node.id='mfBabyModernHome';node.className='mf-baby-modern-home';node.innerHTML=`
      <section class="mf-baby-hero"><div class="mf-baby-photo">${photo}</div><div class="mf-baby-copy"><div class="mf-baby-kicker">${greet()}${age?` · ${esc(age)}`:''}</div><h2>${esc(name)}</h2><p>${lastN?`Last breastfeed ${esc(since(lastN))}`:'Breastfeeding and diapers are ready to log in one tap.'}</p></div></section>
      <div class="mf-baby-grid-title"><h3>Quick log</h3><small>Reorders from what you use most</small></div>
      <section class="mf-care-grid" aria-label="Most-used Baby care actions">${actionHtml}</section>
      <section class="mf-care-today"><div class="mf-care-today-head"><h3>Today</h3><button type="button" data-view="baby-history">See history</button></div><div class="mf-care-numbers"><div class="mf-care-number"><small>Breastfeeds</small><strong>${st.nursing.length}</strong><span>${st.nurseMin?`${st.nurseMin} min logged`:'No sessions yet'}</span></div><div class="mf-care-number"><small>Wet</small><strong>${st.wet}</strong><span>diapers</span></div><div class="mf-care-number"><small>Poopy</small><strong>${st.poop}</strong><span>diapers</span></div><div class="mf-care-number"><small>Mixed</small><strong>${st.both}</strong><span>diapers</span></div></div><div class="mf-last-care"><div class="mf-last-care-card"><small>Last breastfeed</small><strong>${lastN?`${nursingMinutes(lastN)||'—'} min`:'Nothing logged'}</strong><span>${lastN?`${to12(lastN.time)} · ${since(lastN)}`:'Tap Breastfeed above'}</span></div><div class="mf-last-care-card"><small>Last diaper</small><strong>${lastD?`${diaperKind(lastD)==='poop'?'Poopy':diaperKind(lastD)==='both'?'Mixed':'Wet'} diaper`:'Nothing logged'}</strong><span>${lastD?`${to12(lastD.time)} · ${since(lastD)}`:'Tap a diaper above'}</span></div></div></section>`;
    const old=document.getElementById('mfBabyModernHome');if(old)old.replaceWith(node);else view.prepend(node);
  }finally{patching=false;}
}
function later(){clearTimeout(timer);timer=setTimeout(render,70);}
window.addEventListener('storage',e=>{if(e.key===STATE_KEY)later();});window.addEventListener('hashchange',later);window.addEventListener('pageshow',later);
document.addEventListener('submit',e=>{if(['feedForm','diaperForm'].includes(e.target?.id))setTimeout(later,300);});
const mount=()=>{new MutationObserver(later).observe(document.getElementById('view')||document.body,{childList:true,subtree:true});render();};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
