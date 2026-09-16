(() => {
'use strict';

// Optional AI explanation layer. The deterministic smart-pumping.js coach always remains
// active and authoritative for immediate timing; this module adds a human explanation when
// the authenticated backend is available. No provider secret ever reaches the browser.
const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
const HISTORY_KEY='milkflow-pumping-coach-history-v1';
const LAST_KEY='milkflow-ai-coach-last-v2';
const CONTEXT_DAYS=45;
let pending=null;

const cfg=()=>window.MILKFLOW_CONFIG||{};
function read(key,fallback={}){try{return JSON.parse(localStorage.getItem(key)||'null')||fallback}catch{return fallback}}
const state=()=>read(STATE_KEY,{});
const coach=()=>{const p=read(COACH_KEY,{}),daily=Number(p.dayTargets?.[dayKey(new Date())]);return{...p,target:Number.isFinite(daily)?daily:6,mode:p.mode||'normal'};};
const coachDays=()=>read(HISTORY_KEY,{});
const user=()=>{try{return window.firebase?.auth?.().currentUser||null}catch{return null}};
const pad=n=>String(n).padStart(2,'0');
const dayKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));

function cutoff(){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()-CONTEXT_DAYS);return dayKey(d)}
function localRecommendation(){
  const card=document.getElementById('pumpCoach');
  if(!card)return null;
  const primary=card.querySelectorAll('.pc-primary > div');
  return {
    state:card.querySelector('.pc-state')?.textContent?.trim()||null,
    next:primary[0]?.querySelector('strong')?.textContent?.trim()||null,
    nextReason:primary[0]?.querySelector('small')?.textContent?.trim()||null,
    today:primary[1]?.querySelector('strong')?.textContent?.trim()||null,
    guidance:card.querySelector('.pc-guidance')?.textContent?.trim()||null,
    trend:[...card.querySelectorAll('.pc-strip span')].map(x=>x.textContent.trim()).filter(Boolean)
  };
}
function compactEntries(s){
  const floor=cutoff();
  return (Array.isArray(s.entries)?s.entries:[])
    .filter(e=>['pump','nursing'].includes(e?.type)&&e?.date>=floor)
    .map(e=>({
      id:e.id,type:e.type,date:e.date,time:e.time||null,
      amountMl:e.type==='pump'?(+e.amountMl||0):null,
      durationMin:+e.durationMin||null,side:e.type==='nursing'?(e.side||null):null,
      createdAt:e.createdAt||null,editedAt:e.editedAt||null,voidedAt:e.voidedAt||null
    }));
}
function recentOverrides(s){
  const floor=cutoff(),out={};
  for(const [d,v] of Object.entries(s.dailyOverrides||{}))if(d>=floor)out[d]=+v||0;
  return out;
}
function recentCoachDays(){
  const floor=cutoff(),out={};
  for(const [d,v] of Object.entries(coachDays()))if(d>=floor)out[d]=v;
  return out;
}
function buildContext(reason){
  const s=state();
  return {
    schemaVersion:2,
    reason,
    clientTime:new Date().toISOString(),
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,
    schedule:Array.isArray(s.schedule)?s.schedule:[],
    goalMl:+s.profile?.dailyGoalMl||null,
    babyBirthDate:s.baby?.birthDate||null,
    coach:coach(),
    dailyOverrides:recentOverrides(s),
    recentEntries:compactEntries(s),
    coachDays:recentCoachDays(),
    localRecommendation:localRecommendation()
  };
}
function fingerprint(ctx){
  const text=JSON.stringify(ctx);let h=2166136261;
  for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}
  return String(h>>>0);
}

function injectStyle(){
  if(document.getElementById('aiCoachStyle'))return;
  const s=document.createElement('style');s.id='aiCoachStyle';s.textContent=`
.ai-coach-note{margin:10px 0 12px;padding:13px 14px;border-radius:16px;background:color-mix(in srgb,var(--mom) 7%,var(--surface));border:1px solid color-mix(in srgb,var(--mom) 14%,var(--line));font-size:.8rem;line-height:1.5}.ai-coach-note>span{display:block;font-size:.62rem;letter-spacing:.09em;font-weight:900;color:var(--mom);margin-bottom:4px}.ai-coach-note strong{display:block;font-size:.9rem;margin-bottom:3px}.ai-coach-note p{margin:0;color:var(--ink-2)}.ai-coach-signals{display:flex;flex-wrap:wrap;gap:6px;margin-top:9px}.ai-coach-signals i{font-style:normal;font-size:.66rem;font-weight:750;color:var(--muted);background:var(--surface-2);padding:5px 8px;border-radius:999px}.ai-coach-safety{margin-top:8px!important;font-size:.72rem;color:var(--muted)!important}`;
  document.head.appendChild(s);
}
function render(payload,label){
  const card=document.getElementById('pumpCoach');if(!card||!payload?.message)return;
  let box=card.querySelector('.ai-coach-note');
  if(!box){box=document.createElement('div');box.className='ai-coach-note';const after=card.querySelector('.pi-coach-note')||card.querySelector('.pc-guidance');if(after)after.insertAdjacentElement('afterend',box);else card.appendChild(box)}
  const signals=Array.isArray(payload.signals)&&payload.signals.length?`<div class="ai-coach-signals">${payload.signals.map(x=>`<i>${esc(x)}</i>`).join('')}</div>`:'';
  const safety=payload.safety_note?`<p class="ai-coach-safety">${esc(payload.safety_note)}</p>`:'';
  box.innerHTML=`<span>${esc(label||'AI perspective')}</span><strong>${esc(payload.headline||'Pattern update')}</strong><p>${esc(payload.message)}</p>${signals}${safety}`;
}
function restore(){const x=read(LAST_KEY,null);if(x?.message)render(x,x.source==='ai'?'AI perspective':'Built-in guidance')}
function saveResult(payload,fp){const saved={...payload,fingerprint:fp,receivedAt:Date.now()};localStorage.setItem(LAST_KEY,JSON.stringify(saved));return saved}

async function requestOnce(endpoint,token,reason,context,signal){
  const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({schemaVersion:2,reason,context}),signal});
  const body=await res.json().catch(()=>({}));
  if(!res.ok||!body?.ok)throw new Error(body?.error||`Coach ${res.status}`);
  return body;
}
async function requestCoach(reason='manual'){
  const endpoint=String(cfg().aiCoachEndpoint||'').trim();
  if(!endpoint||!navigator.onLine)return null;
  const u=user();if(!u)return null;
  const context=buildContext(reason),fp=fingerprint(context),old=read(LAST_KEY,null);
  // Same state within five minutes should not spend another API call.
  if(old?.fingerprint===fp&&Date.now()-(old.receivedAt||0)<300000){render(old,old.source==='ai'?'AI perspective':'Built-in guidance');return old}
  if(pending)pending.abort();const ctl=new AbortController();pending=ctl;const timer=setTimeout(()=>ctl.abort(),18000);
  try{
    render({headline:'Reviewing your pattern',message:'Checking today against your recent pumping history…'},'AI perspective');
    const token=await u.getIdToken();
    let body;
    try{body=await requestOnce(endpoint,token,reason,context,ctl.signal)}catch(err){
      // One short retry handles transient network/server hiccups; after that the local coach
      // remains on screen unchanged rather than turning an API problem into an app failure.
      if(ctl.signal.aborted)throw err;
      await new Promise(r=>setTimeout(r,650));
      body=await requestOnce(endpoint,token,reason,context,ctl.signal);
    }
    const saved=saveResult(body,fp);render(saved,saved.source==='ai'?'AI perspective':'Built-in guidance');return saved;
  }catch(err){console.warn('Optional AI coach unavailable',err);restore();return null}
  finally{clearTimeout(timer);if(pending===ctl)pending=null}
}

window.MilkFlowAI={requestCoach,enabled:()=>!!String(cfg().aiCoachEndpoint||'').trim(),buildContext};
window.addEventListener('DOMContentLoaded',()=>{injectStyle();restore()});
window.addEventListener('pageshow',restore);
document.addEventListener('click',e=>{
  if(e.target.closest('[data-pc-target],[data-pc-mode]'))setTimeout(()=>requestCoach('pump_plan_selection'),320);
});
document.addEventListener('submit',e=>{
  if(e.target?.id==='momForm'&&document.getElementById('momType')?.value==='pump')setTimeout(()=>requestCoach('pump_logged'),900);
});
document.addEventListener('change',e=>{
  if(e.target?.matches?.('[data-schedule]'))setTimeout(()=>requestCoach('schedule_changed'),550);
});
})();
