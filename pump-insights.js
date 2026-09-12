(() => {
'use strict';

// Persistent companion to smart-pumping.js: keeps daily coach context for trend review,
// syncs it with the signed-in family account, and turns the pump plan into a visual rhythm.
const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
const HISTORY_KEY='milkflow-pumping-coach-history-v1';
const MAX_LOCAL_DAYS=365;
let writing=false, cloudPulling=false;

const $=(s,r=document)=>r.querySelector(s);
const $$=(s,r=document)=>[...r.querySelectorAll(s)];
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`};
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null};
const fmtGap=m=>!m?'—':m>=60?`${Math.floor(m/60)}h${m%60?` ${m%60}m`:''}`:`${m}m`;
const avg=a=>a.length?a.reduce((x,y)=>x+y,0)/a.length:0;
const fd=d=>new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`));
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{}}catch{return {}}}
function coach(){try{return {target:6,mode:'normal',...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})}}catch{return {target:6,mode:'normal'}}}
function hist(){try{const h=JSON.parse(localStorage.getItem(HISTORY_KEY)||'{}');return h&&typeof h==='object'?h:{}}catch{return {}}}
function saveHist(h){
  const keys=Object.keys(h).sort();
  if(keys.length>MAX_LOCAL_DAYS) keys.slice(0,keys.length-MAX_LOCAL_DAYS).forEach(k=>delete h[k]);
  localStorage.setItem(HISTORY_KEY,JSON.stringify(h));
}
const entries=s=>(Array.isArray(s.entries)?s.entries:[]).filter(e=>!e?.voidedAt&&e.type==='pump'&&e.date&&e.time);
const dayPumps=(s,d)=>entries(s).filter(e=>e.date===d).sort((a,b)=>a.time.localeCompare(b.time));
function dayTotal(s,d){const logged=dayPumps(s,d).reduce((n,e)=>n+(+e.amountMl||0),0),o=+(s.dailyOverrides?.[d]??0);return Math.max(logged,Number.isFinite(o)?o:0)}
function dayGap(s,d){const a=dayPumps(s,d),g=[];for(let i=1;i<a.length;i++){const v=mins(a[i].time)-mins(a[i-1].time);if(v>=60&&v<=600)g.push(v)}return g.length?Math.round(avg(g)):null}
function daysBack(n,offset=0){const out=[];for(let i=n-1+offset;i>=offset;i--){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-i);out.push(`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`)}return out}
function activeAverage(s,days){const a=days.map(d=>dayTotal(s,d)).filter(v=>v>0);return a.length?Math.round(avg(a)):0}

function snapshot(){
  const s=state(),p=coach(),d=today(),a=dayPumps(s,d),h=hist();
  const seven=activeAverage(s,daysBack(7)),prior=activeAverage(s,daysBack(7,7));
  const row={date:d,target:+p.target||6,mode:p.mode||'normal',pumps:a.length,totalMl:dayTotal(s,d),avgGapMin:dayGap(s,d),sevenAvg:seven,delta:prior?Math.round((seven-prior)/prior*100):null};
  const old=h[d]||{};
  const same=['date','target','mode','pumps','totalMl','avgGapMin','sevenAvg','delta'].every(k=>old[k]===row[k]);
  if(same)return old;
  row.updatedAt=Date.now();h[d]=row;saveHist(h);pushDay(row);return row;
}

function currentUser(){try{return window.firebase?.auth?.().currentUser||null}catch{return null}}
function db(){try{return window.firebase?.firestore?.()||null}catch{return null}}
async function pushDay(row){const u=currentUser(),x=db();if(!u||!x||!row?.date)return;try{await x.doc(`users/${u.uid}/pumpCoachDays/${row.date}`).set(row,{merge:true})}catch(e){console.warn('Pump trend sync skipped',e)}}
async function pushCoach(){const u=currentUser(),x=db();if(!u||!x)return;const p=coach();try{await x.doc(`users/${u.uid}/private/pumpCoach`).set({...p,updatedAt:Date.now()},{merge:true})}catch(e){console.warn('Pump coach sync skipped',e)}}
async function pullCloud(u){
  const x=db();if(!u||!x||cloudPulling)return;cloudPulling=true;
  try{
    const [pd,ds]=await Promise.all([x.doc(`users/${u.uid}/private/pumpCoach`).get(),x.collection(`users/${u.uid}/pumpCoachDays`).get()]);
    if(pd.exists){const r=pd.data()||{},l=coach();if((r.updatedAt||0)>(l.updatedAt||0)){localStorage.setItem(COACH_KEY,JSON.stringify({target:+r.target||6,mode:r.mode||'normal',updatedAt:r.updatedAt||Date.now()}));try{window.dispatchEvent(new StorageEvent('storage',{key:COACH_KEY,newValue:localStorage.getItem(COACH_KEY)}))}catch{}}}
    const h=hist();let changed=false;ds.forEach(doc=>{const r=doc.data()||{},o=h[doc.id];if(!o||(r.updatedAt||0)>(o.updatedAt||0)){h[doc.id]={...r,date:r.date||doc.id};changed=true}});if(changed)saveHist(h);
    renderSoon();
  }catch(e){console.warn('Pump trend cloud pull skipped',e)}finally{cloudPulling=false}
}
function initCloud(){try{window.firebase?.auth?.().onAuthStateChanged?.(u=>{if(u)pullCloud(u)})}catch(e){console.warn('Pump trend cloud init skipped',e)}}

function fiveTrial(s,h){
  const done=Object.values(h).filter(r=>r?.date&&r.date<today()&&+r.target===5&&r.totalMl>0).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);
  if(!done.length)return {days:0,trialAvg:0,baseAvg:0,delta:null};
  const first=done[0].date,before=[...new Set(entries(s).map(e=>e.date))].filter(d=>d<first&&dayTotal(s,d)>0).sort().slice(-7);
  const trialAvg=Math.round(avg(done.map(r=>r.totalMl))),baseAvg=Math.round(avg(before.map(d=>dayTotal(s,d))));
  return {days:done.length,trialAvg,baseAvg,delta:baseAvg?Math.round((trialAvg-baseAvg)/baseAvg*100):null};
}
function trialMessage(s,p){
  const t=fiveTrial(s,hist());
  if(+p.target===5){
    if(t.days<3)return `5-pump trial: ${t.days} completed ${t.days===1?'day':'days'} recorded. Keep logging complete days; after 3 days the app will compare output with your earlier baseline.`;
    if(t.delta==null)return `5-pump trial: ${t.days} completed days recorded. Keep logging so the earlier baseline becomes strong enough to compare.`;
    if(t.delta<=-8)return `5-pump trial: ${t.trialAvg} mL/day vs ${t.baseAvg} mL/day before the change (${Math.abs(t.delta)}% lower). If maintaining output is the priority, consider returning to 6 and watch the next few days.`;
    if(Math.abs(t.delta)<8)return `5-pump trial: ${t.trialAvg} mL/day vs ${t.baseAvg} mL/day before the change. Output is broadly holding so far; keep watching through a full week before making 5 permanent.`;
    return `5-pump trial: output is not showing a drop versus your earlier baseline so far. Keep watching the full-week trend.`;
  }
  if(t.days)return `Your ${t.days} recorded 5-pump ${t.days===1?'day is':'days are'} preserved for comparison. If you trial 5 again, MilkFlow continues the trend instead of starting over.`;
  return 'MilkFlow now keeps the 5 ↔ 6 pump-plan history so future schedule changes can be compared with output and spacing.';
}

function trendHTML(){
  const s=state(),p=coach(),h=hist(),seven=daysBack(7),rows=seven.map(d=>{const snap=h[d]||{};return{date:d,pumps:dayPumps(s,d).length,total:dayTotal(s,d),gap:dayGap(s,d),target:snap.target||null,mode:snap.mode||null}}),completed=rows.filter(r=>r.date<today()&&r.pumps);
  const sevenAvg=activeAverage(s,seven),prior=activeAverage(s,daysBack(7,7)),delta=prior?Math.round((sevenAvg-prior)/prior*100):null;
  const gaps=completed.map(r=>r.gap).filter(Boolean),tracked=completed.filter(r=>r.target),met=tracked.filter(r=>r.pumps>=r.target).length,max=Math.max(...rows.map(r=>r.total),1);
  const list=rows.map(r=>`<div class="pi-day ${r.date===today()?'today':''}"><div class="pi-day-head"><strong>${r.date===today()?'Today':fd(r.date)}</strong><span>${r.pumps}${r.target?`/${r.target}`:''} pumps${r.mode&&r.mode!=='normal'?` · ${esc(r.mode)}`:''}</span></div><div class="pi-bar"><i style="width:${r.total?Math.max(7,Math.round(r.total/max*100)):2}%"></i></div><div class="pi-day-foot"><b>${r.total?`${r.total} mL`:'No output logged'}</b><span>${r.gap?`${fmtGap(r.gap)} avg gap`:''}</span></div></div>`).join('');
  return `<section id="pumpInsights" class="panel pump-insights"><div class="panel-head"><div><span class="pi-kicker">PUMP ROUTINE</span><h3>Schedule & coaching trend</h3></div><span class="pi-plan">${+p.target||6}/day</span></div><div class="pi-stats"><div><span>7-day output</span><strong>${sevenAvg||0} mL</strong><small>${delta==null?'building baseline':`${delta>=0?'▲':'▼'} ${Math.abs(delta)}% vs prior`}</small></div><div><span>Pumps / day</span><strong>${completed.length?avg(completed.map(r=>r.pumps)).toFixed(1):'—'}</strong><small>completed days</small></div><div><span>Typical spacing</span><strong>${gaps.length?fmtGap(Math.round(avg(gaps))):'—'}</strong><small>actual sessions</small></div><div><span>Target days</span><strong>${tracked.length?`${met}/${tracked.length}`:'—'}</strong><small>met goal</small></div></div><div class="pi-trial"><strong>5 ↔ 6 pump tracking</strong><span>${esc(trialMessage(s,p))}</span></div><div class="pi-days">${list}</div></section>`;
}

function parse12(text){const m=String(text||'').match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);if(!m)return null;let h=+m[1]%12;if(m[3].toUpperCase()==='PM')h+=12;return h*60+(+m[2])}
function decorateSchedule(root=document){
  const strip=$('.schedule-strip',root);if(strip){strip.classList.add('pi-schedule');const nowM=new Date().getHours()*60+new Date().getMinutes();let next=false;$$('.schedule-card',strip).forEach((c,i)=>{c.classList.add(`pi-slot-${i%6}`);const t=parse12($('strong',c)?.textContent),done=c.classList.contains('done'),extra=c.classList.contains('extra');if(done)c.classList.add('pi-done');else if(extra)c.classList.add('pi-extra');else if(t!=null&&t<nowM-75)c.classList.add('pi-missed');else if(!next){c.classList.add('pi-next');next=true}})}
  $$('input[data-schedule]',root).forEach((i,n)=>{const l=i.closest('.field');if(l)l.classList.add('pi-time-field',`pi-slot-${n%6}`)})
}
function addTrialNote(){
  const card=$('#pumpCoach');if(!card)return;const s=state(),p=coach(),text=trialMessage(s,p);let n=$('.pi-coach-note',card);if(!n){n=document.createElement('div');n.className='pi-coach-note';const g=$('.pc-guidance',card);if(g)g.insertAdjacentElement('afterend',n);else card.appendChild(n)}n.textContent=text;
}

function injectStyles(){if($('#pumpInsightsStyles'))return;const s=document.createElement('style');s.id='pumpInsightsStyles';s.textContent=`
.pi-coach-note{margin:10px 0 12px;padding:10px 12px;border-radius:13px;background:color-mix(in srgb,var(--mom-2) 8%,var(--surface-2));font-size:.78rem;line-height:1.45;color:var(--muted)}
.schedule-strip.pi-schedule{display:flex!important;gap:11px!important;overflow-x:auto!important;padding:7px 2px 14px!important;scroll-snap-type:x proximity;counter-reset:pump-slot}.pi-schedule .schedule-card{counter-increment:pump-slot;position:relative!important;flex:0 0 132px!important;min-height:126px!important;padding:16px 13px 16px!important;border:0!important;border-radius:22px!important;background:linear-gradient(150deg,color-mix(in srgb,var(--mom) 10%,var(--surface)),var(--surface))!important;box-shadow:0 9px 24px rgba(25,30,45,.08)!important;scroll-snap-align:start;overflow:hidden}.pi-schedule .schedule-card:before{content:counter(pump-slot);position:absolute;top:10px;right:10px;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;background:color-mix(in srgb,var(--mom) 15%,var(--surface));color:var(--mom);font-size:.68rem;font-weight:900}.pi-schedule .schedule-card>div{width:39px!important;height:39px!important;border-radius:14px!important;display:grid!important;place-items:center!important;background:color-mix(in srgb,var(--mom) 13%,var(--surface))!important;color:var(--mom)!important;margin-bottom:11px!important}.pi-schedule .schedule-card strong{font-size:1rem!important}.pi-schedule .schedule-card small{color:var(--ink-2)!important}.pi-schedule .pi-done{background:linear-gradient(150deg,color-mix(in srgb,#25a77f 19%,var(--surface)),color-mix(in srgb,#25a77f 4%,var(--surface)))!important}.pi-schedule .pi-done:before,.pi-schedule .pi-done>div{background:color-mix(in srgb,#25a77f 17%,var(--surface))!important;color:#187b61!important}.pi-schedule .pi-next{outline:2px solid color-mix(in srgb,var(--mom) 55%,transparent)!important;box-shadow:0 13px 30px color-mix(in srgb,var(--mom) 20%,transparent)!important;transform:translateY(-2px)}.pi-schedule .pi-next:after,.pi-schedule .pi-missed:after,.pi-schedule .pi-extra:after{position:absolute;left:12px;bottom:8px;font-size:.56rem;letter-spacing:.1em;font-weight:900}.pi-schedule .pi-next:after{content:'NEXT';color:var(--mom)}.pi-schedule .pi-missed{background:linear-gradient(150deg,color-mix(in srgb,#d98952 17%,var(--surface)),var(--surface))!important}.pi-schedule .pi-missed:after{content:'MISSED';color:#b76534}.pi-schedule .pi-extra{background:linear-gradient(150deg,color-mix(in srgb,#5798d0 16%,var(--surface)),var(--surface))!important}.pi-schedule .pi-extra:after{content:'EXTRA';color:#397aae}
.pi-time-field{position:relative!important;padding:15px!important;border:1px solid color-mix(in srgb,var(--mom) 16%,var(--line))!important;border-radius:18px!important;background:linear-gradient(145deg,color-mix(in srgb,var(--mom) 8%,var(--surface)),var(--surface))!important;box-shadow:0 5px 16px rgba(28,32,45,.05)}.pi-time-field:before{content:'';position:absolute;left:0;top:14px;bottom:14px;width:4px;border-radius:0 4px 4px 0;background:linear-gradient(var(--mom),var(--mom-2))}.pi-time-field>span{color:var(--mom)!important;font-weight:800!important}.pi-time-field input[type=time]{min-height:48px!important;border-radius:13px!important;background:var(--surface-2)!important;font-weight:750!important}
.pump-insights{margin-top:18px}.pi-kicker{display:block;font-size:.66rem;font-weight:900;letter-spacing:.11em;color:var(--mom);margin-bottom:3px}.pi-plan{padding:6px 10px;border-radius:999px;background:color-mix(in srgb,var(--mom) 12%,var(--surface-2));color:var(--mom-ink);font-size:.72rem;font-weight:900}.pi-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:9px;margin:14px 0}.pi-stats>div{padding:12px;border-radius:17px;background:var(--surface-2);display:flex;flex-direction:column;gap:2px}.pi-stats span,.pi-stats small{color:var(--muted);font-size:.7rem}.pi-stats strong{font-size:1.04rem}.pi-trial{display:flex;flex-direction:column;gap:4px;padding:12px 13px;margin:10px 0 14px;border-radius:15px;background:color-mix(in srgb,var(--mom) 7%,var(--surface-2));line-height:1.42}.pi-trial span{font-size:.78rem;color:var(--ink-2)}.pi-days{display:grid;gap:8px}.pi-day{padding:10px 12px;border-radius:15px;background:var(--surface-2)}.pi-day.today{outline:1px solid color-mix(in srgb,var(--mom) 40%,transparent)}.pi-day-head,.pi-day-foot{display:flex;justify-content:space-between;gap:10px;align-items:center}.pi-day-head span,.pi-day-foot span{font-size:.7rem;color:var(--muted)}.pi-day-foot b{font-size:.76rem}.pi-bar{height:6px;margin:8px 0;border-radius:99px;background:var(--line-soft,var(--line));overflow:hidden}.pi-bar i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,var(--mom),var(--mom-2))}
@media(max-width:700px){.pi-stats{grid-template-columns:repeat(2,1fr)}}@media(max-width:560px){.pi-schedule .schedule-card{flex-basis:124px!important;min-height:122px!important}.pi-day-head,.pi-day-foot{align-items:flex-start}.pump-insights{border-radius:20px}}
`;document.head.appendChild(s)}

function render(){if(writing)return;writing=true;try{injectStyles();snapshot();const v=$('#view');if(!v)return;decorateSchedule(v);if(location.hash==='#mom-home'||(!location.hash&&$('.mom-hero',v)))addTrialNote();if(location.hash==='#mom-trends'){const html=trendHTML(),old=$('#pumpInsights');if(old){const t=document.createElement('div');t.innerHTML=html;old.replaceWith(t.firstElementChild)}else v.insertAdjacentHTML('beforeend',html)}}finally{writing=false}}
let timer=null;function renderSoon(){clearTimeout(timer);timer=setTimeout(render,90)}

document.addEventListener('click',e=>{if(e.target.closest('[data-pc-target],[data-pc-mode]'))setTimeout(()=>{pushCoach();renderSoon()},140)});
window.addEventListener('hashchange',renderSoon);window.addEventListener('storage',e=>{if([STATE_KEY,COACH_KEY,HISTORY_KEY].includes(e.key))renderSoon()});
const mo=new MutationObserver(ms=>{if(writing)return;if(ms.some(m=>m.target?.id==='view'||m.target?.closest?.('#view')))renderSoon()});
window.addEventListener('DOMContentLoaded',()=>{const v=$('#view');if(v)mo.observe(v,{childList:true,subtree:true});initCloud();renderSoon()});
setInterval(renderSoon,60000);
})();
