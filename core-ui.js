(() => {
'use strict';

/*
 * MilkFlow canonical UI controller.
 * One owner for Mom/Baby home enhancements. No MutationObservers, no competing
 * post-render modules, no CSS "last rule wins" chain. app.js remains the data/router
 * authority; this controller runs synchronously after explicit app events only.
 */
const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
let applying=false;
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const dateShift=n=>{const d=new Date(`${today()}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const to12=m=>{if(!Number.isFinite(m))return '—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};

function rawPrefs(){try{return JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{};}catch{return {};}}
function prefs(){const p=rawPrefs(),d=today(),daily=Number(p.dayTargets?.[d]);return{target:Number.isFinite(daily)?daily:(+p.target||6),mode:p.mode||'normal',nextOverrideByDate:p.nextOverrideByDate||{},dayTargets:p.dayTargets||{}};}
function savePrefs(mutator){const old=localStorage.getItem(COACH_KEY),p=rawPrefs(),next=mutator({...p,dayTargets:{...(p.dayTargets||{})},nextOverrideByDate:{...(p.nextOverrideByDate||{})}})||p;localStorage.setItem(COACH_KEY,JSON.stringify(next));try{window.dispatchEvent(new StorageEvent('storage',{key:COACH_KEY,oldValue:old,newValue:JSON.stringify(next),storageArea:localStorage,url:location.href}));}catch{window.dispatchEvent(new CustomEvent('milkflow:coach-change'));}return next;}

const livePumps=s=>(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);
const pumpsOn=(s,d)=>livePumps(s).filter(e=>e.date===d).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
const dayPumps=s=>pumpsOn(s,today());
const round5=m=>Math.round(m/5)*5;

function positiveGreeting(){const h=new Date().getHours();if(h>=5&&h<8)return{text:'Early bird',mark:'☀️'};if(h>=8&&h<12)return{text:'Good morning',mark:'☀️'};if(h>=12&&h<17)return{text:'Good afternoon',mark:'🌤️'};if(h>=17&&h<21)return{text:'Good evening',mark:'✨'};return{text:'Hey, night owl',mark:'🌙'};}
function ageLabel(birthDate){if(!birthDate)return'';const b=new Date(`${birthDate}T12:00:00`),n=new Date(`${today()}T12:00:00`),days=Math.floor((n-b)/86400000);if(!Number.isFinite(days)||days<0)return'';if(days<14)return`${days} day${days===1?'':'s'} old`;if(days<70)return`${Math.floor(days/7)} weeks old`;let m=(n.getFullYear()-b.getFullYear())*12+(n.getMonth()-b.getMonth());if(n.getDate()<b.getDate())m--;return m<24?`${m} months old`:`${Math.floor(m/12)}y ${m%12}m`;}
function relativeAgo(date,time){
  if(!date||!time)return'';
  const at=new Date(`${date}T${time}:00`),diff=Math.max(0,Math.floor((Date.now()-at.getTime())/60000));
  if(!Number.isFinite(diff))return'';
  if(diff<1)return'just now';
  if(diff<60)return`${diff} min${diff===1?'':'s'} ago`;
  const h=Math.floor(diff/60),m=diff%60;
  if(h<24)return`${h} hr${h===1?'':'s'}${m?` ${m} min${m===1?'':'s'}`:''} ago`;
  const d=Math.floor(h/24);return`${d} day${d===1?'':'s'} ago`;
}

function bucket(m){if(m<540)return'early';if(m<810)return'lateMorning';if(m<1050)return'afternoon';if(m<1290)return'evening';return'late';}
function transitions(s){const by={};for(const e of livePumps(s)){if(e.date===today())continue;(by[e.date]??=[]).push(e);}const out=[];for(const d of Object.keys(by).sort().slice(-10)){const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));for(let i=1;i<a.length;i++){const pm=mins(a[i-1].time),nm=mins(a[i].time),gap=nm-pm;if(Number.isFinite(pm)&&gap>=120&&gap<=390)out.push({bucket:bucket(pm),gap});}}return out;}
function learnedGap(s,anchor,target){
  const k=bucket(anchor),rows=transitions(s),same=rows.filter(x=>x.bucket===k).map(x=>x.gap),all=rows.map(x=>x.gap);
  const d6={early:310,lateMorning:215,afternoon:190,evening:180,late:165},b6={early:[270,335],lateMorning:[185,240],afternoon:[170,210],evening:[160,205],late:[150,195]};
  const d5={early:330,lateMorning:255,afternoon:240,evening:225,late:195},b5={early:[290,365],lateMorning:[220,300],afternoon:[205,280],evening:[195,265],late:[175,230]};
  const is5=target===5,defs=is5?d5:d6,bounds=is5?b5:b6;let raw=same.length>=2?median(same):median(all);if(!Number.isFinite(raw))raw=defs[k];if(is5&&same.length>=2)raw+=30;return clamp(Math.round(raw),bounds[k][0],bounds[k][1]);
}
function historicalEdge(s,which){const by={};for(const e of livePumps(s)){if(e.date===today())continue;(by[e.date]??=[]).push(e);}const vals=Object.keys(by).sort().slice(-7).map(d=>{const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));return mins(which==='first'?a[0]?.time:a.at(-1)?.time);}).filter(Number.isFinite);return median(vals);}
function plan(s=read(),p=prefs()){
  const actual=dayPumps(s),target=clamp(+p.target||6,4,8),remaining=Math.max(0,target-actual.length),schedule=(Array.isArray(s.schedule)?s.schedule:[]).map(mins).filter(Number.isFinite).sort((a,b)=>a-b),override=Number(p.nextOverrideByDate?.[today()]);
  let end=Math.max(target===5?1410:1425,historicalEdge(s,'last')||0,schedule.at(-1)||0);end=Math.min(end,target===5?1440:1445);
  if(!actual.length){
    const now=new Date(),nowM=now.getHours()*60+now.getMinutes(),raw=schedule.filter(m=>m>=nowM-20).slice(0,remaining),first=schedule[0]??historicalEdge(s,'first')??340;
    let future=raw.length?raw:Array.from({length:remaining},(_,i)=>first+i*(target===5?240:195)).filter(m=>m>=nowM-20).slice(0,remaining);
    if(Number.isFinite(override)&&override>=nowM-10&&remaining){const gap=target===5?240:195;future=[override,...Array.from({length:remaining-1},(_,i)=>round5(override+gap*(i+1)))].slice(0,remaining);}
    return{target,actual,remaining,future,source:Number.isFinite(override)?'override':'baseline'};
  }
  const last=actual.at(-1),lastM=mins(last.time);let gap=learnedGap(s,lastM,target);if(p.mode==='tired')gap+=15;if(p.mode==='travel')gap+=10;if(!remaining)return{target,actual,remaining,future:[],source:'actual',last};
  const minGap=target===5?180:150;let first=lastM+gap;if(Number.isFinite(override)&&override>lastM)first=override;if(remaining>1)first=Math.min(first,end-minGap*(remaining-1));else first=Math.min(first,end);first=round5(Math.max(first,lastM+minGap));
  const future=[first];if(remaining>1){const step=clamp(Math.round(Math.max(minGap*(remaining-1),end-first)/(remaining-1)),minGap,gap);for(let i=1;i<remaining;i++)future.push(round5(first+step*i));}
  return{target,actual,remaining,future,source:Number.isFinite(override)&&override>lastM?'override':'actual',last};
}
function setTodayTarget(n){n=clamp(Math.round(Number(n)||6),4,8);savePrefs(p=>{p.dayTargets[today()]=n;return p;});return plan(read(),prefs());}
function setTodayNextTime(value){const m=Number.isFinite(Number(value))?Number(value):mins(value);if(!Number.isFinite(m))return plan(read(),prefs());savePrefs(p=>{p.nextOverrideByDate[today()]=clamp(Math.round(m),0,1439);return p;});return plan(read(),prefs());}
function clearTodayNextTime(){savePrefs(p=>{delete p.nextOverrideByDate[today()];return p;});return plan(read(),prefs());}
window.MilkFlowDynamicPump={getPlan:()=>plan(read(),prefs()),previewTarget:n=>plan(read(),{...prefs(),target:clamp(Math.round(Number(n)||6),4,8)}),setTodayTarget,setTodayNextTime,clearTodayNextTime};

function icon(kind){
  const p={
    bottle:'<path d="M19 6h10v6l3 4v22c0 3-2 5-5 5h-6c-3 0-5-2-5-5V16l3-4V6Z"/><path d="M19 12h10M16 21h16"/><path d="M21 28h6M21 33h6"/>',
    nursing:'<path d="M16 17c0-5 3-8 7-8s7 3 7 8-3 8-7 8-7-3-7-8Z"/><path d="M9 41c1-9 6-14 14-14s13 5 14 14"/><circle cx="36" cy="27" r="5"/><path d="M30 28c7 0 11 4 11 10"/>',
    wet:'<path d="M24 7c6 7 11 13 11 20a11 11 0 1 1-22 0c0-7 5-13 11-20Z"/>',
    poop:'<path d="M24 9c4 1 5 4 4 7h2c5 0 8 3 8 7 0 2-.7 3-2 5 4 1 6 4 6 7 0 4-4 7-9 7H15c-5 0-9-3-9-7 0-3 2-6 6-7-1-2-2-3-2-5 0-4 3-7 8-7h2c-1-4 1-7 4-7Z"/>',
    both:'<path d="M16 7c4 5 8 10 8 14a8 8 0 1 1-16 0c0-4 4-9 8-14Z"/><path d="M33 20c3 1 4 3 3 5h1c4 0 6 2 6 5 0 1-.4 2-1 3 2 1 3 3 3 5 0 3-3 5-7 5H27c-4 0-7-2-7-5 0-2 1-4 3-5-.6-1-1-2-1-3 0-3 2-5 6-5h1c-.5-3 1-5 4-5Z"/>',
    moon:'<path d="M34 35A15 15 0 0 1 18 12a15 15 0 1 0 16 23Z"/>',
    growth:'<path d="M10 38h28"/><path d="M14 38V14h20v24"/><path d="M18 20h7M18 26h11M18 32h7"/>'
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${p[kind]||p.bottle}</svg>`;
}

function diaperKind(e){const x=String(e?.subtype||'').toLowerCase();return x==='poop'||x==='dirty'?'poop':x==='both'||x==='mixed'?'both':'wet';}
function babyEvents(s){const id=s.baby?.id||'saahas-2026';return(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e.babyId||e.babyId===id)).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`));}
function feedKind(e){
  if(e?.eventType==='nursing')return'nursing';
  if(e?.eventType!=='feeding')return null;
  const t=String(e.feedingType||e.feeding_type||'').toLowerCase();
  if(t.includes('formula'))return'formula';
  if(t.includes('express')||t.includes('breast'))return'milk';
  return'milk';
}
function babyCareStats(s){
  const ev=babyEvents(s),d=today(),cut=new Date();cut.setDate(cut.getDate()-30);const c=`${cut.getFullYear()}-${pad(cut.getMonth()+1)}-${pad(cut.getDate())}`;
  const recent={milk:0,nursing:0,formula:0,wet:0,poop:0,both:0};
  for(const e of ev){if(e.date<c)continue;const f=feedKind(e);if(f)recent[f]++;else if(e.eventType==='diaper')recent[diaperKind(e)]++;}
  const day=ev.filter(e=>e.date===d),milk=day.filter(e=>feedKind(e)==='milk'),nursing=day.filter(e=>feedKind(e)==='nursing'),formula=day.filter(e=>feedKind(e)==='formula'),diapers=day.filter(e=>e.eventType==='diaper');
  const milkOz=milk.reduce((n,e)=>n+(Number(e.amountOz??e.amount_oz)||0),0),formulaOz=formula.reduce((n,e)=>n+(Number(e.amountOz??e.amount_oz)||0),0);
  const wet=diapers.filter(e=>diaperKind(e)==='wet').length,poop=diapers.filter(e=>diaperKind(e)==='poop').length,both=diapers.filter(e=>diaperKind(e)==='both').length;
  const lastMilk=[...ev].reverse().find(e=>feedKind(e)==='milk');
  return{recent,milkCount:milk.length,milkOz,formulaOz,bottleOz:milkOz+formulaOz,nursingCount:nursing.length,formulaCount:formula.length,wet,poop,both,diaperCount:diapers.length,lastMilkOz:Number(lastMilk?.amountOz??lastMilk?.amount_oz)||null};
}
function momTotalAt(s,d){const logged=pumpsOn(s,d).reduce((n,e)=>n+(Number(e.amountMl)||0),0),o=Number(s.dailyOverrides?.[d]);return Number.isFinite(o)?Math.max(logged,o):logged;}
function momSnapshot(s,x){
  const total=momTotalAt(s,today()),goal=Number(s.profile?.dailyGoalMl)||760,past=[];
  for(let i=1;i<=7;i++){const v=momTotalAt(s,dateShift(-i));if(v>0)past.push(v);}
  const avg=past.length?Math.round(past.reduce((a,b)=>a+b,0)/past.length):0,pct=goal?Math.round(total/goal*100):0;
  return{total,goal,avg,pct,pumps:x.actual.length,target:x.target};
}
function babySnapshot(s,st){
  const ev=babyEvents(s),d=today(),byDay=new Map();
  for(const e of ev){if(e.eventType!=='feeding'||e.date===d)continue;const oz=Number(e.amountOz??e.amount_oz)||0;if(oz>0)byDay.set(e.date,(byDay.get(e.date)||0)+oz);}
  const all=[...byDay.entries()].filter(([date,v])=>date<d&&v>0).sort((a,b)=>a[0].localeCompare(b[0]));
  const allAvg=all.length?all.reduce((n,[,v])=>n+v,0)/all.length:0,recent=all.slice(-7).map(([,v])=>v),recentAvg=recent.length?recent.reduce((a,b)=>a+b,0)/recent.length:allAvg,usual=recentAvg||allAvg,pct=usual?Math.round(st.bottleOz/usual*100):0;
  return{todayOz:st.bottleOz,recentAvg,allAvg,pct,diapers:st.diaperCount};
}
function lastFeed(s){return[...babyEvents(s)].reverse().find(e=>e.eventType==='feeding'||e.eventType==='nursing')||null;}
function lastFeedText(e){
  if(!e)return{main:'No feed logged yet',age:'—',clock:'Tap a feed option below'};
  const age=relativeAgo(e.date,e.time)||'—',clock=to12(mins(e.time));
  if(e.eventType==='nursing'){
    const dur=Number(e.durationMinutes??e.totalMinutes??0)||0,side=e.side?` · ${String(e.side).replace(/^./,c=>c.toUpperCase())}`:'';
    return{main:dur?`Nursed ${dur} min`:'Nursed',age,clock:`${clock}${side}`};
  }
  const oz=Number(e.amountOz??e.amount_oz)||0,type=String(e.feedingType||e.feeding_type||'').toLowerCase().includes('formula')?'formula':'breast milk';
  return{main:`${oz?oz.toFixed(1):'—'} oz ${type}`,age,clock};
}
function topOrb(value,unit,label,tone,pct=null,title=''){
  const p=pct==null?null:clamp(Math.round(pct),0,100),plain=p==null?' plain':'';
  return `<div class="mf-top-orb-wrap" title="${esc(title||label)}"><div class="mf-top-orb ${tone}${plain}"${p==null?'':` style="--p:${p}%"`}><strong>${esc(value)}</strong><small>${esc(unit)}</small></div><span>${esc(label)}</span></div>`;
}

function addStyles(){
  if(document.getElementById('mfCoreUIStyles'))return;
  const s=document.createElement('style');s.id='mfCoreUIStyles';s.textContent=`
html{scroll-behavior:auto!important}#view{overflow-anchor:none}.nav-forward,.nav-back,.nav-swap{animation:none!important;transform:none!important}

/* ---------- ambient color: stronger identity without sacrificing readability ---------- */
body[data-screen="mom-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(129,76,225,.16),transparent 30%),radial-gradient(circle at 88% 20%,rgba(231,106,157,.12),transparent 30%),var(--bg)}
body[data-screen="baby-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(52,165,224,.15),transparent 30%),radial-gradient(circle at 88% 24%,rgba(61,190,154,.12),transparent 30%),var(--bg)}
body[data-screen="mom-home"] .mom-hero{background:linear-gradient(135deg,#fff9ff 0%,#eee2ff 48%,#dfe9ff 100%)}
body[data-screen="mom-home"] .quick-tile.mom{background:linear-gradient(145deg,#f4e8ff,#d9c5ff);color:#5732a7}
body[data-screen="mom-home"] .quick-tile.nurse{background:linear-gradient(145deg,#ffeaf3,#ffcfe2);color:#9a3864}

/* Chat belongs to Mom. Keep it completely off Baby and non-Mom screens. */
body:not([data-screen^="mom-"]) #mfChatButton,body:not([data-screen^="mom-"]) #mfChatPanel{display:none!important}

/* ---------- shared type scale ---------- */
.mf-profile-line{display:flex;align-items:center;gap:12px;margin:0 0 13px}
.mf-profile-line.has-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center}
.mf-profile-photo{width:66px;height:66px;border-radius:48% 52% 44% 56% / 46% 42% 58% 54%;overflow:hidden;flex:0 0 auto;background:var(--surface-2);display:grid;place-items:center;border:0;padding:0;color:var(--muted)}
.mf-profile-photo img{width:100%;height:100%;object-fit:cover;display:block}.mf-profile-photo .placeholder{font-size:26px;line-height:1}
.mf-profile-copy{min-width:0;flex:1}.mf-profile-copy .welcome{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;color:var(--muted);margin-bottom:5px;line-height:1.25}.mf-profile-copy .welcome b{font-size:18px}
.mf-profile-copy h2{margin:0;font:800 29px var(--display);letter-spacing:-.035em;line-height:1.04;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-profile-copy small{display:block;margin-top:6px;color:var(--muted);font-size:12px;line-height:1.35;font-weight:700}
.mf-profile-photo.addable{cursor:pointer}.mf-photo-hint{font-size:12px!important;color:var(--muted)!important}

/* ---------- summary circles ---------- */
.mf-top-orbs{display:flex;align-items:flex-start;justify-content:flex-end;gap:7px;min-width:0}
.mf-top-orb-wrap{width:56px;text-align:center;min-width:0}
.mf-top-orb{--p:100%;--orb-ring:#7044dd;--orb-fill:#eadcff;position:relative;width:54px;height:54px;margin:auto;border-radius:50%;display:grid;align-content:center;justify-items:center;background:conic-gradient(var(--orb-ring) var(--p),rgba(120,126,150,.16) 0);isolation:isolate}
.mf-top-orb::before{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--orb-fill);z-index:-1}
.mf-top-orb.plain{background:var(--orb-fill);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--orb-ring) 34%,transparent)}.mf-top-orb.plain::before{display:none}
.mf-top-orb strong{font:850 15px var(--display);line-height:1;color:var(--ink);letter-spacing:-.03em;max-width:48px;overflow:hidden;text-overflow:ellipsis}
.mf-top-orb small{margin-top:3px!important;font-size:9.5px!important;font-weight:800!important;line-height:1!important;color:var(--muted)!important}
.mf-top-orb-wrap>span{display:block;margin-top:5px;font-size:10px;line-height:1.05;font-weight:850;color:var(--muted);white-space:nowrap}
.mf-top-orb.mom-pumps{--orb-ring:#7044dd;--orb-fill:#eadcff}.mf-top-orb.mom-goal{--orb-ring:#c94f86;--orb-fill:#ffe0ec}.mf-top-orb.mom-avg{--orb-ring:#278e72;--orb-fill:#d9f4e9}
.mf-top-orb.baby-milk{--orb-ring:#198fc8;--orb-fill:#d6efff}.mf-top-orb.baby-usual{--orb-ring:#7255c9;--orb-fill:#e7defd}.mf-top-orb.baby-diaper{--orb-ring:#288f72;--orb-fill:#d8f3e8}

/* ---------- Mom ---------- */
.mf-mom-copy-line{margin-bottom:2px}.mf-mom-orbs{display:flex;gap:10px;align-items:flex-start;margin:5px 0 10px;padding-left:1px}.mf-mom-orbs .mf-top-orb-wrap{width:60px}.mf-mom-orbs .mf-top-orb{width:56px;height:56px}.mf-mom-orbs .mf-top-orb strong{font-size:15px}.mf-mom-orbs .mf-top-orb-wrap>span{font-size:10px}
body[data-screen="mom-home"] .mom-hero .hero-copy>.eyebrow{display:none!important}
.ring.mf-mom-photo-ring{width:124px;height:124px;border-radius:50%;overflow:visible}
.mf-mom-hero-photo{width:124px;height:124px;border:0;padding:0;border-radius:50%;overflow:hidden;background:linear-gradient(145deg,#e6d4ff,#d7e9ff);box-shadow:0 0 0 6px rgba(255,255,255,.72),0 10px 24px rgba(75,60,115,.14);display:grid;place-items:center;color:var(--mom-ink);cursor:pointer}
.mf-mom-hero-photo img{width:100%;height:100%;object-fit:cover;display:block}.mf-mom-hero-photo .placeholder{font-size:30px}.ring.mf-mom-photo-ring svg,.ring.mf-mom-photo-ring .ring-label{display:none!important}
.mf-core-plan{margin:13px 0 16px;padding:19px 20px;border-radius:28px 42px 30px 38px / 34px 26px 42px 30px;background:linear-gradient(145deg,#fbf7ff,#f0eaff 55%,#edf4ff);border:1px solid #dfd4f4;box-shadow:none}
.mf-core-plan-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mf-core-plan-head strong{font-size:17px}.mf-core-plan-head span{font-size:12.5px;color:var(--muted);font-weight:800}
.mf-core-next{font:800 28px var(--display);letter-spacing:-.03em;margin:12px 0 7px}.mf-core-sub{font-size:13.5px;color:var(--muted);line-height:1.45}
.mf-core-times{display:flex;gap:8px;overflow:auto;margin-top:14px;scrollbar-width:none}.mf-core-time{flex:0 0 auto;padding:9px 13px;border-radius:999px;background:#ece5f8;font-size:12.5px;font-weight:800}.mf-core-time.next{background:linear-gradient(135deg,#774ddd,#9b59d0);color:#fff}

/* ---------- Baby ---------- */
.mf-core-baby{display:grid;gap:12px;margin-bottom:16px}.mf-core-baby .mf-profile-line{margin-bottom:0}
.mf-care-label{display:flex;align-items:center;justify-content:space-between;margin:0 3px -1px;font-size:13px;font-weight:850;letter-spacing:.025em;text-transform:uppercase;color:var(--muted)}
.mf-care-label small{font-size:12px;font-weight:750;letter-spacing:0;text-transform:none}

.mf-last-feed-band{display:grid;grid-template-columns:38px minmax(0,1fr) minmax(126px,auto);gap:11px;align-items:center;margin:0;padding:13px 14px;border-radius:23px 31px 25px 29px / 26px 22px 32px 25px;background:linear-gradient(135deg,#cfeeff,#dff3ff 55%,#d8f5ea);border:1px solid #a7d8e8;color:#234d68}
.mf-last-feed-band .mf-last-feed-icon{width:38px;height:38px;border-radius:45% 55% 48% 52% / 58% 44% 56% 42%;background:rgba(255,255,255,.76);display:grid;place-items:center}.mf-last-feed-band svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mf-last-feed-primary,.mf-last-feed-age{min-width:0}.mf-last-feed-band strong{display:block;font-size:15.5px;line-height:1.15;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-last-feed-band small{display:block;margin-top:4px;font-size:11.5px;line-height:1.2;color:#557087;font-weight:750}.mf-last-feed-age{text-align:right}.mf-last-feed-age strong{font-size:15.5px}.mf-last-feed-age small{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}

/* Feed actions: organic shapes, with a protected text-safe area at the bottom. */
.mf-feed-zone{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.mf-feed-card{box-sizing:border-box;position:relative;min-height:108px;border:0;padding:14px 14px 21px;text-align:left;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;color:var(--ink);box-shadow:0 7px 18px rgba(29,42,70,.08)}
.mf-feed-card svg{position:absolute;right:11px;top:10px;width:31px;height:31px;fill:none;stroke:currentColor;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round;opacity:.92}
.mf-feed-card strong,.mf-feed-card small{position:relative;z-index:1;max-width:100%}.mf-feed-card strong{font-size:16px;font-weight:900;letter-spacing:-.015em;line-height:1.1}.mf-feed-card small{display:block;font-size:11.5px;line-height:1.18;font-weight:750;opacity:.84;margin-top:4px}
.mf-feed-card.milk{border-radius:38px 29px 43px 32px / 30px 40px 28px 37px;background:linear-gradient(145deg,#b8ddff 0%,#c5e3ff 58%,#c9cbff 100%);color:#153f61}
.mf-feed-card.nurse{border-radius:43px 31px 35px 42px / 35px 42px 29px 37px;background:linear-gradient(145deg,#ffd1e2,#f5bad4);color:#7b244d}
.mf-feed-card.formula{border-radius:31px 44px 40px 33px / 39px 31px 42px 29px;background:linear-gradient(145deg,#d8ccff,#c6b6f3);color:#432d73}

/* Diaper blobs stay playful, while count badges stay safely inset. */
.mf-diaper-cluster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch}
.mf-diaper-blob{position:relative;min-height:108px;padding:15px 9px 13px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;border:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 7px 18px rgba(29,42,70,.07)}
.mf-diaper-blob svg{position:absolute;top:13px;left:50%;transform:translateX(-50%);width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round;opacity:.94}
.mf-diaper-blob strong{font-size:16px;font-weight:900;line-height:1.15}.mf-diaper-blob span{font-size:11.5px;line-height:1.2;margin-top:4px;opacity:.82}
.mf-diaper-blob b{position:absolute;right:11px;top:10px;min-width:30px;height:30px;padding:0 8px;border-radius:999px;background:rgba(255,255,255,.86);display:grid;place-items:center;font-size:12.5px;font-weight:900;line-height:1;box-shadow:0 1px 0 rgba(0,0,0,.04)}
.mf-diaper-blob.wet{border-radius:56% 44% 62% 38% / 58% 46% 54% 42%;background:linear-gradient(145deg,#bfe7ff,#9fd7f4);color:#145b86}.mf-diaper-blob.poop{border-radius:42% 58% 45% 55% / 62% 45% 55% 38%;background:linear-gradient(145deg,#ffe1a8,#f4ca76);color:#7d5314}.mf-diaper-blob.both{border-radius:60% 40% 52% 48% / 43% 57% 44% 56%;background:linear-gradient(145deg,#d6c2ff,#bca5f4);color:#573a9f}

.mf-care-ribbon{display:flex;gap:8px;overflow:auto;scrollbar-width:none;padding:1px 1px 2px}.mf-care-ribbon::-webkit-scrollbar{display:none}
.mf-care-ribbon button{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-radius:999px;font-size:12.5px;font-weight:850;cursor:pointer;color:var(--ink-2)}
.mf-care-ribbon button:nth-child(1){background:#e6e7ff;color:#4b4e9c}.mf-care-ribbon button:nth-child(2){background:#ffdce8;color:#963e62}.mf-care-ribbon button:nth-child(3){background:#d9efff;color:#246f96}.mf-care-ribbon button:nth-child(4){background:#d9f3e8;color:#27785f}.mf-care-ribbon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* ---------- dark mode: richer, not washed out ---------- */
:root[data-theme="dark"] body[data-screen="mom-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(137,84,241,.18),transparent 32%),radial-gradient(circle at 88% 20%,rgba(220,73,137,.12),transparent 30%),var(--bg)}
:root[data-theme="dark"] body[data-screen="baby-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(38,151,214,.18),transparent 32%),radial-gradient(circle at 88% 22%,rgba(41,175,136,.12),transparent 30%),var(--bg)}
:root[data-theme="dark"] body[data-screen="mom-home"] .mom-hero{background:linear-gradient(135deg,#211735 0%,#2b1a3d 48%,#1b2946 100%)}
:root[data-theme="dark"] body[data-screen="mom-home"] .quick-tile.mom{background:linear-gradient(145deg,#2f214a,#432a68);color:#d6c2ff}:root[data-theme="dark"] body[data-screen="mom-home"] .quick-tile.nurse{background:linear-gradient(145deg,#3a1f2e,#54273d);color:#ffbad6}
:root[data-theme="dark"] .mf-core-plan{background:linear-gradient(145deg,#1d1a2a,#261e35 58%,#1a2539);border-color:#3a2f4e}:root[data-theme="dark"] .mf-core-time{background:#29243a;color:#f1edff;border:1px solid #3b3450}
:root[data-theme="dark"] .mf-top-orb.mom-pumps{--orb-ring:#b795ff;--orb-fill:#352654}:root[data-theme="dark"] .mf-top-orb.mom-goal{--orb-ring:#ef86b0;--orb-fill:#462338}:root[data-theme="dark"] .mf-top-orb.mom-avg{--orb-ring:#5ed5af;--orb-fill:#173d31}
:root[data-theme="dark"] .mf-top-orb.baby-milk{--orb-ring:#57c4f3;--orb-fill:#173d56}:root[data-theme="dark"] .mf-top-orb.baby-usual{--orb-ring:#aa8df4;--orb-fill:#33264f}:root[data-theme="dark"] .mf-top-orb.baby-diaper{--orb-ring:#5ed5af;--orb-fill:#173d31}
:root[data-theme="dark"] .mf-top-orb strong{color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.25)}:root[data-theme="dark"] .mf-top-orb small{color:#e0e5ef!important}:root[data-theme="dark"] .mf-top-orb-wrap>span{color:#d7dce6}
:root[data-theme="dark"] .mf-last-feed-band{background:linear-gradient(135deg,#123246,#17354e 55%,#153c33);border-color:#2a6070;color:#f0fbff}:root[data-theme="dark"] .mf-last-feed-band .mf-last-feed-icon{background:#1b4557;color:#9fe4ff}:root[data-theme="dark"] .mf-last-feed-band small{color:#ced9e3}
:root[data-theme="dark"] .mf-feed-card.milk{background:linear-gradient(145deg,#143a56,#1b315b 62%,#31264f);color:#ccefff}:root[data-theme="dark"] .mf-feed-card.nurse{background:linear-gradient(145deg,#55263c,#442135);color:#ffc1da}:root[data-theme="dark"] .mf-feed-card.formula{background:linear-gradient(145deg,#433765,#332a56);color:#e8ddff}
:root[data-theme="dark"] .mf-diaper-blob.wet{background:linear-gradient(145deg,#123a53,#174a65);color:#7ed4ff}:root[data-theme="dark"] .mf-diaper-blob.poop{background:linear-gradient(145deg,#44320e,#5a4211);color:#ffd487}:root[data-theme="dark"] .mf-diaper-blob.both{background:linear-gradient(145deg,#352653,#463169);color:#c9b4ff}
:root[data-theme="dark"] .mf-diaper-blob b{background:#303846;color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
:root[data-theme="dark"] .mf-care-ribbon button:nth-child(1){background:#25294b;color:#bfc5ff}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(2){background:#472437;color:#ffbfd7}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(3){background:#17394b;color:#9fddff}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(4){background:#183c31;color:#9be1c8}
:root[data-theme="dark"] .mf-mom-hero-photo{box-shadow:0 0 0 6px rgba(169,138,240,.24),0 10px 24px rgba(0,0,0,.35)}

body[data-screen="baby-home"] #view>.baby-stage,body[data-screen="baby-home"] #view>.act-strip,body[data-screen="baby-home"] #view>.feed-cta,body[data-screen="baby-home"] #view>.orb-row,body[data-screen="baby-home"] #view>.pill-row,body[data-screen="baby-home"] #view>.ring-row{display:none!important}

/* ---------- responsive ---------- */
@media(max-width:760px){
  #view{transition:none!important}.mf-core-plan{border-radius:24px 34px 25px 31px / 28px 23px 34px 26px}
  .mf-profile-photo{width:60px;height:60px}.mf-profile-copy h2{font-size:27px}
  .mf-top-orb-wrap{width:52px}.mf-top-orb{width:50px;height:50px}.mf-top-orb strong{font-size:14px}.mf-top-orb-wrap>span{font-size:9.5px}
  .mf-mom-orbs{margin-top:5px}.ring.mf-mom-photo-ring,.mf-mom-hero-photo{width:116px;height:116px}
  .mf-feed-card{min-height:106px;padding:13px 12px 20px}.mf-feed-card strong{font-size:15px}.mf-feed-card small{font-size:11px}
  .mf-diaper-blob{min-height:106px}.mf-care-ribbon button{padding:10px 13px}
}
@media(max-width:390px){
  .mf-profile-line.has-summary{grid-template-columns:auto minmax(0,1fr) auto;gap:7px}.mf-profile-photo{width:54px;height:54px}
  .mf-profile-copy .welcome{font-size:13px}.mf-profile-copy h2{font-size:25px}.mf-profile-copy small{font-size:11px}
  .mf-top-orbs{gap:4px}.mf-top-orb-wrap{width:47px}.mf-top-orb{width:46px;height:46px}.mf-top-orb strong{font-size:13px}.mf-top-orb small{font-size:9px!important}.mf-top-orb-wrap>span{font-size:9px}
  .mf-mom-orbs{gap:6px}.mf-mom-orbs .mf-top-orb-wrap{width:52px}.mf-mom-orbs .mf-top-orb{width:50px;height:50px}
  .ring.mf-mom-photo-ring,.mf-mom-hero-photo{width:104px;height:104px}
  .mf-last-feed-band{grid-template-columns:34px minmax(0,1fr) minmax(112px,auto);gap:8px;padding:11px}.mf-last-feed-band strong,.mf-last-feed-age strong{font-size:14px}.mf-last-feed-band small{font-size:10.5px}
  .mf-feed-zone{gap:6px}.mf-feed-card{min-height:104px;padding:12px 10px 19px}.mf-feed-card svg{width:29px;height:29px;right:9px;top:9px}.mf-feed-card strong{font-size:14px}.mf-feed-card small{font-size:10.5px}
  .mf-diaper-cluster{gap:6px}.mf-diaper-blob{min-height:104px;padding-left:7px;padding-right:7px}.mf-diaper-blob b{right:8px;top:8px;min-width:29px;height:29px;font-size:12px}.mf-diaper-blob strong{font-size:15px}.mf-diaper-blob span{font-size:11px}
}
`;
  document.head.appendChild(s);
}

function profilePhoto(src,kind){if(src)return `<img src="${esc(src)}" alt="${kind==='mom'?'Mom':'Baby'} profile photo">`;return `<span class="placeholder">${kind==='mom'?'♡':'☁︎'}</span>`;}

function renderMom(s){
  const view=document.getElementById('view'),hero=view?.querySelector('.mom-hero');if(!view||!hero)return;
  const g=positiveGreeting(),name=s.profile?.momName||'Mom',photo=s.profile?.momPhoto||'',x=plan(s,prefs()),snap=momSnapshot(s,x),ring=hero.querySelector('.ring');
  if(ring){ring.classList.add('mf-mom-photo-ring');ring.innerHTML=`<button type="button" class="mf-mom-hero-photo" data-core-mom-photo aria-label="${photo?'Change Mom photo':'Add Mom photo'}">${profilePhoto(photo,'mom')}</button>`;}
  let prof=document.getElementById('mfMomProfileLine');
  if(!prof){prof=document.createElement('div');prof.id='mfMomProfileLine';const copy=hero.querySelector('.hero-copy')||hero;copy.prepend(prof);}
  prof.className='mf-profile-line mf-mom-copy-line';
  prof.innerHTML=`<div class="mf-profile-copy"><div class="welcome"><b>${g.mark}</b><span>${g.text}</span></div><h2>${esc(name)}</h2>${photo?'':`<small class="mf-photo-hint">Tap the large photo to add yours</small>`}</div>`;
  let orbs=document.getElementById('mfMomOrbs');
  if(!orbs){orbs=document.createElement('div');orbs.id='mfMomOrbs';orbs.className='mf-mom-orbs';prof.insertAdjacentElement('afterend',orbs);}
  orbs.innerHTML=`${topOrb(`${snap.pumps}/${snap.target}`,'','Pumps','mom-pumps',snap.target?snap.pumps/snap.target*100:null,'Pumps completed today')}${topOrb(snap.pct,'%','Goal','mom-goal',snap.pct,`${snap.pct}% of daily goal`)}${topOrb(snap.avg||'—','mL','7d avg','mom-avg',null,'Seven day pumping average')}`;
  let card=document.getElementById('mfCorePlan');
  if(!card){card=document.createElement('section');card.id='mfCorePlan';card.className='mf-core-plan';hero.insertAdjacentElement('afterend',card);}
  const next=x.remaining&&x.future.length?`${to12(x.future[0]-10)}–${to12(x.future[0]+10)}`:'Target reached for today';
  card.innerHTML=`<div class="mf-core-plan-head"><strong>Today’s live plan</strong><span>${x.actual.length} of ${x.target} done</span></div><div class="mf-core-next">${esc(next)}</div><div class="mf-core-sub">${x.source==='override'?'Adjusted for how today is going.':x.source==='actual'&&x.last?`Updated from your ${to12(mins(x.last.time))} pump and your recent time-of-day spacing.`:'Uses your saved baseline until today’s first pump is logged.'}</div>${x.future.length?`<div class="mf-core-times">${x.future.map((m,i)=>`<span class="mf-core-time ${i===0?'next':''}">${to12(m)}</span>`).join('')}</div>`:''}`;
}

function renderBaby(s){
  const view=document.getElementById('view');if(!view)return;
  const st=babyCareStats(s),snap=babySnapshot(s,st),g=positiveGreeting(),babyName=s.baby?.name||'Baby',photo=s.baby?.photo||'',age=ageLabel(s.baby?.birthDate),lf=lastFeedText(lastFeed(s));
  let box=document.getElementById('mfCoreBaby');if(!box){box=document.createElement('section');box.id='mfCoreBaby';box.className='mf-core-baby';view.prepend(box);}
  const babyMeta=[age,!photo?'Tap the photo spot to add one':''].filter(Boolean).join(' · ');
  box.innerHTML=`
    <div class="mf-profile-line has-summary">
      <button type="button" class="mf-profile-photo addable" data-photo aria-label="${photo?'Change Baby photo':'Add Baby photo'}">${profilePhoto(photo,'baby')}</button>
      <div class="mf-profile-copy"><div class="welcome"><b>${g.mark}</b><span>${g.text}</span></div><h2>${esc(babyName)}</h2>${babyMeta?`<small>${esc(babyMeta)}</small>`:''}</div>
      <div class="mf-top-orbs" aria-label="Baby today summary">
        ${topOrb(snap.todayOz.toFixed(1),'oz','Today','baby-milk',snap.pct,`${snap.todayOz.toFixed(1)} ounces from bottles today`)}
        ${topOrb(snap.recentAvg?snap.pct:'—',snap.recentAvg?'%':'','Vs avg','baby-usual',snap.recentAvg?snap.pct:null,snap.recentAvg?`${snap.pct}% of recent daily average; ${snap.recentAvg.toFixed(1)} ounces recent average, ${snap.allAvg.toFixed(1)} overall`:'Comparison builds from logged days')}
        ${topOrb(snap.diapers,'','Diapers','baby-diaper',null,`${st.wet} wet, ${st.poop} poopy, ${st.both} mixed today`)}
      </div>
    </div>

    <div class="mf-last-feed-band" aria-label="Last feeding">
      <span class="mf-last-feed-icon">${icon('bottle')}</span>
      <span class="mf-last-feed-primary"><strong>${esc(lf.main)}</strong><small>${esc(lf.clock)}</small></span>
      <span class="mf-last-feed-age"><strong>${esc(lf.age)}</strong><small>Last fed</small></span>
    </div>

    <div class="mf-care-label"><span>Feed</span><small>Quick log</small></div>
    <div class="mf-feed-zone">
      <button type="button" class="mf-feed-card milk" data-feed-type="expressed_milk" aria-label="Log breast milk bottle">${icon('bottle')}<strong>Breast milk</strong><small>Log bottle</small></button>
      <button type="button" class="mf-feed-card nurse" data-feed-type="nursing" aria-label="Log nursing">${icon('nursing')}<strong>Nurse</strong><small>${st.nursingCount?`${st.nursingCount} today`:'Breastfeed'}</small></button>
      <button type="button" class="mf-feed-card formula" data-feed-type="formula" aria-label="Log formula">${icon('bottle')}<strong>Formula</strong><small>${st.formulaCount?`${st.formulaCount} today`:'Log bottle'}</small></button>
    </div>

    <div class="mf-care-label"><span>Diapers</span><small>${st.diaperCount?`${st.diaperCount} today`:'Quick log'}</small></div>
    <div class="mf-diaper-cluster">
      <button type="button" class="mf-diaper-blob wet" data-diaper="wet" aria-label="Log wet diaper">${icon('wet')}<b>${st.wet}</b><strong>Wet</strong><span>diaper</span></button>
      <button type="button" class="mf-diaper-blob poop" data-diaper="poop" aria-label="Log poopy diaper">${icon('poop')}<b>${st.poop}</b><strong>Poopy</strong><span>diaper</span></button>
      <button type="button" class="mf-diaper-blob both" data-diaper="both" aria-label="Log mixed diaper">${icon('both')}<b>${st.both}</b><strong>Mixed</strong><span>wet + poopy</span></button>
    </div>

    <div class="mf-care-ribbon" aria-label="More baby care">
      <button type="button" data-sleep>${icon('moon')} Sleep</button>
      <button type="button" data-growth>${icon('growth')} Growth</button>
      <button type="button" data-view="baby-history">History</button>
      <button type="button" data-view="baby-trends">Trends</button>
    </div>`;
}

function cleanup(){
  if(document.body.dataset.screen!=='mom-home'){document.getElementById('mfCorePlan')?.remove();document.getElementById('mfMomProfileLine')?.remove();document.getElementById('mfMomOrbs')?.remove();}
  if(document.body.dataset.screen!=='baby-home')document.getElementById('mfCoreBaby')?.remove();
}
function apply(){if(applying)return;applying=true;try{addStyles();const s=read();cleanup();if(document.body.dataset.screen==='mom-home')renderMom(s);if(document.body.dataset.screen==='baby-home')renderBaby(s);}finally{applying=false;}}
function afterApp(){queueMicrotask(apply);}

async function syncMomProfile(profile){try{const user=window.firebase?.auth?.().currentUser;if(!user||!window.firebase?.firestore)return;await firebase.firestore().collection('users').doc(user.uid).collection('private').doc('profile').set({profile},{merge:true});}catch(err){console.warn('Mom profile photo cloud sync deferred',err?.message||err);}}
function saveMomPhoto(data){const s=read();s.profile={...(s.profile||{}),momPhoto:data};s.savedAt=Date.now();localStorage.setItem(STATE_KEY,JSON.stringify(s));syncMomProfile(s.profile);apply();}
function chooseMomPhoto(){
  let input=document.getElementById('mfCoreMomPhotoFile');
  if(!input){
    input=document.createElement('input');input.type='file';input.accept='image/*';input.id='mfCoreMomPhotoFile';input.hidden=true;document.body.appendChild(input);
    input.addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';if(!f||!/^image\//.test(f.type||''))return;const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),size=320;c.width=c.height=size;const ctx=c.getContext('2d'),side=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,size,size);saveMomPhoto(c.toDataURL('image/jpeg',.82));};img.src=r.result;};r.readAsDataURL(f);});
  }
  input.click();
}

document.addEventListener('click',e=>{if(e.target.closest('[data-core-mom-photo]')){chooseMomPhoto();return;}if(e.target.closest('[data-view],[data-workspace],[data-feed-type],[data-diaper],[data-mom],[data-photo],[data-sleep],[data-growth]'))afterApp();});
document.addEventListener('submit',e=>{if(['momForm','feedForm','diaperForm','sleepForm','growthForm'].includes(e.target?.id))setTimeout(apply,0);});
window.addEventListener('hashchange',afterApp);
window.addEventListener('popstate',afterApp);
window.addEventListener('pageshow',afterApp);
window.addEventListener('milkflow:base-rendered',afterApp);
window.addEventListener('storage',e=>{if(e.key===STATE_KEY||e.key===COACH_KEY)afterApp();});
window.addEventListener('milkflow:coach-change',afterApp);
window.addEventListener('milkflow:chat-data',afterApp);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterApp,{once:true});else afterApp();
setInterval(()=>{if(document.body.dataset.screen==='mom-home'||document.body.dataset.screen==='baby-home')apply();},60000);
})();
