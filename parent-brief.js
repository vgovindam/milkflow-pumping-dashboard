(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const PREF_KEY='milkflow-parent-brief-v1';
const DAY=86400000;
const MIN_GAP=3*DAY;
const ROLLING_WINDOW=7*DAY;
const MAX_SHOWS_PER_WINDOW=2;
const REPEAT_SUPPRESS=12*DAY;
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const mean=a=>a.length?a.reduce((s,v)=>s+(Number(v)||0),0)/a.length:0;
const pct=(a,b)=>b?((a-b)/b)*100:null;
const pad=n=>String(n).padStart(2,'0');
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const today=()=>dateKey(new Date());

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function readPref(){try{return JSON.parse(localStorage.getItem(PREF_KEY)||'{}')||{};}catch{return {};}}
function writePref(p){try{localStorage.setItem(PREF_KEY,JSON.stringify(p));}catch{}}
function dayDiff(a,b){return(Math.abs(new Date(`${a}T12:00:00`)-new Date(`${b}T12:00:00`))/DAY);}
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
  if(rows.length<6)return null;const recent=rows.slice(-3),prior=rows.slice(-6,-3),r=mean(recent.map(x=>x[key])),p=mean(prior.map(x=>x[key])),change=p?pct(r,p):null;if(change==null||Math.abs(change)<minAbsPct)return null;return{recent:r,prior:p,change};
}
function clusterDays(rows){
  let count=0;
  for(const row of rows.slice(-7)){
    const times=(row.events||[]).filter(e=>e.eventType==='feeding'||e.eventType==='nursing').map(e=>{const [h,m]=String(e.time||'').split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;}).filter(Number.isFinite).sort((a,b)=>a-b);
    let clustered=false;for(let i=0;i<times.length-2;i++)if(times[i+2]-times[i]<=180){clustered=true;break;}if(clustered)count++;
  }
  return count;
}
function ageCard(s){
  const days=ageDays(s.baby?.birthDate);if(days==null)return null;const weeks=Math.floor(days/7),name=s.baby?.name||'Baby';
  let body;
  if(days<120)body=`${name} is about ${weeks} weeks old. Feeding and sleep can still shift quickly at this stage, so look for multi-day patterns rather than judging one day. Responsive feeding cues and safe sleep remain more useful than chasing a rigid schedule.`;
  else if(days<180)body=`${name} is about ${weeks} weeks old. Routines may become more recognizable, but day-to-day variation is still normal. MilkFlow should help you notice repeated changes in feeding, sleep, diapers, and growth rather than treating one unusual day as a trend.`;
  else body=`${name} is about ${weeks} weeks old. As routines evolve, use MilkFlow to watch the direction of feeding, sleep, diapers, growth, and milestones over several completed days. Age guidance is educational and does not replace your pediatrician’s advice.`;
  return{kind:'age',priority:20,title:`What to watch around ${weeks} weeks`,body,route:'baby-trends'};
}
function buildCards(s){
  const cards=[],baby=babyRows(s),pumps=pumpRows(s),name=s.baby?.name||'Baby';
  const feed=compareRecent(baby,'feeds',18);if(feed)cards.push({kind:'feeding-shift',priority:95,title:`${name}’s feeding pattern changed`,body:`The last 3 completed days averaged ${feed.recent.toFixed(1)} logged feeds/nursing sessions per day versus ${feed.prior.toFixed(1)} in the previous 3 completed days (${Math.abs(feed.change).toFixed(0)}% ${feed.change>0?'higher':'lower'}). That is a real multi-day change, not today’s partial count.`,route:'baby-trends'});
  const bottle=compareRecent(baby,'bottleOz',20);if(bottle&&Math.max(bottle.recent,bottle.prior)>=4)cards.push({kind:'bottle-shift',priority:82,title:'Bottle intake shifted over several days',body:`Logged bottle volume averaged ${bottle.recent.toFixed(1)} oz/day over the last 3 completed days versus ${bottle.prior.toFixed(1)} oz/day in the prior 3. MilkFlow is treating this as a pattern change, not a single low or high day.`,route:'baby-trends'});
  const wet=compareRecent(baby,'wet',25);if(wet&&Math.max(wet.recent,wet.prior)>=2)cards.push({kind:'wet-shift',priority:88,title:'Wet-diaper pattern changed',body:`Logged wet diapers averaged ${wet.recent.toFixed(1)}/day over the last 3 completed days versus ${wet.prior.toFixed(1)}/day before that. This is worth noticing alongside feeding and how ${name} seems overall; the app does not diagnose hydration from diaper counts alone.`,route:'baby-trends'});
  const sleep=compareRecent(baby.filter(r=>r.sleepMin>0),'sleepMin',20);if(sleep&&Math.max(sleep.recent,sleep.prior)>=120)cards.push({kind:'sleep-shift',priority:72,title:'Logged sleep pattern shifted',body:`On completed days with sleep logged, the recent 3-day average changed by about ${Math.abs(sleep.change).toFixed(0)}%. Use this as a routine signal, not a sleep-quality diagnosis.`,route:'baby-trends'});
  const clusters=clusterDays(baby);if(clusters>=2)cards.push({kind:'cluster-feeding',priority:90,title:'A clustered-feeding pattern is repeating',body:`MilkFlow found 3 or more feeding/nursing starts within a 3-hour span on ${clusters} of the last 7 completed logged days. Repeated clustering can be useful context when planning your day, but it does not by itself mean intake or supply is inadequate.`,route:'baby-trends'});
  const output=compareRecent(pumps,'totalMl',12);if(output&&Math.max(output.recent,output.prior)>=100)cards.push({kind:'pump-output',priority:78,title:'Your pumping output shifted',body:`The last 3 completed pumping days averaged ${Math.round(output.recent)} mL/day versus ${Math.round(output.prior)} mL/day in the previous 3 (${Math.abs(output.change).toFixed(0)}% ${output.change>0?'higher':'lower'}). Today is intentionally excluded until the day is complete.`,route:'mom-trends'});
  const count=compareRecent(pumps,'count',20);if(count&&Math.abs(count.recent-count.prior)>=0.75)cards.push({kind:'pump-count',priority:68,title:'Your pumping rhythm changed',body:`You averaged ${count.recent.toFixed(1)} pumps/day across the last 3 completed days versus ${count.prior.toFixed(1)} previously. MilkFlow separates that completed-day pattern from any temporary target you may be using today.`,route:'mom-trends'});
  const age=ageCard(s);if(age)cards.push(age);
  return cards.sort((a,b)=>b.priority-a.priority);
}
function signature(cards){return cards.slice(0,3).map(c=>c.kind).join('|');}
function eligible(cards){
  if(!cards.length)return false;const p=readPref(),now=Date.now(),shows=(Array.isArray(p.shows)?p.shows:[]).filter(t=>now-Number(t)<ROLLING_WINDOW);if(shows.length>=MAX_SHOWS_PER_WINDOW)return false;if(shows.length&&now-shows.at(-1)<MIN_GAP)return false;const sig=signature(cards),seen=p.seen||{};if(seen[sig]&&now-Number(seen[sig])<REPEAT_SUPPRESS)return false;const meaningful=cards.some(c=>c.priority>=60);if(!meaningful&&shows.length)return false;return true;
}
function markShown(cards){const p=readPref(),now=Date.now(),shows=(Array.isArray(p.shows)?p.shows:[]).filter(t=>now-Number(t)<ROLLING_WINDOW);shows.push(now);const seen={...(p.seen||{}),[signature(cards)]:now};for(const [k,v] of Object.entries(seen))if(now-Number(v)>30*DAY)delete seen[k];writePref({...p,shows,seen,lastShownAt:now});}
function injectStyle(){if(document.getElementById('mfParentBriefStyle'))return;const el=document.createElement('style');el.id='mfParentBriefStyle';el.textContent=`
.mf-parent-brief{border:0;padding:0;background:transparent;max-width:none;width:auto}.mf-parent-brief::backdrop{background:rgba(18,22,32,.48);backdrop-filter:blur(3px)}.mf-parent-brief-card{width:min(92vw,520px);max-height:min(78vh,720px);overflow:auto;border-radius:26px;background:var(--surface,#fff);color:var(--ink,#20202a);box-shadow:0 28px 80px rgba(18,22,32,.3);padding:20px}.mf-parent-brief-head{display:flex;gap:12px;align-items:flex-start}.mf-parent-brief-head>div{flex:1}.mf-parent-brief-kicker{font-size:.68rem;font-weight:900;letter-spacing:.08em;text-transform:uppercase;color:var(--mom,#7653c6)}.mf-parent-brief h2{margin:3px 0 5px;font-size:1.28rem;line-height:1.15}.mf-parent-brief-sub{margin:0;color:var(--muted,#6f6d78);font-size:.78rem;line-height:1.45}.mf-parent-brief-close{border:0;background:var(--surface-2,#f4f2f7);color:var(--ink,#222);width:38px;height:38px;border-radius:13px;font-size:1.25rem}.mf-parent-brief-items{display:grid;gap:10px;margin:16px 0}.mf-parent-brief-item{padding:13px 14px;border-radius:17px;background:var(--surface-2,#f7f5fa);border:1px solid var(--line-soft,#e8e4ed)}.mf-parent-brief-item strong{display:block;font-size:.86rem;margin-bottom:4px}.mf-parent-brief-item p{margin:0;color:var(--muted,#66636f);font-size:.75rem;line-height:1.48}.mf-parent-brief-actions{display:flex;gap:8px;justify-content:flex-end}.mf-parent-brief-actions button{border:0;border-radius:14px;padding:10px 14px;font:inherit;font-size:.76rem;font-weight:850}.mf-parent-brief-later{background:var(--surface-2,#f4f2f7);color:var(--ink,#222)}.mf-parent-brief-view{background:var(--mom,#7653c6);color:#fff}@media(max-width:700px){.mf-parent-brief-card{width:calc(100vw - 24px);border-radius:24px;padding:18px}.mf-parent-brief-actions{justify-content:stretch}.mf-parent-brief-actions button{flex:1}}
`;document.head.appendChild(el);}
function show(cards){
  injectStyle();const top=cards.slice(0,3),existing=document.getElementById('mfParentBrief');if(existing)existing.remove();const d=document.createElement('dialog');d.id='mfParentBrief';d.className='mf-parent-brief';d.innerHTML=`<div class="mf-parent-brief-card"><div class="mf-parent-brief-head"><div><div class="mf-parent-brief-kicker">MilkFlow Parent Brief</div><h2>What changed and what matters</h2><p class="mf-parent-brief-sub">Based on completed logged days. Today stays live, but it does not pull your trend down before the day is over.</p></div><button class="mf-parent-brief-close" type="button" aria-label="Close">×</button></div><div class="mf-parent-brief-items">${top.map(c=>`<article class="mf-parent-brief-item"><strong>${esc(c.title)}</strong><p>${esc(c.body)}</p></article>`).join('')}</div><div class="mf-parent-brief-actions"><button type="button" class="mf-parent-brief-later">Got it</button><button type="button" class="mf-parent-brief-view">View trends</button></div></div>`;document.body.appendChild(d);const close=()=>{try{d.close();}catch{}d.remove();};d.querySelector('.mf-parent-brief-close').addEventListener('click',close);d.querySelector('.mf-parent-brief-later').addEventListener('click',close);d.querySelector('.mf-parent-brief-view').addEventListener('click',()=>{const route=top[0]?.route||'baby-trends';close();location.hash=`#${route}`;});d.addEventListener('cancel',e=>{e.preventDefault();close();});markShown(cards);try{d.showModal();}catch{d.setAttribute('open','');}}
function maybeShow(){const s=readState(),cards=buildCards(s);if(eligible(cards))show(cards);}
function schedule(){setTimeout(maybeShow,1600);}
window.MilkFlowParentBrief={build:()=>buildCards(readState()),showNow:()=>show(buildCards(readState()))};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',schedule,{once:true});else schedule();
window.addEventListener('pageshow',()=>setTimeout(maybeShow,1200));
})();
