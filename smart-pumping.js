(() => {
'use strict';

// Adaptive Pump Coach lives beside the main app on purpose: it reads the same local
// family state, but stores its own preferences so an app save can never erase them.
const STATE_KEY = 'milkflow-family-v4-state';
const COACH_KEY = 'milkflow-pumping-coach-v1';
const DEFAULTS = { target: 6, mode: 'normal', showDetails: true };
let writing = false;

const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const pad = n => String(n).padStart(2,'0');
const today = () => { const d=new Date(); return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; };
const mins = t => { if(!t) return null; const [h,m]=String(t).split(':').map(Number); return Number.isFinite(h)&&Number.isFinite(m) ? h*60+m : null; };
const hhmm = m => `${pad(Math.floor(((m%1440)+1440)%1440/60))}:${pad(((m%1440)+1440)%1440%60)}`;
const to12 = t => { const m=mins(t); if(m==null) return '—'; const h=Math.floor(m/60), mm=m%60; return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`; };
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const median = a => { if(!a.length) return null; const s=[...a].sort((x,y)=>x-y), i=Math.floor(s.length/2); return s.length%2?s[i]:(s[i-1]+s[i])/2; };
const esc = s => String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function state(){
  try { return JSON.parse(localStorage.getItem(STATE_KEY)||'{}') || {}; }
  catch { return {}; }
}
function prefs(){
  try { return {...DEFAULTS, ...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})}; }
  catch { return {...DEFAULTS}; }
}
function savePrefs(p){ localStorage.setItem(COACH_KEY,JSON.stringify({...prefs(),...p})); renderSoon(); }

const liveMom = s => (Array.isArray(s.entries)?s.entries:[]).filter(e=>!e?.voidedAt);
const pumps = s => liveMom(s).filter(e=>e.type==='pump' && e.date && e.time);
const dayPumps = (s,d=today()) => pumps(s).filter(e=>e.date===d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
const amount = e => +e?.amountMl||0;
function dayTotal(s,d){
  const logged=dayPumps(s,d).reduce((n,e)=>n+amount(e),0);
  const override=+(s.dailyOverrides?.[d] ?? 0);
  return Math.max(logged,Number.isFinite(override)?override:0);
}
function daysBack(n, offset=0){
  const out=[];
  for(let i=n-1+offset;i>=offset;i--){ const d=new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate()-i); out.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`); }
  return out;
}
function activeAvg(s,days){ const vals=days.map(d=>dayTotal(s,d)).filter(v=>v>0); return vals.length?Math.round(vals.reduce((a,b)=>a+b,0)/vals.length):0; }
function recentGap(s){
  const by={};
  for(const e of pumps(s)) (by[e.date]??=[]).push(e);
  const gaps=[];
  Object.keys(by).sort().slice(-7).forEach(d=>{
    const a=by[d].sort((x,y)=>x.time.localeCompare(y.time));
    for(let i=1;i<a.length;i++){
      const g=mins(a[i].time)-mins(a[i-1].time);
      if(g>=120 && g<=420) gaps.push(g);
    }
  });
  return median(gaps);
}
function schedule(s){ return (Array.isArray(s.schedule)?s.schedule:[]).filter(Boolean).sort((a,b)=>mins(a)-mins(b)); }
function ageDays(s){
  const b=s.baby?.birthDate; if(!b) return null;
  const a=new Date(`${b}T12:00:00`), z=new Date(`${today()}T12:00:00`);
  const d=Math.floor((z-a)/86400000); return Number.isFinite(d)&&d>=0?d:null;
}
function latestPump(s){ return pumps(s).sort((a,b)=>`${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))[0]||null; }
function isToday(e){ return e?.date===today(); }

// Match plan slots to actual pumps with a generous window. A truly missed slot is one
// that is already >75 minutes behind and has no pump matched to it. We never recommend
// "doubling up" to make the count look right.
function matchedPlan(s){
  const sch=schedule(s), actual=dayPumps(s), used=new Set();
  const slots=sch.map(t=>{
    let bi=-1, bd=Infinity;
    actual.forEach((e,i)=>{ if(used.has(i)) return; const d=Math.abs(mins(e.time)-mins(t)); if(d<bd){bd=d;bi=i;} });
    if(bi>=0 && bd<=150){ used.add(bi); return {time:t,entry:actual[bi],diff:bd}; }
    return {time:t,entry:null,diff:null};
  });
  return {slots,extras:actual.filter((_,i)=>!used.has(i))};
}

function buildSuggestion(s,p){
  const nowD=new Date(), nowM=nowD.getHours()*60+nowD.getMinutes();
  const actual=dayPumps(s), last=latestPump(s), sch=schedule(s);
  const target=clamp(+p.target||6,4,8);
  const remaining=Math.max(0,target-actual.length);
  const first=sch.length?mins(sch[0]):340;
  const lastPlan=sch.length?mins(sch[sch.length-1]):1415;
  const learned=recentGap(s);
  const baseGap=clamp(Math.round(learned || (target===5?240:200)), target===5?190:160, target===5?300:250);
  const plan=matchedPlan(s);
  const missed=plan.slots.filter(x=>!x.entry && mins(x.time)<nowM-75);

  let nextM=null, reason='', status='on-track';
  if(!actual.length){
    const upcoming=sch.find(t=>mins(t)>=nowM-20);
    if(upcoming && mins(upcoming)-nowM<=75){ nextM=mins(upcoming); reason='your next planned time'; }
    else { nextM=nowM; reason=nowM>first+75?'the first planned pump has passed':'you have not logged a pump yet'; }
  } else {
    const lastToday=actual[actual.length-1];
    const lm=mins(lastToday.time);
    const fromActual=lm+baseGap;
    const upcoming=sch.find(t=>mins(t)>lm+45 && mins(t)>nowM-20);
    // If the actual session was close to plan, retain the next plan. If the day shifted,
    // follow the real session and learned interval rather than an obsolete clock slot.
    const nearest=sch.reduce((best,t)=>Math.abs(mins(t)-lm)<Math.abs(mins(best)-lm)?t:best,sch[0]||lastToday.time);
    const wasNearPlan=sch.length && Math.abs(mins(nearest)-lm)<=45;
    nextM=wasNearPlan&&upcoming ? mins(upcoming) : fromActual;
    reason=wasNearPlan&&upcoming ? 'your plan is still lining up' : `today shifted, so this follows your ${Math.round(baseGap/60*10)/10}h recent spacing`;
    if(nextM<nowM-10){ nextM=nowM; reason='the suggested window has passed'; }
  }

  // If several sessions remain, fit them into the family's usual waking pump window without
  // cramming them. If they no longer fit, say so plainly instead of recommending unsafe catch-up.
  let cram=false;
  if(remaining>1 && nextM!=null){
    const window=Math.max(0,lastPlan-nextM);
    const needed=(remaining-1)*(target===5?170:145);
    if(window<needed){
      cram=true;
      status='behind';
      nextM=Math.max(nowM, actual.length?mins(actual[actual.length-1].time)+(target===5?170:145):nowM);
      reason='there is not enough room to squeeze every remaining session into the old plan';
    }
  }
  if(missed.length && status==='on-track') status='shifted';
  if(p.mode==='tired') reason += '; today is marked as a tired/flex day';
  if(p.mode==='travel') reason += '; travel mode follows actual pump times instead of forcing the clock';

  const seven=activeAvg(s,daysBack(7));
  const prior=activeAvg(s,daysBack(7,7));
  const delta=prior?Math.round((seven-prior)/prior*100):null;
  const age=ageDays(s);
  let guidance='';
  if(target===5){
    if(age!=null && age<84) guidance='You are still in the early supply-building window. A regular move from 6 to 5 pumps may reduce supply for some people; if maintaining supply is the priority, treat 5 as a trial rather than an automatic permanent change.';
    else guidance='If you are trialing 5 pumps, watch your 3–7 day output trend rather than judging one day.';
    if(delta!=null && delta<=-8) guidance+=' Your 7-day average is currently down, so returning to 6 sessions is worth considering if maintaining output is your goal.';
  } else if(delta!=null && delta<=-10) guidance='Your 7-day average is down versus the prior week. One day is noisy; if the decline continues for several days, review missed sessions, spacing, illness/travel, hydration/food, and consider lactation support if supply is a concern.';
  else if(delta!=null && delta>=8) guidance='Your 7-day average is up versus the prior week. Keep judging the pattern over several days rather than chasing a single high-output session.';
  else guidance='Your recent output looks broadly steady. Keep using the real session times to adjust the next suggestion.';

  if(cram) guidance='Do not double-pump just to catch the schedule. Use a comfortable next session, accept that today may finish short of the target, and resume the plan tomorrow. '+guidance;
  else if(missed.length) guidance=`${missed.length} planned ${missed.length===1?'session looks':'sessions look'} missed today. The coach has shifted forward instead of stacking sessions. `+guidance;

  return {target,actual,last,nextM,reason,status,remaining,missed,cram,seven,prior,delta,baseGap,guidance,age};
}

function trendText(x){
  if(!x.seven) return 'Trend builds after a few pumping days';
  if(x.delta==null) return `7-day avg ${x.seven} mL`;
  const a=Math.abs(x.delta); return `7-day avg ${x.seven} mL · ${a<3?'steady':`${x.delta>0?'up':'down'} ${a}%`}`;
}
function lastText(x){
  if(!x.last) return 'No pump logged yet';
  const when=isToday(x.last)?to12(x.last.time):`${x.last.date} ${to12(x.last.time)}`;
  return `${when}${amount(x.last)?` · ${amount(x.last)} mL`:''}`;
}
function nextText(x){
  if(x.nextM==null || x.remaining===0) return x.remaining===0?'Target reached for today':'—';
  const t=hhmm(x.nextM), diff=x.nextM-(new Date().getHours()*60+new Date().getMinutes());
  const suffix=diff<=2?'now':diff<60?`in ${Math.max(0,diff)}m`:`in ${Math.floor(diff/60)}h ${diff%60?`${diff%60}m`:''}`.trim();
  return `~${to12(t)} · ${suffix}`;
}

function cardHTML(s,p,x){
  const stateLabel=x.status==='behind'?'Plan shifted':x.status==='shifted'?'Adjusted today':'On track';
  return `<section id="pumpCoach" class="pump-coach pc-${x.status}">
    <div class="pc-head"><div><span class="pc-kicker">ADAPTIVE PUMP COACH</span><h3>Next pump, based on today</h3></div><span class="pc-state">${stateLabel}</span></div>
    <div class="pc-primary"><div><span>Next suggestion</span><strong>${esc(nextText(x))}</strong><small>${esc(x.reason)}</small></div><div><span>Today</span><strong>${x.actual.length} of ${x.target}</strong><small>${x.remaining?`${x.remaining} remaining`:'daily target reached'}</small></div></div>
    <div class="pc-strip"><span><b>Last</b> ${esc(lastText(x))}</span><span><b>Trend</b> ${esc(trendText(x))}</span>${x.missed.length?`<span class="pc-warn"><b>Missed</b> ${x.missed.length}</span>`:''}</div>
    <div class="pc-guidance">${esc(x.guidance)}</div>
    <div class="pc-controls" role="group" aria-label="Pump coach settings">
      <div class="pc-seg"><button data-pc-target="6" class="${x.target===6?'on':''}">6 pumps</button><button data-pc-target="5" class="${x.target===5?'on':''}">5 pumps</button></div>
      <div class="pc-seg"><button data-pc-mode="normal" class="${p.mode==='normal'?'on':''}">Normal</button><button data-pc-mode="tired" class="${p.mode==='tired'?'on':''}">Tired</button><button data-pc-mode="travel" class="${p.mode==='travel'?'on':''}">Travel</button></div>
    </div>
  </section>`;
}

function settingsHTML(s,p,x){
  const early=x.age!=null&&x.age<84;
  return `<section id="pumpCoachSettings" class="panel pc-settings"><div class="panel-head"><h3>Adaptive pump coach</h3></div>
    <p class="pc-settings-lead">The clock plan is your baseline. The coach adjusts the next suggestion from what you actually logged, notices missed sessions, and avoids telling you to cram pumps together.</p>
    <div class="pc-setting-row"><div><strong>Daily session goal</strong><small>Change this without deleting history.</small></div><div class="pc-seg"><button data-pc-target="6" class="${x.target===6?'on':''}">6</button><button data-pc-target="5" class="${x.target===5?'on':''}">5</button></div></div>
    <div class="pc-setting-row"><div><strong>Day mode</strong><small>Tired and Travel let the suggestion follow real timing more loosely.</small></div><div class="pc-seg"><button data-pc-mode="normal" class="${p.mode==='normal'?'on':''}">Normal</button><button data-pc-mode="tired" class="${p.mode==='tired'?'on':''}">Tired</button><button data-pc-mode="travel" class="${p.mode==='travel'?'on':''}">Travel</button></div></div>
    ${x.target===5?`<div class="pc-note ${early?'pc-note-warn':''}"><strong>5-pump trial</strong><span>${early?'Because the baby profile places you under about 12 weeks postpartum, the app treats 5 pumps as a cautious trial rather than assuming supply is established.':'Watch the 3–7 day trend after the change. If output falls more than you want, switch back to 6.'}</span></div>`:''}
    <button type="button" class="pc-plan-button" data-pc-rebuild>Adjust clock times for ${x.target} pumps</button>
    <p class="pc-footnote">This is planning support, not medical advice. Pain, fever, a red/hot breast, or significant supply concerns deserve clinical/lactation guidance.</p>
  </section>`;
}

function rebuildSchedule(target){
  const s=state(), old=schedule(s);
  let start=old.length?mins(old[0]):340, end=old.length?mins(old[old.length-1]):1415;
  if(end<=start) end=start+18*60;
  const count=clamp(+target||6,4,8), step=(end-start)/(count-1);
  s.schedule=Array.from({length:count},(_,i)=>hhmm(Math.round(start+step*i)));
  localStorage.setItem(STATE_KEY,JSON.stringify({...s,savedAt:Date.now()}));
  // Same-tab storage events do not fire. Reload once so the main app adopts the new schedule
  // before it next saves state to Firestore/localStorage.
  location.reload();
}

function updateHeroChip(x){
  if(location.hash!=='#mom-home' && location.hash!=='') return;
  const chips=$$('.mom-hero .chip');
  const next=chips.find(c=>/Next\s/i.test(c.textContent||''));
  if(next && x.remaining>0){ next.textContent=`Next ${nextText(x)}`; next.title='Adaptive suggestion based on the latest logged pump'; }
}

function injectStyles(){
  if($('#pumpCoachStyles')) return;
  const st=document.createElement('style'); st.id='pumpCoachStyles';
  st.textContent=`
  .pump-coach{margin:16px 0 18px;padding:18px;border:1px solid var(--line-soft,var(--line));border-radius:24px;background:linear-gradient(145deg,var(--surface),var(--surface-2));box-shadow:0 10px 30px rgba(30,35,55,.06)}
  .pc-head,.pc-primary,.pc-controls,.pc-setting-row{display:flex;gap:14px;align-items:center;justify-content:space-between}.pc-head{align-items:flex-start}.pc-head h3{margin:3px 0 0;font-size:1.14rem}.pc-kicker{font-size:.68rem;font-weight:800;letter-spacing:.11em;color:var(--mom)}.pc-state{white-space:nowrap;padding:6px 9px;border-radius:999px;background:var(--surface-2);font-size:.72rem;font-weight:800}.pc-shifted .pc-state,.pc-behind .pc-state{background:var(--mom-soft,var(--surface-2));color:var(--mom)}
  .pc-primary{margin:15px 0 12px;align-items:stretch}.pc-primary>div{flex:1;padding:13px 14px;border-radius:18px;background:var(--surface)}.pc-primary span,.pc-primary small{display:block;color:var(--muted);font-size:.75rem}.pc-primary strong{display:block;font-size:1.15rem;margin:3px 0}.pc-primary small{line-height:1.35}.pc-strip{display:flex;gap:8px;flex-wrap:wrap}.pc-strip span{padding:7px 10px;border-radius:999px;background:var(--surface-2);font-size:.76rem}.pc-warn{color:var(--danger)}.pc-guidance{margin:12px 0;padding:11px 12px;border-left:3px solid var(--mom);border-radius:8px;background:var(--surface-2);font-size:.82rem;line-height:1.45}.pc-controls{align-items:flex-end;flex-wrap:wrap}.pc-seg{display:inline-flex;padding:3px;border-radius:13px;background:var(--surface-2);gap:2px}.pc-seg button{border:0;background:transparent;color:var(--muted);padding:8px 10px;border-radius:10px;font:inherit;font-size:.75rem;font-weight:700}.pc-seg button.on{background:var(--surface);color:var(--ink);box-shadow:0 2px 8px rgba(20,25,40,.08)}
  .pc-settings{margin-top:16px}.pc-settings-lead{color:var(--muted);line-height:1.5;margin:0 0 8px}.pc-setting-row{padding:14px 0;border-bottom:1px solid var(--line-soft,var(--line));align-items:center}.pc-setting-row div:first-child{display:flex;flex-direction:column;gap:3px}.pc-setting-row small{color:var(--muted)}.pc-note{display:flex;gap:5px;flex-direction:column;margin:14px 0;padding:12px;border-radius:14px;background:var(--surface-2);font-size:.82rem;line-height:1.45}.pc-note-warn{border-left:3px solid var(--mom)}.pc-plan-button{width:100%;min-height:48px;border:0;border-radius:14px;background:var(--ink);color:var(--on-ink,#fff);font-weight:800;margin-top:8px}.pc-footnote{font-size:.72rem;color:var(--muted);line-height:1.4;margin:10px 0 0}
  @media(max-width:560px){.pump-coach{padding:15px;border-radius:20px}.pc-primary{flex-direction:column;gap:8px}.pc-controls{align-items:stretch}.pc-controls>.pc-seg{flex:1}.pc-controls>.pc-seg button{flex:1}.pc-setting-row{align-items:flex-start;flex-direction:column}.pc-setting-row .pc-seg{width:100%}.pc-setting-row .pc-seg button{flex:1}}
  `;
  document.head.appendChild(st);
}

function render(){
  if(writing) return;
  injectStyles();
  const s=state(), p=prefs(), x=buildSuggestion(s,p);
  const view=$('#view'); if(!view) return;
  const hash=location.hash.slice(1);
  if(hash==='mom-home' || (!hash && $('.mom-hero',view))){
    let card=$('#pumpCoach');
    const html=cardHTML(s,p,x);
    if(card){ const tmp=document.createElement('div'); tmp.innerHTML=html; card.replaceWith(tmp.firstElementChild); }
    else {
      const hero=$('.mom-hero',view); if(hero) hero.insertAdjacentHTML('afterend',html);
    }
    updateHeroChip(x);
  }
  if(hash==='set-pumping'){
    let box=$('#pumpCoachSettings');
    const html=settingsHTML(s,p,x);
    if(box){ const tmp=document.createElement('div'); tmp.innerHTML=html; box.replaceWith(tmp.firstElementChild); }
    else view.insertAdjacentHTML('beforeend',html);
  }
}
let timer=null;
function renderSoon(){ clearTimeout(timer); timer=setTimeout(()=>{ writing=true; try{ render(); } finally { writing=false; } },50); }

document.addEventListener('click',e=>{
  const t=e.target.closest('[data-pc-target]');
  if(t){ e.preventDefault(); savePrefs({target:+t.dataset.pcTarget}); return; }
  const m=e.target.closest('[data-pc-mode]');
  if(m){ e.preventDefault(); savePrefs({mode:m.dataset.pcMode}); return; }
  const r=e.target.closest('[data-pc-rebuild]');
  if(r){ e.preventDefault(); const p=prefs(); if(confirm(`Adjust the clock plan to ${p.target} evenly spaced pumps between your current first and last planned times? Your pumping history will not change.`)) rebuildSchedule(p.target); }
});
window.addEventListener('hashchange',renderSoon);
window.addEventListener('storage',e=>{ if(e.key===STATE_KEY||e.key===COACH_KEY) renderSoon(); });
const mo=new MutationObserver(muts=>{
  if(writing) return;
  if(muts.some(m=>m.target?.id==='view'||m.target?.closest?.('#view'))) renderSoon();
});
window.addEventListener('DOMContentLoaded',()=>{ const v=$('#view'); if(v) mo.observe(v,{childList:true,subtree:true}); renderSoon(); });
setInterval(renderSoon,60000);
})();
