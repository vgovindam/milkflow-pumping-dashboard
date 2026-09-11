(() => {
'use strict';

// Optional AI coaching boundary. The browser NEVER receives an OpenAI/API secret.
// Set MILKFLOW_CONFIG.aiCoachEndpoint to a trusted server endpoint (Firebase Function /
// Cloud Run / other backend). The deterministic local pump coach remains the source of
// truth if this endpoint is absent, offline, slow or unavailable.
const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
const LAST_KEY='milkflow-ai-coach-last-v1';
let pending=null;

function cfg(){return window.MILKFLOW_CONFIG||{}}
function state(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{}}catch{return {}}}
function coach(){try{return {target:6,mode:'normal',...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})}}catch{return {target:6,mode:'normal'}}}
function user(){try{return window.firebase?.auth?.().currentUser||null}catch{return null}}
function dayKey(d){return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
function recentPumpContext(){
  const s=state(), now=new Date(), floor=new Date(now); floor.setDate(floor.getDate()-13); floor.setHours(0,0,0,0);
  const rows=(Array.isArray(s.entries)?s.entries:[])
    .filter(e=>!e?.voidedAt&&e.type==='pump'&&e.date&&e.time&&new Date(`${e.date}T12:00:00`)>=floor)
    .sort((a,b)=>`${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
    .map(e=>({date:e.date,time:e.time,amountMl:+e.amountMl||0,durationMin:+e.durationMin||null}));
  return {
    date:dayKey(now),
    schedule:Array.isArray(s.schedule)?s.schedule:[],
    goalMl:+s.profile?.dailyGoalMl||null,
    babyBirthDate:s.baby?.birthDate||null,
    coach:coach(),
    pumps:rows
  };
}
function escapeHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
function render(message,stateLabel='AI guidance'){
  const card=document.getElementById('pumpCoach'); if(!card)return;
  let box=card.querySelector('.ai-coach-note');
  if(!box){box=document.createElement('div');box.className='ai-coach-note';const after=card.querySelector('.pi-coach-note')||card.querySelector('.pc-guidance');(after||card).insertAdjacentElement?.('afterend',box)||card.appendChild(box)}
  box.innerHTML=`<span>${escapeHtml(stateLabel)}</span><p>${escapeHtml(message)}</p>`;
}
function injectStyle(){if(document.getElementById('aiCoachStyle'))return;const s=document.createElement('style');s.id='aiCoachStyle';s.textContent='.ai-coach-note{margin:10px 0 12px;padding:12px 13px;border-radius:15px;background:color-mix(in srgb,var(--mom) 7%,var(--surface));border:1px solid color-mix(in srgb,var(--mom) 14%,var(--line));font-size:.8rem;line-height:1.48}.ai-coach-note span{display:block;font-size:.62rem;letter-spacing:.09em;font-weight:900;color:var(--mom);margin-bottom:4px}.ai-coach-note p{margin:0;color:var(--ink-2)}';document.head.appendChild(s)}
function restore(){try{const x=JSON.parse(localStorage.getItem(LAST_KEY)||'null');if(x?.message)render(x.message)}catch{}}

async function requestCoach(reason='manual'){
  const endpoint=String(cfg().aiCoachEndpoint||'').trim();
  if(!endpoint||!navigator.onLine)return null;
  const u=user(); if(!u)return null; // backend should verify this Firebase identity
  if(pending)pending.abort();
  const ctl=new AbortController(); pending=ctl;
  const timer=setTimeout(()=>ctl.abort(),15000);
  try{
    render('Checking your recent pattern…','AI guidance');
    const token=await u.getIdToken();
    const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({schemaVersion:1,reason,context:recentPumpContext()}),signal:ctl.signal});
    if(!res.ok)throw new Error(`AI coach ${res.status}`);
    const body=await res.json();
    const message=String(body?.message||body?.advice||'').trim();
    if(!message)throw new Error('AI coach returned no message');
    const saved={message,receivedAt:Date.now()};localStorage.setItem(LAST_KEY,JSON.stringify(saved));render(message);return saved;
  }catch(err){
    console.warn('Optional AI coach unavailable',err);
    restore();
    return null;
  }finally{clearTimeout(timer);if(pending===ctl)pending=null}
}

window.MilkFlowAI={requestCoach,enabled:()=>!!String(cfg().aiCoachEndpoint||'').trim()};
window.addEventListener('DOMContentLoaded',()=>{injectStyle();restore()});
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-pc-target],[data-pc-mode]'))return;
  // Let the local coach save the new selection first. AI is an optional second opinion,
  // never a prerequisite for changing the plan.
  setTimeout(()=>requestCoach('pump_plan_selection'),220);
});
})();
