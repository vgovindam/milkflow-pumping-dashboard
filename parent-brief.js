(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const PREF_KEY='milkflow-parent-brief-v1';
const DAY=86400000;
const MIN_GAP=3*DAY;
const ROLLING_WINDOW=7*DAY;
const MAX_SHOWS_PER_WINDOW=2;
const REPEAT_SUPPRESS=12*DAY;
const MAX_CARDS=2;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));
const mean=a=>a.length?a.reduce((s,v)=>s+(Number(v)||0),0)/a.length:0;
const pct=(a,b)=>b?((a-b)/b)*100:null;
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dateKey(new Date());

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function readPref(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{return {};}}
function writePref(p){try{localStorage.setItem(PREF_KEY,JSON.stringify(p));}catch{}}
function ageDays(birthDate){if(!birthDate)return null;const d=new Date(`${birthDate}T12:00:00`);if(Number.isNaN(+d))return null;return Math.max(0,Math.floor((Date.now()-d.getTime())/DAY));}
function completeDates(days=14){const out=[];const t=new Date(`${today()}T12:00:00`);for(let i=days;i>=1;i--){const d=new Date(t);d.setDate(d.getDate()-i);out.push(dateKey(d));}return out;}

function babyRows(s){
  const dates=completeDates(14),id=s.baby?.id||null,events=(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!id||!e.babyId||e.babyId===id));
  return dates.map(date=>{
    const list=events.filter(e=>e.date===date),feeds=list.filter(e=>e.eventType==='feeding'),nursing=list.filter(e=>e.eventType==='nursing'),diapers=list.filter(e=>e.eventType==='diaper'),sleep=list.filter(e=>e.eventType==='sleep');
    const bottleOz=feeds.reduce((x,e)=>x+(Number(e.amountOz)||0),0),wet=diapers.filter(e=>['wet','both','mixed'].includes(String(e.subtype||'').toLowerCase())).length,poop=diapers.filter(e=>['poop','dirty','both','mixed'].includes(String(e.subtype||'').toLowerCase())).length,sleepMin=sleep.reduce((x,e)=>x+(Number(e.durationMinutes)||0),0);
    return{date,feeds:feeds.length+nursing.length,bottleFeeds:feeds.length,bottleOz,wet,poop,sleepMin,logged:list.length>0,events:list};
  }).filter(r=>r.logged);
}
function pumpRows(s){
  const dates=completeDates(14),entries=(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt);
  return dates.map(date=>{const list=entries.filter(e=>e.date===date),totalMl=list.reduce((x,e)=>x+(Number(e.amountMl)||0),0);return{date,count:list.length,totalMl,logged:list.length>0};}).filter(r=>r.logged);
}
function compareRecent(rows,key,minAbsPct=15){
  if(rows.length<6)return null;
  const recent=rows.slice(-3),prior=rows.slice(-6,-3),r=mean(recent.map(x=>x[key])),p=mean(prior.map(x=>x[key])),change=p?pct(r,p):null;
  if(change==null||Math.abs(change)<minAbsPct)return null;
  return{recent:r,prior:p,change};
}
function clusterDays(rows){
  let count=0;
  for(const row of rows.slice(-7)){
    const times=(row.events||[]).filter(e=>e.eventType==='feeding'||e.eventType==='nursing').map(e=>{const [h,m]=String(e.time||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;}).filter(Number.isFinite).sort((a,b)=>a-b);
    let clustered=false;
    for(let i=0;i<times.length-2;i++)if(times[i+2]-times[i]<=180){clustered=true;break;}
    if(clustered)count++;
  }
  return count;
}
function card({kind,priority,title,observed,meaning,suggestion,route}){return{kind,priority,title,observed,meaning,suggestion,route};}
function ageCard(s){
  const days=ageDays(s.baby?.birthDate);if(days==null)return null;
  const weeks=Math.floor(days/7),name=s.baby?.name||'Baby';
  if(days<120)return card({kind:'age',priority:20,title:`Around ${weeks} weeks`,observed:`${name} is about ${weeks} weeks old.`,meaning:'Feeding and sleep can still change quickly at this age, so one unusual day rarely tells the whole story.',suggestion:'Follow feeding cues, keep safe-sleep habits, and look for patterns that repeat across several days.',route:'baby-trends'});
  if(days<180)return card({kind:'age',priority:20,title:`Around ${weeks} weeks`,observed:`${name} is about ${weeks} weeks old.`,meaning:'Daily routines may be becoming more recognizable, while normal variation can still be substantial.',suggestion:'Watch for repeated changes in feeding, sleep, diapers and growth rather than chasing a rigid schedule.',route:'baby-trends'});
  return card({kind:'age',priority:20,title:`Around ${weeks} weeks`,observed:`${name} is about ${weeks} weeks old.`,meaning:'As routines evolve, trends across several completed days become more useful than individual days.',suggestion:'Use Trends to follow feeding, sleep, diapers, growth and milestones; bring concerns to your pediatrician.',route:'baby-trends'});
}
function buildCards(s){
  const cards=[],baby=babyRows(s),pumps=pumpRows(s),name=s.baby?.name||'Baby';
  const feed=compareRecent(baby,'feeds',18);
  if(feed)cards.push(card({kind:'feeding-shift',priority:95,title:'Feeding rhythm changed',observed:`The last 3 completed days averaged ${feed.recent.toFixed(1)} feeds or nursing sessions/day vs ${feed.prior.toFixed(1)} before (${Math.abs(feed.change).toFixed(0)}% ${feed.change>0?'higher':'lower'}).`,meaning:'Because it repeated across completed days, this is more useful than a single busy or quiet day.',suggestion:'Keep feeding responsively and watch whether the new rhythm continues over the next few days.',route:'baby-trends'}));
  const bottle=compareRecent(baby,'bottleOz',20);
  if(bottle&&Math.max(bottle.recent,bottle.prior)>=4)cards.push(card({kind:'bottle-shift',priority:82,title:'Bottle pattern shifted',observed:`Logged bottle volume averaged ${bottle.recent.toFixed(1)} oz/day over the last 3 completed days vs ${bottle.prior.toFixed(1)} oz/day before.`,meaning:'This is a repeated logged pattern, not a judgment about whether intake is medically adequate.',suggestion:`Watch feeding cues, diapers and how ${name} seems overall; use Trends for the day-by-day detail.`,route:'baby-trends'}));
  const wet=compareRecent(baby,'wet',25);
  if(wet&&Math.max(wet.recent,wet.prior)>=2)cards.push(card({kind:'wet-shift',priority:88,title:'Wet-diaper pattern changed',observed:`Wet diapers averaged ${wet.recent.toFixed(1)}/day over the last 3 completed days vs ${wet.prior.toFixed(1)}/day before.`,meaning:'A repeated diaper change can be useful context alongside feeding, but MilkFlow does not diagnose hydration from counts alone.',suggestion:`Watch feeding and how ${name} seems overall; contact the pediatrician if you are worried about hydration or wellbeing.`,route:'baby-trends'}));
  const sleep=compareRecent(baby.filter(r=>r.sleepMin>0),'sleepMin',20);
  if(sleep&&Math.max(sleep.recent,sleep.prior)>=120)cards.push(card({kind:'sleep-shift',priority:72,title:'Logged sleep shifted',observed:`Completed days with sleep logged changed by about ${Math.abs(sleep.change).toFixed(0)}% in the recent 3-day window.`,meaning:'This can flag a routine change, but logged duration alone cannot measure sleep quality or safety.',suggestion:'Look for whether the shift repeats and keep safe-sleep practices consistent.',route:'baby-trends'}));
  const clusters=clusterDays(baby);
  if(clusters>=2)cards.push(card({kind:'cluster-feeding',priority:90,title:'Clustered feeding is repeating',observed:`MilkFlow found 3+ feeding or nursing starts within 3 hours on ${clusters} of the last 7 completed logged days.`,meaning:'A repeating cluster is useful planning context, but it does not by itself mean intake or milk supply is inadequate.',suggestion:'Follow feeding cues and expect some parts of the day to be busier; Trends can show when the clusters happen.',route:'baby-trends'}));
  const output=compareRecent(pumps,'totalMl',12);
  if(output&&Math.max(output.recent,output.prior)>=100)cards.push(card({kind:'pump-output',priority:78,title:'Pumping output shifted',observed:`The last 3 completed pumping days averaged ${Math.round(output.recent)} mL/day vs ${Math.round(output.prior)} mL/day before (${Math.abs(output.change).toFixed(0)}% ${output.change>0?'higher':'lower'}).`,meaning:'Today is excluded until it is complete, so this is not an artificial mid-day drop.',suggestion:'Watch whether the pattern continues and consider session timing, duration and pump count when reviewing Trends.',route:'mom-trends'}));
  const count=compareRecent(pumps,'count',20);
  if(count&&Math.abs(count.recent-count.prior)>=0.75)cards.push(card({kind:'pump-count',priority:68,title:'Pumping rhythm changed',observed:`You averaged ${count.recent.toFixed(1)} pumps/day over the last 3 completed days vs ${count.prior.toFixed(1)} previously.`,meaning:'That change can explain part of an output shift and is separate from any one-day target override.',suggestion:'Check whether this matches your intended normal pump target and adjust the permanent setting if your routine has changed.',route:'mom-trends'}));
  const age=ageCard(s);if(age)cards.push(age);
  return cards.sort((a,b)=>b.priority-a.priority);
}
function signature(cards){return cards.slice(0,MAX_CARDS).map(c=>c.kind).join('|');}
function eligible(cards){
  if(!cards.length)return false;
  const p=readPref(),now=Date.now(),shows=(Array.isArray(p.shows)?p.shows:[]).filter(t=>now-Number(t)<ROLLING_WINDOW);
  if(shows.length>=MAX_SHOWS_PER_WINDOW)return false;
  if(shows.length&&now-shows.at(-1)<MIN_GAP)return false;
  const sig=signature(cards),seen=p.seen||{};
  if(seen[sig]&&now-Number(seen[sig])<REPEAT_SUPPRESS)return false;
  const meaningful=cards.some(c=>c.priority>=60);
  if(!meaningful&&shows.length)return false;
  return true;
}
function markShown(cards){
  const p=readPref(),now=Date.now(),shows=(Array.isArray(p.shows)?p.shows:[]).filter(t=>now-Number(t)<ROLLING_WINDOW);shows.push(now);
  const seen={...(p.seen||{}),[signature(cards)]:now};for(const [k,v] of Object.entries(seen))if(now-Number(v)>30*DAY)delete seen[k];
  writePref({...p,shows,seen,lastShownAt:now});
}
function injectStyle(){
  if(document.getElementById('mfParentBriefStyle'))return;
  const el=document.createElement('style');el.id='mfParentBriefStyle';el.textContent=`
.mf-parent-brief{border:0;padding:0;background:transparent;max-width:none;width:auto}.mf-parent-brief::backdrop{background:rgba(17,21,31,.44);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
.mf-parent-brief-card{width:min(92vw,500px);max-height:min(82vh,720px);overflow:auto;border:1px solid color-mix(in srgb,var(--line,#e6e8f0) 82%,transparent);border-radius:24px;background:color-mix(in srgb,var(--surface,#fff) 96%,transparent);color:var(--ink,#20202a);box-shadow:0 26px 70px rgba(18,22,32,.24);padding:18px}
.mf-parent-brief-head{display:grid;grid-template-columns:minmax(0,1fr) 36px;gap:12px;align-items:start}.mf-parent-brief-kicker{display:inline-flex;align-items:center;gap:6px;width:max-content;padding:5px 9px;border-radius:999px;background:color-mix(in srgb,var(--mom,#7653c6) 11%,transparent);color:var(--mom-ink,var(--mom,#7653c6));font-size:.63rem;font-weight:950;letter-spacing:.075em;text-transform:uppercase}.mf-parent-brief h2{margin:9px 0 4px;font-size:1.22rem;line-height:1.12;letter-spacing:-.025em}.mf-parent-brief-sub{margin:0;color:var(--muted,#6f6d78);font-size:.72rem;line-height:1.42;max-width:44ch}.mf-parent-brief-close{border:1px solid var(--line-soft,#e8e4ed);background:var(--surface-2,#f4f2f7);color:var(--ink-2,#444);width:36px;height:36px;border-radius:50%;font-size:1.12rem;line-height:1}
.mf-parent-brief-items{display:grid;gap:9px;margin:15px 0}.mf-parent-brief-item{position:relative;padding:13px 14px 13px 16px;border-radius:18px;background:color-mix(in srgb,var(--surface-2,#f7f5fa) 90%,transparent);border:1px solid var(--line-soft,#e8e4ed)}.mf-parent-brief-item::before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:3px;border-radius:99px;background:var(--mom,#7653c6)}.mf-parent-brief-item h3{margin:0 0 9px;padding-left:2px;font-size:.9rem;line-height:1.2;letter-spacing:-.01em}.mf-parent-brief-line{display:grid;grid-template-columns:72px minmax(0,1fr);gap:8px;align-items:start;margin-top:6px}.mf-parent-brief-line b{font-size:.62rem;letter-spacing:.045em;text-transform:uppercase;color:var(--ink-2,#505466)}.mf-parent-brief-line span{color:var(--muted,#66636f);font-size:.71rem;line-height:1.42}.mf-parent-brief-line.next span{color:var(--ink-2,#505466);font-weight:700}
.mf-parent-brief-actions{display:grid;grid-template-columns:auto minmax(132px,1fr);gap:8px;align-items:center}.mf-parent-brief-actions button{border:0;border-radius:13px;min-height:42px;padding:9px 13px;font:inherit;font-size:.74rem;font-weight:900}.mf-parent-brief-later{background:transparent;color:var(--muted,#666);padding-inline:10px}.mf-parent-brief-view{background:var(--ink,#20202a);color:var(--on-ink,#fff);box-shadow:0 8px 18px rgba(20,24,36,.14)}
@media(max-width:700px){.mf-parent-brief-card{width:calc(100vw - 22px);border-radius:23px;padding:16px}.mf-parent-brief-line{grid-template-columns:66px minmax(0,1fr)}.mf-parent-brief-actions{grid-template-columns:1fr 1.35fr}.mf-parent-brief-actions button{min-height:44px}}
`;document.head.appendChild(el);
}
function show(cards){
  if(!cards.length)return;
  injectStyle();
  const top=cards.slice(0,MAX_CARDS),existing=document.getElementById('mfParentBrief');if(existing)existing.remove();
  const d=document.createElement('dialog');d.id='mfParentBrief';d.className='mf-parent-brief';
  d.innerHTML=`<div class="mf-parent-brief-card"><div class="mf-parent-brief-head"><div><div class="mf-parent-brief-kicker">✦ Parent brief</div><h2>A couple of things worth noticing</h2><p class="mf-parent-brief-sub">Completed-day signals only. Short, suggestive and meant to help you know what to watch next.</p></div><button class="mf-parent-brief-close" type="button" aria-label="Close">×</button></div><div class="mf-parent-brief-items">${top.map(c=>`<article class="mf-parent-brief-item"><h3>${esc(c.title)}</h3><div class="mf-parent-brief-line"><b>Observed</b><span>${esc(c.observed)}</span></div><div class="mf-parent-brief-line"><b>Why</b><span>${esc(c.meaning)}</span></div><div class="mf-parent-brief-line next"><b>Watch / try</b><span>${esc(c.suggestion)}</span></div></article>`).join('')}</div><div class="mf-parent-brief-actions"><button type="button" class="mf-parent-brief-later">Got it</button><button type="button" class="mf-parent-brief-view">See trends</button></div></div>`;
  document.body.appendChild(d);
  const close=()=>{try{d.close();}catch{}d.remove();};
  d.querySelector('.mf-parent-brief-close').addEventListener('click',close);
  d.querySelector('.mf-parent-brief-later').addEventListener('click',close);
  d.querySelector('.mf-parent-brief-view').addEventListener('click',()=>{const route=top[0]?.route||'baby-trends';close();location.hash=`#${route}`;});
  d.addEventListener('cancel',e=>{e.preventDefault();close();});
  markShown(cards);
  try{d.showModal();}catch{d.setAttribute('open','');}
}
function maybeShow(){const s=readState(),cards=buildCards(s);if(eligible(cards))show(cards);}
function schedule(){setTimeout(maybeShow,1600);}
window.MilkFlowParentBrief={build:()=>buildCards(readState()),showNow:()=>show(buildCards(readState()))};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('pageshow',()=>setTimeout(maybeShow,1200));
})();
