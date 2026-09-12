(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
let timer=null;
let patching=false;

const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const readState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const readPrefs=()=>{try{return {target:6,mode:'normal',...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})};}catch{return {target:6,mode:'normal'};}};
const livePumps=s=>(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);
const todayPumps=s=>livePumps(s).filter(e=>e.date===today()).sort((a,b)=>String(a.time).localeCompare(String(b.time)));
const round5=m=>Math.round(m/5)*5;

function to12(m){
  if(!Number.isFinite(m))return '—';
  const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;
  return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;
}
function bucket(m){
  if(m<540)return 'early';       // before 9 AM
  if(m<810)return 'lateMorning'; // 9 AM–1:30 PM
  if(m<1050)return 'afternoon';  // 1:30–5:30 PM
  if(m<1290)return 'evening';    // 5:30–9:30 PM
  return 'late';
}
function bucketLabel(k){return ({early:'morning',lateMorning:'late-morning',afternoon:'afternoon',evening:'evening',late:'late-evening'})[k]||'recent';}

function historicalTransitions(s){
  const by={};
  for(const e of livePumps(s)){
    if(e.date===today())continue;
    (by[e.date]??=[]).push(e);
  }
  const dates=Object.keys(by).sort().slice(-10), out=[];
  for(const d of dates){
    const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));
    for(let i=1;i<a.length;i++){
      const pm=mins(a[i-1].time), nm=mins(a[i].time), gap=nm-pm;
      if(Number.isFinite(pm)&&gap>=120&&gap<=390)out.push({from:pm,gap,bucket:bucket(pm)});
    }
  }
  return out;
}
function allDayGap(s){return median(historicalTransitions(s).map(x=>x.gap));}
function timeAwareGap(s,anchor,target){
  const k=bucket(anchor), rows=historicalTransitions(s), same=rows.filter(x=>x.bucket===k).map(x=>x.gap);
  const learned=same.length>=2?median(same):allDayGap(s);
  const defaults6={early:310,lateMorning:215,afternoon:190,evening:180,late:165};
  const bounds6={early:[270,335],lateMorning:[185,240],afternoon:[170,210],evening:[160,205],late:[150,195]};
  const defaults5={early:330,lateMorning:255,afternoon:240,evening:225,late:195};
  const bounds5={early:[290,365],lateMorning:[220,300],afternoon:[205,280],evening:[195,265],late:[175,230]};
  const is5=target===5, defaults=is5?defaults5:defaults6, bounds=is5?bounds5:bounds6;
  let raw=Number.isFinite(learned)?learned:defaults[k];
  // Most history is six-pump history. A five-pump trial should not simply reuse those tighter gaps.
  if(is5&&Number.isFinite(learned))raw+=30;
  return {minutes:clamp(Math.round(raw),bounds[k][0],bounds[k][1]),bucket:k,samples:same.length};
}
function recentLast(s){
  const by={};
  for(const e of livePumps(s)){if(e.date===today())continue;(by[e.date]??=[]).push(e);}
  const vals=Object.keys(by).sort().slice(-7).map(d=>{
    const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));
    return mins(a[a.length-1]?.time);
  }).filter(Number.isFinite);
  return median(vals);
}
function recentFirst(s){
  const by={};
  for(const e of livePumps(s)){if(e.date===today())continue;(by[e.date]??=[]).push(e);}
  const vals=Object.keys(by).sort().slice(-7).map(d=>{
    const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));
    return mins(a[0]?.time);
  }).filter(Number.isFinite);
  return median(vals);
}

function plan(s=readState(),p=readPrefs()){
  const actual=todayPumps(s),target=clamp(+p.target||6,4,8),remaining=Math.max(0,target-actual.length);
  const schedule=(Array.isArray(s.schedule)?s.schedule:[]).map(mins).filter(Number.isFinite).sort((a,b)=>a-b);
  const historyEnd=recentLast(s),savedEnd=schedule.at(-1);
  let endAnchor=Math.max(target===5?1410:1425,historyEnd||0,savedEnd||0);
  endAnchor=Math.min(endAnchor,target===5?1440:1445); // no silent deep-after-midnight drift

  if(!actual.length){
    const now=new Date(),nowM=now.getHours()*60+now.getMinutes();
    const raw=schedule.filter(m=>m>=nowM-20).slice(0,remaining);
    const firstBase=schedule[0]??recentFirst(s)??340;
    const future=raw.length?raw:Array.from({length:remaining},(_,i)=>firstBase+i*(target===5?240:195)).filter(m=>m>=nowM-20).slice(0,remaining);
    return {target,actual,remaining,future,preferred:target===5?240:195,endAnchor,source:'baseline',last:null,lastGap:null,gapBucket:null,gapSamples:0};
  }

  const last=actual.at(-1),lastM=mins(last.time),g=timeAwareGap(s,lastM,target);
  let preferred=g.minutes;
  if(p.mode==='tired')preferred+=15;
  if(p.mode==='travel')preferred+=10;
  const lastGap=actual.length>1?lastM-mins(actual.at(-2).time):null;
  if(!remaining)return {target,actual,remaining,future:[],preferred,endAnchor,source:'actual',last,lastGap,gapBucket:g.bucket,gapSamples:g.samples};

  const minGap=target===5?180:150;
  let first=lastM+preferred;
  if(remaining>1){
    const latestFirst=endAnchor-minGap*(remaining-1);
    first=Math.min(first,latestFirst);
  }else{
    first=Math.min(first,endAnchor);
  }
  first=Math.max(first,lastM+minGap);
  first=round5(first);

  const future=[first];
  if(remaining>1){
    const available=Math.max(minGap*(remaining-1),endAnchor-first);
    const step=clamp(Math.round(available/(remaining-1)),minGap,preferred);
    for(let i=1;i<remaining;i++)future.push(round5(first+step*i));
  }
  return {target,actual,remaining,future,preferred,endAnchor,source:'actual',last,lastGap,gapBucket:g.bucket,gapSamples:g.samples};
}

function windowLabel(m){return `${to12(m-10)}–${to12(m+10)}`;}
function until(m){
  const d=new Date(),now=d.getHours()*60+d.getMinutes();let diff=Math.round(m-now);if(diff<0)diff+=1440;
  if(diff<2)return 'now';if(diff<60)return `in ${diff}m`;const h=Math.floor(diff/60),r=diff%60;return r?`in ${h}h ${r}m`:`in ${h}h`;
}
function nextDayFirst(s){
  const schedule=(Array.isArray(s.schedule)?s.schedule:[]).map(mins).filter(Number.isFinite).sort((a,b)=>a-b);
  return schedule[0]??recentFirst(s)??340;
}
function reason(x,p){
  if(!x.actual.length)return 'Starts with your baseline, then learns from the times you actually log.';
  const flex=p.mode==='normal'?'':` ${p.mode==='tired'?'Tired':'Travel'} mode adds a little flexibility.`;
  const learned=x.gapSamples>=2?`your usual ${bucketLabel(x.gapBucket)} spacing`:'your recent spacing';
  return `Updated from your ${to12(mins(x.last.time))} pump using ${learned}; remaining pumps are kept from bunching together.${flex}`;
}
function iconMark(kind){return kind==='done'?'✓':'•';}

function patchLiveCard(x,p){
  const card=document.getElementById('pumpQuick');if(!card)return;
  const label=card.querySelector('.pq-next span'),strong=card.querySelector('.pq-next strong'),small=card.querySelector('.pq-next small');
  if(label)label.textContent=x.remaining?`Next pump · ${x.actual.length} of ${x.target} done`:`${x.target} of ${x.target} done`;
  if(strong)strong.textContent=x.remaining?windowLabel(x.future[0]):'Today’s target is complete';
  if(small)small.textContent=reason(x,p);
  const live=card.querySelector('.pq-live');if(live)live.textContent='Adaptive · time-aware';
  const rest=card.querySelector('.pq-rest'),restLabel=card.querySelector('.pq-rest-label');
  if(rest){rest.innerHTML=x.future.map((m,i)=>`<div class="pq-slot ${i===0?'next':''}"><b>${to12(m)}</b></div>`).join('');}
  if(restLabel)restLabel.textContent=x.future.length>1?'Later today':'Next';
}
function patchHero(x,s){
  const hero=document.querySelector('.mom-hero');if(!hero)return;
  const chips=[...hero.querySelectorAll('.chip')];
  const c=chips.find(n=>/^Next\b/i.test(n.textContent.trim()));if(!c)return;
  const m=x.remaining?x.future[0]:nextDayFirst(s);
  const text=x.remaining?`Next ${to12(m)} · ${until(m)}`:`Tomorrow ${to12(m)}`;
  const svg=c.querySelector('svg')?.cloneNode(true);c.textContent='';if(svg)c.appendChild(svg);c.append(document.createTextNode(text));
}
function patchSchedule(x){
  const strip=document.querySelector('.mf-pump-plan-panel .schedule-strip');if(!strip)return;
  const done=x.actual.map(e=>`<div class="schedule-card done"><div class="mf-plan-mark">${iconMark('done')}</div><strong>${to12(mins(e.time))}</strong><small>${Number(e.amountMl)||0} mL</small></div>`);
  const future=x.future.map((m,i)=>`<div class="schedule-card ${i===0?'pc-next':''}"><div class="mf-plan-mark">${iconMark('future')}</div><strong>${to12(m)}</strong><small>${i===0?'Next':'Planned'}</small></div>`);
  strip.innerHTML=[...done,...future].join('');
}
function style(){
  if(document.getElementById('mfAdaptivePlanStyles'))return;
  const s=document.createElement('style');s.id='mfAdaptivePlanStyles';s.textContent=`
    .mf-plan-mark{font-size:18px;font-weight:900;line-height:1}
    .mf-pump-plan-panel .schedule-card.pc-next .mf-plan-mark{color:inherit}
  `;document.head.appendChild(s);
}
function apply(){
  if(patching)return;patching=true;
  try{
    style();const s=readState(),p=readPrefs(),x=plan(s,p);
    window.MilkFlowDynamicPump=window.MilkFlowDynamicPump||{};
    window.MilkFlowDynamicPump.getPlan=()=>plan(readState(),readPrefs());
    window.MilkFlowDynamicPump.plan=x;
    if(location.hash==='#mom-home'||document.body.dataset.screen==='mom-home'){
      patchLiveCard(x,p);patchHero(x,s);patchSchedule(x);
    }
  }finally{patching=false;}
}
function later(){clearTimeout(timer);timer=setTimeout(apply,70);}

window.addEventListener('storage',e=>{if(e.key===STATE_KEY||e.key===COACH_KEY)later();});
window.addEventListener('hashchange',later);window.addEventListener('pageshow',later);
document.addEventListener('click',e=>{if(e.target.closest('[data-pc-target],[data-pc-mode]'))setTimeout(later,80);});
document.addEventListener('submit',e=>{if(e.target?.id==='momForm')setTimeout(later,500);});
const mount=()=>{new MutationObserver(later).observe(document.getElementById('view')||document.body,{childList:true,subtree:true});apply();setInterval(apply,30000);};
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
