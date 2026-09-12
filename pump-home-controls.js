(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
let observer=null;
let timer=null;
let patching=false;

const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const median=a=>{if(!a.length)return null;const s=[...a].sort((x,y)=>x-y),i=Math.floor(s.length/2);return s.length%2?s[i]:(s[i-1]+s[i])/2;};
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function readPrefs(){try{return {target:6,mode:'normal',...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})};}catch{return {target:6,mode:'normal'};}}
function livePumps(s){return (Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);}
function todayPumps(s){return livePumps(s).filter(e=>e.date===today()).sort((a,b)=>String(a.time).localeCompare(String(b.time)));}
function to12FromMin(m){if(m==null)return '—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;}
function round5(m){return Math.round(m/5)*5;}

function recentGap(s){
  const by={};
  for(const e of livePumps(s)){(by[e.date]??=[]).push(e);}
  const gaps=[];
  Object.keys(by).sort().slice(-7).forEach(d=>{
    const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));
    for(let i=1;i<a.length;i++){
      const g=mins(a[i].time)-mins(a[i-1].time);
      if(g>=120&&g<=420)gaps.push(g);
    }
  });
  return median(gaps);
}

function recentLastPump(s){
  const by={};
  for(const e of livePumps(s)){if(e.date===today())continue;(by[e.date]??=[]).push(e);}
  const vals=Object.keys(by).sort().slice(-7).map(d=>{
    const a=by[d].sort((x,y)=>String(x.time).localeCompare(String(y.time)));
    return mins(a[a.length-1]?.time);
  }).filter(Number.isFinite);
  return median(vals);
}

function recentAmountMedian(s){
  const vals=livePumps(s).sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(-18).map(e=>+e.amountMl||0).filter(v=>v>0);
  return median(vals);
}

function ageDays(s){
  const b=s.baby?.birthDate;if(!b)return null;
  const a=new Date(`${b}T12:00:00`),z=new Date(`${today()}T12:00:00`),d=Math.floor((z-a)/86400000);
  return Number.isFinite(d)&&d>=0?d:null;
}

function dynamicPlan(s,p){
  const actual=todayPumps(s);
  const target=clamp(+p.target||6,4,8);
  const remaining=Math.max(0,target-actual.length);
  const schedule=(Array.isArray(s.schedule)?s.schedule:[]).map(mins).filter(Number.isFinite).sort((a,b)=>a-b);
  const learned=recentGap(s);
  const baseDefault=target===5?240:195;
  let preferred=clamp(Math.round(learned||baseDefault),target===5?205:175,target===5?285:220);
  if(p.mode==='tired')preferred+=15;
  if(p.mode==='travel')preferred+=10;

  const historyEnd=recentLastPump(s);
  const savedEnd=schedule.length?schedule[schedule.length-1]:null;
  const endFloor=target===5?1410:1425; // 11:30/11:45 PM family-friendly finish target.
  let endAnchor=Math.max(endFloor,historyEnd||0,savedEnd||0);
  endAnchor=Math.min(endAnchor,1455); // avoid quietly pushing a normal plan deep past midnight.

  if(!actual.length){
    const now=new Date(),nowM=now.getHours()*60+now.getMinutes();
    const raw=schedule.filter(m=>m>=nowM-20).slice(0,remaining);
    const future=raw.length?raw:Array.from({length:remaining},(_,i)=>round5(nowM+(i?preferred*i:0)));
    return {target,actual,remaining,preferred,endAnchor,future:future.slice(0,remaining),source:'baseline',last:null,lastGap:null};
  }

  const last=actual[actual.length-1];
  const lastM=mins(last.time);
  let lastGap=null;
  if(actual.length>1)lastGap=lastM-mins(actual[actual.length-2].time);
  if(!remaining)return {target,actual,remaining,preferred,endAnchor,future:[],source:'actual',last,lastGap};

  const minGap=target===5?175:145;
  let first=lastM+preferred;
  if(remaining>1){
    const latestFirst=endAnchor-minGap*(remaining-1);
    first=Math.min(first,latestFirst);
  }
  first=Math.max(first,lastM+minGap);
  first=round5(first);

  const future=[first];
  if(remaining>1){
    const available=Math.max(minGap*(remaining-1),endAnchor-first);
    const step=clamp(Math.round(available/(remaining-1)),minGap,preferred);
    for(let i=1;i<remaining;i++)future.push(round5(first+step*i));
  }
  return {target,actual,remaining,preferred,endAnchor,future,source:'actual',last,lastGap};
}

function timeWindow(m){
  if(m==null)return '—';
  return `${to12FromMin(m-10)}–${to12FromMin(m+10)}`;
}

function nextReason(plan,p){
  if(!plan.actual.length)return 'Uses your baseline until the first pump is logged.';
  const last=plan.last;
  const mode=p.mode==='normal'?'':` ${p.mode==='tired'?'Tired':'Travel'} mode is allowing a little more flexibility.`;
  return `Recalculated from your ${to12FromMin(mins(last.time))} pump and your recent spacing.${mode}`;
}

function tipFor(s,p,plan){
  const age=ageDays(s);
  const lastAmount=+plan.last?.amountMl||0;
  const amountMed=recentAmountMedian(s);
  if(plan.lastGap&&plan.lastGap>=250)return 'Longer gap today: don’t stack pumps to “catch up.” Return to comfortable, steady spacing from the session you actually completed.';
  if(+p.target===5&&age!=null&&age<84)return 'If maintaining supply is the priority this early postpartum, treat 5 pumps as a trial and judge it by the 3–7 day output trend, not one day.';
  if(lastAmount&&amountMed&&lastAmount<amountMed*.75)return 'One lower-output session is noisy. Watch the full-day and multi-day trend instead of trying to force extra milk from the next pump.';
  return 'To support comfortable milk removal: settle in, check that flange fit feels comfortable, and use gentle breast compressions or warmth if they help your let-down.';
}

function style(){
  if(document.getElementById('pumpQuickStylesV2'))return;
  document.getElementById('pumpQuickStyles')?.remove();
  const el=document.createElement('style');el.id='pumpQuickStylesV2';el.textContent=`
  .pump-quick{margin:10px 0 12px;padding:16px;border:1px solid var(--line-soft,var(--line));border-radius:22px;background:linear-gradient(150deg,var(--surface),color-mix(in srgb,var(--mom) 5%,var(--surface)));box-shadow:0 10px 28px rgba(30,35,55,.06)}
  .pq-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}.pq-kicker{display:block;font-size:.66rem;font-weight:900;letter-spacing:.1em;color:var(--mom)}.pq-title{font-size:1rem;font-weight:850;margin-top:2px}.pq-live{font-size:.68rem;font-weight:850;color:var(--mom-ink);background:var(--mom-soft,var(--surface-2));padding:6px 9px;border-radius:999px;white-space:nowrap}
  .pq-next{margin:13px 0 5px;padding:15px;border-radius:18px;background:var(--surface);border:1px solid color-mix(in srgb,var(--mom) 18%,var(--line));}.pq-next span{display:block;font-size:.7rem;font-weight:800;color:var(--muted)}.pq-next strong{display:block;font-size:1.5rem;line-height:1.1;margin:5px 0;color:var(--ink)}.pq-next small{display:block;font-size:.74rem;line-height:1.4;color:var(--muted)}
  .pq-rest-label{margin:13px 0 7px;font-size:.72rem;font-weight:850;color:var(--muted)}.pq-rest{display:flex;gap:7px;overflow:auto;padding-bottom:2px;scrollbar-width:none}.pq-rest::-webkit-scrollbar{display:none}.pq-slot{min-width:104px;padding:10px 11px;border-radius:14px;background:var(--surface-2);border:1px solid var(--line-soft,var(--line))}.pq-slot b,.pq-slot span{display:block}.pq-slot b{font-size:.76rem}.pq-slot span{font-size:.68rem;color:var(--muted);margin-top:2px}.pq-slot.next{border-color:color-mix(in srgb,var(--mom) 38%,var(--line));background:color-mix(in srgb,var(--mom) 7%,var(--surface))}
  .pq-tip{margin:12px 0;padding:11px 12px;border-radius:14px;background:var(--surface-2);font-size:.78rem;line-height:1.45}.pq-tip b{color:var(--mom)}
  .pump-quick-main{display:grid;grid-template-columns:1fr 1fr;gap:8px}.pump-quick-main button{min-height:52px;border:1px solid var(--line-soft,var(--line));border-radius:15px;background:var(--surface-2);color:var(--ink);font:inherit;font-weight:850;font-size:.95rem}.pump-quick-main button.on{background:var(--mom);color:var(--on-ink,#fff);border-color:var(--mom);box-shadow:0 7px 18px color-mix(in srgb,var(--mom) 24%,transparent)}
  .pump-quick-label{margin:12px 0 6px;font-size:.7rem;font-weight:850;color:var(--muted)}.pump-quick-mode{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.pump-quick-mode button{min-height:42px;border:1px solid var(--line-soft,var(--line));border-radius:12px;background:transparent;color:var(--muted);font:inherit;font-size:.76rem;font-weight:800}.pump-quick-mode button.on{background:var(--surface-2);color:var(--ink);border-color:color-mix(in srgb,var(--mom) 28%,var(--line))}
  #pumpCoach .pc-controls{display:none!important}
  @media(max-width:560px){.pump-quick{border-radius:19px;padding:14px}.pq-next strong{font-size:1.42rem}.pump-quick-main button{min-height:56px}}
  `;document.head.appendChild(el);
}

function html(s,p,plan){
  const ai=String(window.MILKFLOW_CONFIG?.aiCoachEndpoint||'').trim();
  const next=plan.future[0];
  const nextText=plan.remaining?timeWindow(next):'Target reached for today';
  const rest=plan.future.map((m,i)=>`<div class="pq-slot ${i===0?'next':''}"><b>${i===0?'Next':'Then'} ${esc(to12FromMin(m))}</b><span>${esc(timeWindow(m))}</span></div>`).join('');
  return `<section id="pumpQuick" class="pump-quick" aria-label="Dynamic pumping plan">
    <div class="pq-top"><div><span class="pq-kicker">MOM · PUMPING</span><div class="pq-title">Today’s live plan</div></div><span class="pq-live">${ai?'AI + adaptive':'Adaptive'}</span></div>
    <div class="pq-next"><span>${plan.actual.length} of ${plan.target} pumps logged · Next pump</span><strong>${esc(nextText)}</strong><small>${esc(nextReason(plan,p))}</small></div>
    ${plan.remaining?`<div class="pq-rest-label">Rest of today — updates after every logged pump</div><div class="pq-rest">${rest}</div>`:''}
    <div class="pq-tip"><b>Support output:</b> ${esc(tipFor(s,p,plan))}</div>
    <div class="pump-quick-label">Daily goal</div>
    <div class="pump-quick-main" role="group" aria-label="Daily pump target"><button type="button" data-pc-target="6" class="${+p.target===6?'on':''}" aria-pressed="${+p.target===6}">6 pumps</button><button type="button" data-pc-target="5" class="${+p.target===5?'on':''}" aria-pressed="${+p.target===5}">5 pumps</button></div>
    <div class="pump-quick-label">How should today flex?</div>
    <div class="pump-quick-mode" role="group" aria-label="Day mode"><button type="button" data-pc-mode="normal" class="${p.mode==='normal'?'on':''}" aria-pressed="${p.mode==='normal'}">Normal</button><button type="button" data-pc-mode="tired" class="${p.mode==='tired'?'on':''}" aria-pressed="${p.mode==='tired'}">Tired</button><button type="button" data-pc-mode="travel" class="${p.mode==='travel'?'on':''}" aria-pressed="${p.mode==='travel'}">Travel</button></div>
  </section>`;
}

function patchCoach(plan,p){
  const card=document.getElementById('pumpCoach');
  if(!card)return;
  const primary=card.querySelectorAll('.pc-primary > div');
  if(primary[0]){
    const strong=primary[0].querySelector('strong'),small=primary[0].querySelector('small');
    if(strong)strong.textContent=plan.remaining?`~${to12FromMin(plan.future[0])}`:'Target reached for today';
    if(small)small.textContent=nextReason(plan,p);
  }
  if(primary[1]){
    const strong=primary[1].querySelector('strong'),small=primary[1].querySelector('small');
    if(strong)strong.textContent=`${plan.actual.length} of ${plan.target}`;
    if(small)small.textContent=plan.remaining?`${plan.remaining} remaining`:'daily target reached';
  }
  const heroChip=[...document.querySelectorAll('.mom-hero .chip')].find(x=>/^Next\b/i.test((x.textContent||'').trim()));
  if(heroChip&&plan.remaining)heroChip.textContent=`Next ~${to12FromMin(plan.future[0])}`;
}

// stable20 shipped calling isMomHome() without ever defining it, which threw on every
// render and silently removed the whole dynamic plan. Match how smart-pumping.js
// decides: the hash when there is one, otherwise the presence of the Mom hero.
function isMomHome(){
  const h=location.hash.replace(/^#/,'');
  return h==='mom-home' || (!h && !!document.querySelector('#view .mom-hero'));
}

function render(){
  if(patching)return;
  if(!isMomHome()){document.getElementById('pumpQuick')?.remove();return;}
  const view=document.getElementById('view'),hero=view?.querySelector('.mom-hero');if(!view||!hero)return;
  patching=true;
  try{
    style();
    const s=readState(),p=readPrefs(),plan=dynamicPlan(s,p);
    window.MilkFlowDynamicPump={getPlan:()=>dynamicPlan(readState(),readPrefs()),plan};
    const wrap=document.createElement('div');wrap.innerHTML=html(s,p,plan);const next=wrap.firstElementChild;
    const existing=document.getElementById('pumpQuick');
    if(existing)existing.replaceWith(next);else hero.insertAdjacentElement('afterend',next);
    patchCoach(plan,p);
  } finally {patching=false;}
}

function renderSoon(delay=80){clearTimeout(timer);timer=setTimeout(render,delay);}
function isPumpSubmit(e){return e.target?.id==='momForm'&&document.getElementById('momType')?.value==='pump';}

window.addEventListener('DOMContentLoaded',()=>{
  const view=document.getElementById('view');
  if(view){observer=new MutationObserver(()=>{if(!patching)renderSoon(120);});observer.observe(view,{childList:true,subtree:true,characterData:true});}
  renderSoon(100);
});
window.addEventListener('hashchange',()=>renderSoon(80));
window.addEventListener('pageshow',()=>renderSoon(80));
window.addEventListener('storage',e=>{if(e.key===COACH_KEY||e.key===STATE_KEY)renderSoon(80);});
document.addEventListener('click',e=>{if(e.target.closest('[data-pc-target],[data-pc-mode]')){renderSoon(180);setTimeout(render,650);}});
document.addEventListener('submit',e=>{if(isPumpSubmit(e)){renderSoon(450);setTimeout(render,1200);}});
document.addEventListener('change',e=>{if(e.target?.matches?.('[data-schedule]'))renderSoon(250);});
setInterval(()=>renderSoon(0),30000);
})();
