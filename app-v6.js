(() => {
'use strict';

const STATE_KEY = 'milkflow-family-v4-state';
const PRE_IMPORT_KEY = 'milkflow-family-pre-import-backup';
const VALID_VIEWS = new Set(['mom-home','today','history','trends','stash','baby-home','baby-history','doctor','settings']);
const DEFAULTS = {
  version: 6,
  profile: { dailyGoalMl: 760, babyMinOz: 20, babyMaxOz: 22, stashMl: 0 },
  baby: { id: 'saahas-2026', name: 'Saahas' },
  schedule: ['05:40','11:05','14:35','17:45','20:45','23:35'],
  entries: [],
  babyEvents: [],
  dailyOverrides: {},
  reminders: { enabled: false, leadMin: 10, lastSentKey: null, snoozedUntil: null },
  cloud: { enabled: false, userId: null, email: null, lastSync: null, lastVerified: null, momCount: null, babyCount: null },
  ui: { view: 'mom-home', workspace: 'mom', momHistoryRange: 30, babyHistoryRange: 30, babyFilter: 'all', doctorRange: 14 }
};

const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const sum = a => a.reduce((x,y) => x+y, 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const isoDate = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => isoDate(new Date());
const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fd = d => d ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const fdl = d => d ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const to12 = t => { if(!t) return '—'; const [h,m] = t.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const cap = s => String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const byWhenDesc = (a,b) => `${b.date||''}${b.time||''}`.localeCompare(`${a.date||''}${a.time||''}`);
const uuid = prefix => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;

function loadState(){
  const legacy = [STATE_KEY,'milkflow-v3-state','milkflow-v2-state'];
  for(const key of legacy){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      const p = JSON.parse(raw);
      return {
        ...clone(DEFAULTS), ...p,
        profile: {...DEFAULTS.profile,...(p.profile||{})},
        baby: {...DEFAULTS.baby,...(p.baby||{})},
        reminders: {...DEFAULTS.reminders,...(p.reminders||{})},
        cloud: {...DEFAULTS.cloud,...(p.cloud||{})},
        ui: {...DEFAULTS.ui,...(p.ui||{})},
        entries: Array.isArray(p.entries)?p.entries:[],
        babyEvents: Array.isArray(p.babyEvents)?p.babyEvents:[],
        dailyOverrides: p.dailyOverrides||{}
      };
    }catch(e){ console.warn('State read skipped', e); }
  }
  return clone(DEFAULTS);
}

const S = loadState();
let cloud = null;
let view = (() => {
  const h = location.hash.replace('#','');
  if(VALID_VIEWS.has(h)) return h;
  if(VALID_VIEWS.has(S.ui.view)) return S.ui.view;
  return 'mom-home';
})();

function workspaceForView(v){ return (v.startsWith('baby') || v === 'doctor') ? 'baby' : 'mom'; }
function save(){
  S.version = 6;
  S.ui.view = view;
  S.ui.workspace = workspaceForView(view);
  localStorage.setItem(STATE_KEY, JSON.stringify(S));
}
function toast(msg, duration=2800){
  const t=$('toast'); if(!t) return;
  t.textContent=msg; t.classList.add('show'); clearTimeout(t._timer);
  t._timer=setTimeout(()=>t.classList.remove('show'),duration);
}
function setView(v, {replaceHash=true}={}){
  if(!VALID_VIEWS.has(v)) v='mom-home';
  view=v; save();
  if(replaceHash && location.hash!==`#${v}`) history.replaceState(null,'',`#${v}`);
  closeOverlays(); render(); window.scrollTo({top:0,behavior:'auto'});
}
function closeOverlays(){
  $('sidebar')?.classList.remove('open');
  $('scrim')?.classList.remove('show');
  $('moreSheet')?.classList.remove('show');
  $('quickSheet')?.classList.remove('show');
}
window.addEventListener('hashchange',()=>{
  const h=location.hash.replace('#','');
  if(VALID_VIEWS.has(h) && h!==view){ view=h; save(); closeOverlays(); render(); }
});

function icon(name, cls=''){
  const p={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/>',
    drop:'<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-7.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/>',
    snow:'<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/>',
    baby:'<circle cx="12" cy="12" r="8"/><path d="M9.5 10h.01M14.5 10h.01M9.5 14c1.6 1.2 3.4 1.2 5 0"/><path d="M8 4.7c1.2-1.9 3.7-2.3 5.3-.8"/>',
    diaper:'<path d="M5 7c2.3 1.4 4.6 2.1 7 2.1S16.7 8.4 19 7v8.5c-2.1 2.3-4.5 3.5-7 3.5s-4.9-1.2-7-3.5Z"/><path d="M8 9.1v7.1M16 9.1v7.1"/>',
    bottle:'<path d="M9 3h6M10 3v4l-2 3v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9l-2-3V3"/><path d="M8 13h8"/>',
    steth:'<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v2a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="10" r="2"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
    download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>'
  };
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.heart}</svg>`;
}

const momEntries = () => S.entries.filter(e=>!e.deletedAt);
const pumps = () => momEntries().filter(e=>e.type==='pump');
const nurses = () => momEntries().filter(e=>e.type==='nursing');
const babyEvents = () => S.babyEvents.filter(e=>!e.deletedAt);
const dayP = d => pumps().filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
const dayN = d => nurses().filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
const calcPump = d => sum(dayP(d).map(e=>+e.amountMl||0));
const dayTotal = d => Number.isFinite(+S.dailyOverrides?.[d]) ? +S.dailyOverrides[d] : calcPump(d);
const babyFor = (d,type) => babyEvents().filter(e=>e.date===d && (!type||e.eventType===type));
function lastDates(n,end=today()){ const out=[], d=new Date(`${end}T12:00:00`); for(let i=n-1;i>=0;i--){ const x=new Date(d); x.setDate(d.getDate()-i); out.push(isoDate(x)); } return out; }
function latestBabyDate(){ return babyEvents().slice().sort(byWhenDesc)[0]?.date || today(); }
function earliestBabyDate(){ return babyEvents().slice().sort((a,b)=>`${a.date}${a.time||''}`.localeCompare(`${b.date}${b.time||''}`))[0]?.date || today(); }
function rollingPumpAvg(n=7){ const vals=lastDates(n).map(dayTotal).filter(v=>v>0); return vals.length?Math.round(sum(vals)/vals.length):0; }
function lastPump(){ return pumps().slice().sort(byWhenDesc)[0]||null; }
function nextSlot(){ const d=new Date(),m=d.getHours()*60+d.getMinutes(); return S.schedule.map(t=>({t,m:+t.slice(0,2)*60 + +t.slice(3)})).find(x=>x.m>m)?.t||S.schedule[0]; }
function babyStats(d){
  const diapers=babyFor(d,'diaper'), feeds=babyFor(d,'feeding'), nursing=babyFor(d,'nursing');
  const wet=diapers.filter(e=>['wet','both'].includes(e.subtype)).length;
  const poop=diapers.filter(e=>['poop','both'].includes(e.subtype)).length;
  const oz=sum(feeds.map(e=>+e.amountOz||0));
  return {wet,poop,diapers:diapers.length,feeds:feeds.length,nursing:nursing.length,oz};
}
function dateAtLeast(date, days){ const x=new Date(`${today()}T12:00:00`); x.setDate(x.getDate()-days+1); return date>=isoDate(x); }

function metric(label,value,sub,ic,tone='mom'){
  return `<article class="metric-card ${tone}"><div class="metric-icon">${icon(ic)}</div><div class="metric-copy"><span>${label}</span><strong>${value}</strong><small>${sub}</small></div></article>`;
}
function empty(ic,title,sub,action=''){
  return `<div class="empty-state"><div class="empty-icon">${icon(ic)}</div><strong>${title}</strong>${sub?`<span>${sub}</span>`:''}${action}</div>`;
}
function sectionHead(title, action=''){
  return `<div class="panel-head"><h3>${title}</h3>${action}</div>`;
}
function scheduleStrip(){
  const d=today(), a=dayP(d), nowD=new Date(), nm=nowD.getHours()*60+nowD.getMinutes();
  return `<div class="schedule-strip">${S.schedule.map((t,i)=>{
    const e=a[i], sm=+t.slice(0,2)*60 + +t.slice(3), cls=e?'done':(!e&&sm>=nm&&a.length===i?'next':'');
    return `<div class="slot ${cls}"><div class="slot-icon">${e?icon('check'):icon('bell')}</div><div><strong>${e?to12(e.time):to12(t)}</strong><span>${e?`${e.amountMl} mL`:'Pump'}</span></div></div>`;
  }).join('')}</div>`;
}
function recentMom(n=5){
  const a=momEntries().slice().sort(byWhenDesc).slice(0,n);
  if(!a.length) return empty('history','Mom history needs restoring','Baby history is safe. Import the complete family backup once.','<button class="big-link" data-import>Restore Mom history</button>');
  return `<div class="list">${a.map(e=>`<button class="list-row" data-view="history"><span class="row-icon">${icon(e.type==='pump'?'drop':'heart')}</span><span><strong>${e.type==='pump'?`${e.amountMl||0} mL`:`${e.durationMin||0} min nursing`}</strong><small>${fd(e.date)} · ${to12(e.time)}</small></span><b>›</b></button>`).join('')}</div>`;
}
function momHome(){
  const total=dayTotal(today()), lp=lastPump();
  const recovery = !momEntries().length && babyEvents().length ? `<section class="recovery-banner"><div class="recovery-icon">${icon('shield')}</div><div><strong>Baby history is here. Mom history still needs one restore.</strong><span>Your Baby Tracker import did not include the Mom pumping backup.</span></div><button data-import>Restore</button></section>` : '';
  return `${recovery}<section class="hero mom-hero"><div class="hero-copy"><span class="eyebrow">MOM</span><h2>${total?`${total} mL today`:'Your day at a glance'}</h2><div class="hero-actions"><button class="action primary" data-mom="pump">${icon('drop')}<span>Pump</span></button><button class="action soft" data-mom="nursing">${icon('heart')}<span>Nursing</span></button></div></div><div class="hero-art mom-art"><div class="art-orb"></div>${icon('drop','hero-symbol')}<span class="art-heart">♥</span></div></section>
  <div class="metric-grid">${metric('Today',`${total} mL`,`${dayP(today()).length} pumps`,'drop')}${metric('7-day avg',`${rollingPumpAvg()} mL`,'pumping days','chart')}${metric('Next',to12(nextSlot()),lp?`last ${to12(lp.time)}`:'nothing logged yet','bell')}${metric('Stash',`${(+S.profile.stashMl||0).toLocaleString()} mL`,'freezer','snow')}</div>
  <section class="panel">${sectionHead('Pump plan','<button data-view="today">Today</button>')}${scheduleStrip()}</section>
  <div class="two-col"><section class="panel">${sectionHead('Recent','<button data-view="history">History</button>')}${recentMom()}</section><section class="panel quick-panel">${sectionHead('Quick links')}<div class="quick-grid"><button data-view="trends">${icon('chart')}<span>Trends</span></button><button data-view="stash">${icon('snow')}<span>Stash</span></button><button data-view="settings">${icon('bell')}<span>Reminders</span></button><button data-workspace="baby">${icon('baby')}<span>Baby</span></button></div></section></div>`;
}
function todayView(){
  const p=dayP(today()), n=dayN(today());
  return `<div class="view-head"><div><span class="eyebrow">${fdl(today())}</span><h2>Today</h2></div><button class="round-action" data-mom="pump">${icon('plus')}<span>Pump</span></button></div>
  <div class="metric-grid compact-grid">${metric('Pumped',`${dayTotal(today())} mL`,`${p.length} sessions`,'drop')}${metric('Nursing',n.length,`${sum(n.map(x=>+x.durationMin||0))} min`,'heart')}${metric('Next',to12(nextSlot()),'planned','bell')}${metric('Goal',`${Math.min(100,Math.round(dayTotal(today())/(+S.profile.dailyGoalMl||760)*100))}%`,`${+S.profile.dailyGoalMl||760} mL`,'chart')}</div>
  <section class="panel">${sectionHead('Schedule')}${scheduleStrip()}</section>
  <section class="panel">${sectionHead('Pumping','<button data-mom="pump">Add</button>')}${p.length?momRows(p):empty('drop','No pumps yet','Tap Add when you finish a pump.')}</section>
  ${n.length?`<section class="panel">${sectionHead('Nursing','<button data-mom="nursing">Add</button>')}${momRows(n)}</section>`:''}`;
}
function momRows(a){
  return `<div class="history-list">${a.slice().sort(byWhenDesc).map(e=>`<div class="history-row"><span class="row-icon">${icon(e.type==='pump'?'drop':'heart')}</span><div><strong>${e.type==='pump'?`${e.amountMl||0} mL`:`${e.durationMin||0} min nursing`}</strong><small>${fdl(e.date)} · ${to12(e.time)}${e.side?` · ${cap(e.side)}`:''}</small></div></div>`).join('')}</div>`;
}
function momHistoryView(){
  const range=+S.ui.momHistoryRange||30;
  const a=momEntries().filter(e=>range===0||dateAtLeast(e.date,range)).slice().sort(byWhenDesc);
  return `<div class="view-head"><div><span class="eyebrow">MOM</span><h2>History</h2></div><button class="round-action" data-mom="pump">${icon('plus')}<span>Pump</span></button></div>
  <div class="chips"><button data-mom-range="7" class="${range===7?'active':''}">7 days</button><button data-mom-range="30" class="${range===30?'active':''}">30 days</button><button data-mom-range="0" class="${range===0?'active':''}">All</button></div>
  <section class="panel">${a.length?momRows(a):empty('history','No Mom history found',babyEvents().length?'Baby history is safe. Restore the complete family backup once.':'Import your family backup.','<button class="big-link" data-import>Import backup</button>')}</section>`;
}
function trendsView(){
  const ds=lastDates(14), vals=ds.map(dayTotal), mx=Math.max(...vals,+S.profile.dailyGoalMl||760,1), high=pumps().reduce((m,e)=>(+e.amountMl||0)>(+m?.amountMl||0)?e:m,null);
  return `<div class="view-head"><div><span class="eyebrow">MOM</span><h2>Trends</h2></div></div>
  <div class="metric-grid compact-grid">${metric('7-day avg',`${rollingPumpAvg()} mL`,'daily output','chart')}${metric('Best pump',`${high?.amountMl||0} mL`,high?fd(high.date):'—','drop')}${metric('Sessions',pumps().length,'all saved pumps','history')}${metric('Stash',`${(+S.profile.stashMl||0)} mL`,'freezer','snow')}</div>
  <section class="panel">${sectionHead('Last 14 days')}<div class="bars">${ds.map((d,i)=>`<div class="bar-col"><span>${vals[i]||''}</span><i style="height:${Math.max(3,Math.round((vals[i]/mx)*170))}px"></i><small>${fd(d)}</small></div>`).join('')}</div></section>`;
}
function stashView(){
  return `<section class="hero stash-hero"><div class="hero-copy"><span class="eyebrow">MOM</span><h2>${(+S.profile.stashMl||0).toLocaleString()} mL</h2><small>Freezer stash</small></div><div class="hero-art">${icon('snow','hero-symbol')}</div></section><section class="panel"><div class="stash-actions"><button data-stash="-60">−60</button><button data-stash="60">+60</button><button data-stash="120">+120</button></div></section>`;
}

function babyLabel(e){
  if(e.eventType==='diaper') return `${cap(e.subtype||'diaper')} diaper`;
  if(e.eventType==='feeding') return `${(+e.amountOz||0).toFixed(1)} oz ${e.feedingType==='formula'?'formula':'milk'}`;
  if(e.eventType==='nursing') return `${e.totalMinutes||e.durationMin||0} min nursing`;
  if(e.eventType==='sleep') return `${Math.round((+e.durationMinutes||0)/6)/10} hr sleep`;
  return cap(e.eventType);
}
function recentBaby(n=6){
  const a=babyEvents().slice().sort(byWhenDesc).slice(0,n);
  if(!a.length) return empty('baby','No baby history found','Import your Baby Tracker backup.','<button class="big-link baby" data-import>Import backup</button>');
  return `<div class="list">${a.map(e=>`<button class="list-row" data-view="baby-history"><span class="row-icon baby">${icon(e.eventType==='feeding'?'bottle':e.eventType==='diaper'?'diaper':e.eventType==='nursing'?'heart':'baby')}</span><span><strong>${babyLabel(e)}</strong><small>${fd(e.date)} · ${to12(e.time)}</small></span><b>›</b></button>`).join('')}</div>`;
}
function babyHome(){
  const latest=latestBabyDate(), todayStats=babyStats(today()), latestStats=babyStats(latest), useLatest=babyEvents().length && latest!==today();
  const s=useLatest?latestStats:todayStats;
  return `<section class="hero baby-hero"><div class="hero-copy"><span class="eyebrow">${esc(S.baby.name)}</span><h2>${useLatest?`Latest: ${fd(latest)}`:'Baby care'}</h2><div class="baby-actions"><button data-baby="wet">${icon('diaper')}<span>Wet</span></button><button data-baby="poop">${icon('diaper')}<span>Poop</span></button><button data-baby="both">${icon('diaper')}<span>Both</span></button><button data-baby="bottle">${icon('bottle')}<span>Bottle</span></button></div></div><div class="hero-art baby-art"><div class="art-orb"></div>${icon('baby','hero-symbol')}</div></section>
  <div class="metric-grid">${metric('Wet',s.wet,useLatest?fd(latest):'today','diaper','baby')}${metric('Poop',s.poop,useLatest?fd(latest):'today','diaper','baby')}${metric('Feeds',s.feeds,`${s.oz.toFixed(1)} oz`,'bottle','baby')}${metric('History',babyEvents().length.toLocaleString(),'saved records','history','baby')}</div>
  <div class="two-col"><section class="panel">${sectionHead('Recent','<button data-view="baby-history">History</button>')}${recentBaby()}</section><section class="panel doctor-card"><div class="doctor-icon">${icon('steth')}</div><div><h3>Doctor summary</h3><p>Daily diapers, feeds and bottle intake.</p><button class="action baby" data-view="doctor">Open</button></div></section></div>`;
}
function babyRows(a){
  if(!a.length) return empty('baby','No matching records','Try another filter.');
  return `<div class="history-list">${a.map(e=>`<div class="history-row"><span class="row-icon baby">${icon(e.eventType==='feeding'?'bottle':e.eventType==='diaper'?'diaper':e.eventType==='nursing'?'heart':'baby')}</span><div><strong>${babyLabel(e)}</strong><small>${fdl(e.date)} · ${to12(e.time)}</small></div></div>`).join('')}</div>`;
}
function babyHistoryView(){
  const range=+S.ui.babyHistoryRange||30, filter=S.ui.babyFilter||'all';
  let a=babyEvents().filter(e=>range===0||dateAtLeast(e.date,range));
  if(filter!=='all') a=a.filter(e=>e.eventType===filter);
  a=a.sort(byWhenDesc);
  return `<div class="view-head"><div><span class="eyebrow">${esc(S.baby.name)}</span><h2>History</h2></div></div>
  <div class="filter-stack"><div class="chips"><button data-baby-range="7" class="${range===7?'active':''}">7 days</button><button data-baby-range="30" class="${range===30?'active':''}">30 days</button><button data-baby-range="0" class="${range===0?'active':''}">All</button></div><div class="chips baby-chips"><button data-baby-filter="all" class="${filter==='all'?'active':''}">All</button><button data-baby-filter="diaper" class="${filter==='diaper'?'active':''}">Diapers</button><button data-baby-filter="feeding" class="${filter==='feeding'?'active':''}">Feeds</button><button data-baby-filter="nursing" class="${filter==='nursing'?'active':''}">Nursing</button><button data-baby-filter="sleep" class="${filter==='sleep'?'active':''}">Sleep</button></div></div>
  <section class="panel">${babyRows(a)}</section>`;
}
function doctorView(){
  const range=+S.ui.doctorRange||14, end=latestBabyDate();
  const first=earliestBabyDate(), candidate=lastDates(range,end), days=candidate.filter(d=>d>=first), rows=days.map(d=>({d,...babyStats(d)}));
  const denom=Math.max(rows.length,1), avg=k=>(sum(rows.map(r=>+r[k]||0))/denom);
  const latest=babyStats(end), prev7=lastDates(7,end).map(d=>babyStats(d)), wet7=sum(prev7.map(r=>r.wet))/7, poop7=sum(prev7.map(r=>r.poop))/7, feeds7=sum(prev7.map(r=>r.feeds))/7, oz7=sum(prev7.map(r=>r.oz))/7;
  return `<div class="view-head"><div><span class="eyebrow">${esc(S.baby.name)}</span><h2>Doctor summary</h2><small>Through ${fdl(end)}</small></div><button class="round-action baby" data-print>${icon('steth')}<span>Print</span></button></div>
  <div class="chips"><button data-doctor-range="7" class="${range===7?'active':''}">7 days</button><button data-doctor-range="14" class="${range===14?'active':''}">14 days</button><button data-doctor-range="30" class="${range===30?'active':''}">30 days</button></div>
  <div class="metric-grid">${metric('Wet / day',avg('wet').toFixed(1),`${range}-day average`,'diaper','baby')}${metric('Poop / day',avg('poop').toFixed(1),`${range}-day average`,'diaper','baby')}${metric('Feeds / day',avg('feeds').toFixed(1),`${range}-day average`,'bottle','baby')}${metric('Bottle milk',`${avg('oz').toFixed(1)} oz/day`,'logged bottles','bottle','baby')}</div>
  <section class="panel doctor-latest">${sectionHead(`Latest logged day · ${fd(end)}`)}<div class="doctor-answers"><div><span>Wet diapers</span><strong>${latest.wet}</strong></div><div><span>Poopy diapers</span><strong>${latest.poop}</strong></div><div><span>Feeds</span><strong>${latest.feeds}</strong></div><div><span>Bottle milk</span><strong>${latest.oz.toFixed(1)} oz</strong></div></div></section>
  <section class="panel">${sectionHead('Doctor quick answers')}<div class="qa"><div>${icon('diaper')}<span>Wet diapers</span><strong>${wet7.toFixed(1)} / day</strong><small>7-day average</small></div><div>${icon('diaper')}<span>Poopy diapers</span><strong>${poop7.toFixed(1)} / day</strong><small>7-day average</small></div><div>${icon('bottle')}<span>Feeds</span><strong>${feeds7.toFixed(1)} / day</strong><small>7-day average</small></div><div>${icon('bottle')}<span>Bottle milk</span><strong>${oz7.toFixed(1)} oz / day</strong><small>7-day average</small></div></div></section>
  <section class="panel">${sectionHead('Daily log')}<div class="doctor-table"><div class="doctor-tr head"><span>Date</span><span>Wet</span><span>Poop</span><span>Feeds</span><span>Oz</span></div>${rows.slice().reverse().map(r=>`<div class="doctor-tr"><span>${fd(r.d)}</span><span>${r.wet}</span><span>${r.poop}</span><span>${r.feeds}</span><span>${r.oz.toFixed(1)}</span></div>`).join('')}</div><small class="footnote">Summary reflects logged events and is intended to help answer routine visit questions.</small></section>`;
}

function notificationSupport(){
  if(!('Notification' in window)) return 'unavailable';
  return Notification.permission;
}
function settingsView(){
  const notif=notificationSupport(), localMom=momEntries().length, localBaby=babyEvents().length;
  const verified = S.cloud.lastVerified && S.cloud.momCount===localMom && S.cloud.babyCount===localBaby;
  return `<div class="view-head"><div><span class="eyebrow">FAMILY</span><h2>Settings</h2></div></div>
  <section class="panel data-panel"><div class="data-hero-icon">${icon('shield')}</div><div class="data-main"><h3>${verified?'Family data is saved':'Family data'}</h3><p>${S.cloud.enabled?esc(S.cloud.email||'Signed in'):'Sign in to keep the same history on every device.'}</p><div class="data-counts"><span><b>${localMom}</b> Mom</span><span><b>${localBaby}</b> Baby</span>${S.cloud.lastVerified?`<span><b>${S.cloud.momCount??'—'} / ${S.cloud.babyCount??'—'}</b> Cloud</span>`:''}</div></div><div class="settings-actions">${S.cloud.enabled?`<button class="action soft" data-cloud-check>${icon('check')}<span>Check cloud</span></button><button class="mini" data-signout>Sign out</button>`:`<button class="action primary" data-auth>${icon('shield')}<span>Sign in</span></button>`}</div></section>
  ${!localMom && localBaby?`<section class="panel recovery-panel"><div class="settings-icon mom-tone">${icon('history')}</div><div><h3>Restore Mom history</h3><p>Baby history is already here. Use the complete family backup to add Mom pumping history without replacing Baby records.</p></div><button class="action primary" data-import>${icon('upload')}<span>Import</span></button></section>`:''}
  <section class="panel settings-card"><div class="settings-icon">${icon('bell')}</div><div><h3>Reminders</h3><p>${S.reminders.enabled?'In-app pump reminders are on.':'Turn on pump reminders.'}${notif==='granted'?' Device alerts are allowed.':notif==='denied'?' Device alerts are blocked in browser settings.':notif==='unavailable'?' Device alerts need a supported Home Screen app/browser.':' Device alerts can be enabled.'}</p></div><button class="action soft" data-reminders>${icon('bell')}<span>${S.reminders.enabled?'Turn off':'Turn on'}</span></button></section>
  <section class="panel backup-panel"><div class="settings-icon">${icon('history')}</div><div><h3>Backup & restore</h3><p>Imports merge safely. Existing Mom and Baby records stay in place.</p></div><div class="settings-actions"><button class="action soft" data-import>${icon('upload')}<span>Import</span></button><button class="action soft" data-export>${icon('download')}<span>Export</span></button></div></section>
  <section class="panel settings-stack"><label>Daily pump goal<input id="goalMl" type="number" inputmode="numeric" value="${+S.profile.dailyGoalMl||760}"></label><label>Freezer stash<input id="stashMl" type="number" inputmode="numeric" value="${+S.profile.stashMl||0}"></label>${S.schedule.map((t,i)=>`<label>Pump ${i+1}<input data-schedule="${i}" type="time" value="${t}"></label>`).join('')}</section>`;
}

const renderers={'mom-home':momHome,today:todayView,history:momHistoryView,trends:trendsView,stash:stashView,'baby-home':babyHome,'baby-history':babyHistoryView,doctor:doctorView,settings:settingsView};
const titles={'mom-home':'Mom',today:'Today',history:'Mom history',trends:'Mom trends',stash:'Freezer stash','baby-home':'Baby','baby-history':'Baby history',doctor:'Doctor summary',settings:'Settings'};
function render(){
  const workspace=workspaceForView(view);
  $('viewTitle').textContent=titles[view]||'MilkFlow';
  $('content').innerHTML=(renderers[view]||momHome)();
  document.body.dataset.workspace=workspace;
  document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  document.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('active',b.dataset.workspace===workspace));
  renderTopActions(workspace); renderMobileNav(workspace); syncBadge();
}
function renderTopActions(workspace){
  const el=$('topActions'); if(!el) return;
  el.innerHTML=workspace==='baby'?'<button class="btn ghost" data-baby="wet">Wet</button><button class="btn primary baby-top" data-baby="bottle">Bottle</button>':'<button class="btn ghost" data-mom="nursing">Nursing</button><button class="btn primary" data-mom="pump">Pump</button>';
}
function renderMobileNav(workspace){
  const map=workspace==='baby'?{home:['baby-home','Baby','baby'],history:['baby-history','History','history'],insights:['doctor','Doctor','steth']}:{home:['mom-home','Mom','home'],history:['history','History','history'],insights:['trends','Trends','chart']};
  for(const key of ['home','history','insights']){const btn=document.querySelector(`[data-mobile-tab="${key}"]`);if(!btn)continue;const[target,label,ic]=map[key];btn.dataset.target=target;btn.innerHTML=`${icon(ic)}<span>${label}</span>`;btn.classList.toggle('active',view===target);}
  const more=document.querySelector('[data-mobile-tab="more"]');if(more){more.innerHTML=`${icon('more')}<span>More</span>`;more.classList.toggle('active',view==='settings'||view==='stash');}
  const add=document.querySelector('[data-mobile-tab="add"]');if(add)add.innerHTML=`<span class="add-circle">${icon('plus')}</span><small>Add</small>`;
}
function syncBadge(){
  const on=!!S.cloud.enabled,badge=$('cloudBadge'),title=$('syncTitle'),sub=$('syncSubtitle');
  if(badge){badge.textContent=on?'Saved':'Device';badge.className=`cloud-badge ${on?'on':'off'}`;}if(title)title.textContent=on?'Family data saved':'On this device';if(sub)sub.textContent=on?(S.cloud.email||'Family account'):'Sign in to sync';
}

function openMom(type){
  $('entryType').value=type;$('dialogTitle').textContent=type==='pump'?'Pump':'Nursing';$('entryDate').value=today();$('entryTime').value=now();$('entryAmount').value='';$('entryDuration').value='';$('entryNote').value='';document.querySelectorAll('.pump-only').forEach(x=>x.classList.toggle('hidden',type!=='pump'));document.querySelectorAll('.nurse-only').forEach(x=>x.classList.toggle('hidden',type!=='nursing'));$('entryDialog').showModal();
}
function openBaby(kind){
  $('babyDate').value=today();$('babyTime').value=now();$('babyNote').value='';$('babyAmount').value='';if(['wet','poop','both'].includes(kind)){$('babyEventType').value='diaper';$('babyDialogTitle').textContent='Diaper';$('babyAmountWrap').classList.add('hidden');$('babySubtype').innerHTML='<option value="wet">Wet</option><option value="poop">Poop</option><option value="both">Wet + poop</option>';$('babySubtype').value=kind;}else{$('babyEventType').value='feeding';$('babyDialogTitle').textContent='Bottle';$('babyAmountWrap').classList.remove('hidden');$('babySubtype').innerHTML='<option value="expressed_milk">Breast milk</option><option value="formula">Formula</option>';}$('babyDialog').showModal();
}
function openQuickSheet(){
  const workspace=workspaceForView(view),sheet=$('quickSheet');sheet.innerHTML=workspace==='baby'?`<div class="sheet-handle"></div><div class="sheet-head"><strong>Add baby care</strong><button data-close-sheet>${icon('close')}</button></div><div class="sheet-grid"><button data-baby="wet">${icon('diaper')}<span>Wet</span></button><button data-baby="poop">${icon('diaper')}<span>Poop</span></button><button data-baby="both">${icon('diaper')}<span>Both</span></button><button data-baby="bottle">${icon('bottle')}<span>Bottle</span></button></div>`:`<div class="sheet-handle"></div><div class="sheet-head"><strong>Add Mom care</strong><button data-close-sheet>${icon('close')}</button></div><div class="sheet-grid two"><button data-mom="pump">${icon('drop')}<span>Pump</span></button><button data-mom="nursing">${icon('heart')}<span>Nursing</span></button></div>`;sheet.classList.add('show');$('scrim').classList.add('show');
}
function openMoreSheet(){
  const workspace=workspaceForView(view),sheet=$('moreSheet');const items=workspace==='baby'?[['doctor','steth','Doctor'],['baby-history','history','History'],['settings','settings','Settings'],['mom-home','heart','Mom']]:[['stash','snow','Stash'],['trends','chart','Trends'],['settings','settings','Settings'],['baby-home','baby','Baby']];sheet.innerHTML=`<div class="sheet-handle"></div><div class="sheet-head"><strong>More</strong><button data-close-sheet>${icon('close')}</button></div><div class="more-grid">${items.map(([v,ic,l])=>`<button data-view="${v}">${icon(ic)}<span>${l}</span></button>`).join('')}</div>`;sheet.classList.add('show');$('scrim').classList.add('show');
}

function snapshotBeforeImport(){try{localStorage.setItem(PRE_IMPORT_KEY,JSON.stringify(S));}catch(e){console.warn('Pre-import snapshot failed',e);}}
function mapMigrationBaby(x){return {id:x.migration_id||x.id||uuid('baby'),babyId:x.baby_id||x.babyId||'saahas-2026',eventType:x.event_type||x.eventType,date:x.date,time:x.time||'',subtype:x.status||x.subtype||null,feedingType:x.feeding_type||x.feedingType||null,amountOz:x.amount_oz??x.amountOz??null,totalMinutes:x.total_minutes??x.totalMinutes??null,leftMinutes:x.left_minutes??x.leftMinutes??null,rightMinutes:x.right_minutes??x.rightMinutes??null,durationMinutes:x.duration_minutes??x.durationMinutes??null,note:x.note||'',sourceFile:x.source_file||x.sourceFile||'Baby Tracker',sourceRow:x.source_row||x.sourceRow||null,synced:false};}
function mergeById(current,incoming){const m=new Map(current.map(x=>[x.id,x]));for(const x of incoming){if(!x?.id)continue;if(!m.has(x.id))m.set(x.id,{...x,synced:false});}return [...m.values()];}
async function importBackup(file){
  let d;try{d=JSON.parse(await file.text());}catch{return toast('That backup could not be read.');}let mom=[],baby=[],profile=null,schedule=null,overrides={};if(d.schema_version==='milkflow-family-bundle-2'){mom=Array.isArray(d.mom?.entries)?d.mom.entries:[];baby=Array.isArray(d.baby?.events)?d.baby.events.map(mapMigrationBaby):[];profile=d.mom?.profile||null;schedule=d.mom?.schedule||null;overrides=d.mom?.dailyOverrides||{};}else if(Array.isArray(d.events)){baby=d.events.filter(x=>x.owner_scope==='baby'&&String(x.date||'').startsWith('2026-')).map(mapMigrationBaby);}else if(Array.isArray(d.entries)){mom=d.entries;profile=d.profile||null;schedule=d.schedule||null;overrides=d.dailyOverrides||{};}if(!mom.length&&!baby.length)return toast('No compatible family records found.');snapshotBeforeImport();const beforeMom=momEntries().length,beforeBaby=babyEvents().length;S.entries=mergeById(S.entries,mom);S.babyEvents=mergeById(S.babyEvents,baby);if(profile)S.profile={...S.profile,...profile};if(Array.isArray(schedule)&&schedule.length)S.schedule=schedule;S.dailyOverrides={...S.dailyOverrides,...overrides};save();const addedMom=momEntries().length-beforeMom,addedBaby=babyEvents().length-beforeBaby;toast(`Added ${addedMom} Mom · ${addedBaby} Baby records`,3600);if(S.cloud.enabled){try{await reconcile();await checkCloud({quiet:true});toast('Family history saved to cloud.',3200);}catch(e){console.error(e);toast('Saved on this device. Cloud will retry.',3600);}}setView(addedMom>0?'history':baby.length?'baby-history':'settings');
}
function exportBackup(){const bundle={schema_version:'milkflow-family-bundle-2',exported_at:new Date().toISOString(),mom:{entries:momEntries(),profile:S.profile,schedule:S.schedule,dailyOverrides:S.dailyOverrides},baby:{events:babyEvents(),profile:S.baby}};const blob=new Blob([JSON.stringify(bundle,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`milkflow-family-backup-${today()}.json`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Private backup exported.');}

async function initCloud(){
  const c=window.MILKFLOW_CONFIG||{};if(!c.enableCloudSync||!c.firebaseConfig||!window.firebase){syncBadge();return;}try{if(!firebase.apps.length)firebase.initializeApp(c.firebaseConfig);cloud={auth:firebase.auth(),db:firebase.firestore()};try{await cloud.db.enablePersistence({synchronizeTabs:true});}catch{}cloud.auth.onAuthStateChanged(async u=>{S.cloud.userId=u?.uid||null;S.cloud.email=u?.email||null;S.cloud.enabled=!!u;save();syncBadge();if(u){await reconcile();await checkCloud({quiet:true});}render();});}catch(e){console.error(e);toast('Cloud connection needs attention.');}
}
const userRef=()=>cloud?.db.collection('users').doc(S.cloud.userId);const momRef=()=>userRef().collection('entries');const babyRef=()=>userRef().collection('familyEvents');const profRef=()=>userRef().collection('private').doc('profile');
async function reconcile(){
  if(!cloud||!S.cloud.userId)return;const[ms,bs,ps]=await Promise.all([momRef().get(),babyRef().get(),profRef().get()]);const remoteMom=new Map(ms.docs.map(d=>[d.id,{id:d.id,...d.data(),synced:true}]));const localMom=new Map(S.entries.map(e=>[e.id,e]));for(const[id,r]of remoteMom)localMom.set(id,{...(localMom.get(id)||{}),...r,synced:true});S.entries=[...localMom.values()];const remoteBaby=new Map(bs.docs.map(d=>[d.id,{id:d.id,...d.data(),synced:true}]));const localBaby=new Map(S.babyEvents.map(e=>[e.id,e]));for(const[id,r]of remoteBaby)localBaby.set(id,{...(localBaby.get(id)||{}),...r,synced:true});S.babyEvents=[...localBaby.values()];if(ps.exists){const p=ps.data();S.profile={...S.profile,...(p.profile||{})};S.baby={...S.baby,...(p.baby||{})};if(Array.isArray(p.schedule))S.schedule=p.schedule;S.dailyOverrides={...S.dailyOverrides,...(p.dailyOverrides||{})};S.reminders={...S.reminders,...(p.reminders||{})};}for(const e of S.entries){if(!remoteMom.has(e.id))await pushMom(e);else e.synced=true;}await pushBabies(S.babyEvents.filter(e=>!remoteBaby.has(e.id)));if(!ps.exists)await pushProfile();S.cloud.lastSync=new Date().toISOString();save();
}
async function pushMom(e){if(!cloud||!S.cloud.userId)return;await momRef().doc(e.id).set({type:e.type,date:e.date,time:e.time||'',amountMl:e.amountMl??null,durationMin:e.durationMin??null,side:e.side||null,quality:e.quality||null,note:e.note||'',occurredAt:`${e.date}T${e.time||'00:00'}:00`,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});e.synced=true;save();}
async function pushBabies(arr){if(!cloud||!S.cloud.userId||!arr.length)return;for(let i=0;i<arr.length;i+=350){const part=arr.slice(i,i+350),batch=cloud.db.batch();for(const e of part)batch.set(babyRef().doc(e.id),{...e,synced:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await batch.commit();part.forEach(e=>e.synced=true);}save();}
async function pushProfile(){if(!cloud||!S.cloud.userId)return;await profRef().set({profile:S.profile,baby:S.baby,schedule:S.schedule,dailyOverrides:S.dailyOverrides,reminders:S.reminders,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});S.cloud.lastSync=new Date().toISOString();save();}
async function checkCloud({quiet=false}={}){if(!cloud||!S.cloud.userId){if(!quiet)toast('Sign in first.');return null;}try{const[m,b]=await Promise.all([momRef().get(),babyRef().get()]);S.cloud.momCount=m.size;S.cloud.babyCount=b.size;S.cloud.lastVerified=new Date().toISOString();save();if(!quiet)toast(`Cloud has ${m.size} Mom · ${b.size} Baby records`,3500);return{mom:m.size,baby:b.size};}catch(e){console.error(e);if(!quiet)toast('Could not check cloud right now.');return null;}}

async function toggleReminders(){S.reminders.enabled=!S.reminders.enabled;save();if(S.reminders.enabled&&'Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}try{await pushProfile();}catch{}render();toast(S.reminders.enabled?'Pump reminders are on.':'Pump reminders are off.');}
function tickReminders(){if(!S.reminders.enabled)return;const d=new Date(),m=d.getHours()*60+d.getMinutes(),dt=today();if(S.reminders.snoozedUntil&&Date.now()<S.reminders.snoozedUntil)return;S.schedule.forEach((t,i)=>{const target=+t.slice(0,2)*60 + +t.slice(3)-(+S.reminders.leadMin||0),key=`${dt}-${i}-${target}`;if(Math.abs(m-target)<=1&&S.reminders.lastSentKey!==key&&dayP(dt).length<=i){toast(`Pump ${i+1} is coming up · ${to12(t)}`,8000);if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Pump reminder',{body:`Pump ${i+1} · ${to12(t)}`});}catch{}}S.reminders.lastSentKey=key;save();}});}

function handleClick(e){
  const close=e.target.closest('[data-close-sheet]');if(close){closeOverlays();return;}if(e.target.id==='scrim'){closeOverlays();return;}const workspace=e.target.closest('[data-workspace]');if(workspace){setView(workspace.dataset.workspace==='baby'?'baby-home':'mom-home');return;}const route=e.target.closest('[data-view]');if(route){setView(route.dataset.view);return;}const m=e.target.closest('[data-mom]');if(m){closeOverlays();openMom(m.dataset.mom);return;}const b=e.target.closest('[data-baby]');if(b){closeOverlays();openBaby(b.dataset.baby);return;}const mobile=e.target.closest('[data-mobile-tab]');if(mobile){const key=mobile.dataset.mobileTab;if(key==='add')return openQuickSheet();if(key==='more')return openMoreSheet();if(mobile.dataset.target)return setView(mobile.dataset.target);}if(e.target.closest('[data-menu]')){$('sidebar').classList.add('open');$('scrim').classList.add('show');return;}if(e.target.closest('[data-import]')){$('importFile').click();return;}if(e.target.closest('[data-export]')){exportBackup();return;}if(e.target.closest('[data-cloud-check]')){checkCloud().then(()=>render());return;}if(e.target.closest('[data-reminders]')){toggleReminders();return;}if(e.target.closest('[data-auth]')){$('authDialog').showModal();return;}if(e.target.closest('[data-signout]')){cloud?.auth.signOut();return;}if(e.target.closest('[data-print]')){window.print();return;}const stash=e.target.closest('[data-stash]');if(stash){S.profile.stashMl=Math.max(0,(+S.profile.stashMl||0)+ +stash.dataset.stash);save();pushProfile().catch(()=>{});render();return;}const mr=e.target.closest('[data-mom-range]');if(mr){S.ui.momHistoryRange=+mr.dataset.momRange;save();render();return;}const br=e.target.closest('[data-baby-range]');if(br){S.ui.babyHistoryRange=+br.dataset.babyRange;save();render();return;}const bf=e.target.closest('[data-baby-filter]');if(bf){S.ui.babyFilter=bf.dataset.babyFilter;save();render();return;}const dr=e.target.closest('[data-doctor-range]');if(dr){S.ui.doctorRange=+dr.dataset.doctorRange;save();render();return;}
}

document.addEventListener('click',handleClick);
$('entryForm').addEventListener('submit',async e=>{e.preventDefault();const type=$('entryType').value,x={id:uuid('mom'),type,date:$('entryDate').value,time:$('entryTime').value,amountMl:type==='pump'?+$('entryAmount').value||0:null,durationMin:+$('entryDuration').value||null,side:type==='nursing'?$('entrySide').value:null,quality:type==='pump'?$('entryQuality').value:null,note:$('entryNote').value.trim(),synced:false};S.entries.push(x);save();$('entryDialog').close();try{await pushMom(x);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('babyForm').addEventListener('submit',async e=>{e.preventDefault();const type=$('babyEventType').value,x={id:uuid('baby'),babyId:S.baby.id,eventType:type,date:$('babyDate').value,time:$('babyTime').value,subtype:type==='diaper'?$('babySubtype').value:null,feedingType:type==='feeding'?$('babySubtype').value:null,amountOz:type==='feeding'?+$('babyAmount').value||0:null,note:$('babyNote').value.trim(),sourceFile:'MilkFlow',synced:false};S.babyEvents.push(x);save();$('babyDialog').close();try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('authForm').addEventListener('submit',async e=>{e.preventDefault();if(!cloud)return toast('Cloud is not ready yet.');try{await cloud.auth.signInWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value);$('authDialog').close();}catch(err){toast(err.message);}});
$('signUpBtn').addEventListener('click',async()=>{if(!cloud)return toast('Cloud is not ready yet.');try{await cloud.auth.createUserWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value);$('authDialog').close();}catch(err){toast(err.message);}});
$('importFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value='';});
document.addEventListener('change',e=>{if(e.target.id==='goalMl'){S.profile.dailyGoalMl=+e.target.value||760;save();pushProfile().catch(()=>{});}if(e.target.id==='stashMl'){S.profile.stashMl=Math.max(0,+e.target.value||0);save();pushProfile().catch(()=>{});}if(e.target.matches('[data-schedule]')){S.schedule[+e.target.dataset.schedule]=e.target.value;save();pushProfile().catch(()=>{});}});

save();render();initCloud();tickReminders();setInterval(tickReminders,60000);
})();