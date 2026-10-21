(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const CHAT_KEY='milkflow-family-chat-v1';
const PENDING_KEY='milkflow-family-chat-pending-v1';
const MAX_LOCAL=50;
const STATUS_POLL_MS=1800;
const STATUS_POLL_LIMIT=22;
let busy=false;
let recoveryPromise=null;

function readJSON(key,fallback){try{return JSON.parse(localStorage.getItem(key)||JSON.stringify(fallback));}catch{return fallback;}}
function readState(){return readJSON(STATE_KEY,{});}
function readChat(){const v=readJSON(CHAT_KEY,[]);return Array.isArray(v)?v:[];}
function saveChat(v){try{localStorage.setItem(CHAT_KEY,JSON.stringify(v.slice(-MAX_LOCAL)));}catch{}}
function readPending(){const v=readJSON(PENDING_KEY,null);return v&&v.requestId&&v.message?v:null;}
function savePending(v){try{v?localStorage.setItem(PENDING_KEY,JSON.stringify(v)):localStorage.removeItem(PENDING_KEY);}catch{}}
function pad(n){return String(n).padStart(2,'0');}
function dateKey(d){return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;}
function today(){return dateKey(new Date());}
function dateShift(n){const d=new Date();d.setHours(12,0,0,0);d.setDate(d.getDate()+n);return dateKey(d);}
function clock(d){return `${pad(d.getHours())}:${pad(d.getMinutes())}`;}
function uid(prefix){return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#039;'}[c]));}
function to12(t){if(!t)return'—';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);return `${((h+11)%12)+1}:${pad(m)} ${h>=12?'PM':'AM'}`;}
function to12m(m){if(!Number.isFinite(m))return'—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;}
function activeBabyId(s){return s.baby?.id||'saahas-2026';}
function livePumps(s){const state=s||readState();return(Array.isArray(state.entries)?state.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);}
function liveBaby(s){const state=s||readState(),id=activeBabyId(state);return(Array.isArray(state.babyEvents)?state.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e.babyId||e.babyId===id));}
function endpoints(){const c=window.MILKFLOW_CONFIG||{};return[...new Set([c.familyChatEndpoint,...(Array.isArray(c.familyChatEndpoints)?c.familyChatEndpoints:[])].map(x=>String(x||'').trim()).filter(Boolean))];}
function permanentTarget(){const a=Number(window.MilkFlowPumpTarget?.get?.());if(Number.isFinite(a))return a;const b=Number(readState().profile?.dailyPumpTarget);return Number.isFinite(b)?Math.max(1,Math.min(8,Math.round(b))):6;}
function currentPlan(){try{return window.MilkFlowDynamicPump?.getPlan?.()||null;}catch{return null;}}
function planActions(){const normal=permanentTarget(),todayTarget=Number(currentPlan()?.target)||normal;return[{id:'replan',label:'Refresh today’s plan'},{id:`today:${todayTarget}`,label:`Today ${todayTarget}`},{id:`permanent:${normal}`,label:`Normal ${normal}/day`}];}


const CONFIRM_KEY='milkflow-chat-log-confirm-v1';
function pendingLog(){const p=readJSON(CONFIRM_KEY,null);return p&&Date.now()-Number(p.savedAt||0)<1800000?p:null;}
function storePendingLog(p){try{if(p)localStorage.setItem(CONFIRM_KEY,JSON.stringify(Object.assign({},p,{savedAt:Date.now()})));else localStorage.removeItem(CONFIRM_KEY);}catch{}}
function askToLog(q){
  const m=String(q||'').trim().match(/^(\d{1,4}(?:\.\d+)?)\s*(ml|milliliters?|oz|ounces?)\.?$/i);
  if(!m)return null;
  const amount=Number(m[1]),pump=/^ml|millil/i.test(m[2]);
  if(amount<=0||(pump&&amount>900)||(!pump&&amount>16))return null;
  const p={kind:pump?'pump':'feeding',amount,date:today(),time:clock(new Date())};
  storePendingLog(p);
  const last=pump?livePumps(readState()).filter(e=>e.date===today()).sort((a,b)=>String(a.time).localeCompare(String(b.time))).at(-1):null;
  const choices=[{id:'care-confirm',label:pump?'Log new pump':'Log bottle'}];
  if(last&&pump)choices.push({id:'care-edit',label:'Update last pump'});
  choices.push({id:'care-cancel',label:'Cancel'});
  return{reply:(pump?amount+' mL — is this a new pump or a correction?':amount+' oz — did baby have this bottle?')+(last&&pump?' Your latest pump today was '+last.amountMl+' mL at '+to12(last.time)+'.':'')+' Nothing will change until you choose.',actions:choices};
}
async function finishPendingLog(choice){
  const p=pendingLog();if(!p)return{reply:'No entry is waiting to be logged.'};
  if(choice==='cancel'){storePendingLog(null);return{reply:'No entry saved. 💛'};}
  if(choice==='edit'){
    if(p.kind!=='pump')return{reply:'An update is only available for a pumping entry.'};
    const s=readState(),last=livePumps(s).filter(e=>e.date===p.date).sort((a,b)=>String(a.time).localeCompare(String(b.time))).at(-1);
    if(!last)return{reply:'I cannot find a pump from today to update. No entry was changed.'};
    last.amountMl=p.amount;last.editedAt=new Date().toISOString();last.synced=false;
    writeState(s);
    try{await syncMom(last);}catch{ /* local edit remains queued for cloud reconciliation */ }
    storePendingLog(null);
    return{reply:'Updated the '+to12(last.time)+' pump to '+p.amount+' mL. No duplicate entry was created.'};
  }
  storePendingLog(null);
  const action=p.action||(p.kind==='pump'?{kind:'pump',amountMl:p.amount,date:p.date,time:p.time}:{kind:'feeding',amountOz:p.amount,feedingType:'expressed_milk',date:p.date,time:p.time});
  return await performAction(action);
}
function milkflowCareAdvice(q){
  const t=String(q||'').toLowerCase(),baby=/baby|infant|newborn|saahas|child|my son|my daughter/.test(t);
  if(baby&&/fever|temperature|difficulty breathing|letharg|unresponsive/.test(t))
    return 'For a baby under 3 months, a measured fever of 100.4°F (38°C) or higher needs urgent medical evaluation. Breathing difficulty, unresponsiveness or severe dehydration needs emergency care. How old is the baby and what temperature did you measure?';
  if(/mastitis|breast|tender|lump|clog|plugged|engorge|sore nipple|milk bleb|pain while pump/.test(t)||(!baby&&/fever|chills/.test(t))){
    if(/fever|chills|flu.like|red|hot|mastitis|shiver/.test(t))
      return 'Breast pain with fever or chills can be mastitis. Please contact your OB/midwife or clinician today. Keep your usual comfortable pumping or feeding rhythm, try a cold compress, rest and hydrate. Avoid deep massage, very high suction and extra pumping just to empty. Seek urgent care if you feel severely ill or rapidly worsen. What is your measured temperature, and is there redness or warmth?';
    return 'For breast tenderness, a cold compress, comfortable bra and your usual pumping rhythm may help. Check flange fit; avoid deep massage, high suction and extra emptying sessions. Seek prompt clinician advice for a painful growing lump, spreading redness, fever or chills. Which breast hurts, and do you have fever or redness?';
  }
  return null;
}
function chatPumpMetrics(){
  const all=livePumps(readState()),by={};
  for(const e of all){if(e.date>=today())continue;const row=by[e.date]||(by[e.date]={date:e.date,total:0,count:0});row.total+=Number(e.amountMl)||0;row.count++;}
  const dates=Object.values(by).sort((a,b)=>a.date.localeCompare(b.date)),last=dates.slice(-7),prev=dates.slice(-14,-7);
  if(!last.length)return 'There are no completed pumping days logged yet. Today stays live progress and is not used to infer a drop.';
  const mean=rs=>rs.length?rs.reduce((sum,x)=>sum+x.total,0)/rs.length:null;
  const avg=mean(last),before=mean(prev),pumps=last.reduce((sum,x)=>sum+x.count,0)/last.length;
  const td=all.filter(e=>e.date===today()),soFar=td.reduce((sum,e)=>sum+(Number(e.amountMl)||0),0);
  return 'Your last '+last.length+' completed logged days averaged '+Math.round(avg)+' mL/day across '+pumps.toFixed(1)+' pumps/day.'+(before==null?'':' The previous '+prev.length+' completed days averaged '+Math.round(before)+' mL/day ('+Math.abs(100*(avg-before)/before).toFixed(1)+'% '+(avg>=before?'higher':'lower')+').')+' Today so far is '+soFar+' mL from '+td.length+' pumps; today is excluded from trend comparisons. Missing logs and nursing volume are not counted.';
}
function chatBabyToday(){
  const events=liveBaby(readState()).filter(e=>e.date===today()),feeds=events.filter(e=>e.eventType==='feeding'),nursing=events.filter(e=>e.eventType==='nursing'),diapers=events.filter(e=>e.eventType==='diaper');
  const oz=feeds.reduce((n,e)=>n+(Number(e.amountOz)||0),0),wet=diapers.filter(e=>['wet','both','mixed'].includes(e.subtype)).length;
  return 'Baby today so far: '+feeds.length+' bottle feeds totaling '+oz.toFixed(1)+' oz, '+nursing.length+' nursing sessions and '+diapers.length+' diapers ('+wet+' wet or mixed). These are logged counts only; they cannot by themselves confirm adequate intake.';
}
function trackerFallback(q){
  const health=milkflowCareAdvice(q);if(health)return health;
  if(/avg|average|trend|compare|weekly|last week|pumping output|daily total|supply changes|doing better|doing worse/i.test(q))return chatPumpMetrics();
  if(/baby|saahas|feed|nursing|diaper|bottle/i.test(q))return chatBabyToday();
  return 'I can help with pumping trends and schedules, lactation questions, breast symptoms, feeding, diapers and baby-care questions. Deeper coaching requires the cloud chat service, which is currently unavailable; your logged data remains safe.';
}
function add(role,text,extra={}){const list=readChat();list.push({role,text:String(text||''),at:Date.now(),...extra});saveChat(list);renderMessages();}
function upsertAssistant(requestId,text='',extra={}){const list=readChat(),i=list.findIndex(m=>m.role==='assistant'&&m.requestId===requestId),next={role:'assistant',text:String(text||''),requestId,at:Date.now(),...extra};if(i>=0)list[i]={...list[i],...next};else list.push(next);saveChat(list);renderMessages();}
function findUserByRequest(requestId){return readChat().find(m=>m.role==='user'&&m.requestId===requestId)||null;}
function updateAssistantStatus(requestId,status,text){const list=readChat(),i=list.findIndex(m=>m.role==='assistant'&&m.requestId===requestId);if(i<0)return;list[i]={...list[i],status,...(text!==undefined?{text:String(text)}:{}),at:Date.now()};saveChat(list);renderMessages();}

function styles(){if(document.getElementById('mfChatStyles'))return;const s=document.createElement('style');s.id='mfChatStyles';s.textContent=`
.mf-chat-btn{position:fixed;z-index:90;right:16px;bottom:22px;width:52px;height:52px;border:0;border-radius:18px;background:color-mix(in srgb,var(--mom,#7653c6) 90%,#fff 10%);color:#fff;box-shadow:0 9px 24px rgba(36,30,63,.22);display:grid;place-items:center;cursor:pointer}.mf-chat-btn svg{width:23px;height:23px}.mf-chat-btn .dot{position:absolute;right:2px;top:2px;width:10px;height:10px;border-radius:50%;background:#55c38f;border:2px solid var(--surface,#fff)}
.mf-chat-panel{position:fixed;z-index:89;right:18px;bottom:86px;width:min(410px,calc(100vw - 24px));height:min(650px,74vh);background:var(--surface,#fff);color:var(--ink,#20202a);border:1px solid var(--line-soft,var(--line,#e7e5ed));border-radius:24px;box-shadow:0 24px 70px rgba(27,24,43,.22);overflow:hidden;display:none;grid-template-rows:auto 1fr auto}.mf-chat-panel.open{display:grid}.mf-chat-head{padding:14px 15px;display:flex;gap:10px;align-items:center;border-bottom:1px solid var(--line-soft,var(--line,#eee))}.mf-chat-avatar{width:38px;height:38px;border-radius:14px;background:var(--mom,#7653c6);color:#fff;display:grid;place-items:center;font-weight:900}.mf-chat-head-text{min-width:0;flex:1}.mf-chat-head-text strong,.mf-chat-head-text small{display:block}.mf-chat-head-text small{font-size:.7rem;color:var(--muted,#74717d)}.mf-chat-close{border:0;background:transparent;font-size:1.4rem;color:var(--muted,#777)}
.mf-chat-body{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px}.mf-chat-welcome{padding:12px 13px;border-radius:16px;background:var(--surface-2,#f7f5fa);font-size:.78rem;line-height:1.5;color:var(--muted,#706d78)}.mf-chat-row{display:flex;flex-direction:column}.mf-chat-row.user{align-items:flex-end}.mf-chat-msg{max-width:88%;padding:10px 12px;border-radius:16px;font-size:.82rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.mf-chat-row.user .mf-chat-msg{background:var(--mom,#7653c6);color:#fff}.mf-chat-row.assistant .mf-chat-msg{background:var(--surface-2,#f7f5fa)}.mf-chat-status{font-size:.66rem;color:var(--muted,#777);margin:4px 5px}.mf-chat-actions,.mf-chat-quick{display:flex;gap:6px;overflow:auto;flex-wrap:wrap}.mf-chat-actions{margin:6px 0 0 3px}.mf-chat-quick{padding:0 14px 9px;flex-wrap:nowrap}.mf-chat-actions button,.mf-chat-quick button,.mf-chat-retry{border:1px solid var(--line-soft,var(--line,#ddd));background:var(--surface,#fff);color:var(--ink,#222);border-radius:999px;padding:7px 10px;font:inherit;font-size:.68rem;font-weight:800;white-space:nowrap}.mf-chat-compose{border-top:1px solid var(--line-soft,var(--line,#eee));padding:10px}.mf-chat-form{display:flex;gap:8px;align-items:flex-end}.mf-chat-input{flex:1;resize:none;min-height:44px;max-height:112px;border:1px solid var(--line-soft,var(--line,#ddd));border-radius:15px;background:var(--surface-2,#faf9fb);color:var(--ink,#222);padding:11px 12px;font:inherit}.mf-chat-send{width:44px;height:44px;border:0;border-radius:14px;background:var(--mom,#7653c6);color:#fff}.mf-chat-note{display:block;margin:7px 3px 0;font-size:.62rem;color:var(--muted,#777)}
@media(max-width:700px){.mf-chat-btn{right:10px;bottom:calc(82px + env(safe-area-inset-bottom));width:46px;height:46px;border-radius:16px;box-shadow:0 7px 20px rgba(36,30,63,.20)}.mf-chat-btn svg{width:21px;height:21px}.mf-chat-btn .dot{width:9px;height:9px}.mf-chat-panel{right:8px;bottom:calc(136px + env(safe-area-inset-bottom));width:calc(100vw - 16px);height:min(610px,70vh);border-radius:22px}}`;document.head.appendChild(s);}
function renderMessages(){const body=document.getElementById('mfChatBody');if(!body)return;body.innerHTML=`<div class="mf-chat-welcome">Ask about pumping trends, breast tenderness, supply, fever, feeding, baby care, and your logs. I'll confirm an unclear amount before saving.</div>`+readChat().map(m=>`<div class="mf-chat-row ${m.role==='user'?'user':'assistant'}"><div class="mf-chat-msg">${esc(m.text)}</div>${m.status&&m.status!=='completed'?`<small class="mf-chat-status">${esc(m.status==='failed'?'Couldn’t finish automatically.':'Working…')}</small>`:''}${m.status==='failed'&&m.requestId?`<button class="mf-chat-retry" data-mf-retry="${esc(m.requestId)}">Retry</button>`:''}${Array.isArray(m.actions)&&m.actions.length?`<div class="mf-chat-actions">${m.actions.map(a=>`<button data-mf-action="${esc(a.id)}">${esc(a.label)}</button>`).join('')}</div>`:''}</div>`).join('');body.scrollTop=body.scrollHeight;}

function parseExplicitTime(text){let m=String(text).match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);if(m){let h=+m[1],min=+(m[2]||0);const pm=/p/i.test(m[3]);if(h===12)h=0;if(pm)h+=12;return`${pad(h)}:${pad(min)}`;}m=String(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);if(m)return`${pad(+m[1])}:${pad(+m[2])}`;if(/\b(now|just now|just pumped|just nursed|just fed|just changed)\b/i.test(text))return clock(new Date());return null;}
function targetNumber(text){const words={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8};const m=String(text).toLowerCase().match(/\b([1-8]|one|two|three|four|five|six|seven|eight)\b/);return m?(words[m[1]]||Number(m[1])):null;}
function parsePlanCommand(text){const q=String(text||'').toLowerCase(),n=targetNumber(q),time=parseExplicitTime(q);if(n&&/\b(pump|pumps|session|sessions|target|schedule|plan)\b/.test(q)){if(/\b(normal|usual|default|permanent|daily|every day)\b/.test(q))return{kind:'permanentTarget',target:n};if(/\btomorrow\b/.test(q))return{kind:'tomorrowTarget',target:n};if(/\b(today|tonight|switch|make|use|target|plan)\b/.test(q))return{kind:'todayTarget',target:n};}if(time&&/\b(next\s+pump|move\s+(?:my\s+)?next|set\s+(?:my\s+)?next|next\s+session)\b/.test(q))return{kind:'nextTime',time};if(/\b(recalculate|recalc|refresh|adjust|shift|update)\b.*\b(plan|schedule|times?)\b/.test(q)||/\bplan\s+(?:for\s+)?today\b/.test(q))return{kind:'replan'};return null;}
function parseNaturalAction(text){const q=String(text||'');if(/\b(avg|average|compare|trend|why|how much|analyse|analyze|fever|tender|pain|help|recommend)\b/i.test(q))return null;const date=/\byesterday\b/i.test(q)?dateShift(-1):today(),time=parseExplicitTime(q),ml=+(q.match(/\b(\d{1,4}(?:\.\d+)?)\s*(?:ml|millilit(?:er|re)s?)\b/i)?.[1]||0),oz=+(q.match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:oz|ounce|ounces)\b/i)?.[1]||0),mins=+(q.match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i)?.[1]||0),nursing=/\b(nurs(?:e|ed|ing)?|breast\s*feed|breastfed|breastfeeding)\b/i.test(q),bottle=/\b(formula|breast\s*milk|expressed|bottle)\b/i.test(q);if(ml&&time&&!bottle&&!nursing)return{kind:'pump',date,time,amountMl:ml};if(nursing&&mins)return{kind:'nursing',date,time:time||clock(new Date()),durationMinutes:mins,side:/\bright\b/i.test(q)?'right':/\bleft\b/i.test(q)?'left':/\bboth\b/i.test(q)?'both':null};if(/\b(diaper|nappy|wet|poopy|poop|dirty|mixed)\b/i.test(q)&&/\b(wet|poopy|poop|dirty|mixed|both)\b/i.test(q))return{kind:'diaper',date,time:time||clock(new Date()),subtype:/\b(mixed|both)\b/i.test(q)?'both':/\b(poopy|poop|dirty)\b/i.test(q)?'poop':'wet'};if(oz&&bottle)return{kind:'feeding',date,time:time||clock(new Date()),amountOz:oz,feedingType:/\bformula\b/i.test(q)?'formula':'expressed_milk'};return null;}

function writeState(s){const oldRaw=localStorage.getItem(STATE_KEY);s.savedAt=Math.max(Date.now(),Number(s.savedAt||0)+1);const raw=JSON.stringify(s);localStorage.setItem(STATE_KEY,raw);try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,oldValue:oldRaw,newValue:raw,storageArea:localStorage,url:location.href}));}catch{}window.dispatchEvent(new CustomEvent('milkflow:chat-data'));}
// Chat logs must carry the origin in the FIRST Firestore write, just like forms.
// Doing this in the cloud write alone leaves a race with the create-triggered push.
function stampChatEntry(e){
  if(!e?.sourceDeviceId){
    const stamp=window.MilkFlowCrossDeviceAlerts?.stamp?.();
    if(stamp?.sourceDeviceId)Object.assign(e,{...stamp,sourceClientAt:e.createdAt||stamp.sourceClientAt});
  }
  return e;
}
async function syncMom(e){const u=window.firebase?.auth?.().currentUser;if(!u||!window.firebase?.firestore)return;await window.firebase.firestore().collection('users').doc(u.uid).collection('entries').doc(e.id).set({...stampChatEntry(e),updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
async function syncBaby(e){const u=window.firebase?.auth?.().currentUser;if(!u||!window.firebase?.firestore)return;await window.firebase.firestore().collection('users').doc(u.uid).collection('familyEvents').doc(e.id).set({...stampChatEntry(e),updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});}
function pumpSummary(s,day){const rows=livePumps(s).filter(e=>e.date===day);return{count:rows.length,total:rows.reduce((a,e)=>a+(Number(e.amountMl)||0),0)};}
function planText(prefix){const p=currentPlan(),sum=pumpSummary(readState(),today()),next=p?.future?.length?to12m(Number(p.future[0])):null;return`${prefix}${p?`\n\nToday: ${sum.total} mL · ${sum.count}/${p.target||permanentTarget()} pumps${next?` · next around ${next}`:''}.`:''}`;}
async function performPlanCommand(cmd){if(cmd.kind==='permanentTarget'){const n=await window.MilkFlowPumpTarget?.set?.(cmd.target);return{reply:`Done 💛 Your normal synced target is now ${n||cmd.target} pump${(n||cmd.target)===1?'':'s'} per day.`,actions:planActions()};}const api=window.MilkFlowDynamicPump;if(!api)return{reply:'The live planner is still loading. Open Mom Home once and try again.'};if(cmd.kind==='todayTarget'){api.setTodayTarget?.(cmd.target);return{reply:planText(`Done 💛 Today is set to ${cmd.target} pump${cmd.target===1?'':'s'} only.`),actions:planActions()};}if(cmd.kind==='tomorrowTarget'){api.setTomorrowTarget?.(cmd.target);return{reply:`Done 💛 Tomorrow is ${cmd.target} pump${cmd.target===1?'':'s'} as a one-day override. Your normal target remains ${permanentTarget()}/day.`};}if(cmd.kind==='nextTime'){api.setTodayNextTime?.((+cmd.time.slice(0,2))*60+(+cmd.time.slice(3)));return{reply:planText(`Done 💛 I moved the next pump toward ${to12(cmd.time)}.`),actions:planActions()};}return{reply:planText('I refreshed today from what you actually logged 💛'),actions:planActions()};}
async function performAction(a){const s=readState();if(a.kind==='pump'){const dupe=livePumps(s).find(e=>e.date===a.date&&e.time===a.time&&Number(e.amountMl)===Number(a.amountMl));if(dupe)return{reply:'That pump is already logged.'};const e={id:uid('chat-pump'),type:'pump',date:a.date,time:a.time,amountMl:a.amountMl,source:'MilkFlow Chat',createdAt:new Date().toISOString(),voidedAt:null};s.entries=Array.isArray(s.entries)?s.entries:[];s.entries.push(e);writeState(s);try{await syncMom(e);}catch(err){console.warn('Chat pump cloud sync deferred',err);}const sum=pumpSummary(s,a.date);return{reply:`Logged 💛 ${a.amountMl} mL at ${to12(a.time)}.${a.date===today()?` Today is now ${sum.total} mL across ${sum.count} pump${sum.count===1?'':'s'}.`:''}`,actions:planActions()};}const events=Array.isArray(s.babyEvents)?s.babyEvents:[],babyId=activeBabyId(s);let e;if(a.kind==='nursing')e={id:uid('chat-baby'),babyId,eventType:'nursing',date:a.date,time:a.time,durationMinutes:a.durationMinutes,totalMinutes:a.durationMinutes,side:a.side||null,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString()};if(a.kind==='diaper')e={id:uid('chat-baby'),babyId,eventType:'diaper',date:a.date,time:a.time,subtype:a.subtype,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString()};if(a.kind==='feeding')e={id:uid('chat-baby'),babyId,eventType:'feeding',date:a.date,time:a.time,feedingType:a.feedingType,amountOz:a.amountOz,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString()};if(!e)return null;events.push(e);s.babyEvents=events;writeState(s);try{await syncBaby(e);}catch(err){console.warn('Chat baby cloud sync deferred',err);}return{reply:a.kind==='feeding'?`Logged 🍼 ${a.amountOz} oz at ${to12(a.time)}.`:a.kind==='nursing'?`Logged 💕 ${a.durationMinutes} minutes nursing at ${to12(a.time)}.`:`Logged 💛 ${a.subtype} diaper at ${to12(a.time)}.`};}

function context(){const s=readState(),p=currentPlan(),normal=permanentTarget();let tomorrowTarget=null;try{const c=readJSON('milkflow-pumping-coach-v1',{});tomorrowTarget=Number(c.dayTargets?.[dateShift(1)])||null;}catch{}return{localDay:today(),currentLocalTime:new Date().toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,currentWorkspace:s.ui?.workspace||null,activeBaby:s.baby?{id:s.baby.id||null,name:s.baby.name||null,birthDate:s.baby.birthDate||null}:null,pumpChoices:{permanentTarget:normal,todayTarget:Number(p?.target)||normal,tomorrowTarget},dynamicPlan:p?{target:p.target,remaining:p.remaining,future:Array.isArray(p.future)?p.future.slice(0,8):[],source:p.source||null}:null,recentMom:livePumps(s).slice(-24).map(e=>({type:e.type,date:e.date,time:e.time,amountMl:e.amountMl??null})),recentBaby:liveBaby(s).slice(-36).map(e=>({eventType:e.eventType,date:e.date,time:e.time,subtype:e.subtype||null,feedingType:e.feedingType||null,amountOz:e.amountOz??null,durationMinutes:e.durationMinutes??e.totalMinutes??null})),localConversation:readChat().slice(-8).map(m=>({role:m.role,text:String(m.text||'').slice(0,700)}))};}
async function post(url,user,body,timeout=18000){const token=await user.getIdToken(),ctl=new AbortController(),timer=setTimeout(()=>ctl.abort(),timeout);try{return await fetch(url,{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),signal:ctl.signal});}finally{clearTimeout(timer);}}
async function recoverCloudRequest(pending,user){let started=false;for(const url of endpoints()){try{const r=await post(url,user,{mode:'run',requestId:pending.requestId,message:pending.message,context:context()});const j=await r.json().catch(()=>({}));if(r.status===202){started=true;break;}if((r.ok||r.status===429)&&j.reply)return j;}catch(err){console.warn('Chat request failed',err?.message||err);}}for(let i=0;i<STATUS_POLL_LIMIT&&(started||i<3);i++){await new Promise(r=>setTimeout(r,STATUS_POLL_MS));for(const url of endpoints()){try{const r=await post(url,user,{mode:'status',requestId:pending.requestId},8000),j=await r.json().catch(()=>({}));if(r.ok&&j.status==='completed'&&j.reply)return j;if(j.status==='failed')throw new Error(j.error||'Request failed');}catch(err){console.warn('Chat status failed',err?.message||err);}}}throw new Error('Chat recovery timed out');}
function recoverLegacyHistory(){const list=readChat();let changed=false;for(const m of list){if(m.role==='assistant'&&m.status&&m.status!=='completed'&&!m.requestId){m.status='failed';m.text=m.text||'This older reply could not be recovered.';changed=true;}}if(changed)saveChat(list);}
async function resumePending(){if(recoveryPromise)return recoveryPromise;const pending=readPending(),user=window.firebase?.auth?.().currentUser;if(!pending||!user)return null;busy=true;recoveryPromise=(async()=>{try{const out=await recoverCloudRequest(pending,user);upsertAssistant(pending.requestId,out.reply||'Done.',{status:'completed'});savePending(null);return out;}catch(err){upsertAssistant(pending.requestId,trackerFallback(pending.message)+'\n\n(Basic local answer; deeper cloud coaching is unavailable.)',{status:'completed'});savePending(null);return null;}finally{busy=false;recoveryPromise=null;}})();return recoveryPromise;}
async function retryRequest(requestId){const m=findUserByRequest(requestId);if(!m)return;savePending({requestId,message:m.text,createdAt:m.at||Date.now()});upsertAssistant(requestId,'',{status:'sending'});try{await resumePending();}catch{}}
async function sendMessage(text){
  if(busy)return;
  const message=String(text||'').trim().slice(0,1800);if(!message)return;
  const input=document.getElementById('mfChatInput');if(input)input.value='';
  if(pendingLog()&&/^(yes|yep|sure|okay|ok|confirm|log it|save it)$/i.test(message)){
    add('user',message);const p=pendingLog();
    const last=p.kind==='pump'?livePumps(readState()).some(e=>e.date===p.date):false;
    if(last){add('assistant','Should I log a new pump or update the last one?',{actions:[{id:'care-confirm',label:'Log new'},{id:'care-edit',label:'Update last'},{id:'care-cancel',label:'Cancel'}]});return;}
    const out=await finishPendingLog('new');add('assistant',out.reply,{actions:out.actions});return;
  }
  if(pendingLog()&&/^(no|nope|cancel|not now|never mind)$/i.test(message)){add('user',message);const out=await finishPendingLog('cancel');add('assistant',out.reply);return;}
  if(pendingLog()&&/^(at|time|change time)/i.test(message)){
    const time=parseExplicitTime(message);
    if(time){const p=pendingLog();storePendingLog(Object.assign({},p,{time}));add('user',message);add('assistant','Log '+p.amount+' '+(p.kind==='pump'?'mL':'oz')+' at '+to12(time)+'?',{actions:[{id:'care-confirm',label:'Yes, log it'},{id:'care-cancel',label:'Cancel'}]});return;}
  }
  const offer=askToLog(message);if(offer){add('user',message);add('assistant',offer.reply,{actions:offer.actions});return;}
  const cmd=parsePlanCommand(message);if(cmd){add('user',message);try{const out=await performPlanCommand(cmd);add('assistant',out.reply,{actions:out.actions});}catch{add('assistant','I could not update the plan. Try the Mom Home controls.');}return;}
  const action=parseNaturalAction(message);if(action){add('user',message);storePendingLog({kind:action.kind,action});add('assistant','I understood this as '+(action.kind==='pump'?action.amountMl+' mL pumping':action.kind==='feeding'?action.amountOz+' oz bottle':action.kind==='diaper'?action.subtype+' diaper':action.kind==='nursing'?action.durationMinutes+' min nursing':'a care entry')+' at '+to12(action.time)+'. Save it?',{actions:[{id:'care-confirm',label:'Save entry'},{id:'care-cancel',label:'Cancel'}]});return;}
  const user=window.firebase?.auth?.().currentUser;
  if(!user||!endpoints().length){add('user',message);add('assistant',trackerFallback(message));return;}
  const requestId=uid('chatreq'),pending={requestId,message,createdAt:Date.now()};
  add('user',message,{requestId});upsertAssistant(requestId,'',{status:'sending'});savePending(pending);
  try{await resumePending();}catch{}
}

function mount(){styles();if(document.getElementById('mfChatButton'))return;const btn=document.createElement('button');btn.id='mfChatButton';btn.className='mf-chat-btn';btn.setAttribute('aria-label','Open MilkFlow Chat');btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/></svg><span class="dot"></span>';const panel=document.createElement('section');panel.id='mfChatPanel';panel.className='mf-chat-panel';panel.innerHTML=`<div class="mf-chat-head"><div class="mf-chat-avatar">MF</div><div class="mf-chat-head-text"><strong>MilkFlow Care Chat</strong><small>Mom + Baby care and data</small></div><button class="mf-chat-close" aria-label="Close">×</button></div><div id="mfChatBody" class="mf-chat-body"></div><div><div class="mf-chat-quick"><button data-mf-prompt="What is my pumping average from completed days?">Pump average</button><button data-mf-prompt="Compare my last 7 completed pumping days with the previous 7.">7-day trend</button><button data-mf-prompt="How is baby doing today from the tracker?">Baby today</button><button data-mf-prompt="My breast is tender; what should I do?">Breast care</button></div><div class="mf-chat-compose"><form id="mfChatForm" class="mf-chat-form"><textarea id="mfChatInput" class="mf-chat-input" maxlength="1800" rows="1" placeholder="Ask MilkFlow or log an entry…"></textarea><button class="mf-chat-send" aria-label="Send">➤</button></form><small class="mf-chat-note">Mom + Baby care and tracker insight · not a medical diagnosis.</small></div></div>`;document.body.append(panel,btn);renderMessages();btn.addEventListener('click',()=>panel.classList.toggle('open'));panel.querySelector('.mf-chat-close')?.addEventListener('click',()=>panel.classList.remove('open'));panel.querySelector('#mfChatForm')?.addEventListener('submit',e=>{e.preventDefault();sendMessage(panel.querySelector('#mfChatInput')?.value);});panel.addEventListener('click',async e=>{const prompt=e.target.closest('[data-mf-prompt]')?.dataset.mfPrompt;if(prompt)return sendMessage(prompt);const id=e.target.closest('[data-mf-action]')?.dataset.mfAction;if(id==='care-confirm'||id==='care-cancel'||id==='care-edit'){const out=await finishPendingLog(id==='care-confirm'?'new':id==='care-edit'?'edit':'cancel');add('assistant',out.reply,{actions:out.actions});return;}if(id){let cmd;if(id==='replan'cmd={kind:'replan'};else{const [kind,n]=id.split(':');cmd={kind:kind==='permanent'?'permanentTarget':'todayTarget',target:Number(n)};}const out=await performPlanCommand(cmd);add('assistant',out.reply,{actions:out.actions});return;}const retry=e.target.closest('[data-mf-retry]')?.dataset.mfRetry;if(retry)retryRequest(retry);});recoverLegacyHistory();setTimeout(()=>resumePending().catch(()=>{}),400);}

if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
window.addEventListener('pageshow',()=>resumePending().catch(()=>{}));
})();
