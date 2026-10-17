(() => {
'use strict';

/*
 * Permanent pumping target + adaptive planner bridge.
 *
 * MilkFlow historically treated six pumps as an implicit fallback inside the UI coach.
 * That made a 5-pump choice temporary and impossible to carry forward as the user's normal
 * routine. This module makes the normal daily pump count part of the synced family profile.
 * Date-specific choices remain overrides and never mutate the permanent preference.
 */
const STATE_KEY='milkflow-family-v4-state';
const COACH_KEY='milkflow-pumping-coach-v1';
const MIN_TARGET=1;
const MAX_TARGET=8;
const pad=n=>String(n).padStart(2,'0');
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const dateShift=n=>{const d=new Date(`${today()}T12:00:00`);d.setDate(d.getDate()+n);return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const mins=t=>{if(!t)return null;const [h,m]=String(t).split(':').map(Number);return Number.isFinite(h)&&Number.isFinite(m)?h*60+m:null;};
const toTime=m=>{const n=clamp(Math.round(Number(m)||0),0,1439);return `${pad(Math.floor(n/60))}:${pad(n%60)}`;};
const round5=m=>Math.round(m/5)*5;

function readState(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function writeState(s){
  try{
    const oldRaw=localStorage.getItem(STATE_KEY);
    s.savedAt=Math.max(Date.now(),Number(s.savedAt||0)+1);
    const raw=JSON.stringify(s);
    localStorage.setItem(STATE_KEY,raw);
    try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,oldValue:oldRaw,newValue:raw,storageArea:localStorage,url:location.href}));}catch{}
    window.dispatchEvent(new CustomEvent('milkflow:pump-target-change',{detail:{target:permanentTarget(s)}}));
  }catch(err){console.warn('MilkFlow pump target could not be saved locally',err);}
}
function readCoach(){try{return JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{};}catch{return {};}}
function writeCoach(p){try{localStorage.setItem(COACH_KEY,JSON.stringify(p));window.dispatchEvent(new CustomEvent('milkflow:coach-change'));}catch{}}
function permanentTarget(s=readState()){
  const stored=Number(s.profile?.dailyPumpTarget);
  if(Number.isFinite(stored))return clamp(Math.round(stored),MIN_TARGET,MAX_TARGET);
  const scheduleCount=Array.isArray(s.schedule)&&s.schedule.length?Math.round(s.schedule.length):6;
  return clamp(scheduleCount,MIN_TARGET,MAX_TARGET);
}
function explicitTarget(day=today()){
  const p=readCoach(),n=Number(p.dayTargets?.[day]);
  if(!Number.isFinite(n))return null;
  // A seed is merely the permanent default copied into the old date-based coach store.
  if(p.defaultSeedByDate?.[day])return null;
  return clamp(Math.round(n),MIN_TARGET,MAX_TARGET);
}
function effectiveTarget(day=today(),s=readState()){return explicitTarget(day)??permanentTarget(s);}
function resizeSchedule(schedule,target){
  const src=(Array.isArray(schedule)?schedule:[]).map(mins).filter(Number.isFinite).sort((a,b)=>a-b);
  const n=clamp(Math.round(Number(target)||6),MIN_TARGET,MAX_TARGET);
  if(!src.length){
    const first=340,last=1415;
    if(n===1)return[toTime(Math.round((first+last)/2))];
    return Array.from({length:n},(_,i)=>toTime(first+((last-first)*i/(n-1))));
  }
  if(src.length===n)return src.map(toTime);
  const first=src[0],last=src.at(-1);
  if(n===1)return[toTime(Math.round((first+last)/2))];
  return Array.from({length:n},(_,i)=>toTime(round5(first+((last-first)*i/(n-1)))));
}
function seedDefaultForDay(day=today()){
  const p=readCoach(),target=permanentTarget(),dayTargets={...(p.dayTargets||{})},seeds={...(p.defaultSeedByDate||{})};
  if(!Number.isFinite(Number(dayTargets[day]))||seeds[day]){
    dayTargets[day]=target;seeds[day]=true;
    writeCoach({...p,dayTargets,defaultSeedByDate:seeds});
  }
}
async function syncProfile(s){
  try{
    const user=window.firebase?.auth?.().currentUser;
    if(!user||!window.firebase?.firestore)return false;
    await window.firebase.firestore().collection('users').doc(user.uid).collection('private').doc('profile').set({
      profile:s.profile||{},schedule:Array.isArray(s.schedule)?s.schedule:[],
      updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
    },{merge:true});
    return true;
  }catch(err){console.warn('MilkFlow permanent pump target cloud sync deferred',err?.message||err);return false;}
}
async function setPermanentTarget(value,{resize=true}={}){
  const n=clamp(Math.round(Number(value)||6),MIN_TARGET,MAX_TARGET),s=readState();
  s.profile={...(s.profile||{}),dailyPumpTarget:n};
  if(resize)s.schedule=resizeSchedule(s.schedule,n);
  const p=readCoach(),day=today(),targets={...(p.dayTargets||{})},seeds={...(p.defaultSeedByDate||{})};
  // Preserve a deliberate one-day choice. Otherwise today immediately adopts the new normal.
  if(!Number.isFinite(Number(targets[day]))||seeds[day]){targets[day]=n;seeds[day]=true;}
  writeCoach({...p,dayTargets:targets,defaultSeedByDate:seeds});
  writeState(s);
  await syncProfile(s);
  renderSetting();
  return n;
}
function setDayOverride(day,value){
  const n=clamp(Math.round(Number(value)||permanentTarget()),MIN_TARGET,MAX_TARGET),p=readCoach();
  const targets={...(p.dayTargets||{}),[day]:n},seeds={...(p.defaultSeedByDate||{})};delete seeds[day];
  writeCoach({...p,dayTargets:targets,defaultSeedByDate:seeds});
  return n;
}
function clearDayOverride(day=today()){
  const p=readCoach(),targets={...(p.dayTargets||{})},seeds={...(p.defaultSeedByDate||{})};
  targets[day]=permanentTarget();seeds[day]=true;writeCoach({...p,dayTargets:targets,defaultSeedByDate:seeds});
}

function livePumps(s,d=today()){return(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date===d&&e?.time).sort((a,b)=>String(a.time).localeCompare(String(b.time)));}
function customLowTargetPlan(target,s=readState()){
  const actual=livePumps(s),remaining=Math.max(0,target-actual.length),schedule=resizeSchedule(s.schedule,target).map(mins),p=readCoach(),override=Number(p.nextOverrideByDate?.[today()]);
  if(!remaining)return{target,actual,remaining:0,future:[],source:'actual',last:actual.at(-1)||null};
  const now=new Date(),nowM=now.getHours()*60+now.getMinutes(),last=actual.at(-1)||null,lastM=mins(last?.time),minGap=target===1?0:target===2?300:240;
  if(!actual.length){
    let future=schedule.filter(m=>m>=nowM-20).slice(0,remaining);
    if(Number.isFinite(override)&&override>=nowM-10)future=[override,...future.filter(m=>m>override)].slice(0,remaining);
    if(future.length<remaining){
      const start=Math.max(nowM+5,schedule.find(m=>m>=nowM-20)??nowM+5),end=Math.max(start,schedule.at(-1)??1415),step=remaining>1?Math.max(minGap,Math.floor((end-start)/(remaining-1))):0;
      future=Array.from({length:remaining},(_,i)=>round5(Math.min(1439,start+step*i)));
    }
    return{target,actual,remaining,future,source:Number.isFinite(override)?'override':'baseline'};
  }
  const start=Number.isFinite(override)&&override>lastM?override:Math.max(nowM+5,lastM+minGap),end=Math.max(start,schedule.at(-1)??1415),step=remaining>1?Math.max(minGap,Math.floor((end-start)/(remaining-1))):0;
  const future=Array.from({length:remaining},(_,i)=>round5(Math.min(1439,start+step*i)));
  return{target,actual,remaining,future,source:Number.isFinite(override)&&override>lastM?'override':'actual',last};
}

let plannerPatched=false;
function patchPlanner(){
  const api=window.MilkFlowDynamicPump;if(!api||api.__permanentTargetPatched)return false;
  api.__permanentTargetPatched=true;plannerPatched=true;seedDefaultForDay();
  const original={
    getPlan:api.getPlan?.bind(api),previewTarget:api.previewTarget?.bind(api),setTodayNextTime:api.setTodayNextTime?.bind(api),clearTodayNextTime:api.clearTodayNextTime?.bind(api)
  };
  api.getPermanentTarget=()=>permanentTarget();
  api.getDayTarget=day=>effectiveTarget(day||today());
  api.setPermanentTarget=n=>setPermanentTarget(n);
  api.setTodayTarget=n=>{const v=setDayOverride(today(),n);return v<4?customLowTargetPlan(v):original.previewTarget?.(v)||original.getPlan?.();};
  api.setDayTarget=(day,n)=>setDayOverride(day,n);
  api.setTomorrowTarget=n=>setDayOverride(dateShift(1),n);
  api.clearTodayTarget=()=>{clearDayOverride(today());return api.getPlan();};
  api.previewTarget=n=>{const v=clamp(Math.round(Number(n)||permanentTarget()),MIN_TARGET,MAX_TARGET);return v<4?customLowTargetPlan(v):original.previewTarget?.(v)||original.getPlan?.();};
  api.getPlan=()=>{
    seedDefaultForDay();const target=effectiveTarget();
    if(target<4)return customLowTargetPlan(target);
    // The underlying learned planner reads the seeded day target, so it keeps its historical
    // spacing logic while no longer falling back to six.
    return original.getPlan?.()||{target,actual:livePumps(readState()),remaining:0,future:[]};
  };
  if(original.setTodayNextTime)api.setTodayNextTime=original.setTodayNextTime;
  if(original.clearTodayNextTime)api.clearTodayNextTime=original.clearTodayNextTime;
  return true;
}

function statusCopy(){
  const n=permanentTarget(),override=explicitTarget();
  return override==null?`${n} pump${n===1?'':'s'} every day`:`${n}/day normally · ${override} today`;
}
function renderSetting(){
  patchPlanner();
  if(document.body.dataset.screen==='set-pumping'){
    const view=document.getElementById('view');if(view&&!document.getElementById('mfPermanentPumpTarget')){
      const section=document.createElement('section');section.className='panel';section.id='mfPermanentPumpTarget';
      section.innerHTML=`<div class="panel-head"><h3>Normal daily pump count</h3><span class="panel-note">Permanent</span></div><div class="settings-grid"><label class="field"><span>Pumps per day</span><select id="mfPumpTargetSelect">${Array.from({length:MAX_TARGET},(_,i)=>i+1).map(n=>`<option value="${n}"${n===permanentTarget()?' selected':''}>${n} pump${n===1?'':'s'}</option>`).join('')}</select></label></div><p class="chart-note">This becomes your normal plan for future days and syncs to your Family account. Changing “today” in the coach/chat remains a one-day override. Pump times are redistributed across your existing first-to-last pump window and can still be edited below.</p>`;
      const firstPanel=view.querySelector('.panel');firstPanel?firstPanel.before(section):view.appendChild(section);
      section.querySelector('#mfPumpTargetSelect')?.addEventListener('change',async e=>{
        const n=await setPermanentTarget(e.target.value);
        const toast=document.getElementById('toast');if(toast){toast.textContent=`Normal plan saved: ${n} pump${n===1?'':'s'} per day`;toast.classList.add('show');setTimeout(()=>toast.classList.remove('show'),2600);}
        // app.js owns the schedule fields; ask it to render again so the resized synced schedule
        // immediately shows the correct number of time inputs.
        window.dispatchEvent(new CustomEvent('milkflow:pump-target-saved',{detail:{target:n}}));
        setTimeout(()=>{try{location.hash=location.hash;}catch{}},0);
      });
    }
  }
  if(document.body.dataset.screen==='settings'){
    const rows=[...document.querySelectorAll('.list-row,.setting-list button,.settings-list button')];
    for(const row of rows){const text=row.textContent||'';if(/Pumping/i.test(text)){const sub=row.querySelector('span:last-child,small');if(sub)sub.textContent=statusCopy();break;}}
  }
}

function reconcileFromCloud(){
  const s=readState(),target=permanentTarget(s),p=readCoach(),day=today(),seeds={...(p.defaultSeedByDate||{})};
  if(seeds[day]&&Number(p.dayTargets?.[day])!==target){const targets={...(p.dayTargets||{}),[day]:target};writeCoach({...p,dayTargets:targets,defaultSeedByDate:seeds});}
  renderSetting();
}

window.MilkFlowPumpTarget={get:permanentTarget,getEffective:effectiveTarget,set:setPermanentTarget,setToday:n=>setDayOverride(today(),n),clearToday:()=>clearDayOverride(today()),resizeSchedule};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{patchPlanner();renderSetting();},{once:true});else{patchPlanner();renderSetting();}
window.addEventListener('milkflow:base-rendered',renderSetting);
window.addEventListener('pageshow',()=>{reconcileFromCloud();});
window.addEventListener('storage',e=>{if(e.key===STATE_KEY||e.key===COACH_KEY)reconcileFromCloud();});
setTimeout(()=>{patchPlanner();renderSetting();},450);
})();
