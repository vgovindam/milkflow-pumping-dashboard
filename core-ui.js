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
function prefs(){const p=rawPrefs(),d=today(),daily=Number(p.dayTargets?.[d]);return{target:Number.isFinite(daily)?daily:6,mode:p.mode||'normal',nextOverrideByDate:p.nextOverrideByDate||{},dayTargets:p.dayTargets||{}};}
function savePrefs(mutator){const old=localStorage.getItem(COACH_KEY),p=rawPrefs(),next=mutator({...p,dayTargets:{...(p.dayTargets||{})},nextOverrideByDate:{...(p.nextOverrideByDate||{})}})||p;localStorage.setItem(COACH_KEY,JSON.stringify(next));try{window.dispatchEvent(new StorageEvent('storage',{key:COACH_KEY,oldValue:old,newValue:JSON.stringify(next),storageArea:localStorage,url:location.href}));}catch{window.dispatchEvent(new CustomEvent('milkflow:coach-change'));}return next;}

const livePumps=s=>(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);
const pumpsOn=(s,d)=>livePumps(s).filter(e=>e.date===d).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
const dayPumps=s=>pumpsOn(s,today());
const round5=m=>Math.round(m/5)*5;

function positiveGreeting(){
  const h=new Date().getHours();
  if(h>=5&&h<8)return{text:'Gentle start',mark:'🌅'};
  if(h>=8&&h<12)return{text:'Good morning',mark:'☀️'};
  if(h>=12&&h<17)return{text:'Good afternoon',mark:'🌤️'};
  if(h>=17&&h<21)return{text:'Good evening',mark:'✨'};
  if(h>=21||h<2)return{text:'Peaceful night',mark:'🌙'};
  return{text:'Hope it is a calm one',mark:'🌙'};
}
/* Greet the person reading, by name. The stored default is the literal word "Mom", which
   reads colder than no name at all, so that case falls back to the bare greeting. */
/* The Mom hero used to head the card with a fixed slogan about a beautifully paced day - the
   same words every morning whatever had happened, which told a parent nothing. This says where
   today
   actually stands, in words rather than numbers, because the numbers are in the fact boxes
   right underneath and repeating them would waste the line twice over. */
const SESSION_WORDS=['No','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten'];
function momHeadline(x){
  const done=(x.actual||[]).length,target=x.target||0,left=Math.max(0,target-done);
  if(!done)return 'A fresh start';
  if(!x.remaining||!left)return 'Today is complete';
  if(left===1)return 'One more to go';
  /* Short on purpose: beside a 128px photo this line has about 185px on a 393pt phone, and
     anything longer than about 18 characters takes a third line and eats the card. */
  return `${SESSION_WORDS[done]||done} in, ${(SESSION_WORDS[left]||left).toLowerCase()} to go`;
}

function greetingLine(savedName){
  const g=positiveGreeting();
  const n=String(savedName||'').trim();
  return {mark:g.mark,text:n&&n!=='Mom'?`${g.text}, ${n}`:g.text};
}
/* Baby Home should feel alive without pretending to know how the baby feels. These wishes
   use only time-of-day and the app's own conservative next-feed estimate. */
function babyWishLine(name,nextFeed,feedCount){
  const h=new Date().getHours(),baby=String(name||'Baby');
  if(nextFeed?.overdue&&nextFeed.minsAway>-90)return `${baby}'s usual feed window is here`;
  if(!feedCount&&h<12)return `A gentle start for you and ${baby}`;
  if(h>=5&&h<12)return 'Wishing you both a smooth morning';
  if(h>=12&&h<17)return `Hope your afternoon with ${baby} feels easy`;
  if(h>=17&&h<21)return 'Wishing you both a cozy evening';
  return '';
}
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
function compactRelativeAgo(date,time){
  if(!date||!time)return'';
  const at=new Date(`${date}T${time}:00`),diff=Math.max(0,Math.floor((Date.now()-at.getTime())/60000));
  if(!Number.isFinite(diff))return'';
  if(diff<1)return'just now';
  if(diff<60)return`${diff}m ago`;
  const h=Math.floor(diff/60),m=diff%60;
  if(h<24)return`${h}h${m?` ${m}m`:''} ago`;
  return`${Math.floor(h/24)}d ago`;
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
function setDayTarget(day,n){n=clamp(Math.round(Number(n)||6),4,8);savePrefs(p=>{p.dayTargets[day]=n;delete p.target;return p;});return n;}
function setTodayNextTime(value){const m=Number.isFinite(Number(value))?Number(value):mins(value);if(!Number.isFinite(m))return plan(read(),prefs());savePrefs(p=>{p.nextOverrideByDate[today()]=clamp(Math.round(m),0,1439);return p;});return plan(read(),prefs());}
function clearTodayNextTime(){savePrefs(p=>{delete p.nextOverrideByDate[today()];return p;});return plan(read(),prefs());}
window.MilkFlowDynamicPump={getPlan:()=>plan(read(),prefs()),previewTarget:n=>plan(read(),{...prefs(),target:clamp(Math.round(Number(n)||6),4,8)}),setTodayTarget,setDayTarget,setTomorrowTarget:n=>setDayTarget(dateShift(1),n),setTodayNextTime,clearTodayNextTime};

function icon(kind){
  const p={
    bottle:'<path d="M19 6h10v6l3 4v22c0 3-2 5-5 5h-6c-3 0-5-2-5-5V16l3-4V6Z"/><path d="M19 12h10M16 21h16"/><path d="M21 28h6M21 33h6"/>',
    nursing:'<path d="M16 17c0-5 3-8 7-8s7 3 7 8-3 8-7 8-7-3-7-8Z"/><path d="M9 41c1-9 6-14 14-14s13 5 14 14"/><circle cx="36" cy="27" r="5"/><path d="M30 28c7 0 11 4 11 10"/>',
    wet:'<path d="M24 7c6 7 11 13 11 20a11 11 0 1 1-22 0c0-7 5-13 11-20Z"/>',
    poop:'<path d="M24 9c4 1 5 4 4 7h2c5 0 8 3 8 7 0 2-.7 3-2 5 4 1 6 4 6 7 0 4-4 7-9 7H15c-5 0-9-3-9-7 0-3 2-6 6-7-1-2-2-3-2-5 0-4 3-7 8-7h2c-1-4 1-7 4-7Z"/>',
    both:'<path d="M16 7c4 5 8 10 8 14a8 8 0 1 1-16 0c0-4 4-9 8-14Z"/><path d="M33 20c3 1 4 3 3 5h1c4 0 6 2 6 5 0 1-.4 2-1 3 2 1 3 3 3 5 0 3-3 5-7 5H27c-4 0-7-2-7-5 0-2 1-4 3-5-.6-1-1-2-1-3 0-3 2-5 6-5h1c-.5-3 1-5 4-5Z"/>',
    plus:'<path d="M24 9v30M9 24h30"/>',
    moon:'<path d="M34 35A15 15 0 0 1 18 12a15 15 0 1 0 16 23Z"/>',
    growth:'<path d="M10 38h28"/><path d="M14 38V14h20v24"/><path d="M18 20h7M18 26h11M18 32h7"/>',
    formula:'<path d="M13 9h22v5H13z"/><path d="M15 14h18v26a4 4 0 0 1-4 4H19a4 4 0 0 1-4-4V14Z"/><path d="M20 24h8M20 31h8"/>',
    clock:'<circle cx="24" cy="24" r="16"/><path d="M24 14v10l7 4"/>'
  };
  return `<svg viewBox="0 0 48 48" aria-hidden="true">${p[kind]||p.bottle}</svg>`;
}

/* Maps a care action to the built-in semantic glyph used when the active theme has no
   generated icon for it (a new theme, or an action added before its art). */
const CARE_GLYPH={milk:'bottle',nurse:'nursing',formula:'formula',wet:'wet',poop:'poop',mixed:'both',clock:'clock'};

/* Resolved at render time from the theme registry, in the same pass that builds the card.
   No second module rewrites these afterwards, so there is no ordering to get wrong. */
function careMark(action){
  const src=window.MilkFlowExperience?.careIcon?.(action)||null;
  const inner=src
    ? `<img class="mf-care-art" src="${esc(src)}" alt="" decoding="async">`
    : icon(CARE_GLYPH[action]||action);
  return `<span class="mf-care-mark ${esc(action)}${src?' is-art':''}" aria-hidden="true">${inner}</span>`;
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
/* Predicted next feed.
 *
 * Mom's side has had an adaptive pump plan for a while; Baby had nothing equivalent, so the
 * check-in row could only ever report the past. This projects forward from the gaps actually
 * observed, using the MEDIAN of recent intervals rather than the mean so that one four-hour
 * stretch overnight does not drag every estimate late.
 *
 * Deliberately conservative: it needs at least four feeds to say anything, ignores gaps
 * outside 20 minutes to 8 hours as data-entry noise or night breaks, and returns null rather
 * than guessing. A wrong prediction on a newborn feeding schedule is worse than none.
 */
function predictNextFeed(s, now = Date.now()){
  const feeds = babyEvents(s).filter(e => (e.eventType === 'feeding' || e.eventType === 'nursing') && e.date && e.time);
  if(feeds.length < 4) return null;
  const recent = feeds.slice(-12).map(e => new Date(`${e.date}T${e.time}:00`).getTime()).filter(Number.isFinite).sort((a,b) => a-b);
  if(recent.length < 4) return null;
  const gaps = [];
  for(let i = 1; i < recent.length; i++){
    const g = (recent[i] - recent[i-1]) / 60000;
    if(g >= 20 && g <= 480) gaps.push(g);
  }
  if(gaps.length < 3) return null;
  const sorted = [...gaps].sort((a,b) => a-b);
  const mid = Math.floor(sorted.length/2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid-1] + sorted[mid]) / 2;
  const last = recent[recent.length-1];
  const due = last + median * 60000;
  const minsAway = Math.round((due - now) / 60000);
  return {
    dueAt: due,
    typicalGapMin: Math.round(median),
    minsAway,
    overdue: minsAway < 0,
    label: to12(new Date(due).getHours()*60 + new Date(due).getMinutes()),
    sample: gaps.length
  };
}

function lastFeedText(e){
  if(!e)return{main:'No feed logged yet',age:'—',clock:'Tap a feed option below'};
  const age=relativeAgo(e.date,e.time)||'—',clock=to12(mins(e.time));
  if(e.eventType==='nursing'){
    const dur=Number(e.durationMinutes??e.totalMinutes??0)||0,side=e.side?` · ${String(e.side).replace(/^./,c=>c.toUpperCase())}`:'';
    return{main:dur?`Nursed ${dur} min`:'Nursed',age,clock,side:side.replace(/^ · /,'')};
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
/* Component CSS for the MilkFlow core UI.
   Declared into the milkflow-components layer (see the cascade contract at the top of
   styles.css). Being a layer is what makes these rules beat the base sheet and lose to
   the themed experience layer, by position rather than by a louder declaration - which is
   why there is no forced override anywhere in this block. A rule that needs to outrank a
   theme belongs in a later layer, not in a stronger one. */
@layer milkflow-components {
html{scroll-behavior:auto}#view{overflow-anchor:none}/* Motion was switched off entirely to stop the slide transform jittering inside the
   .main scroll owner. An opacity cross-fade cannot move layout, so navigation can feel
   continuous again without reintroducing that jitter. */


/* The Baby hero used to be a flex row with an absolutely-placed copy block. It is a named
   grid now - greeting across the top, photo / name / stats beneath - and that grid is defined
   once, in component-theme-core.css, with .mf-animal-profile and .mf-animal-copy set to
   display:contents so their children are the grid's own items. The old flex rules lived here
   and had to be shouted down by the grid; they are gone rather than overridden. */

/* ---------- ambient color: stronger identity without sacrificing readability ---------- */
body[data-screen="mom-home"] .main{background:radial-gradient(circle at 10% 8%,rgba(194,220,255,.55),transparent 29%),radial-gradient(circle at 89% 17%,rgba(226,193,255,.46),transparent 31%),radial-gradient(circle at 60% 76%,rgba(255,205,228,.24),transparent 29%),linear-gradient(155deg,var(--bg),color-mix(in srgb,var(--bg) 72%,#eaf7ff))}
body[data-screen="baby-home"] .main{background:radial-gradient(circle at 10% 8%,rgba(186,226,255,.52),transparent 29%),radial-gradient(circle at 89% 17%,rgba(204,194,255,.4),transparent 31%),radial-gradient(circle at 62% 76%,rgba(184,241,226,.23),transparent 29%),linear-gradient(155deg,var(--bg),color-mix(in srgb,var(--bg) 70%,#e9fbf6))}
body[data-screen="mom-home"] .mom-hero{background:radial-gradient(circle at 88% 12%,rgba(255,255,255,.72),transparent 26%),linear-gradient(140deg,rgba(255,255,255,.94),rgba(239,230,255,.91) 52%,rgba(223,241,255,.9))}
body[data-screen="mom-home"] .quick-tile.mom{background:linear-gradient(145deg,#f8f1ff,#ddd1ff 58%,#dceeff);color:#5732a7}
body[data-screen="mom-home"] .quick-tile.nurse{background:linear-gradient(145deg,#fff4fa,#ffdcea 58%,#f1dcff);color:#9a3864}

/* Chat belongs to Mom. Keep it completely off Baby and non-Mom screens. */
body:not([data-screen^="mom-"]) #mfChatButton,body:not([data-screen^="mom-"]) #mfChatPanel{display:none}

/* ---------- shared type scale ---------- */
.mf-profile-line{display:flex;align-items:center;gap:12px;margin:0 0 13px}
.mf-profile-line.has-summary{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:11px;align-items:center}
/* A circle, the same as the Mom hero's. The organic blob belongs to the Baby CARDS; on the
   portrait it made the picture look like it changed size when you switched persona, because
   a blob of the same width reads smaller than a circle of that width. */
.mf-profile-photo{width:66px;height:66px;border-radius:50%;overflow:hidden;flex:0 0 auto;background:var(--surface-2);display:grid;place-items:center;border:0;padding:0;color:var(--muted)}
/* Anchor near the top: a portrait centered in a circle loses the top of the head. */
.mf-profile-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 8%;display:block}.mf-profile-photo .placeholder{font-size:26px;line-height:1}
.mf-profile-copy{min-width:0;flex:1}.mf-profile-copy .welcome{display:flex;align-items:center;gap:7px;font-size:14px;font-weight:800;color:var(--muted);margin-bottom:5px;line-height:1.25}.mf-profile-copy .welcome b{font-size:18px}
.mf-profile-copy h2{margin:0;font:800 29px var(--display);letter-spacing:-.035em;line-height:1.04;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-profile-copy small{display:block;margin-top:6px;color:var(--muted);font-size:12px;line-height:1.35;font-weight:700}
.mf-profile-photo.addable{cursor:pointer}.mf-photo-hint{font-size:12px;color:var(--muted)}

/* ---------- summary circles ---------- */
.mf-top-orbs{display:flex;align-items:flex-start;justify-content:flex-end;gap:7px;min-width:0}
.mf-top-orb-wrap{width:56px;text-align:center;min-width:0}
.mf-top-orb{--p:100%;--orb-ring:#7044dd;--orb-fill:#eadcff;position:relative;width:54px;height:54px;margin:auto;border-radius:50%;display:grid;align-content:center;justify-items:center;background:conic-gradient(var(--orb-ring) var(--p),rgba(120,126,150,.16) 0);isolation:isolate}
.mf-top-orb::before{content:"";position:absolute;inset:4px;border-radius:50%;background:var(--orb-fill);z-index:-1}
.mf-top-orb.plain{background:var(--orb-fill);box-shadow:inset 0 0 0 2px color-mix(in srgb,var(--orb-ring) 34%,transparent)}.mf-top-orb.plain::before{display:none}
.mf-top-orb strong{font:850 15px var(--display);line-height:1;color:var(--ink);letter-spacing:-.03em;max-width:48px;overflow:hidden;text-overflow:ellipsis}
.mf-top-orb small{margin-top:3px;font-size:9.5px;font-weight:800;line-height:1;color:var(--muted)}
.mf-top-orb-wrap>span{display:block;margin-top:5px;font-size:10px;line-height:1.05;font-weight:850;color:var(--muted);white-space:nowrap}
.mf-top-orb.mom-pumps{--orb-ring:#7044dd;--orb-fill:#eadcff}.mf-top-orb.mom-goal{--orb-ring:#c94f86;--orb-fill:#ffe0ec}.mf-top-orb.mom-avg{--orb-ring:#278e72;--orb-fill:#d9f4e9}
.mf-top-orb.baby-milk{--orb-ring:#198fc8;--orb-fill:#d6efff}.mf-top-orb.baby-usual{--orb-ring:#7255c9;--orb-fill:#e7defd}.mf-top-orb.baby-diaper{--orb-ring:#288f72;--orb-fill:#d8f3e8}
.mf-target-dialog{width:min(430px,calc(100vw - 28px));border:0;border-radius:24px;padding:0;background:var(--surface);color:var(--ink);box-shadow:0 24px 80px rgba(25,22,42,.28)}.mf-target-dialog::backdrop{background:rgba(25,22,42,.42);backdrop-filter:blur(3px)}.mf-target-dialog form{padding:20px}.mf-target-dialog .dialog-head{padding:0;display:flex;align-items:flex-start;gap:12px}.mf-target-dialog .dialog-head div{flex:1}.mf-target-dialog .dialog-head small{display:block;color:var(--mom);font-size:10px;font-weight:900;letter-spacing:.12em;margin-bottom:5px}.mf-target-dialog .dialog-head h2{margin:0;font-size:22px}.mf-target-dialog .dialog-head>button{border:0;background:var(--surface-2);color:var(--muted);width:38px;height:38px;border-radius:12px;font-size:22px}.mf-target-dialog p{color:var(--muted);font-size:13px;line-height:1.5;margin:14px 0}.mf-target-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.mf-target-options button{border:1px solid var(--line);border-radius:18px;background:var(--surface-2);color:var(--ink);padding:16px 12px;text-align:left}.mf-target-options strong,.mf-target-options span{display:block}.mf-target-options strong{font-size:16px}.mf-target-options span{font-size:11px;color:var(--muted);margin-top:4px}.mf-target-options button:first-child{border-color:color-mix(in srgb,var(--mom) 40%,var(--line));background:color-mix(in srgb,var(--mom) 9%,var(--surface))}.mf-target-later{width:100%;margin-top:10px;border:0;background:transparent;color:var(--muted);padding:11px;font-weight:800}

/* ---------- Mom ---------- */
.mf-mom-copy-line{margin-bottom:2px}.mf-mom-orbs{display:flex;gap:10px;align-items:flex-start;margin:5px 0 10px;padding-left:1px}.mf-mom-orbs .mf-top-orb-wrap{width:60px}.mf-mom-orbs .mf-top-orb{width:56px;height:56px}.mf-mom-orbs .mf-top-orb strong{font-size:15px}.mf-mom-orbs .mf-top-orb-wrap>span{font-size:10px}
body[data-screen="mom-home"] .mom-hero .hero-copy>.eyebrow{display:none}
.ring.mf-mom-photo-ring{width:124px;height:124px;border-radius:50%;overflow:visible}
.mf-mom-hero-photo{width:124px;height:124px;border:0;padding:0;border-radius:50%;overflow:hidden;background:linear-gradient(145deg,#e6d4ff,#d7e9ff);box-shadow:0 0 0 6px rgba(255,255,255,.72),0 10px 24px rgba(75,60,115,.14);display:grid;place-items:center;color:var(--mom-ink);cursor:pointer}
.mf-mom-hero-photo img{width:100%;height:100%;object-fit:cover;display:block}.mf-mom-hero-photo .placeholder{font-size:30px}.ring.mf-mom-photo-ring svg,.ring.mf-mom-photo-ring .ring-label{display:none}
.mf-core-plan:not(.mf-dream-journey){margin:13px 0 16px;padding:19px 20px;border-radius:28px 42px 30px 38px / 34px 26px 42px 30px;background:radial-gradient(circle at 90% 8%,rgba(255,255,255,.72),transparent 28%),linear-gradient(145deg,rgba(253,249,255,.94),rgba(239,232,255,.91) 55%,rgba(230,244,255,.9));border:1px solid rgba(255,255,255,.72);box-shadow:0 16px 38px rgba(78,64,132,.1),inset 0 1px 0 rgba(255,255,255,.86);backdrop-filter:blur(18px) saturate(1.1)}
.mf-core-plan-head{display:flex;justify-content:space-between;gap:10px;align-items:center}.mf-core-plan-head strong{font-size:17px}.mf-core-plan-head span{font-size:12.5px;color:var(--muted);font-weight:800}
.mf-core-next{font:800 28px var(--display);letter-spacing:-.03em;margin:12px 0 7px}.mf-core-sub{font-size:13.5px;color:var(--muted);line-height:1.45}
.mf-core-times{display:flex;gap:8px;overflow:auto;margin-top:14px;scrollbar-width:none}.mf-core-time{flex:0 0 auto;padding:9px 13px;border-radius:999px;background:#ece5f8;font-size:12.5px;font-weight:800}.mf-core-time.next{background:linear-gradient(135deg,#774ddd,#9b59d0);color:#fff}

/* ---------- Reimagined dream-cloud Mom home ---------- */
.mf-dream-hero{min-height:0;padding:22px 24px;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:20px;border-radius:32px;isolation:isolate;background:linear-gradient(135deg,#755fc8 0%,#9e78d9 36%,#e293bd 68%,#8fc5e8 100%);border:0;box-shadow:0 22px 48px rgba(78,55,133,.2);color:#fff;overflow:hidden}
.mf-dream-main h2{font:800 30px/1.08 var(--editorial);margin:10px 0 0;letter-spacing:-.02em}
/* The nudge card. Quiet by design: it reads as a note on the page, not an alert, and the
   dismiss affordance is as easy to hit as the action. */
.mf-nudge{margin:12px 0 0;padding:14px 15px 13px;border-radius:24px 30px 22px 28px / 26px 22px 30px 24px;
  background:linear-gradient(150deg,rgba(255,255,255,.95),var(--realm-soft) 96%);
  border:1px solid rgba(255,255,255,.8);box-shadow:0 12px 28px rgba(64,60,104,.09);position:relative;z-index:3}
.mf-nudge.mom{--realm-soft:var(--mom-soft)}
.mf-nudge.baby{--realm-soft:var(--baby-soft)}
.mf-nudge-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.mf-nudge-head span{font-size:9.5px;font-weight:900;letter-spacing:.1em;text-transform:uppercase;opacity:.72}
.mf-nudge-x{width:28px;height:28px;min-height:0;padding:0;border:0;background:rgba(255,255,255,.7);border-radius:50%;
  font-size:17px;line-height:1;color:inherit;opacity:.65;display:grid;place-items:center}
.mf-nudge-x:active{opacity:1}
.mf-nudge>strong{display:block;margin-top:5px;font:800 17px/1.2 var(--display);letter-spacing:-.01em}
.mf-nudge>p{margin:5px 0 0;font-size:12.5px;line-height:1.4;opacity:.88}
.mf-nudge>ul{margin:9px 0 0;padding:0;list-style:none;display:grid;gap:5px}
.mf-nudge>ul li{position:relative;padding-left:16px;font-size:12.5px;line-height:1.35;opacity:.92}
.mf-nudge>ul li:before{content:"";position:absolute;left:3px;top:7px;width:6px;height:6px;border-radius:50%;background:currentColor;opacity:.42}
.mf-nudge-actions{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.mf-nudge-go{flex:1 1 auto;min-height:40px;padding:0 15px;border:0;border-radius:14px;background:var(--realm-ink,var(--ink));color:#fff;font:800 13px/1 var(--font)}
.mf-nudge-later{min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:14px;background:transparent;color:inherit;font:750 13px/1 var(--font);opacity:.8}
:root[data-theme="dark"] .mf-nudge{background:linear-gradient(150deg,rgba(32,32,52,.94),color-mix(in srgb,var(--realm) 14%,rgba(26,30,46,.92)));border-color:rgba(201,193,239,.14)}
:root[data-theme="dark"] .mf-nudge-x{background:rgba(255,255,255,.12)}
@media(max-width:390px){.mf-nudge>strong{font-size:16px}}
/* The hero fact boxes. One component, used by BOTH heroes, so "what happened last" and
   "where today stands" read identically whichever person you are looking at. Each box is a
   label, the number, and the one piece of context that makes the number mean something. */
.mf-hero-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;margin-top:14px}
/* Three, because the third is the next feed - which used to be a whole card of its own under
   the hero saying one number. Folding it in answers both halves of the same complaint: the
   hero stops wasting the space beside the name, and the facts stop being two wide slabs. */
.mf-hero-facts.three{grid-template-columns:repeat(3,minmax(0,1fr));gap:7px}
.mf-hero-facts.three .mf-hero-fact{padding:7px 9px}
.mf-hero-facts.three .mf-hero-fact strong{font-size:15px;letter-spacing:-.02em}
.mf-hero-facts.three .mf-hero-fact small{font-size:8.5px}
.mf-hero-facts.three .mf-hero-fact em{font-size:9.5px}
.mf-hero-fact.due strong{color:var(--mf-world-accent,currentColor)}
.mf-hero-fact{display:grid;align-content:start;gap:1px;min-width:0;padding:8px 11px;border-radius:17px;
  background:rgba(255,255,255,.17);border:1px solid rgba(255,255,255,.28);box-shadow:inset 0 1px 0 rgba(255,255,255,.22);backdrop-filter:blur(14px)}
.mf-hero-fact small{font-size:9.5px;font-weight:850;letter-spacing:.08em;text-transform:uppercase;opacity:.82}
.mf-hero-fact strong{font:800 16px/1.14 var(--display);letter-spacing:-.01em;overflow-wrap:anywhere}
.mf-hero-fact em{font-style:normal;font-size:11px;font-weight:700;opacity:.86;line-height:1.2}
/* Shown only while the app does not know the parent's name - the greeting and the persona
   tab both fall back to the word "Mom" until it does, and nothing else asks for it. */
.mf-name-cta{margin-left:8px;padding:3px 9px;border:1px solid currentColor;border-radius:999px;background:none;color:inherit;font:inherit;font-size:11px;font-weight:800;opacity:.78;cursor:pointer}
.mf-name-cta:active{opacity:1}
.mf-dream-next{margin-top:14px;display:flex;align-items:baseline;gap:9px;flex-wrap:wrap}
.mf-dream-next span{font-size:10.5px;font-weight:800;opacity:.82;text-transform:uppercase;letter-spacing:.06em}
.mf-dream-next strong{font:900 17px/1.1 var(--display)}
/* Progress is the ring AROUND the photo. It used to be a separate absolutely positioned
   circle sitting on top of the photo, which is the overlap that kept reappearing. */
.mf-dream-side{display:contents}
.mf-dream-photo{position:relative}
.mf-dream-ring{position:absolute;inset:-8px;border-radius:50%;pointer-events:none;
  background:conic-gradient(rgba(255,255,255,.95) var(--dream-p,0%),rgba(255,255,255,.22) 0);
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 5px),#000 calc(100% - 4px))}
.mf-dream-hero:before{content:"";position:absolute;z-index:-2;inset:0;background:radial-gradient(circle at 16% 14%,rgba(255,255,255,.28),transparent 22%),radial-gradient(circle at 84% 17%,rgba(255,238,250,.38),transparent 25%),linear-gradient(180deg,rgba(255,255,255,.06),rgba(73,50,126,.08))}
.mf-dream-main{position:relative;z-index:2;max-width:660px}.mf-dream-welcome{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:800;color:rgba(255,255,255,.86)}.mf-dream-welcome>span{width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.18);backdrop-filter:blur(8px)}
.mf-dream-kicker{margin-top:34px;font-size:12px;letter-spacing:.035em;font-weight:750;color:#fff2c5}.mf-dream-main h2{max-width:580px;margin:7px 0 10px;font:650 clamp(40px,4vw,60px)/.98 var(--editorial);letter-spacing:-.035em;color:#fff;text-wrap:balance;text-shadow:0 2px 16px rgba(61,39,103,.14)}.mf-dream-main>p{max-width:560px;margin:0;color:rgba(255,255,255,.84);font-size:15px;line-height:1.55}
.mf-dream-next{width:min(580px,100%);margin-top:30px;padding:15px 16px 15px 19px;border:1px solid rgba(255,255,255,.26);border-radius:24px;display:flex;align-items:center;gap:18px;background:rgba(255,255,255,.14);box-shadow:inset 0 1px 0 rgba(255,255,255,.2);backdrop-filter:blur(18px)}.mf-dream-next>div{flex:1;min-width:0}.mf-dream-next>div span,.mf-dream-next>div strong,.mf-dream-next>div small{display:block}.mf-dream-next>div span{font-size:9px;letter-spacing:.15em;font-weight:900;color:#fff2c5}.mf-dream-next>div strong{font:850 22px var(--display);margin-top:3px}.mf-dream-next>div small{font-size:11px;color:rgba(255,255,255,.72);margin-top:3px}.mf-dream-next button{flex:0 0 auto;min-height:54px;border:0;border-radius:18px;padding:0 18px;display:flex;align-items:center;gap:8px;background:#fff;color:#6849b1;font-weight:900;box-shadow:0 12px 26px rgba(58,37,106,.2)}.mf-dream-next button svg{width:18px;height:18px}
.mf-dream-side{display:contents}.mf-dream-photo{width:136px;height:136px;padding:0;border:7px solid rgba(255,255,255,.22);border-radius:50%;overflow:hidden;background:linear-gradient(145deg,rgba(255,255,255,.93),rgba(235,215,255,.93));color:#4a2f86;display:grid;place-items:center;box-shadow:0 18px 34px rgba(57,37,101,.16)}.mf-dream-photo img{width:100%;height:100%;object-fit:cover;object-position:50% 8%}.mf-dream-photo .placeholder{font-size:38px}
.mf-dream-journey{position:relative;z-index:3;margin-top:18px;padding:23px 25px;border-radius:30px;background:rgba(255,255,255,.82);box-shadow:0 18px 40px rgba(79,63,132,.11),inset 0 1px 0 #fff}.mf-journey-head{display:flex;align-items:center;justify-content:space-between;gap:16px}.mf-journey-head span,.mf-journey-head strong{display:block}.mf-journey-head span{font-size:9px;letter-spacing:.15em;font-weight:900;color:var(--mom)}.mf-journey-head strong{margin-top:4px;font:800 18px var(--display)}.mf-journey-head em{font-style:normal;padding:7px 11px;border-radius:999px;background:var(--mom-soft);color:var(--mom-ink);font-size:11px;font-weight:900}.mf-journey-track{position:relative;display:grid;grid-auto-flow:column;grid-auto-columns:minmax(92px,1fr);gap:8px;overflow:auto;margin:14px 0 8px;padding:12px 0 10px;scrollbar-width:none}.mf-journey-track:before{content:"";position:absolute;left:34px;right:34px;top:33px;height:2px;background:linear-gradient(90deg,#8b68de,#e19ac2,#8bc9e7);opacity:.27}.mf-journey-stop{position:relative;z-index:1;display:grid;justify-items:center;min-width:92px;text-align:center}.mf-journey-stop i{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;background:#f2edfb;color:#63558a;border:5px solid rgba(255,255,255,.9);box-shadow:0 4px 14px rgba(82,64,131,.1);font-style:normal}.mf-journey-stop.done i{background:#dff5ec;color:#1d6a52}.mf-journey-stop.next i{background:linear-gradient(145deg,#613cb8,#8e3a6f);color:#fff;box-shadow:0 7px 18px rgba(115,75,178,.26),0 0 0 4px rgba(132,98,216,.1)}.mf-journey-stop strong{margin-top:7px;font-size:12px}.mf-journey-stop small{margin-top:2px;font-size:9px;color:var(--muted);font-weight:800}.mf-dream-journey>p{margin:2px 0 0;color:var(--muted);font-size:11px;line-height:1.45}
.mf-dream-actions{max-width:none;gap:12px}.mf-dream-actions .quick-tile{min-height:120px;border-radius:28px;padding:60px 14px 16px;text-align:center;align-items:center}.mf-dream-actions .quick-tile strong{font-size:22px}.mf-dream-actions .quick-tile .tile-art{left:50%;right:auto;top:12px;transform:translateX(-50%);width:54px;height:54px;border-radius:50%}body[data-realm] .mf-dream-metrics .metric{border:0;border-radius:24px;background:rgba(255,255,255,.72);box-shadow:0 13px 30px rgba(78,65,126,.08)}
/* ---------- Baby ---------- */
.mf-core-baby{display:grid;gap:12px;margin-bottom:16px}.mf-core-baby .mf-profile-line{margin-bottom:0}
.mf-animal-hero{position:relative;min-height:176px;padding:22px 25px;border-radius:38px 48px 35px 44px / 42px 34px 48px 38px;overflow:hidden;isolation:isolate;background:linear-gradient(135deg,#a8ddf4 0%,#c9ebdf 48%,#ffe0b9 100%);box-shadow:0 20px 45px rgba(47,91,102,.14);color:#214c57}
.mf-animal-hero:before{content:"";position:absolute;z-index:-2;inset:0;background:radial-gradient(circle at 15% 8%,rgba(255,255,255,.72),transparent 27%),radial-gradient(circle at 87% 20%,rgba(255,247,202,.9),transparent 17%)}
.mf-animal-hero:after{content:"";position:absolute;z-index:-1;left:-5%;right:-5%;bottom:-42px;height:106px;border-radius:50% 50% 0 0;background:linear-gradient(180deg,#8fd7ad,#60be91)}
/* The photo well is cream in both modes, so its glyph does not follow the page palette.
   It has to be set on the BUTTON: the themed hero forces color:inherit on its descendants. */
.mf-profile-photo,.mf-dream-photo{color:#5d6478}
.mf-animal-profile .mf-profile-photo{width:88px;height:88px;border:5px solid rgba(255,255,255,.72);background:#fff6e4;box-shadow:0 10px 24px rgba(38,99,102,.14)}.mf-animal-copy .welcome{font-size:11px;font-weight:750;letter-spacing:.015em;text-transform:none;opacity:.78}.mf-animal-copy h2{margin:4px 0 0;font:650 31px/.98 var(--editorial);letter-spacing:-.03em}.mf-animal-copy small{display:block;margin-top:6px;font-size:11px;font-weight:700;opacity:.76}
.mf-animal-sticker{--a:#a96c4b;--b:#ffe7c7;--line:#60402f;display:grid;place-items:center}.mf-animal-sticker svg{width:100%;height:100%;overflow:visible;filter:drop-shadow(0 3px 3px rgba(44,51,67,.13))}.mf-animal-sticker .a-base,.mf-animal-sticker .a-ear{fill:var(--a)}.mf-animal-sticker .a-soft{fill:var(--b)}.mf-animal-sticker .a-dot{fill:var(--line)}.mf-animal-sticker .a-line{fill:none;stroke:var(--line);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}.mf-animal-sticker.bunny{--a:#fffaf7;--b:#f3adc4;--line:#5e4d5d}.mf-animal-sticker.fox{--a:#f38b4d;--b:#fff2db;--line:#64352d}.mf-animal-sticker.whale{--a:#49b3d3;--b:#e1fbff;--line:#245469}.mf-animal-sticker.owl{--a:#8c68cb;--b:#ffe29c;--line:#453762}
.mf-animal-hero>.mf-animal-sticker{position:absolute;z-index:2}.mf-animal-hero>.bear{width:76px;height:76px;right:116px;bottom:8px;transform:rotate(-4deg)}.mf-animal-hero>.bunny{width:62px;height:62px;right:47px;bottom:7px;transform:rotate(5deg)}.mf-animal-star{position:absolute;color:#fff8c7;font-size:15px;filter:drop-shadow(0 2px 4px rgba(72,86,70,.14))}.mf-animal-star.one{left:47%;top:25px}.mf-animal-star.two{right:34%;top:66px;font-size:10px}
.mf-animal-checkin{display:grid;grid-template-columns:48px minmax(0,1fr) auto;align-items:center;gap:11px;padding:12px 14px;border-radius:34px 24px 30px 26px / 26px 32px 24px 34px;background:linear-gradient(135deg,#fff5df,#ffe8cf 52%,#eadffd);color:#664f45;box-shadow:0 8px 22px rgba(96,72,66,.08)}.mf-animal-checkin>.mf-animal-sticker{width:45px;height:45px}.mf-animal-checkin strong,.mf-animal-checkin small{display:block}.mf-animal-checkin strong{font-size:14px}.mf-animal-checkin small{margin-top:3px;font-size:10.5px;opacity:.72}.mf-animal-checkin>span:last-child{text-align:right}
.mf-care-label{display:flex;align-items:center;justify-content:space-between;margin:0 3px;font:650 17px/1.1 var(--editorial);letter-spacing:-.015em;text-transform:none;color:var(--ink)}
.mf-care-label small{font-size:12px;font-weight:750;letter-spacing:0;text-transform:none}

.mf-last-feed-band{display:grid;grid-template-columns:38px minmax(0,1fr) minmax(126px,auto);gap:11px;align-items:center;margin:0;padding:13px 14px;border-radius:23px 31px 25px 29px / 26px 22px 32px 25px;background:linear-gradient(135deg,#cfeeff,#dff3ff 55%,#d8f5ea);border:1px solid #a7d8e8;color:#234d68}
.mf-last-feed-band .mf-last-feed-icon{width:38px;height:38px;border-radius:45% 55% 48% 52% / 58% 44% 56% 42%;background:rgba(255,255,255,.76);display:grid;place-items:center}.mf-last-feed-band svg{width:23px;height:23px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.mf-last-feed-primary,.mf-last-feed-age{min-width:0}.mf-last-feed-band strong{display:block;font-size:15.5px;line-height:1.15;font-weight:900;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.mf-last-feed-band small{display:block;margin-top:4px;font-size:11.5px;line-height:1.2;color:#557087;font-weight:750}.mf-last-feed-age{text-align:right}.mf-last-feed-age strong{font-size:15.5px}.mf-last-feed-age small{font-size:10.5px;text-transform:uppercase;letter-spacing:.04em}

/* Feed actions: organic shapes, with a protected text-safe area at the bottom. */
.mf-feed-zone{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}
.mf-feed-card{box-sizing:border-box;position:relative;min-height:116px;border:0;padding:58px 10px 14px;text-align:center;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;overflow:hidden;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;color:var(--ink);box-shadow:0 7px 18px rgba(29,42,70,.08)}
.mf-feed-card>svg{position:absolute;right:11px;top:10px;width:31px;height:31px;fill:none;stroke:currentColor;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round;opacity:.92}
.mf-feed-card>.mf-animal-sticker{position:absolute;right:8px;top:7px;width:58px;height:58px;padding:5px;border-radius:50%;background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.6);opacity:1}.mf-feed-card>.mf-animal-sticker svg{position:static;width:100%;height:100%;fill:initial;stroke:initial;opacity:1}
/* A care action is recognised by its symbol, so the symbol is the one thing a theme may not
   replace. The disc is a neutral carrier and the mark inherits the card's own accent, which
   gives each action its own color instead of one flat ink across all six. */
.mf-care-mark{position:absolute;display:grid;place-items:center;border-radius:50%;color:inherit;
  background:rgba(255,255,255,.92);box-shadow:inset 0 0 0 1px rgba(255,255,255,.72),0 6px 15px rgba(30,44,66,.13)}
.mf-care-mark>svg{position:static;inset:auto;left:auto;right:auto;top:auto;bottom:auto;transform:none;width:58%;height:58%;fill:none;stroke:currentColor;stroke-width:2.9;stroke-linecap:round;stroke-linejoin:round;opacity:1}
/* is-art: the illustrated mark brings its own shape, so the neutral carrier steps aside.
   The icon used to draw a filled disc too, which meant a rounded tile, then this plate, then
   that disc, then the character - three containers around one drawing. The disc is gone from
   the generated file now, so the art sits straight on the tile and can be drawn larger in the
   same box. */
.mf-care-mark.is-art{background:none;box-shadow:none}
.mf-care-mark.is-art .mf-care-art{width:100%;height:100%;display:block;border-radius:0}
.mf-section-motif{position:absolute;right:14px;bottom:8px;width:56px;height:56px;opacity:.9;pointer-events:none}

/* The mark is a span, and the rule .mf-diaper-blob span{position:relative} outranks a lone
   .mf-care-mark, so these carry the element type to win the specificity contest. */
.mf-feed-card>span.mf-care-mark{position:absolute;left:50%;right:auto;top:9px;transform:translateX(-50%);width:52px;height:52px}
.mf-diaper-blob>span.mf-care-mark{position:absolute;left:11px;right:auto;top:9px;transform:none;width:48px;height:48px}
.mf-animal-checkin>span.mf-care-mark{position:relative;left:auto;top:auto;transform:none;width:44px;height:44px}
:root[data-theme="dark"] .mf-animal-checkin>span.mf-care-mark:not(.is-art){background:rgba(255,255,255,.15);box-shadow:inset 0 0 0 1px rgba(255,255,255,.2)}
/* Two tones per card: the title carries the accent, the caption steps back a measured
   amount. Previously both sat on one color at .84 opacity, which read as a single flat ink. */
.mf-feed-card small,.mf-diaper-blob span{color:var(--mf-card-sub,currentColor);opacity:1;font-weight:800}
.mf-feed-card.milk{--mf-card-sub:#2d7a62}.mf-feed-card.nurse{--mf-card-sub:#a64b78}.mf-feed-card.formula{--mf-card-sub:#9a4f28}
.mf-diaper-blob.wet{--mf-card-sub:#2f7ba7}.mf-diaper-blob.poop{--mf-card-sub:#8d6420}.mf-diaper-blob.both{--mf-card-sub:#6a55a8}
:root[data-theme="dark"] .mf-feed-card.milk{--mf-card-sub:#8ad9bf}:root[data-theme="dark"] .mf-feed-card.nurse{--mf-card-sub:#e59ebd}:root[data-theme="dark"] .mf-feed-card.formula{--mf-card-sub:#f0b490}
:root[data-theme="dark"] .mf-diaper-blob.wet{--mf-card-sub:#8ccdec}:root[data-theme="dark"] .mf-diaper-blob.poop{--mf-card-sub:#dbb271}:root[data-theme="dark"] .mf-diaper-blob.both{--mf-card-sub:#b3a0e0}
.mf-feed-card strong,.mf-feed-card small{position:relative;z-index:1;max-width:100%}.mf-feed-card strong{font-size:16px;font-weight:900;letter-spacing:-.015em;line-height:1.1}.mf-feed-card small{display:block;font-size:11.5px;line-height:1.18;font-weight:750;opacity:.84;margin-top:4px}
/* Feed and Diapers used to share blue and violet, two of three each, so at a glance the two
   groups looked like one. Feed is the warm/green family now - teal, rose, coral - and Diapers
   keeps the established blue, amber and violet. */
.mf-feed-card.milk{border-radius:40px 26px 36px 30px / 30px 38px 28px 40px;background:linear-gradient(145deg,#c6f1e1 0%,#b2e7d3 58%,#a4dfc9 100%);color:#0f4f3b}
.mf-feed-card.nurse{border-radius:28px 40px 30px 36px / 38px 28px 40px 30px;background:linear-gradient(145deg,#ffd1e2,#f5bad4);color:#7b244d}
.mf-feed-card.formula{border-radius:36px 30px 40px 26px / 28px 40px 30px 38px;background:linear-gradient(145deg,#ffdcc8,#ffc3a4);color:#76331a}

/* Diaper blobs stay playful, while count badges stay safely inset. */
.mf-diaper-cluster{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;align-items:stretch}
.mf-diaper-blob{position:relative;min-height:116px;padding:58px 9px 13px;text-align:center;display:grid;grid-template-rows:auto auto;align-content:end;justify-items:center;border:0;font:inherit;cursor:pointer;-webkit-tap-highlight-color:transparent;box-shadow:0 7px 18px rgba(29,42,70,.07);overflow:hidden}
.mf-diaper-blob>svg{position:absolute;top:13px;left:50%;transform:translateX(-50%);width:38px;height:38px;fill:none;stroke:currentColor;stroke-width:2.15;stroke-linecap:round;stroke-linejoin:round;opacity:.94}
.mf-diaper-blob>.mf-animal-sticker{position:absolute;top:5px;left:50%;transform:translateX(-50%);width:58px;height:58px;padding:5px;border-radius:50%;background:rgba(255,255,255,.42);box-shadow:inset 0 1px 0 rgba(255,255,255,.62)}.mf-diaper-blob>.mf-animal-sticker svg{position:static;width:100%;height:100%;transform:none;fill:initial;stroke:initial;opacity:1}
.mf-diaper-blob strong{position:relative;z-index:2;font-size:16px;font-weight:900;line-height:1.1}.mf-diaper-blob span{position:relative;z-index:2;font-size:11.5px;line-height:1.15;margin-top:4px;opacity:.86}
.mf-diaper-blob b{position:absolute;right:10px;top:10px;min-width:27px;height:27px;padding:0 7px;border-radius:999px;background:rgba(255,255,255,.86);display:grid;place-items:center;font-size:12px;font-weight:900;line-height:1;box-shadow:0 1px 0 rgba(0,0,0,.04)}
.mf-diaper-blob.wet{border-radius:42px 28px 34px 32px / 32px 40px 30px 38px;background:linear-gradient(145deg,#bfe7ff,#9fd7f4);color:#145b86}.mf-diaper-blob.poop{border-radius:30px 40px 28px 38px / 40px 30px 36px 28px;background:linear-gradient(145deg,#ffe1a8,#f4ca76);color:#68420d}.mf-diaper-blob.both{border-radius:34px 36px 42px 26px / 26px 42px 32px 36px;background:linear-gradient(145deg,#d6c2ff,#bca5f4);color:#46307f}

.mf-care-ribbon{display:flex;gap:8px;overflow:auto;scrollbar-width:none;padding:1px 1px 2px}.mf-care-ribbon::-webkit-scrollbar{display:none}
.mf-care-ribbon button{flex:0 0 auto;display:flex;align-items:center;gap:7px;padding:10px 14px;border:0;border-radius:999px;font-size:12.5px;font-weight:850;cursor:pointer;color:var(--ink-2)}
.mf-care-ribbon button:nth-child(1){background:#e6e7ff;color:#4b4e9c}.mf-care-ribbon button:nth-child(2){background:#ffdce8;color:#963e62}.mf-care-ribbon button:nth-child(3){background:#d9efff;color:#246f96}.mf-care-ribbon button:nth-child(4){background:#d9f3e8;color:#27785f}.mf-care-ribbon svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}

/* ---------- one visual system across every Mom, Baby and Family screen ---------- */
body[data-realm="mom"] .main{--realm:#7e5bd1;--realm-soft:#eee6ff;--realm-ink:#5d3ea8;background:radial-gradient(circle at 8% 7%,rgba(205,191,255,.58),transparent 28%),radial-gradient(circle at 92% 14%,rgba(255,191,220,.42),transparent 30%),linear-gradient(155deg,#f9f5ff,#f4f5ff 58%,#eef8ff)}
body[data-realm="baby"] .main{--realm:#3b9fc4;--realm-soft:#def5f4;--realm-ink:#236c89;background:radial-gradient(circle at 8% 7%,rgba(174,225,250,.6),transparent 28%),radial-gradient(circle at 92% 14%,rgba(255,225,166,.45),transparent 28%),linear-gradient(155deg,#f2fbff,#f6f4ff 56%,#effcf5)}
body[data-realm="family"] .main{--realm:#7064c5;--realm-soft:#eceaff;--realm-ink:#514798}
body[data-depth="1"] .view,body[data-depth="2"] .view{max-width:1100px}
body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head{position:relative;min-height:126px;padding:24px 26px;margin-bottom:16px;border-radius:34px;overflow:hidden;isolation:isolate;border:1px solid rgba(255,255,255,.72);box-shadow:0 20px 48px rgba(67,58,110,.12);align-items:center}
body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head:before{content:"";position:absolute;z-index:-2;inset:0;background:linear-gradient(135deg,rgba(255,255,255,.94),rgba(241,236,255,.9) 52%,rgba(227,244,255,.88))}
body[data-realm="mom"] .page-head:before{background:radial-gradient(circle at 84% 18%,rgba(255,240,199,.72),transparent 17%),linear-gradient(135deg,#755fc8,#a579d9 47%,#df8eba 77%,#89c2e4)}
body[data-realm="mom"] .page-head:after{content:"";position:absolute;z-index:-1;width:220px;height:64px;right:-40px;bottom:-23px;border-radius:999px;background:rgba(255,255,255,.24);box-shadow:-70px 2px 0 -3px rgba(255,255,255,.15),-12px -32px 0 -8px rgba(255,255,255,.18)}
body[data-realm="baby"] .page-head:before{background:radial-gradient(circle at 88% 15%,rgba(255,247,196,.9),transparent 16%),linear-gradient(135deg,#a8def2,#c8ecdf 54%,#ffe1b9)}
body[data-realm="family"] .page-head:before{background:linear-gradient(135deg,#eee8ff,#fcebf4 55%,#e5f5ff)}
body[data-realm="mom"] .page-head h2,body[data-realm="mom"] .page-head .eyebrow{color:#fff;text-shadow:0 2px 12px rgba(62,41,108,.18)}body[data-realm="mom"] .page-head .eyebrow{color:#fff2c8}
body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head h2{font-size:34px;letter-spacing:-.04em}body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head .eyebrow{font-size:11px;letter-spacing:.18em;color:var(--realm-ink)}
.mf-section-animal{position:absolute;z-index:0;right:112px;bottom:-5px;width:92px;height:92px;filter:drop-shadow(0 10px 13px rgba(52,92,86,.14));pointer-events:none}.mf-head-dream{position:absolute;right:112px;top:26px;color:#fff5ca;font-size:22px;letter-spacing:13px;transform:rotate(-8deg);pointer-events:none}
body[data-realm] .round-action{position:relative;z-index:2;border:1px solid rgba(255,255,255,.55);border-radius:17px;background:rgba(255,255,255,.75);box-shadow:0 10px 24px rgba(46,48,92,.1);color:var(--realm-ink);backdrop-filter:blur(12px)}
body[data-realm] .pills{padding:4px;border-radius:17px;background:color-mix(in srgb,var(--realm) 9%,rgba(255,255,255,.7));border:1px solid rgba(255,255,255,.7);box-shadow:0 8px 22px rgba(67,58,110,.06)}body[data-realm] .pills button{border-radius:13px}body[data-realm] .pills button.active{background:linear-gradient(135deg,var(--realm),color-mix(in srgb,var(--realm) 68%,#d785ba));color:#fff;box-shadow:0 7px 16px color-mix(in srgb,var(--realm) 24%,transparent)}
body[data-realm] .panel{border:1px solid rgba(255,255,255,.78);border-radius:30px;background:linear-gradient(145deg,rgba(255,255,255,.86),color-mix(in srgb,var(--realm-soft) 34%,rgba(255,255,255,.82)));box-shadow:0 16px 38px rgba(67,58,110,.09),inset 0 1px 0 rgba(255,255,255,.9)}body[data-realm] .panel-head h3{font-size:18px}body[data-realm] .panel-head button{color:var(--realm-ink);background:var(--realm-soft);border-radius:999px;padding:7px 11px}
/* Summary tiles take the color of the thing they count. The tint is a background-IMAGE, so
   the themed surface contract (which sets background-color for contrast) leaves it alone, and
   the icon well carries the matching ink. This is what puts color on Trends, Growth and the
   Mom screens instead of a grid of identical white boxes. */
body[data-realm] .metric[data-metric]{background-image:linear-gradient(152deg,rgba(255,255,255,.62),var(--realm-soft) 96%)}
body[data-realm] .metric[data-metric="drop"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--wet) 96%)}
body[data-realm] .metric[data-metric="poop"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--poop) 96%)}
body[data-realm] .metric[data-metric="milk"],body[data-realm] .metric[data-metric="bottle"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--feed) 96%)}
body[data-realm] .metric[data-metric="scale"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--growth) 96%)}
body[data-realm] .metric[data-metric="moon"],body[data-realm] .metric[data-metric="sleep"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--sleep) 96%)}
body[data-realm] .metric[data-metric="spark"]{background-image:linear-gradient(152deg,rgba(255,255,255,.55),var(--mixed) 96%)}
body[data-realm] .metric[data-metric="drop"] .metric-icon{color:var(--wet-ink)}
body[data-realm] .metric[data-metric="poop"] .metric-icon{color:var(--poop-ink)}
body[data-realm] .metric[data-metric="milk"] .metric-icon,body[data-realm] .metric[data-metric="bottle"] .metric-icon{color:var(--feed-ink)}
body[data-realm] .metric[data-metric="scale"] .metric-icon{color:var(--growth-ink)}
body[data-realm] .metric[data-metric="moon"] .metric-icon,body[data-realm] .metric[data-metric="sleep"] .metric-icon{color:var(--sleep-ink)}
body[data-realm] .metric[data-metric="spark"] .metric-icon{color:var(--mixed-ink)}
body[data-realm] .metric{position:relative;overflow:hidden;border:1px solid rgba(255,255,255,.8);border-radius:25px;background:linear-gradient(145deg,rgba(255,255,255,.9),var(--realm-soft));box-shadow:0 13px 30px rgba(67,58,110,.08)}body[data-realm] .metric:after{content:"";position:absolute;right:-18px;bottom:-28px;width:82px;height:62px;border-radius:50%;background:rgba(255,255,255,.37)}body[data-realm] .metric-icon{position:relative;z-index:1;border-radius:50%;background:rgba(255,255,255,.7);color:var(--realm-ink);box-shadow:0 6px 15px rgba(68,61,110,.08)}body[data-realm] .metric>div:last-child{position:relative;z-index:1}
body[data-realm="mom"] .metric:nth-child(2){--realm-soft:#ffe5f0;--realm-ink:#a64672}body[data-realm="mom"] .metric:nth-child(3){--realm-soft:#e5f5ff;--realm-ink:#357ba5}body[data-realm="mom"] .metric:nth-child(4){--realm-soft:#e3f6ee;--realm-ink:#327d65}body[data-realm="baby"] .metric:nth-child(2){--realm-soft:#fff0d7;--realm-ink:#98702b}body[data-realm="baby"] .metric:nth-child(3){--realm-soft:#eee5ff;--realm-ink:#684da9}body[data-realm="baby"] .metric:nth-child(4){--realm-soft:#e3f6ee;--realm-ink:#347e67}
body[data-realm] .rows{display:grid;gap:8px}body[data-realm] .row{border:1px solid color-mix(in srgb,var(--realm) 9%,transparent);border-radius:18px;background-color:rgba(255,255,255,.58);padding:11px}body[data-realm] .row:hover{filter:saturate(1.06) brightness(.99)}body[data-realm] .row-icon{border-radius:14px;box-shadow:inset 0 1px 0 rgba(255,255,255,.55)}
body[data-realm="baby"] .review-stats,body[data-realm="baby"] .stat-ring,body[data-realm="baby"] .daily-row,body[data-realm="baby"] .journey,body[data-realm="baby"] .stage-card,body[data-realm="baby"] .ms-group,body[data-realm="baby"] .doctor-summary-card,body[data-realm="baby"] .qa-grid>div{border-color:rgba(255,255,255,.76);background:linear-gradient(145deg,rgba(255,255,255,.84),rgba(224,247,242,.56));box-shadow:0 13px 30px rgba(47,97,104,.08)}
body[data-realm] .grp{border:1px solid rgba(255,255,255,.78);border-radius:26px;background:rgba(255,255,255,.76);box-shadow:0 14px 34px rgba(67,58,110,.08)}body[data-realm] .grp-row{min-height:68px}body[data-realm] .grp-icon{border-radius:15px}
body[data-realm] .stash-hero,body[data-realm] .data-status{border-color:rgba(255,255,255,.78);border-radius:30px;background:linear-gradient(135deg,rgba(255,255,255,.9),var(--realm-soft));box-shadow:0 16px 38px rgba(67,58,110,.09)}
body[data-realm] .field input,body[data-realm] .field select,body[data-realm] .field textarea{border-color:color-mix(in srgb,var(--realm) 15%,transparent);border-radius:16px;background:rgba(255,255,255,.72)}body[data-realm] .sheet,body[data-realm] .dialog{border:1px solid rgba(255,255,255,.62);background:linear-gradient(155deg,color-mix(in srgb,var(--realm-soft) 38%,var(--surface)),var(--surface));box-shadow:0 -24px 60px rgba(46,42,82,.22)}body[data-realm] .sheet-actions button{border-radius:22px;background:rgba(255,255,255,.68)}body[data-realm] .sheet-actions button .gly{color:var(--realm)}
body[data-realm] .page-head h2{font-family:var(--editorial);font-weight:650;line-height:1.02;letter-spacing:-.03em;text-wrap:balance}body[data-realm] .panel-head h3{font-family:var(--editorial);font-weight:650;font-size:21px;line-height:1.1;letter-spacing:-.02em;text-wrap:balance}.mf-journey-head span{font-size:11px;letter-spacing:.035em;font-weight:750;text-transform:none}.mf-journey-head strong{font:650 21px/1.12 var(--editorial);letter-spacing:-.025em;text-wrap:balance}.mf-dream-next>div span{letter-spacing:.035em;text-transform:none;font-size:11px;font-weight:750}.mf-dream-actions .quick-tile strong{font-family:var(--editorial);font-weight:650;letter-spacing:-.02em}body[data-realm] .mf-dream-metrics .metric span{text-transform:none;letter-spacing:.01em;font-weight:700}
body[data-realm] .page-head h2,body[data-realm] .panel-head h3,.mf-journey-head strong,.mf-dream-actions .quick-tile strong{font-family:var(--display);font-weight:750}.mf-dream-hero .mf-dream-main h2,.mf-animal-copy h2{font-family:var(--editorial);font-weight:650}
:root[data-theme="dark"] body[data-realm="mom"] .main,:root[data-theme="dark"] body[data-realm="baby"] .main{background:radial-gradient(circle at 10% 8%,color-mix(in srgb,var(--realm) 20%,transparent),transparent 30%),linear-gradient(155deg,#111222,#17182b 58%,#11202a)}:root[data-theme="dark"] body[data-realm] .panel,:root[data-theme="dark"] body[data-realm] .metric,:root[data-theme="dark"] body[data-realm] .grp,:root[data-theme="dark"] body[data-realm] .row,:root[data-theme="dark"] body[data-realm] .review-stats,:root[data-theme="dark"] body[data-realm] .stat-ring,:root[data-theme="dark"] body[data-realm] .daily-row,:root[data-theme="dark"] body[data-realm] .stash-hero,:root[data-theme="dark"] body[data-realm] .data-status{background:linear-gradient(145deg,rgba(30,30,50,.94),color-mix(in srgb,var(--realm) 12%,rgba(25,29,45,.92)));border-color:rgba(201,193,239,.1)}

@media(max-width:760px){
  body[data-depth="1"] .view,body[data-depth="2"] .view{padding-top:10px}body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head{min-height:104px;padding:17px 16px;border-radius:27px;margin-bottom:12px}body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head h2{font-size:27px}body:not([data-screen="mom-home"]):not([data-screen="baby-home"]) .page-head .eyebrow{margin-bottom:4px}.mf-section-animal{right:76px;width:72px;height:72px;bottom:-3px}.mf-head-dream{right:78px;top:22px;font-size:16px}.page-head .round-action{min-height:42px;padding:0 12px}.page-head .round-action span{font-size:11px}
  body[data-realm] .panel{padding:15px;border-radius:24px}body[data-realm] .metric{min-height:102px;border-radius:21px;padding:12px;display:block}body[data-realm] .metric-icon{width:35px;height:35px;margin-bottom:9px}body[data-realm] .metric strong{font-size:18px}body[data-realm] .metric span{font-size:11px}body[data-realm] .row{padding:10px}body[data-realm] .grp{border-radius:22px}
}

/* ---------- dark mode: richer, not washed out ---------- */
:root[data-theme="dark"] body[data-screen="mom-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(137,84,241,.18),transparent 32%),radial-gradient(circle at 88% 20%,rgba(220,73,137,.12),transparent 30%),var(--bg)}
:root[data-theme="dark"] body[data-screen="baby-home"] .main{background:radial-gradient(circle at 12% 8%,rgba(38,151,214,.18),transparent 32%),radial-gradient(circle at 88% 22%,rgba(41,175,136,.12),transparent 30%),var(--bg)}
:root[data-theme="dark"] body[data-screen="mom-home"] .mom-hero{background:linear-gradient(135deg,#211735 0%,#2b1a3d 48%,#1b2946 100%)}
:root[data-theme="dark"] body[data-screen="mom-home"] .quick-tile.mom{background:linear-gradient(145deg,#2f214a,#432a68);color:#d6c2ff}:root[data-theme="dark"] body[data-screen="mom-home"] .quick-tile.nurse{background:linear-gradient(145deg,#3a1f2e,#54273d);color:#ffbad6}
:root[data-theme="dark"] .mf-core-plan{background:linear-gradient(145deg,#1d1a2a,#261e35 58%,#1a2539);border-color:#3a2f4e}:root[data-theme="dark"] .mf-core-time{background:#29243a;color:#f1edff;border:1px solid #3b3450}
:root[data-theme="dark"] .mf-top-orb.mom-pumps{--orb-ring:#b795ff;--orb-fill:#352654}:root[data-theme="dark"] .mf-top-orb.mom-goal{--orb-ring:#ef86b0;--orb-fill:#462338}:root[data-theme="dark"] .mf-top-orb.mom-avg{--orb-ring:#5ed5af;--orb-fill:#173d31}
:root[data-theme="dark"] .mf-top-orb.baby-milk{--orb-ring:#57c4f3;--orb-fill:#173d56}:root[data-theme="dark"] .mf-top-orb.baby-usual{--orb-ring:#aa8df4;--orb-fill:#33264f}:root[data-theme="dark"] .mf-top-orb.baby-diaper{--orb-ring:#5ed5af;--orb-fill:#173d31}
:root[data-theme="dark"] .mf-top-orb strong{color:#fff;text-shadow:0 1px 1px rgba(0,0,0,.25)}:root[data-theme="dark"] .mf-top-orb small{color:#e0e5ef}:root[data-theme="dark"] .mf-top-orb-wrap>span{color:#d7dce6}
:root[data-theme="dark"] .mf-last-feed-band{background:linear-gradient(135deg,#123246,#17354e 55%,#153c33);border-color:#2a6070;color:#f0fbff}:root[data-theme="dark"] .mf-last-feed-band .mf-last-feed-icon{background:#1b4557;color:#9fe4ff}:root[data-theme="dark"] .mf-last-feed-band small{color:#ced9e3}
:root[data-theme="dark"] .mf-feed-card.milk{background:linear-gradient(145deg,#103a30,#15493b 62%,#1a5344);color:#b6f0da}:root[data-theme="dark"] .mf-feed-card.nurse{background:linear-gradient(145deg,#55263c,#442135);color:#ffc1da}:root[data-theme="dark"] .mf-feed-card.formula{background:linear-gradient(145deg,#4c2c1b,#5e3722);color:#ffcfb2}
:root[data-theme="dark"] .mf-diaper-blob.wet{background:linear-gradient(145deg,#123a53,#174a65);color:#7ed4ff}:root[data-theme="dark"] .mf-diaper-blob.poop{background:linear-gradient(145deg,#44320e,#5a4211);color:#ffd487}:root[data-theme="dark"] .mf-diaper-blob.both{background:linear-gradient(145deg,#352653,#463169);color:#c9b4ff}
:root[data-theme="dark"] .mf-diaper-blob b{background:#303846;color:#fff;box-shadow:0 0 0 1px rgba(255,255,255,.12)}
:root[data-theme="dark"] .mf-care-ribbon button:nth-child(1){background:#25294b;color:#bfc5ff}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(2){background:#472437;color:#ffbfd7}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(3){background:#17394b;color:#9fddff}:root[data-theme="dark"] .mf-care-ribbon button:nth-child(4){background:#183c31;color:#9be1c8}
:root[data-theme="dark"] .mf-animal-hero{background:linear-gradient(145deg,#162b4c 0%,#2b315d 48%,#51355e 100%);color:#f4f1ff;box-shadow:0 22px 48px rgba(5,12,29,.32)}:root[data-theme="dark"] .mf-animal-hero:before{background:radial-gradient(circle at 15% 9%,rgba(126,190,255,.22),transparent 28%),radial-gradient(circle at 88% 19%,rgba(255,232,153,.8),transparent 12%)}:root[data-theme="dark"] .mf-animal-hero:after{background:linear-gradient(180deg,#315f59,#21453f)}:root[data-theme="dark"] .mf-animal-checkin{background:linear-gradient(135deg,#27233f,#382744 54%,#1e3843);color:#f4eaf3}:root[data-theme="dark"] .mf-animal-sticker.bear{--a:#b77c58;--b:#f4d3a9;--line:#493127}:root[data-theme="dark"] .mf-animal-sticker.bunny{--a:#ddd7e7;--b:#d895ad;--line:#55485d}
:root[data-theme="dark"] .mf-animal-copy .welcome{background:rgba(12,24,42,.66);border:1px solid rgba(190,231,247,.18);color:#e2f6ff}:root[data-theme="dark"] .mf-animal-copy h2{color:#f7f3ff}:root[data-theme="dark"] .mf-animal-copy small{color:#d7e7ef}:root[data-theme="dark"] .mf-care-label small{color:#c6ccda}:root[data-theme="dark"] .mf-animal-checkin small{color:#ddd5e1;opacity:1}
:root[data-theme="dark"] .mf-mom-hero-photo{box-shadow:0 0 0 6px rgba(169,138,240,.24),0 10px 24px rgba(0,0,0,.35)}
:root[data-theme="dark"] .mf-dream-hero{background:linear-gradient(145deg,#29204d 0%,#493166 40%,#693a61 69%,#274e69 100%)}:root[data-theme="dark"] .mf-dream-journey{background:rgba(28,28,48,.86);border-color:rgba(200,185,245,.12)}:root[data-theme="dark"] .mf-journey-stop i{border-color:#26243d;background:#34304c}:root[data-theme="dark"] .mf-journey-stop.done i{background:#173f33}:root[data-theme="dark"] body[data-realm] .mf-dream-metrics .metric{background:rgba(31,31,51,.84)}
:root[data-theme="dark"] .mf-journey-stop i{color:#d5c9ec}:root[data-theme="dark"] .mf-journey-stop.done i{color:#8ee4c4}:root[data-theme="dark"] .mf-journey-head em{background:#33274d;color:#dbcaff}:root[data-theme="dark"] .mf-dream-journey>p,:root[data-theme="dark"] .mf-journey-stop small{color:#c0c7d8}

body[data-screen="baby-home"] #view>.baby-stage,body[data-screen="baby-home"] #view>.act-strip,body[data-screen="baby-home"] #view>.feed-cta,body[data-screen="baby-home"] #view>.orb-row,body[data-screen="baby-home"] #view>.pill-row,body[data-screen="baby-home"] #view>.ring-row{display:none}

/* ---------- responsive ---------- */
@media(max-width:760px){
  #view{transition:none}.mf-core-plan:not(.mf-dream-journey){border-radius:24px 34px 25px 31px / 28px 23px 34px 26px}
  .mf-dream-hero{min-height:0;padding:14px 15px 15px;border-radius:29px;grid-template-columns:minmax(0,1fr) 118px;grid-template-areas:"greeting photo" "title photo" "facts facts" "next next";align-items:start;column-gap:14px;row-gap:0}.mf-dream-main,.mf-dream-side{display:contents}.mf-dream-welcome{grid-area:greeting;min-height:0;padding:0;font-size:15px;align-self:center;min-width:0}.mf-dream-welcome>b{min-width:0;overflow:hidden;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.15}.mf-dream-welcome>span{width:25px;height:25px}.mf-dream-kicker{margin-top:0;font-size:9px}/* One owner for the headline on a phone. There were five rules for this element and the
   last one won by being last - including a max-width:74% from the days when the line ran
   the full width of the card rather than sitting beside a photo. */
  .mf-dream-main h2{grid-area:title;max-width:none;font-size:26px;line-height:1.06;margin:6px 0 0;align-self:start;text-wrap:balance;letter-spacing:-.025em}.mf-dream-main>p{display:none}.mf-dream-next{grid-area:next;width:100%;margin-top:9px;padding:8px 11px 8px 13px;border-radius:18px;gap:9px}.mf-dream-next>div strong{font-size:16px}.mf-dream-next>div small{font-size:9px}.mf-dream-next button{min-height:48px;width:auto;min-width:91px;padding:0 12px;justify-content:center;border-radius:15px}.mf-dream-next button span{display:inline;font-size:10px}.mf-dream-photo{grid-area:photo;align-self:center;justify-self:end;width:118px;height:118px;border-width:5px}.mf-hero-facts{grid-area:facts;margin-top:11px;gap:8px}.mf-dream-photo .placeholder{font-size:32px}.mf-dream-journey{padding:17px 15px}.mf-journey-track{margin-top:14px;grid-auto-columns:82px}.mf-dream-actions .quick-tile{min-height:116px;padding:58px 13px 15px}.mf-dream-actions .quick-tile strong{font-size:19px}.mf-dream-actions .quick-tile .tile-art{width:54px;height:54px}
  .mf-animal-hero{padding:15px;border-radius:29px 36px 28px 34px / 33px 28px 37px 30px}.mf-animal-profile .mf-profile-photo{width:138px;height:138px;border-width:7px;box-shadow:0 12px 28px rgba(38,99,102,.2)}.mf-animal-copy .welcome{display:inline-flex;flex-wrap:wrap;padding:5px 7px;border-radius:9px;background:rgba(255,255,255,.55);color:#29606b;font-size:9px;line-height:1.2;letter-spacing:.055em;opacity:1}.mf-animal-copy h2{margin-top:7px;font-size:25px;color:#163f52}.mf-animal-copy small{font-size:9.5px;color:#41636a;opacity:1}.mf-animal-hero>.bear{width:70px;height:70px;right:80px;bottom:-1px}.mf-animal-hero>.bunny{width:57px;height:57px;right:20px;bottom:2px}.mf-animal-star.one{left:48%;top:16px}.mf-animal-checkin{grid-template-columns:44px minmax(0,1fr) auto;padding:10px 11px}.mf-animal-checkin>.mf-animal-sticker{width:42px;height:42px}
  .mf-profile-photo{width:60px;height:60px}.mf-profile-copy h2{font-size:27px}
  .mf-top-orb-wrap{width:52px}.mf-top-orb{width:50px;height:50px}.mf-top-orb strong{font-size:14px}.mf-top-orb-wrap>span{font-size:9.5px}
  .mf-mom-orbs{margin-top:5px}.ring.mf-mom-photo-ring,.mf-mom-hero-photo{width:116px;height:116px}
  .mf-feed-card{min-height:116px;padding:58px 9px 13px}.mf-feed-card strong{font-size:15px}.mf-feed-card small{font-size:11px}
  .mf-diaper-blob{min-height:116px}.mf-care-ribbon button{padding:10px 13px}
}
@media(max-width:390px){
  /* 375pt phones: the greeting is the first thing to run out of room beside the photo, so the
   photo steps down the same way the Baby hero's does rather than ellipsising a name. */
  .mf-dream-hero{min-height:0;padding-left:14px;padding-right:14px;grid-template-columns:minmax(0,1fr) 108px;column-gap:12px}.mf-dream-photo{width:108px;height:108px}.mf-dream-welcome{font-size:13.5px}.mf-dream-next>div strong{font-size:16px}.mf-dream-next>div small{max-width:190px}.mf-journey-head strong{font-size:16px}
  .mf-profile-line.has-summary{grid-template-columns:auto minmax(0,1fr) auto;gap:7px}.mf-profile-photo{width:54px;height:54px}
  .mf-profile-copy .welcome{font-size:13px}.mf-profile-copy h2{font-size:25px}.mf-profile-copy small{font-size:11px}
  .mf-top-orbs{gap:4px}.mf-top-orb-wrap{width:47px}.mf-top-orb{width:46px;height:46px}.mf-top-orb strong{font-size:13px}.mf-top-orb small{font-size:9px}.mf-top-orb-wrap>span{font-size:9px}
  .mf-mom-orbs{gap:6px}.mf-mom-orbs .mf-top-orb-wrap{width:52px}.mf-mom-orbs .mf-top-orb{width:50px;height:50px}
  .ring.mf-mom-photo-ring,.mf-mom-hero-photo{width:104px;height:104px}
  .mf-last-feed-band{grid-template-columns:34px minmax(0,1fr) minmax(112px,auto);gap:8px;padding:11px}.mf-last-feed-band strong,.mf-last-feed-age strong{font-size:14px}.mf-last-feed-band small{font-size:10.5px}
  .mf-feed-zone{gap:6px}.mf-feed-card{min-height:112px;padding:54px 8px 12px}.mf-feed-card svg{width:29px;height:29px;right:9px;top:9px}.mf-feed-card strong{font-size:14px}.mf-feed-card small{font-size:10.5px}
  .mf-diaper-cluster{gap:6px}.mf-diaper-blob{min-height:112px;padding:54px 7px 12px}.mf-diaper-blob b{right:7px;top:7px;min-width:28px;height:28px;padding:0 7px;font-size:12px}.mf-diaper-blob>.mf-animal-sticker{width:55px;height:55px}.mf-diaper-blob strong{font-size:15px}.mf-diaper-blob span{font-size:10.5px}
}
@media(max-width:760px){
  .mf-dream-journey{padding:16px 15px}.mf-journey-track{margin:10px 0 5px;grid-auto-columns:82px;padding:8px 0 7px}.mf-journey-stop.next i{border-color:#d9ccf5;box-shadow:0 7px 18px rgba(115,75,178,.26)}
  .mf-dream-actions{gap:9px;margin:10px 0 11px}.mf-dream-actions .quick-tile{min-height:112px;padding:56px 12px 14px;border-radius:28px}.mf-dream-actions .quick-tile strong{font-size:18px}.mf-dream-actions .quick-tile .tile-art{width:54px;height:54px;left:50%;right:auto;top:11px;transform:translateX(-50%)}.mf-dream-actions .quick-tile .tile-art .gly{width:40px;height:40px}
  body[data-realm] .mf-dream-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;overflow:visible;margin-bottom:12px}body[data-realm] .mf-dream-metrics .metric{min-width:0;min-height:76px;padding:11px 12px;display:grid;grid-template-columns:34px minmax(0,1fr);align-items:center;gap:9px;border-radius:19px}body[data-realm] .mf-dream-metrics .metric-icon{width:34px;height:34px;margin:0}body[data-realm] .mf-dream-metrics .metric:last-child:nth-child(odd){grid-column:1/-1;min-height:70px}body[data-realm] .mf-dream-metrics .metric strong{font-size:18px}body[data-realm] .mf-dream-metrics .metric small{font-size:9px}
  .mf-pump-plan-panel .schedule-card.mf-r2-next,.mf-pump-plan-panel .schedule-card.pc-next,.mf-pump-plan-panel .schedule-card.pi-next{outline:0;border:2px solid color-mix(in srgb,var(--mom) 48%,transparent);box-shadow:0 7px 17px color-mix(in srgb,var(--mom) 15%,transparent)}.mf-pump-plan-panel .schedule-card.mf-r2-next>div:first-child,.mf-pump-plan-panel .schedule-card.pc-next>div:first-child,.mf-pump-plan-panel .schedule-card.pi-next>div:first-child{box-shadow:none;border-color:var(--surface)}.mf-dream-kicker{font-size:12px;letter-spacing:.02em;font-weight:700}.mf-dream-next>div span{font-size:11px;color:#fff6d9}.mf-dream-next>div strong{font-size:18px;line-height:1.15}.mf-dream-next>div small{font-size:11px;color:rgba(255,255,255,.9);line-height:1.3}.mf-dream-next button span{font-size:12px}
  .mf-journey-head strong{font:750 20px/1.12 var(--display);letter-spacing:-.025em}.mf-journey-head span{font-size:11.5px}.mf-dream-journey>p{font-size:12.5px;line-height:1.45;color:var(--ink-2)}.mf-journey-stop small{font-size:10.5px;color:var(--ink-2)}.mf-dream-actions .quick-tile strong{font-family:var(--display);font-size:20px;font-weight:750}.mf-dream-actions .quick-tile small{font-size:12px;opacity:.86}body[data-realm] .mf-dream-metrics .metric span{font-size:11px;color:var(--ink-2)}body[data-realm] .mf-dream-metrics .metric strong{font-size:21px}body[data-realm] .mf-dream-metrics .metric small{font-size:11px;color:var(--ink-2)}
  .mf-animal-copy .welcome{font-size:11px;line-height:1.25;letter-spacing:.01em}.mf-animal-copy h2{font-size:27px}.mf-animal-copy small{font-size:11px;line-height:1.25}.mf-care-label{font:750 14px/1.15 var(--display);letter-spacing:-.01em}.mf-care-label small{font-size:12px;color:var(--ink-2)}.mf-animal-checkin strong{font-size:15px}.mf-animal-checkin small{font-size:11px;opacity:.9}.mf-feed-card strong{font-size:15px;font-weight:800}.mf-feed-card small,.mf-diaper-blob span{font-size:11px}.mf-diaper-blob strong{font-size:16px}
  body[data-realm] .page-head h2{font-family:var(--display);font-weight:750;line-height:1.05}body[data-realm] .panel-head h3{font-family:var(--display);font-weight:750;font-size:20px;line-height:1.15}.page-head .eyebrow{font-size:11px;letter-spacing:.07em}.row-main strong{font-size:15px}.row-main span{font-size:11.5px;color:var(--ink-2);line-height:1.35}.pills button{font-size:13px;font-weight:750}.bottom-nav button{font-size:10.5px;color:var(--ink-2)}.schedule-card strong{font-size:14px}.schedule-card small{font-size:11px}.schedule-card em{font-size:10px}.metric span{font-size:11px;text-transform:none;letter-spacing:.01em}.metric small{font-size:11px}.daily-cell span,.daily-cell b small{font-size:10.5px}.qa-grid span{font-size:10.5px;text-transform:none;letter-spacing:.01em}.qa-grid small{font-size:11px}.stat-ring span,.stat-ring small{font-size:10px}.tl-ticks span,.cbar small,.chart-rail.dim,.donut-center span,.hbar small,.journey-legend span,.band em{font-size:10px;color:var(--ink-2)}.sheet-actions button span{font-size:10.5px;color:var(--ink-2)}
}
}
/* Stable shape before the first app render; avoid a square-to-rounded flash. */
.mf-animal-hero,.mf-dream-hero{border-radius:31px;overflow:hidden}
.mf-last-feed-value{display:grid;grid-template-columns:minmax(0,1fr) max-content;align-items:baseline;column-gap:8px;width:100%;white-space:normal;line-height:1.15}
.mf-last-feed-value b,.mf-last-feed-value em{display:inline-block;white-space:nowrap;font-style:normal}
.mf-last-feed-value em{text-align:right}
.mf-baby-timing{min-width:0;gap:10px}
.mf-last-feed-slot{min-width:0}
/* Image and caption have separate flow rows. Neither can overlap, even if an icon grows. */
.mf-feed-card,.mf-diaper-blob{box-sizing:border-box;height:132px;min-height:132px;display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:3px 4px 8px;text-align:center}
.mf-feed-card .mf-tile-picture,.mf-diaper-blob .mf-tile-picture{position:relative;z-index:1;flex:1 1 auto;min-height:0;width:100%;margin:0;display:grid;place-items:center}
.mf-feed-card .mf-tile-picture>span.mf-care-mark,.mf-diaper-blob .mf-tile-picture>span.mf-care-mark{position:relative;inset:auto;left:auto;top:auto;right:auto;transform:none;width:94px;height:94px;max-width:100%;max-height:100%;aspect-ratio:1;margin:0}
.mf-diaper-blob .mf-tile-picture>span.mf-care-mark{width:80px;height:80px}
.mf-feed-card .mf-tile-copy,.mf-diaper-blob .mf-tile-copy{position:relative;z-index:2;display:block;flex:0 0 auto;width:100%;margin:0;padding:0}
.mf-feed-card .mf-tile-copy strong,.mf-diaper-blob .mf-tile-copy strong{display:block;font-size:clamp(14px,4vw,19px);line-height:1.16;white-space:nowrap}
.mf-diaper-blob .mf-tile-title{display:flex;align-items:center;justify-content:center;gap:5px;margin:0}
.mf-diaper-blob .mf-tile-title>b{position:static;z-index:auto;display:grid;place-items:center;min-width:22px;width:22px;height:22px;padding:0;margin:0;border-radius:50%;font-size:12px;line-height:1}
.mf-diaper-blob .mf-tile-detail{display:block;margin:1px 0 0;font-size:11px;line-height:1.15;font-weight:800}
/* Mom's two primary actions are app-style image tiles: the illustration fills the picture
   area and the one useful label sits below it. No floating corner icon or duplicate hint. */
.mf-dream-actions .quick-tile{box-sizing:border-box;height:132px;min-height:132px;padding:99px 10px 8px;justify-content:flex-end;align-items:center;text-align:center}
.mf-dream-actions .quick-tile .tile-art{left:50%;right:auto;top:2px;transform:translateX(-50%);width:98px;height:98px;border-radius:50%}
.mf-dream-actions .quick-tile strong{font-size:20px;line-height:1.15}
/* The history rows carry their own activity color across the surface. */
/* One semantic palette paints the complete activity row, not only its little icon. */
body[data-realm] .rows .row[data-care-kind]{--care-fill:var(--care-milk);background-image:linear-gradient(130deg,color-mix(in srgb,var(--care-fill) 44%,var(--mf-world-surface,var(--surface))),color-mix(in srgb,var(--care-fill) 26%,var(--mf-world-surface,var(--surface))));border-color:color-mix(in srgb,var(--care-fill) 45%,var(--mf-world-surface,var(--surface)))}
body[data-realm] .rows .row[data-care-kind="milk"]{--care-fill:var(--care-milk)}
body[data-realm] .rows .row[data-care-kind="formula"]{--care-fill:var(--care-formula)}
body[data-realm] .rows .row[data-care-kind="nursing"]{--care-fill:var(--care-nursing)}
body[data-realm] .rows .row[data-care-kind="wet"]{--care-fill:var(--care-wet)}
body[data-realm] .rows .row[data-care-kind="poop"]{--care-fill:var(--care-poop)}
body[data-realm] .rows .row[data-care-kind="mixed"]{--care-fill:var(--care-mixed)}
body[data-realm] .rows .row[data-care-kind="sleep"]{--care-fill:var(--care-sleep)}
body[data-realm] .rows .row[data-care-kind="growth"]{--care-fill:var(--care-growth)}
body[data-realm] .rows .row[data-care-kind="milestone"]{--care-fill:var(--care-milestone)}
body[data-realm] .rows .row[data-care-kind="pump"]{--care-fill:var(--care-pump)}
:root[data-theme="dark"] body[data-realm] .rows .row[data-care-kind]{background-image:linear-gradient(130deg,color-mix(in srgb,var(--care-fill) 30%,var(--mf-world-surface,var(--surface))),color-mix(in srgb,var(--care-fill) 18%,var(--mf-world-surface,var(--surface))))}
body[data-screen="history"] .act-row,body[data-screen="baby-history"] .act-row{
  background:color-mix(in srgb,var(--c) 24%,var(--surface));
  border-color:color-mix(in srgb,var(--c) 43%,var(--line));
}
body[data-screen="history"] .act-row .act-main,body[data-screen="baby-history"] .act-row .act-main{background:transparent}
body[data-screen="history"] .act-row .act-icon,body[data-screen="baby-history"] .act-row .act-icon{background:color-mix(in srgb,var(--c) 24%,var(--surface))}
:root[data-theme="dark"] body:is([data-screen="history"],[data-screen="baby-history"]) .act-row{background:color-mix(in srgb,var(--c) 32%,#1b2030)}
@media(max-width:430px){.mf-last-feed-value{font-size:13px}}
`;
  document.head.appendChild(s);
}

function profilePhoto(src,kind){if(src)return `<img src="${esc(src)}" alt="${kind==='mom'?'Mom':'Baby'} profile photo">`;return `<span class="placeholder">${kind==='mom'?'♡':'☁︎'}</span>`;}

/* The nudge card. app.js decides IF and WHAT; this renders it, once, directly under the hero
   where it is the first thing read and the easiest thing to dismiss. */
function nudgeCard(realm){
  const n=window.MilkFlowNudges?.due?.(realm);
  if(!n)return '';
  return `<section class="mf-nudge ${esc(n.tone)}" role="status">
    <div class="mf-nudge-head"><span>${esc(n.eyebrow)}</span><button type="button" class="mf-nudge-x" data-nudge-dismiss="${esc(n.id)}" aria-label="${esc(n.dismiss)}">×</button></div>
    <strong>${esc(n.title)}</strong>
    <p>${esc(n.body)}</p>
    ${n.items&&n.items.length?`<ul>${n.items.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:''}
    <div class="mf-nudge-actions">
      <button type="button" class="mf-nudge-go" data-nudge-go="${esc(n.id)}" data-view="${esc(n.cta.view)}">${esc(n.cta.label)}</button>
      <button type="button" class="mf-nudge-later" data-nudge-dismiss="${esc(n.id)}">${esc(n.dismiss)}</button>
    </div>
  </section>`;
}

function renderMom(s){
  const view=document.getElementById('view'),hero=view?.querySelector('.mom-hero');if(!view||!hero)return;
  const g=positiveGreeting(),name=s.profile?.momName||'Mom',gl=greetingLine(name),photo=s.profile?.momPhoto||'',x=plan(s,prefs()),snap=momSnapshot(s,x),next=x.remaining&&x.future.length?`${to12(x.future[0]-10)}–${to12(x.future[0]+10)}`:'All done for today',progress=x.target?Math.min(100,Math.round(x.actual.length/x.target*100)):0;
  hero.classList.add('mf-dream-hero');
  hero.innerHTML=`
    <div class="mf-dream-main">
      <div class="mf-dream-welcome"><span>${g.mark}</span><b>${esc(gl.text)}</b>${(s.profile?.momName||'').trim()?'':'<button type="button" class="mf-name-cta" data-view="set-baby">Add your name</button>'}</div>
      <h2>${esc(momHeadline(x))}</h2>
      <div class="mf-hero-facts" aria-label="Today at a glance">
        <span class="mf-hero-fact"><small>Last pump</small><strong>${x.last?`${Number(x.last.amountMl)||0} mL`:'—'}</strong><em>${x.last?`${esc(relativeAgo(x.last.date||today(),x.last.time)||'')} · ${esc(to12(mins(x.last.time)))}`.replace(/^ · /,''):'Not yet today'}</em></span>
        <span class="mf-hero-fact"><small>Today</small><strong>${snap.total} mL · ${x.actual.length} of ${x.target}</strong></span>
      </div>
      <div class="mf-dream-next"><span>${x.remaining?'Next pump':'All done today'}</span><strong>${esc(next)}</strong></div>
    </div>
    <div class="mf-dream-side">
      <button type="button" class="mf-dream-photo" data-core-mom-photo style="--dream-p:${progress}%" aria-label="${photo?'Change Mom photo':'Add Mom photo'}">${profilePhoto(photo,'mom')}<i class="mf-dream-ring" aria-hidden="true"></i></button>
    </div>`;
  view.querySelector('.mom-grid')?.classList.add('mf-dream-actions');
  view.querySelector('.mom-summary')?.classList.add('mf-dream-metrics');
  let card=document.getElementById('mfCorePlan');
  if(!card){card=document.createElement('section');card.id='mfCorePlan';card.className='mf-core-plan';hero.insertAdjacentElement('afterend',card);}
  card.className='mf-core-plan mf-dream-journey';
  const stops=[...(x.actual||[]).map(e=>({kind:'done',time:mins(e.time),amount:Number(e.amountMl)||0})),...(x.future||[]).map((m,i)=>({kind:i===0?'next':'future',time:m}))];
  card.innerHTML=`<div class="mf-journey-head"><div><span>Today’s journey</span><strong>${x.remaining?'One gentle session at a time':'Today’s rhythm is complete'}</strong></div><em>${x.actual.length} of ${x.target}</em></div><div class="mf-journey-track">${stops.map((stop,i)=>`<div class="mf-journey-stop ${stop.kind}"><i>${stop.kind==='done'?'✓':stop.kind==='next'?'●':'○'}</i><strong>${to12(stop.time)}</strong><small>${stop.kind==='done'?`${stop.amount} mL`:stop.kind==='next'?'Next up':'Later'}</small></div>`).join('')}</div><p>${x.source==='override'?'Today’s times were adjusted for you.':x.source==='actual'&&x.last?`Spaced out from your ${to12(mins(x.last.time))} pump so the gaps stay comfortable.`:'Starts from your usual schedule and adjusts each time you log a pump.'}</p>`;
  /* Insert ONLY when it is not already in place. render-lifecycle.js watches #view's childList
     and re-runs this pass on every change, so re-inserting the card unconditionally made each
     render trigger the next one - an infinite loop that pegged the main thread and hung the
     visual QA for half an hour before it was spotted. Same reason the journey card above is
     created once and then only refilled. */
  let nudge=document.getElementById('mfMomNudge');
  const nudgeHtml=nudgeCard('mom');
  if(nudgeHtml){
    if(!nudge){nudge=document.createElement('div');nudge.id='mfMomNudge';}
    if(nudge.innerHTML!==nudgeHtml)nudge.innerHTML=nudgeHtml;
    if(nudge.previousElementSibling!==hero)hero.insertAdjacentElement('afterend',nudge);
  }else if(nudge)nudge.remove();
  maybeAskTomorrow(x);
}

function tomorrowPromptKey(){return `milkflow-pump-choice-${today()}`;}
function closeTomorrowPrompt(){const d=document.getElementById('mfTomorrowTargetDialog');if(d?.open)d.close();}
function maybeAskTomorrow(x){
  if(x.remaining>0||!x.actual.length||localStorage.getItem(tomorrowPromptKey()))return;
  let d=document.getElementById('mfTomorrowTargetDialog');
  if(!d){
    d=document.createElement('dialog');d.id='mfTomorrowTargetDialog';d.className='dialog mf-target-dialog';
    d.innerHTML=`<form method="dialog"><div class="dialog-head"><div><small>TODAY COMPLETE</small><h2>How many pumps tomorrow?</h2></div><button value="cancel" aria-label="Decide later">×</button></div><p>Today’s choice will not carry over. Pick tomorrow’s plan, or decide tomorrow.</p><div class="mf-target-options"><button type="button" data-tomorrow-target="6"><strong>6 pumps</strong><span>Usual plan</span></button><button type="button" data-tomorrow-target="5"><strong>5 pumps</strong><span>One-day plan</span></button></div><button class="mf-target-later" value="cancel">Decide tomorrow</button></form>`;
    document.body.appendChild(d);
    d.addEventListener('click',e=>{const b=e.target.closest('[data-tomorrow-target]');if(!b)return;const n=Number(b.dataset.tomorrowTarget);setDayTarget(dateShift(1),n);localStorage.setItem(tomorrowPromptKey(),String(n));closeTomorrowPrompt();window.dispatchEvent(new CustomEvent('milkflow:tomorrow-target',{detail:{date:dateShift(1),target:n}}));});
    d.addEventListener('close',()=>{if(!localStorage.getItem(tomorrowPromptKey()))localStorage.setItem(tomorrowPromptKey(),'later');});
  }
  if(!d.open)try{d.showModal();}catch{}
}

function renderBaby(s){
  const view=document.getElementById('view');if(!view)return;
  const st=babyCareStats(s),snap=babySnapshot(s,st),nextFeed=predictNextFeed(s),g=positiveGreeting(),gl=greetingLine(s.profile?.momName),babyName=s.baby?.name||'Baby',photo=s.baby?.photo||'',age=ageLabel(s.baby?.birthDate),lf=lastFeedText(lastFeed(s));
  let box=document.getElementById('mfCoreBaby');if(!box){box=document.createElement('section');box.id='mfCoreBaby';box.className='mf-core-baby';view.prepend(box);}
  const feedCount=st.milkCount+st.nursingCount+st.formulaCount;
  const last=lastFeed(s),lastAge=last?compactRelativeAgo(last.date,last.time).replace(/ ago$/,''):'Nothing yet';
  const sleepStart=s.baby?.activeSleep?.date&&s.baby?.activeSleep?.time?new Date(`${s.baby.activeSleep.date}T${s.baby.activeSleep.time}:00`):null;
  const sleepElapsed=sleepStart&&Number.isFinite(sleepStart.getTime())?Math.max(0,Math.round((Date.now()-sleepStart.getTime())/60000)):null;
  const sleepLabel=sleepElapsed==null?'Sleep':sleepElapsed<60?`Sleep ${sleepElapsed}m`:`Sleep ${Math.floor(sleepElapsed/60)}h ${sleepElapsed%60}m`;
  const babyMeta=age;
  const todayBits=[
    feedCount?`${feedCount} feed${feedCount===1?'':'s'}`:'No feeds yet',
    snap.todayOz>0?`${snap.todayOz.toFixed(1)} oz bottles`:'',
    `${snap.diapers} diaper${snap.diapers===1?'':'s'}`
  ].filter(Boolean);
  const wish=babyWishLine(babyName,nextFeed,feedCount);
  box.innerHTML=`
    <div class="mf-animal-hero">
      <span class="mf-animal-star one" aria-hidden="true">✦</span><span class="mf-animal-star two" aria-hidden="true">✧</span>
      <div class="mf-animal-profile">
        <div class="mf-animal-copy">
          <div class="welcome">${g.mark} ${esc(gl.text)}${(s.profile?.momName||'').trim()?'':'<button type="button" class="mf-name-cta" data-view="set-baby">Add your name</button>'}</div>
          <h2>${esc(babyName)}${babyMeta?`<i>${esc(babyMeta)}</i>`:''}</h2>
          ${wish?`<p class="mf-baby-wish">${esc(wish)}</p>`:''}
          <p class="mf-baby-todayline">${todayBits.map(esc).join(' · ')}</p>
          <div class="mf-baby-timing" aria-label="Baby feeding timing">
            <span class="mf-last-feed-slot"><small>Last feed</small><strong class="mf-last-feed-value"><b>${esc(lastAge)}</b>${last?`<em>${esc(lf.clock)}</em>`:''}</strong></span>
            <span class="${nextFeed&&nextFeed.overdue?'due':''}"><small>${nextFeed&&nextFeed.overdue?'Feed window':'Next feed'}</small><strong>${nextFeed?esc(nextFeed.label):'Learning'}</strong></span>
          </div>
        </div>
        <button type="button" class="mf-profile-photo addable" data-photo aria-label="${photo?'Change Baby photo':'Add Baby photo'}">${profilePhoto(photo,'baby')}${photo?'':'<span class="mf-photo-add">+ Photo</span>'}</button>
      </div>
    </div>

    ${nudgeCard('baby')}

    <div class="mf-care-label"><span>Feed</span><small>Quick log</small></div>
    <div class="mf-feed-zone">
      <button type="button" class="mf-feed-card milk" data-feed-type="expressed_milk" aria-label="Log breast milk bottle"><span class="mf-tile-picture">${careMark('milk')}</span><span class="mf-tile-copy"><strong>Breast milk</strong></span></button>
      <button type="button" class="mf-feed-card nurse" data-feed-type="nursing" aria-label="Log nursing"><span class="mf-tile-picture">${careMark('nurse')}</span><span class="mf-tile-copy"><strong>Nurse</strong></span></button>
      <button type="button" class="mf-feed-card formula" data-feed-type="formula" aria-label="Log formula"><span class="mf-tile-picture">${careMark('formula')}</span><span class="mf-tile-copy"><strong>Formula</strong></span></button>
    </div>

    <div class="mf-care-label"><span>Diapers</span><small>${st.diaperCount?`${st.diaperCount} today`:'Quick log'}</small></div>
    <div class="mf-diaper-cluster">
      <button type="button" class="mf-diaper-blob wet" data-diaper="wet" aria-label="Log wet diaper"><span class="mf-tile-picture">${careMark('wet')}</span><span class="mf-tile-copy"><span class="mf-tile-title"><strong>Wet</strong><b>${st.wet}</b></span><span class="mf-tile-detail">diaper</span></span></button>
      <button type="button" class="mf-diaper-blob poop" data-diaper="poop" aria-label="Log poopy diaper"><span class="mf-tile-picture">${careMark('poop')}</span><span class="mf-tile-copy"><span class="mf-tile-title"><strong>Poopy</strong><b>${st.poop}</b></span><span class="mf-tile-detail">diaper</span></span></button>
      <button type="button" class="mf-diaper-blob both" data-diaper="both" aria-label="Log mixed diaper"><span class="mf-tile-picture">${careMark('mixed')}</span><span class="mf-tile-copy"><span class="mf-tile-title"><strong>Mixed</strong><b>${st.both}</b></span><span class="mf-tile-detail">wet + poopy</span></span></button>
    </div>

    <div class="mf-care-ribbon" aria-label="More baby care">
      <button type="button" data-sleep class="${sleepElapsed!=null?'sleep-live':''}">${icon('moon')} <span>${esc(sleepLabel)}</span></button>
      <button type="button" data-growth>${icon('growth')} Growth</button>
      <button type="button" data-view="baby-history">History</button>
      <button type="button" data-view="baby-trends">Trends</button>
    </div>`;
}

function cleanup(){
  if(document.body.dataset.screen!=='mom-home'){document.getElementById('mfCorePlan')?.remove();document.getElementById('mfMomProfileLine')?.remove();document.getElementById('mfMomOrbs')?.remove();}
  if(document.body.dataset.screen!=='baby-home')document.getElementById('mfCoreBaby')?.remove();
}
function decorateApp(){
  const screen=document.body.dataset.screen||'',baby=screen.startsWith('baby-')||screen==='development'||screen==='doctor',mom=screen.startsWith('mom-');
  document.body.dataset.realm=baby?'baby':mom?'mom':'family';
  const head=document.querySelector('#view .page-head');if(!head||head.querySelector('.mf-section-animal,.mf-head-dream,.mf-section-motif'))return;
  /* Section headers used to show an unrelated stock animal - a whale on Trends, a fox on
     Doctor - that belonged to no theme. They now carry the selected world's own motif. */
  if(baby&&screen!=='baby-trends'){const motif=window.MilkFlowExperience?.themeMotif?.();
    if(motif)head.insertAdjacentHTML('beforeend',`<img class="mf-section-motif" src="${esc(motif)}" alt="" decoding="async">`);}
  else if(mom&&screen!=='mom-trends')head.insertAdjacentHTML('beforeend','<span class="mf-head-dream" aria-hidden="true">✦ · ✧</span>');
}
function apply(){if(applying)return;applying=true;try{addStyles();const s=read();cleanup();decorateApp();if(document.body.dataset.screen==='mom-home')renderMom(s);if(document.body.dataset.screen==='baby-home')renderBaby(s);}finally{applying=false;}}
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
/* Care icons are resolved during render, so a world change has to re-run it. */
window.addEventListener('milkflow:experience-theme-change',afterApp);
window.addEventListener('milkflow:chat-data',afterApp);

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterApp,{once:true});else afterApp();
setInterval(()=>{if(document.body.dataset.screen==='mom-home'||document.body.dataset.screen==='baby-home')apply();},60000);
})();
