(() => {
'use strict';

const STATE_KEY = 'milkflow-family-v4-state';
const SNAPSHOT_KEY = 'milkflow-family-pre-import-backup';
const VERSION = 7;
const VIEWS = new Set(['mom-home','mom-history','mom-trends','mom-stash','baby-home','baby-history','baby-trends','baby-growth','doctor','settings']);
const defaults = {
  version: VERSION,
  profile: { dailyGoalMl: 760, stashMl: 0 },
  baby: { id:'saahas-2026', name:'Saahas', feedingPreference:'auto' },
  schedule:['05:40','11:05','14:35','17:45','20:45','23:35'],
  entries:[],
  babyEvents:[],
  dailyOverrides:{},
  reminders:{enabled:false,leadMin:10,lastSentKey:null},
  cloud:{enabled:false,userId:null,email:null,lastSync:null,lastVerified:null,momCount:null,babyCount:null},
  ui:{workspace:'mom',view:'mom-home',momRange:30,babyRange:30,babyFilter:'all',trendRange:14,doctorRange:14}
};

const $ = id => document.getElementById(id);
const clone = x => JSON.parse(JSON.stringify(x));
const sum = a => a.reduce((x,y)=>x+y,0);
const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => iso(new Date());
const now = () => { const d=new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fd = d => d ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const fdl = d => d ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const to12 = t => { if(!t)return '—'; const [h,m]=t.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const cap = s => String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());
const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const byWhenDesc = (a,b) => `${b.date||''}${b.time||''}`.localeCompare(`${a.date||''}${a.time||''}`);

function readState(){
  const keys=[STATE_KEY,'milkflow-v3-state','milkflow-v2-state'];
  for(const key of keys){
    try{
      const raw=localStorage.getItem(key); if(!raw) continue;
      const p=JSON.parse(raw);
      return {
        ...clone(defaults),...p,
        profile:{...defaults.profile,...(p.profile||{})},
        baby:{...defaults.baby,...(p.baby||{})},
        reminders:{...defaults.reminders,...(p.reminders||{})},
        cloud:{...defaults.cloud,...(p.cloud||{})},
        ui:{...defaults.ui,...(p.ui||{})},
        entries:Array.isArray(p.entries)?p.entries:[],
        babyEvents:Array.isArray(p.babyEvents)?p.babyEvents:[],
        dailyOverrides:p.dailyOverrides||{}
      };
    }catch(e){ console.warn('Ignoring unreadable local state',e); }
  }
  return clone(defaults);
}

const S=readState();
let cloud=null;
let unsubscribers=[];
let renderTimer=null;
let view=(()=>{const h=location.hash.slice(1);if(VIEWS.has(h))return h;if(VIEWS.has(S.ui.view))return S.ui.view;return 'mom-home';})();

function workspaceOf(v){return v.startsWith('baby')||v==='doctor'?'baby':'mom';}
function save(){S.version=VERSION;S.ui.view=view;S.ui.workspace=workspaceOf(view);localStorage.setItem(STATE_KEY,JSON.stringify(S));}
function toast(text,ms=2800){const t=$('toast');if(!t)return;t.textContent=text;t.classList.add('show');clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove('show'),ms);}
function closeOverlays(){document.body.classList.remove('locked');$('drawer')?.classList.remove('open');$('sheet')?.classList.remove('open');$('scrim')?.classList.remove('open');}
function setView(v){if(!VIEWS.has(v))v=S.ui.workspace==='baby'?'baby-home':'mom-home';view=v;save();history.replaceState(null,'',`#${v}`);closeOverlays();render();window.scrollTo({top:0,behavior:'auto'});}
window.addEventListener('hashchange',()=>{const h=location.hash.slice(1);if(VIEWS.has(h)&&h!==view){view=h;save();closeOverlays();render();}});

// Selected SVG paths are based on Lucide icons (ISC license): https://lucide.dev/
function icon(name,cls=''){
  const p={
    home:'<path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10.5V20h13v-9.5"/><path d="M9 20v-6h6v6"/>',
    drop:'<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-7.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bottle:'<path d="M9 3h6M10 3v4l-2 3v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9l-2-3V3"/><path d="M8 13h8"/>',
    diaper:'<path d="M5 7c2.3 1.4 4.6 2.1 7 2.1S16.7 8.4 19 7v8.5c-2.1 2.3-4.5 3.5-7 3.5s-4.9-1.2-7-3.5Z"/><path d="M8 9.1v7.1M16 9.1v7.1"/>',
    history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l3 2"/>',
    chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/>',
    snow:'<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/>',
    baby:'<circle cx="12" cy="12" r="8"/><path d="M9.5 10h.01M14.5 10h.01M9.5 14c1.6 1.2 3.4 1.2 5 0"/><path d="M8 4.7c1.2-1.9 3.7-2.3 5.3-.8"/>',
    plus:'<path d="M12 5v14M5 12h14"/>',
    more:'<circle cx="5" cy="12" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/><circle cx="19" cy="12" r="1" fill="currentColor"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    check:'<path d="m5 12 4 4L19 6"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/>',
    steth:'<path d="M6 3v5a4 4 0 0 0 8 0V3"/><path d="M10 12v2a5 5 0 0 0 10 0v-1"/><circle cx="20" cy="10" r="2"/>',
    growth:'<path d="M4 20V10M10 20V4M16 20v-7M22 20V7"/>',
    moon:'<path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
    upload:'<path d="M12 21V9"/><path d="m7 14 5-5 5 5"/><path d="M5 3h14"/>',
    download:'<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
    chevron:'<path d="m9 18 6-6-6-6"/>',
    clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'
  };
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${p[name]||p.heart}</svg>`;
}

const momEntries=()=>S.entries.filter(e=>!e.voidedAt);
const pumps=()=>momEntries().filter(e=>e.type==='pump');
const nurses=()=>momEntries().filter(e=>e.type==='nursing');
const babyEvents=()=>S.babyEvents.filter(e=>!e.voidedAt);
const dayP=d=>pumps().filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
const dayTotal=d=>Number.isFinite(+S.dailyOverrides?.[d])?+S.dailyOverrides[d]:sum(dayP(d).map(e=>+e.amountMl||0));
const babyOn=(d,t)=>babyEvents().filter(e=>e.date===d&&(!t||e.eventType===t));
function dateList(n,end=today()){const out=[],d=new Date(`${end}T12:00:00`);for(let i=n-1;i>=0;i--){const x=new Date(d);x.setDate(d.getDate()-i);out.push(iso(x));}return out;}
function rollingAvg(n=7){const vals=dateList(n).map(dayTotal).filter(Boolean);return vals.length?Math.round(sum(vals)/vals.length):0;}
function lastPump(){return pumps().slice().sort(byWhenDesc)[0]||null;}
function nextPump(){const d=new Date(),m=d.getHours()*60+d.getMinutes();return S.schedule.find(t=>(+t.slice(0,2)*60 + +t.slice(3))>m)||S.schedule[0];}
function babyStats(d){
  const diapers=babyOn(d,'diaper').filter(e=>!e.exactSourceDuplicate), feeds=babyOn(d,'feeding').filter(e=>!e.exactSourceDuplicate), nursing=babyOn(d,'nursing').filter(e=>!e.exactSourceDuplicate);
  return {
    wet:diapers.filter(e=>['wet','both'].includes(e.subtype)).length,
    poop:diapers.filter(e=>['poop','both'].includes(e.subtype)).length,
    feeds:feeds.length+nursing.length,
    bottles:feeds.length,
    nursing:nursing.length,
    oz:sum(feeds.map(e=>+e.amountOz||0))
  };
}
function latestBabyDate(){return babyEvents().slice().sort(byWhenDesc)[0]?.date||today();}
function latestGrowth(){return babyEvents().filter(e=>e.eventType==='growth').sort(byWhenDesc)[0]||null;}
function feedingPreference(){
  if(['mostly_breastfed','mostly_formula','mixed'].includes(S.baby.feedingPreference)) return S.baby.feedingPreference;
  const recent=babyEvents().filter(e=>e.eventType==='feeding'||e.eventType==='nursing').filter(e=>{const x=new Date(`${today()}T12:00:00`);x.setDate(x.getDate()-30);return e.date>=iso(x);});
  const breast=recent.filter(e=>e.eventType==='nursing'||e.feedingType==='expressed_milk').length;
  const formula=recent.filter(e=>e.eventType==='feeding'&&e.feedingType==='formula').length;
  if(!breast&&!formula)return 'mostly_breastfed';
  if(formula>breast*1.3)return 'mostly_formula';
  if(breast>formula*1.3)return 'mostly_breastfed';
  return 'mixed';
}

function metric(label,value,sub,ic,tone='mom'){return `<article class="metric ${tone}"><div class="metric-icon">${icon(ic)}</div><div><span>${label}</span><strong>${value}</strong><small>${sub}</small></div></article>`;}
function panel(title,content,action=''){return `<section class="panel"><div class="panel-head"><h3>${title}</h3>${action}</div>${content}</section>`;}
function empty(ic,title,sub,action=''){return `<div class="empty"><div class="empty-icon">${icon(ic)}</div><strong>${title}</strong><span>${sub||''}</span>${action}</div>`;}
function pills(items,active,attr){return `<div class="pills">${items.map(([v,l])=>`<button ${attr}="${v}" class="${String(v)===String(active)?'active':''}">${l}</button>`).join('')}</div>`;}

function momHome(){
  const t=today(),total=dayTotal(t),count=dayP(t).length,lp=lastPump();
  return `<div class="hero mom-hero"><div class="hero-copy"><span class="eyebrow">MOM</span><h2>${total?`${total} mL today`:'Start today'}</h2><p>${count} pumps${lp?` · last ${to12(lp.time)}`:''}</p></div><div class="hero-visual mom-visual">${icon('drop','hero-main')}<span class="bubble one"></span><span class="bubble two"></span></div></div>
  <div class="quick-grid mom-grid">
    <button class="quick-tile mom" data-mom="pump"><span class="tile-art">${icon('drop')}</span><strong>Pump</strong><small>Log milk</small></button>
    <button class="quick-tile mom" data-mom="nursing"><span class="tile-art">${icon('heart')}</span><strong>Nursing</strong><small>Log session</small></button>
    <button class="quick-tile mom" data-view="mom-history"><span class="tile-art">${icon('history')}</span><strong>History</strong><small>Past entries</small></button>
    <button class="quick-tile mom" data-view="mom-stash"><span class="tile-art">${icon('snow')}</span><strong>Stash</strong><small>${(+S.profile.stashMl||0).toLocaleString()} mL</small></button>
  </div>
  <div class="metric-grid">${metric('Today',`${total} mL`,`${count} pumps`,'drop')}${metric('7-day avg',`${rollingAvg()} mL`,'pumping days','chart')}${metric('Next',to12(nextPump()),'planned','bell')}${metric('Cloud',S.cloud.enabled?'Connected':'Device only',S.cloud.email||'sign in in Settings','shield')}</div>
  ${panel('Today’s pump plan',scheduleStrip(),'<button data-view="settings">Edit</button>')}
  ${panel('Recent',recentMom(5),'<button data-view="mom-history">All</button>')}`;
}
function scheduleStrip(){const p=dayP(today());return `<div class="schedule-strip">${S.schedule.map((t,i)=>{const e=p[i];return `<div class="schedule-card ${e?'done':''}"><div>${e?icon('check'):icon('clock')}</div><strong>${e?to12(e.time):to12(t)}</strong><small>${e?`${e.amountMl} mL`:'Planned'}</small></div>`;}).join('')}</div>`;}
function recentMom(n){const a=momEntries().slice().sort(byWhenDesc).slice(0,n);if(!a.length)return empty('history','No Mom history yet','Import your complete family backup or start logging.','<button class="primary-link" data-import>Import backup</button>');return `<div class="rows">${a.map(momRow).join('')}</div>`;}
function momRow(e){return `<div class="row"><div class="row-icon mom">${icon(e.type==='pump'?'drop':'heart')}</div><div class="row-main"><strong>${e.type==='pump'?`${e.amountMl||0} mL`:`${e.durationMin||0} min nursing`}</strong><span>${fd(e.date)} · ${to12(e.time)}${e.side?` · ${cap(e.side)}`:''}</span></div><div class="row-status">${e.synced?'Saved':'Device'}</div></div>`;}
function momHistory(){
  const range=+S.ui.momRange||30;const cutoff=dateList(range)[0];const a=momEntries().filter(e=>range>=9999||e.date>=cutoff).sort(byWhenDesc);
  return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>History</h2></div><button class="round-action" data-mom="pump">${icon('plus')}<span>Pump</span></button></div>
  ${pills([[7,'7 days'],[30,'30 days'],[9999,'All']],range,'data-mom-range')}
  ${panel('',a.length?`<div class="rows">${a.map(momRow).join('')}</div>`:empty('history','No Mom records in this view','Your data is never removed when you change filters.'))}`;
}
function momTrends(){const range=+S.ui.trendRange||14,days=dateList(range),vals=days.map(dayTotal),max=Math.max(...vals,1);const bars=days.map((d,i)=>`<div class="bar"><span>${vals[i]||''}</span><i style="height:${Math.max(4,Math.round(vals[i]/max*150))}px"></i><small>${fd(d)}</small></div>`).join('');const sessions=pumps().filter(e=>e.date>=days[0]);const avgSession=sessions.length?Math.round(sum(sessions.map(e=>+e.amountMl||0))/sessions.length):0;const best=sessions.reduce((m,e)=>(+e.amountMl||0)>(+m?.amountMl||0)?e:m,null);return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>Milk trends</h2></div></div>${pills([[7,'7 days'],[14,'14 days'],[30,'30 days']],range,'data-trend-range')}<div class="metric-grid three">${metric('Daily avg',`${rollingAvg(Math.min(range,7))} mL`,'recent pumping days','chart')}${metric('Avg pump',`${avgSession} mL`,`${sessions.length} sessions`,'drop')}${metric('Best pump',`${best?.amountMl||0} mL`,best?fd(best.date):'—','check')}</div>${panel('Daily output',`<div class="bars">${bars}</div>`)}`;}
function momStash(){return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>Freezer stash</h2></div></div><div class="stash-hero"><div class="stash-art">${icon('snow')}</div><div><strong>${(+S.profile.stashMl||0).toLocaleString()} mL</strong><span>saved milk</span></div></div>${panel('Update stash',`<div class="stash-buttons"><button data-stash="-30">−30</button><button data-stash="30">+30</button><button data-stash="60">+60</button><button data-stash="120">+120</button></div><label class="field"><span>Exact amount (mL)</span><input id="stashExact" type="number" inputmode="numeric" min="0" value="${+S.profile.stashMl||0}"></label>`)}`;}

function babyHome(){
  const s=babyStats(today()),pref=feedingPreference(),prefLabel=pref==='mostly_formula'?'Mostly formula':pref==='mixed'?'Mixed feeding':'Mostly breastfed';
  return `<div class="hero baby-hero"><div class="hero-copy"><span class="eyebrow">${esc(S.baby.name)}</span><h2>Baby care</h2><p>${prefLabel} · ${s.feeds} feeds today</p></div><div class="hero-visual baby-visual">${icon('baby','hero-main')}<span class="bubble one"></span><span class="bubble two"></span></div></div>
  <div class="quick-grid baby-grid">
    <button class="quick-tile feed" data-feed>${icon('bottle')}<strong>Feed</strong><small>Nurse or bottle</small></button>
    <button class="quick-tile wet" data-diaper="wet">${icon('drop')}<strong>Wet</strong><small>Pee diaper</small></button>
    <button class="quick-tile poop" data-diaper="poop">${icon('diaper')}<strong>Poopy</strong><small>Dirty diaper</small></button>
    <button class="quick-tile mixed" data-diaper="both">${icon('diaper')}<strong>Mixed</strong><small>Wet + poopy</small></button>
  </div>
  <div class="metric-grid">${metric('Wet',s.wet,'today','drop','baby')}${metric('Poopy',s.poop,'today','diaper','baby')}${metric('Feeds',s.feeds,`${s.nursing} nursing · ${s.bottles} bottles`,'bottle','baby')}${metric('Bottle milk',`${s.oz.toFixed(1)} oz`,'today','bottle','baby')}</div>
  ${panel('Recent care',recentBaby(6),'<button data-view="baby-history">All</button>')}
  ${panel('At a glance',`<div class="baby-shortcuts"><button data-view="baby-trends">${icon('chart')}<span><strong>Trends</strong><small>Diapers + feeding</small></span>${icon('chevron')}</button><button data-view="baby-growth">${icon('growth')}<span><strong>Growth</strong><small>Weight, length, head size</small></span>${icon('chevron')}</button></div>`)}`;
}
function babyLabel(e){if(e.eventType==='diaper')return e.subtype==='both'?'Mixed diaper':e.subtype==='poop'?'Poopy diaper':'Wet diaper';if(e.eventType==='feeding')return `${(+e.amountOz||0).toFixed(1)} oz ${e.feedingType==='formula'?'formula':'breast milk'}`;if(e.eventType==='nursing')return `${e.durationMinutes??e.totalMinutes??0} min nursing`;if(e.eventType==='sleep')return `${Math.round((+e.durationMinutes||0)/6)/10} hr sleep`;if(e.eventType==='growth')return 'Growth measurement';return cap(e.eventType);}
function recentBaby(n){const a=babyEvents().slice().sort(byWhenDesc).slice(0,n);if(!a.length)return empty('baby','No Baby history yet','Import your Baby Tracker JSON or start logging.','<button class="primary-link" data-import>Import history</button>');return `<div class="rows">${a.map(babyRow).join('')}</div>`;}
function babyRow(e){const ic=e.eventType==='feeding'?'bottle':e.eventType==='diaper'?(e.subtype==='wet'?'drop':'diaper'):e.eventType==='nursing'?'heart':e.eventType==='growth'?'growth':'moon';return `<div class="row"><div class="row-icon baby">${icon(ic)}</div><div class="row-main"><strong>${babyLabel(e)}</strong><span>${fd(e.date)} · ${to12(e.time)}${e.exactSourceDuplicate?' · duplicate preserved':''}</span></div><div class="row-status">${e.synced?'Saved':'Device'}</div></div>`;}
function babyHistory(){const range=+S.ui.babyRange||30,filter=S.ui.babyFilter||'all',cutoff=dateList(range)[0];const a=babyEvents().filter(e=>(range>=9999||e.date>=cutoff)&&(filter==='all'||e.eventType===filter)).sort(byWhenDesc);return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>History</h2></div><button class="round-action baby" data-feed>${icon('plus')}<span>Feed</span></button></div>${pills([[7,'7 days'],[30,'30 days'],[9999,'All']],range,'data-baby-range')}${pills([['all','All'],['diaper','Diapers'],['feeding','Bottles'],['nursing','Nursing'],['growth','Growth']],filter,'data-baby-filter')}${panel('',a.length?`<div class="rows">${a.map(babyRow).join('')}</div>`:empty('history','No matching records','Try another filter.'))}`;}
function babyTrends(){const range=+S.ui.trendRange||14,days=dateList(range),rows=days.map(d=>({d,...babyStats(d)})),active=rows.filter(r=>r.wet||r.poop||r.feeds),avg=k=>active.length?(sum(active.map(r=>r[k]))/active.length).toFixed(1):'0.0';const table=rows.slice().reverse().map(r=>`<div class="trend-row"><span>${fd(r.d)}</span><b>${r.wet}</b><b>${r.poop}</b><b>${r.feeds}</b><b>${r.oz.toFixed(1)}</b></div>`).join('');return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>Care trends</h2></div></div>${pills([[7,'7 days'],[14,'14 days'],[30,'30 days']],range,'data-trend-range')}<div class="metric-grid">${metric('Wet / day',avg('wet'),'average','drop','baby')}${metric('Poopy / day',avg('poop'),'average','diaper','baby')}${metric('Feeds / day',avg('feeds'),'average','bottle','baby')}${metric('Bottle oz / day',avg('oz'),'logged bottles','bottle','baby')}</div>${panel('Daily view',`<div class="trend-table"><div class="trend-row head"><span>Date</span><b>Wet</b><b>Poop</b><b>Feeds</b><b>Oz</b></div>${table}</div>`)}`;}
function babyGrowth(){const a=babyEvents().filter(e=>e.eventType==='growth').sort(byWhenDesc),g=a[0];return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>Growth</h2></div><button class="round-action baby" data-growth>${icon('plus')}<span>Add</span></button></div><div class="metric-grid three">${metric('Weight',g?.weightLb!=null?`${g.weightLb} lb${g.weightOz?` ${g.weightOz} oz`:''}`:'—',g?fd(g.date):'No measurement','growth','baby')}${metric('Length',g?.lengthIn!=null?`${g.lengthIn} in`:'—','latest','growth','baby')}${metric('Head',g?.headIn!=null?`${g.headIn} in`:'—','latest','growth','baby')}</div>${panel('Measurements',a.length?`<div class="rows">${a.map(e=>`<div class="row"><div class="row-icon baby">${icon('growth')}</div><div class="row-main"><strong>${e.weightLb??'—'} lb${e.weightOz?` ${e.weightOz} oz`:''} · ${e.lengthIn??'—'} in</strong><span>${fd(e.date)} · head ${e.headIn??'—'} in</span></div><div class="row-status">${e.synced?'Saved':'Device'}</div></div>`).join('')}</div>`:empty('growth','No growth measurements yet','Add measurements from pediatric visits.'))}<div class="clinical-note">For children under 2, U.S. clinicians typically use WHO growth standards and look at the pattern over time rather than a single number.</div>`;}
function doctorView(){const range=+S.ui.doctorRange||14,days=dateList(range),rows=days.map(d=>({d,...babyStats(d)})),active=rows.filter(r=>r.wet||r.poop||r.feeds),avg=k=>active.length?(sum(active.map(r=>r[k]))/active.length).toFixed(1):'0.0',g=latestGrowth(),pref=feedingPreference();const split=active.length?{nursing:sum(active.map(r=>r.nursing)),bottles:sum(active.map(r=>r.bottles))}:{nursing:0,bottles:0};return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>Doctor summary</h2></div><button class="round-action baby" data-print>${icon('steth')}<span>Print</span></button></div>${pills([[7,'7 days'],[14,'14 days'],[30,'30 days']],range,'data-doctor-range')}<div class="metric-grid">${metric('Wet / day',avg('wet'),'logged average','drop','baby')}${metric('Poopy / day',avg('poop'),'logged average','diaper','baby')}${metric('Feeds / day',avg('feeds'),'nursing + bottles','bottle','baby')}${metric('Bottle oz / day',avg('oz'),'logged volume','bottle','baby')}</div>${panel('Quick answers',`<div class="qa-grid"><div><span>Feeding pattern</span><strong>${pref==='mostly_formula'?'Mostly formula':pref==='mixed'?'Mixed':'Mostly breastfed'}</strong></div><div><span>Nursing sessions</span><strong>${split.nursing} in ${range} days</strong></div><div><span>Bottles</span><strong>${split.bottles} in ${range} days</strong></div><div><span>Latest growth</span><strong>${g?`${g.weightLb??'—'} lb · ${g.lengthIn??'—'} in`:'Not logged'}</strong></div></div>`)}${panel('Daily review',`<div class="trend-table"><div class="trend-row head"><span>Date</span><b>Wet</b><b>Poop</b><b>Feeds</b><b>Oz</b></div>${rows.slice().reverse().map(r=>`<div class="trend-row"><span>${fd(r.d)}</span><b>${r.wet}</b><b>${r.poop}</b><b>${r.feeds}</b><b>${r.oz.toFixed(1)}</b></div>`).join('')}</div>`)}<div class="clinical-note">This summary reflects what was logged. Around this age, stool frequency can vary widely—especially after about 6 weeks—so trends and growth matter more than a single day.</div>`;}

function dataStatus(){const localMom=momEntries().length,localBaby=babyEvents().length,cloudKnown=S.cloud.momCount!=null&&S.cloud.babyCount!=null,match=cloudKnown&&S.cloud.momCount===localMom&&S.cloud.babyCount===localBaby;return `<div class="data-status ${match?'good':''}"><div>${icon(match?'check':'shield')}</div><div><strong>${S.cloud.enabled?(match?'All data matches cloud':'Family data connected'):'This device only'}</strong><span>${localMom} Mom · ${localBaby} Baby on this device${cloudKnown?` · ${S.cloud.momCount} Mom · ${S.cloud.babyCount} Baby in cloud`:''}</span></div></div>`;}
function settingsView(){return `<div class="page-head"><div><span class="eyebrow">FAMILY</span><h2>Settings</h2></div></div>${dataStatus()}${panel('Family account',S.cloud.enabled?`<div class="setting-row"><div><strong>${esc(S.cloud.email||'Signed in')}</strong><span>Use this same account on every device.</span></div><div class="setting-actions"><button data-cloud-check>Check cloud</button><button data-signout>Sign out</button></div></div>`:`<div class="setting-row"><div><strong>Not signed in</strong><span>Sign in once and use the same account on every phone or laptop.</span></div><button class="primary-link" data-auth>Sign in</button></div>`)}${panel('Backup & restore',`<div class="setting-row"><div><strong>Private family backup</strong><span>Import merges records. It never replaces or deletes existing history.</span></div><div class="setting-actions"><button data-import>${icon('upload')} Import</button><button data-export>${icon('download')} Export</button></div></div>`)}${panel('Baby feeding',`<label class="field"><span>Usual feeding</span><select id="feedingPreference"><option value="auto" ${S.baby.feedingPreference==='auto'?'selected':''}>Choose automatically from history</option><option value="mostly_breastfed" ${S.baby.feedingPreference==='mostly_breastfed'?'selected':''}>Mostly breastfed</option><option value="mostly_formula" ${S.baby.feedingPreference==='mostly_formula'?'selected':''}>Mostly formula</option><option value="mixed" ${S.baby.feedingPreference==='mixed'?'selected':''}>Mixed feeding</option></select></label>`)}${panel('Mom pumping',`<div class="settings-grid"><label class="field"><span>Daily goal (mL)</span><input id="goalMl" type="number" inputmode="numeric" min="0" value="${+S.profile.dailyGoalMl||760}"></label><label class="field"><span>Freezer stash (mL)</span><input id="stashMl" type="number" inputmode="numeric" min="0" value="${+S.profile.stashMl||0}"></label>${S.schedule.map((t,i)=>`<label class="field"><span>Pump ${i+1}</span><input data-schedule="${i}" type="time" value="${t}"></label>`).join('')}</div>`)}${panel('Reminders',`<div class="setting-row"><div><strong>${S.reminders.enabled?'Pump reminders on':'Pump reminders off'}</strong><span>In-app reminders work whenever MilkFlow is open. System alerts are used when the browser allows them.</span></div><button data-reminders>${S.reminders.enabled?'Turn off':'Turn on'}</button></div>`)}`;}

const renderers={'mom-home':momHome,'mom-history':momHistory,'mom-trends':momTrends,'mom-stash':momStash,'baby-home':babyHome,'baby-history':babyHistory,'baby-trends':babyTrends,'baby-growth':babyGrowth,doctor:doctorView,settings:settingsView};
const titles={'mom-home':'Mom','mom-history':'Mom history','mom-trends':'Milk trends','mom-stash':'Stash','baby-home':'Baby','baby-history':'Baby history','baby-trends':'Baby trends','baby-growth':'Growth',doctor:'Doctor summary',settings:'Settings'};
function render(){
  $('pageTitle').textContent=titles[view]||'MilkFlow';
  $('view').innerHTML=(renderers[view]||momHome)();
  const workspace=workspaceOf(view);S.ui.workspace=workspace;save();
  document.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('active',b.dataset.workspace===workspace));
  document.querySelectorAll('.sidebar [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  renderBottomNav();syncBadge();bindViewInputs();
}
function renderBottomNav(){const w=workspaceOf(view),nav=$('bottomNav');const home=w==='baby'?'baby-home':'mom-home',history=w==='baby'?'baby-history':'mom-history',trends=w==='baby'?'baby-trends':'mom-trends';nav.innerHTML=`<button data-view="${home}" class="${view===home?'active':''}">${icon('home')}<span>Home</span></button><button data-view="${history}" class="${view===history?'active':''}">${icon('history')}<span>History</span></button><button class="add-tab" data-add>${icon('plus')}<span>Add</span></button><button data-view="${trends}" class="${view===trends?'active':''}">${icon('chart')}<span>Trends</span></button><button data-more class="${['settings','doctor','baby-growth','mom-stash'].includes(view)?'active':''}">${icon('more')}<span>More</span></button>`;}
function syncBadge(){const b=$('syncBadge'),t=$('syncTitle'),sub=$('syncSubtitle');if(b){b.innerHTML=S.cloud.enabled?`${icon('check')}<span>Saved</span>`:`${icon('shield')}<span>Device</span>`;b.className=`sync-badge ${S.cloud.enabled?'on':''}`;}if(t)t.textContent=S.cloud.enabled?'Family data saved':'On this device';if(sub)sub.textContent=S.cloud.enabled?(S.cloud.email||'Family account'):'Sign in to sync across devices';}

function openDrawer(){const w=workspaceOf(view);$('drawerBody').innerHTML=w==='baby'?`<button data-view="baby-home">${icon('baby')}<span>Baby home</span></button><button data-view="baby-history">${icon('history')}<span>History</span></button><button data-view="baby-trends">${icon('chart')}<span>Trends</span></button><button data-view="baby-growth">${icon('growth')}<span>Growth</span></button><button data-view="doctor">${icon('steth')}<span>Doctor summary</span></button><hr><button data-view="settings">${icon('settings')}<span>Settings</span></button><button data-view="mom-home">${icon('heart')}<span>Switch to Mom</span></button>`:`<button data-view="mom-home">${icon('heart')}<span>Mom home</span></button><button data-view="mom-history">${icon('history')}<span>History</span></button><button data-view="mom-trends">${icon('chart')}<span>Trends</span></button><button data-view="mom-stash">${icon('snow')}<span>Freezer stash</span></button><hr><button data-view="settings">${icon('settings')}<span>Settings</span></button><button data-view="baby-home">${icon('baby')}<span>Switch to Baby</span></button>`;$('drawer').classList.add('open');$('scrim').classList.add('open');document.body.classList.add('locked');}
function openSheet(html){$('sheet').innerHTML=`<div class="sheet-handle"></div>${html}`;$('sheet').classList.add('open');$('scrim').classList.add('open');document.body.classList.add('locked');}
function addSheet(){const w=workspaceOf(view);if(w==='mom')return openSheet(`<div class="sheet-head"><strong>Add Mom care</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions two"><button data-mom="pump">${icon('drop')}<strong>Pump</strong><span>Milk output</span></button><button data-mom="nursing">${icon('heart')}<strong>Nursing</strong><span>Breastfeed</span></button></div>`);openSheet(`<div class="sheet-head"><strong>Add Baby care</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions"><button data-feed>${icon('bottle')}<strong>Feed</strong><span>Nurse or bottle</span></button><button data-diaper="wet">${icon('drop')}<strong>Wet</strong></button><button data-diaper="poop">${icon('diaper')}<strong>Poopy</strong></button><button data-diaper="both">${icon('diaper')}<strong>Mixed</strong></button><button data-sleep>${icon('moon')}<strong>Sleep</strong></button><button data-growth>${icon('growth')}<strong>Growth</strong></button></div>`);}
function moreSheet(){openDrawer();}
function feedSheet(){const pref=feedingPreference();openSheet(`<div class="sheet-head"><strong>How did baby feed?</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions three"><button data-feed-type="nursing">${icon('heart')}<strong>Nursing</strong></button><button data-feed-type="expressed_milk" class="${pref!=='mostly_formula'?'recommended':''}">${icon('bottle')}<strong>Breast milk</strong><span>Bottle</span></button><button data-feed-type="formula" class="${pref==='mostly_formula'?'recommended':''}">${icon('bottle')}<strong>Formula</strong><span>Bottle</span></button></div>`);}

function openMomDialog(type){closeOverlays();$('momType').value=type;$('momDialogTitle').textContent=type==='pump'?'Pump':'Nursing';$('momDate').value=today();$('momTime').value=now();$('momAmount').value='';$('momDuration').value='';$('momNote').value='';const pump=type==='pump';$('momAmountWrap').classList.toggle('hidden',!pump);$('momSideWrap').classList.toggle('hidden',pump);$('momAmount').required=pump;$('momDialog').showModal();}
function openDiaperDialog(kind){closeOverlays();$('diaperKind').value=kind;$('diaperDialogTitle').textContent=kind==='wet'?'Wet diaper':kind==='poop'?'Poopy diaper':'Mixed diaper';$('diaperDate').value=today();$('diaperTime').value=now();$('diaperNote').value='';$('diaperDialog').showModal();}
function openFeedDialog(type){closeOverlays();$('feedType').value=type;$('feedDialogTitle').textContent=type==='nursing'?'Nursing':type==='formula'?'Formula bottle':'Breast milk bottle';$('feedDate').value=today();$('feedTime').value=now();$('feedAmount').value='';$('feedDuration').value='';const nursing=type==='nursing';$('feedAmountWrap').classList.toggle('hidden',nursing);$('feedNursingWrap').classList.toggle('hidden',!nursing);$('feedSideWrap').classList.toggle('hidden',!nursing);$('feedAmount').required=!nursing;$('feedDuration').required=nursing;$('feedDialog').showModal();}
function openGrowthDialog(){closeOverlays();$('growthDate').value=today();$('growthWeightLb').value='';$('growthWeightOz').value='';$('growthLength').value='';$('growthHead').value='';$('growthNote').value='';$('growthDialog').showModal();}
function openSleepDialog(){closeOverlays();$('sleepDate').value=today();$('sleepTime').value=now();$('sleepMinutes').value='';$('sleepDialog').showModal();}

function bindViewInputs(){
  $('stashExact')?.addEventListener('change',e=>{S.profile.stashMl=Math.max(0,+e.target.value||0);save();pushProfile().catch(()=>{});render();});
  $('goalMl')?.addEventListener('change',e=>{S.profile.dailyGoalMl=Math.max(0,+e.target.value||0);save();pushProfile().catch(()=>{});});
  $('stashMl')?.addEventListener('change',e=>{S.profile.stashMl=Math.max(0,+e.target.value||0);save();pushProfile().catch(()=>{});});
  $('feedingPreference')?.addEventListener('change',e=>{S.baby.feedingPreference=e.target.value;save();pushProfile().catch(()=>{});render();});
  document.querySelectorAll('[data-schedule]').forEach(x=>x.addEventListener('change',()=>{S.schedule[+x.dataset.schedule]=x.value;save();pushProfile().catch(()=>{});}));
}

function snapshot(){try{localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(S));}catch{}}
function mapBaby(x){return {id:x.migration_id||x.id||uid('baby'),babyId:x.baby_id||x.babyId||'saahas-2026',eventType:x.event_type||x.eventType,date:x.date,time:x.time||'',subtype:x.status||x.subtype||null,feedingType:x.feeding_type||x.feedingType||null,amountOz:x.amount_oz??x.amountOz??null,durationMinutes:x.duration_minutes??x.durationMinutes??null,totalMinutes:x.total_minutes??x.totalMinutes??null,leftMinutes:x.left_minutes??x.leftMinutes??null,rightMinutes:x.right_minutes??x.rightMinutes??null,note:x.note||'',sourceFile:x.source_file||x.sourceFile||'Baby Tracker',sourceRow:x.source_row||x.sourceRow||null,exactSourceDuplicate:!!(x.exact_source_duplicate??x.exactSourceDuplicate),synced:false};}
function mergeById(current,incoming){const m=new Map(current.map(e=>[e.id,e]));for(const e of incoming){if(!e?.id)continue;if(!m.has(e.id))m.set(e.id,{...e,synced:false});}return [...m.values()];}
async function importBackup(file){let d;try{d=JSON.parse(await file.text());}catch{return toast('That file could not be read.');}let mom=[],baby=[],profile=null,schedule=null,overrides={};if(d.schema_version==='milkflow-family-bundle-2'){mom=Array.isArray(d.mom?.entries)?d.mom.entries:[];baby=Array.isArray(d.baby?.events)?d.baby.events.map(mapBaby):[];profile=d.mom?.profile||null;schedule=d.mom?.schedule||null;overrides=d.mom?.dailyOverrides||{};}else if(Array.isArray(d.events)){baby=d.events.filter(x=>x.owner_scope==='baby'&&String(x.date||'').startsWith('2026-')).map(mapBaby);}else if(Array.isArray(d.entries)){mom=d.entries;profile=d.profile||null;schedule=d.schedule||null;overrides=d.dailyOverrides||{};}if(!mom.length&&!baby.length)return toast('No compatible family records found.');snapshot();const bm=momEntries().length,bb=babyEvents().length;S.entries=mergeById(S.entries,mom);S.babyEvents=mergeById(S.babyEvents,baby);if(profile)S.profile={...S.profile,...profile};if(Array.isArray(schedule)&&schedule.length)S.schedule=schedule;S.dailyOverrides={...S.dailyOverrides,...overrides};save();const am=momEntries().length-bm,ab=babyEvents().length-bb;toast(`Added ${am} Mom · ${ab} Baby records`,4000);if(S.cloud.enabled){try{await reconcile();await verifyCloud(true);toast('Family history saved to cloud.',3500);}catch(e){console.error(e);toast('Saved on this device. Cloud will retry.',4000);}}setView(am?'mom-history':ab?'baby-history':S.ui.workspace==='baby'?'baby-home':'mom-home');}
function exportBackup(){const data={schema_version:'milkflow-family-bundle-2',exported_at:new Date().toISOString(),mom:{entries:momEntries(),profile:S.profile,schedule:S.schedule,dailyOverrides:S.dailyOverrides},baby:{events:babyEvents(),profile:S.baby}};const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`milkflow-family-backup-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);toast('Private backup exported.');}

async function initCloud(){const c=window.MILKFLOW_CONFIG||{};if(!c.enableCloudSync||!c.firebaseConfig||!window.firebase)return syncBadge();try{if(!firebase.apps.length)firebase.initializeApp(c.firebaseConfig);cloud={auth:firebase.auth(),db:firebase.firestore()};try{await cloud.db.enablePersistence({synchronizeTabs:true});}catch{}cloud.auth.onAuthStateChanged(async u=>{stopRealtime();S.cloud.userId=u?.uid||null;S.cloud.email=u?.email||null;S.cloud.enabled=!!u;save();syncBadge();if(u){try{await reconcile();startRealtime();await verifyCloud(true);}catch(e){console.error(e);toast('Cloud sync needs attention.');}}render();});}catch(e){console.error(e);toast('Cloud connection needs attention.');}}
const userRef=()=>cloud?.db.collection('users').doc(S.cloud.userId);const momRef=()=>userRef().collection('entries');const babyRef=()=>userRef().collection('familyEvents');const profileRef=()=>userRef().collection('private').doc('profile');
async function reconcile(){if(!cloud||!S.cloud.userId)return;const[ms,bs,ps]=await Promise.all([momRef().get(),babyRef().get(),profileRef().get()]);const remoteMom=new Map(ms.docs.map(d=>[d.id,{id:d.id,...d.data(),synced:true}]));const remoteBaby=new Map(bs.docs.map(d=>[d.id,{id:d.id,...d.data(),synced:true}]));const localMom=new Map(S.entries.map(e=>[e.id,e]));for(const[id,r]of remoteMom)localMom.set(id,{...(localMom.get(id)||{}),...r,synced:true});S.entries=[...localMom.values()];const localBaby=new Map(S.babyEvents.map(e=>[e.id,e]));for(const[id,r]of remoteBaby)localBaby.set(id,{...(localBaby.get(id)||{}),...r,synced:true});S.babyEvents=[...localBaby.values()];if(ps.exists){const p=ps.data();S.profile={...S.profile,...(p.profile||{})};S.baby={...S.baby,...(p.baby||{})};if(Array.isArray(p.schedule))S.schedule=p.schedule;S.dailyOverrides={...S.dailyOverrides,...(p.dailyOverrides||{})};S.reminders={...S.reminders,...(p.reminders||{})};}for(const e of S.entries)if(!remoteMom.has(e.id))await pushMom(e);await pushBabies(S.babyEvents.filter(e=>!remoteBaby.has(e.id)));await pushProfile();S.cloud.lastSync=new Date().toISOString();save();}
async function pushMom(e){if(!cloud||!S.cloud.userId)return;await momRef().doc(e.id).set({type:e.type,date:e.date,time:e.time||'',amountMl:e.amountMl??null,durationMin:e.durationMin??null,side:e.side||null,quality:e.quality||null,note:e.note||'',source:e.source||'MilkFlow',updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});e.synced=true;S.cloud.lastSync=new Date().toISOString();save();}
async function pushBabies(arr){if(!cloud||!S.cloud.userId||!arr.length)return;for(let i=0;i<arr.length;i+=350){const part=arr.slice(i,i+350),batch=cloud.db.batch();for(const e of part)batch.set(babyRef().doc(e.id),{...e,synced:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});await batch.commit();part.forEach(e=>e.synced=true);}S.cloud.lastSync=new Date().toISOString();save();}
async function pushProfile(){if(!cloud||!S.cloud.userId)return;await profileRef().set({profile:S.profile,baby:S.baby,schedule:S.schedule,dailyOverrides:S.dailyOverrides,reminders:S.reminders,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});S.cloud.lastSync=new Date().toISOString();save();}
function startRealtime(){stopRealtime();if(!cloud||!S.cloud.userId)return;const mergeSnapshot=(snap,key)=>{const current=new Map(S[key].map(e=>[e.id,e]));let changed=false;snap.docChanges().forEach(c=>{if(c.type==='removed')return;const r={id:c.doc.id,...c.doc.data(),synced:true};const old=current.get(r.id);if(!old||JSON.stringify({...old,updatedAt:undefined})!==JSON.stringify({...r,updatedAt:undefined})){current.set(r.id,{...(old||{}),...r});changed=true;}});if(changed){S[key]=[...current.values()];save();clearTimeout(renderTimer);renderTimer=setTimeout(render,120);}};unsubscribers.push(momRef().onSnapshot(s=>mergeSnapshot(s,'entries'),e=>console.warn('Mom realtime',e)));unsubscribers.push(babyRef().onSnapshot(s=>mergeSnapshot(s,'babyEvents'),e=>console.warn('Baby realtime',e)));unsubscribers.push(profileRef().onSnapshot(d=>{if(!d.exists)return;const p=d.data();S.profile={...S.profile,...(p.profile||{})};S.baby={...S.baby,...(p.baby||{})};if(Array.isArray(p.schedule))S.schedule=p.schedule;S.dailyOverrides={...S.dailyOverrides,...(p.dailyOverrides||{})};save();clearTimeout(renderTimer);renderTimer=setTimeout(render,120);},e=>console.warn('Profile realtime',e)));}
function stopRealtime(){unsubscribers.forEach(fn=>{try{fn();}catch{}});unsubscribers=[];}
async function verifyCloud(quiet=false){if(!cloud||!S.cloud.userId){if(!quiet)toast('Sign in first.');return;}try{const[m,b]=await Promise.all([momRef().get(),babyRef().get()]);S.cloud.momCount=m.size;S.cloud.babyCount=b.size;S.cloud.lastVerified=new Date().toISOString();save();if(!quiet)toast(`Cloud: ${m.size} Mom · ${b.size} Baby`,3500);}catch(e){console.error(e);if(!quiet)toast('Cloud check failed. Try again.');}}

async function toggleReminders(){S.reminders.enabled=!S.reminders.enabled;save();if(S.reminders.enabled&&'Notification'in window&&Notification.permission==='default'){try{await Notification.requestPermission();}catch{}}try{await pushProfile();}catch{}render();toast(S.reminders.enabled?'Pump reminders are on.':'Pump reminders are off.');}
function tickReminders(){if(!S.reminders.enabled)return;const d=new Date(),m=d.getHours()*60+d.getMinutes(),dt=today();S.schedule.forEach((t,i)=>{const target=+t.slice(0,2)*60 + +t.slice(3)-(+S.reminders.leadMin||0),key=`${dt}-${i}-${target}`;if(Math.abs(m-target)<=1&&S.reminders.lastSentKey!==key&&dayP(dt).length<=i){toast(`Pump ${i+1} is coming up · ${to12(t)}`,7000);if('Notification'in window&&Notification.permission==='granted'){try{new Notification('Pump reminder',{body:`Pump ${i+1} · ${to12(t)}`});}catch{}}S.reminders.lastSentKey=key;save();}});}

function handleClick(e){
  if(e.target.closest('[data-close]')||e.target.id==='scrim'){closeOverlays();return;}
  const ws=e.target.closest('[data-workspace]');if(ws){setView(ws.dataset.workspace==='baby'?'baby-home':'mom-home');return;}
  const route=e.target.closest('[data-view]');if(route){setView(route.dataset.view);return;}
  if(e.target.closest('[data-menu]')||e.target.closest('[data-more]')){openDrawer();return;}
  if(e.target.closest('[data-add]')){addSheet();return;}
  const mom=e.target.closest('[data-mom]');if(mom){openMomDialog(mom.dataset.mom);return;}
  if(e.target.closest('[data-feed]')){feedSheet();return;}
  const ft=e.target.closest('[data-feed-type]');if(ft){openFeedDialog(ft.dataset.feedType);return;}
  const diaper=e.target.closest('[data-diaper]');if(diaper){openDiaperDialog(diaper.dataset.diaper);return;}
  if(e.target.closest('[data-growth]')){openGrowthDialog();return;}
  if(e.target.closest('[data-sleep]')){openSleepDialog();return;}
  if(e.target.closest('[data-import]')){$('importFile').click();return;}
  if(e.target.closest('[data-export]')){exportBackup();return;}
  if(e.target.closest('[data-cloud-check]')){verifyCloud().then(render);return;}
  if(e.target.closest('[data-reminders]')){toggleReminders();return;}
  if(e.target.closest('[data-auth]')){$('authDialog').showModal();return;}
  if(e.target.closest('[data-signout]')){cloud?.auth.signOut();return;}
  if(e.target.closest('[data-print]')){window.print();return;}
  const mr=e.target.closest('[data-mom-range]');if(mr){S.ui.momRange=+mr.dataset.momRange;save();render();return;}
  const br=e.target.closest('[data-baby-range]');if(br){S.ui.babyRange=+br.dataset.babyRange;save();render();return;}
  const bf=e.target.closest('[data-baby-filter]');if(bf){S.ui.babyFilter=bf.dataset.babyFilter;save();render();return;}
  const tr=e.target.closest('[data-trend-range]');if(tr){S.ui.trendRange=+tr.dataset.trendRange;save();render();return;}
  const dr=e.target.closest('[data-doctor-range]');if(dr){S.ui.doctorRange=+dr.dataset.doctorRange;save();render();return;}
  const st=e.target.closest('[data-stash]');if(st){S.profile.stashMl=Math.max(0,(+S.profile.stashMl||0)+ +st.dataset.stash);save();pushProfile().catch(()=>{});render();return;}
}
document.addEventListener('click',handleClick);

$('momForm').addEventListener('submit',async e=>{e.preventDefault();const type=$('momType').value,x={id:uid('mom'),type,date:$('momDate').value,time:$('momTime').value,amountMl:type==='pump'?+$('momAmount').value||0:null,durationMin:+$('momDuration').value||null,side:type==='nursing'?$('momSide').value:null,note:$('momNote').value.trim(),source:'MilkFlow',synced:false};S.entries.push(x);save();$('momDialog').close();try{await pushMom(x);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('diaperForm').addEventListener('submit',async e=>{e.preventDefault();const x={id:uid('baby'),babyId:S.baby.id,eventType:'diaper',date:$('diaperDate').value,time:$('diaperTime').value,subtype:$('diaperKind').value,note:$('diaperNote').value.trim(),sourceFile:'MilkFlow',synced:false};S.babyEvents.push(x);save();$('diaperDialog').close();try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('feedForm').addEventListener('submit',async e=>{e.preventDefault();const type=$('feedType').value,x=type==='nursing'?{id:uid('baby'),babyId:S.baby.id,eventType:'nursing',date:$('feedDate').value,time:$('feedTime').value,durationMinutes:+$('feedDuration').value||null,side:$('feedSide').value,note:'',sourceFile:'MilkFlow',synced:false}:{id:uid('baby'),babyId:S.baby.id,eventType:'feeding',date:$('feedDate').value,time:$('feedTime').value,feedingType:type,amountOz:+$('feedAmount').value||0,note:'',sourceFile:'MilkFlow',synced:false};S.babyEvents.push(x);save();$('feedDialog').close();try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('growthForm').addEventListener('submit',async e=>{e.preventDefault();const x={id:uid('baby'),babyId:S.baby.id,eventType:'growth',date:$('growthDate').value,time:'12:00',weightLb:$('growthWeightLb').value===''?null:+$('growthWeightLb').value,weightOz:$('growthWeightOz').value===''?null:+$('growthWeightOz').value,lengthIn:$('growthLength').value===''?null:+$('growthLength').value,headIn:$('growthHead').value===''?null:+$('growthHead').value,note:$('growthNote').value.trim(),sourceFile:'MilkFlow',synced:false};S.babyEvents.push(x);save();$('growthDialog').close();try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');}setView('baby-growth');});
$('sleepForm').addEventListener('submit',async e=>{e.preventDefault();const x={id:uid('baby'),babyId:S.baby.id,eventType:'sleep',date:$('sleepDate').value,time:$('sleepTime').value,durationMinutes:+$('sleepMinutes').value||0,sourceFile:'MilkFlow',synced:false};S.babyEvents.push(x);save();$('sleepDialog').close();try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');}render();});
$('authForm').addEventListener('submit',async e=>{e.preventDefault();if(!cloud)return toast('Cloud is not ready yet.');try{await cloud.auth.signInWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value);$('authDialog').close();}catch(err){toast(err.message,4500);}});
$('createAccount').addEventListener('click',async()=>{if(!cloud)return toast('Cloud is not ready yet.');try{await cloud.auth.createUserWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value);$('authDialog').close();}catch(err){toast(err.message,4500);}});
$('importFile').addEventListener('change',e=>{const f=e.target.files?.[0];if(f)importBackup(f);e.target.value='';});

save();render();initCloud();tickReminders();setInterval(tickReminders,60000);
})();
