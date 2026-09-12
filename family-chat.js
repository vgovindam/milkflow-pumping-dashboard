(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const CHAT_KEY='milkflow-family-chat-v1';
const MAX_LOCAL=60;
let busy=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const readState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const readChat=()=>{try{const x=JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');return Array.isArray(x)?x:[];}catch{return [];}};
const saveChat=a=>{try{localStorage.setItem(CHAT_KEY,JSON.stringify(a.slice(-MAX_LOCAL)));}catch{}};
const dateKey=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const clock=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const today=()=>dateKey(new Date());
const uid=p=>`${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;

function endpoint(){return String(window.MILKFLOW_CONFIG?.familyChatEndpoint||'').trim();}
function isOpen(){return document.getElementById('mfChatPanel')?.classList.contains('open');}
function to12(t){if(!t)return'—';const [h,m]=String(t).split(':').map(Number);if(!Number.isFinite(h)||!Number.isFinite(m))return String(t);return `${((h+11)%12)+1}:${pad(m)} ${h>=12?'PM':'AM'}`;}
function to12m(m){if(!Number.isFinite(m))return'—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;}
function shortDate(k){try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${k}T12:00:00`));}catch{return k;}}
function localTimestamp(){const d=new Date(),off=-d.getTimezoneOffset(),sign=off>=0?'+':'-',oh=pad(Math.floor(Math.abs(off)/60)),om=pad(Math.abs(off)%60);return `${dateKey(d)}T${clock(d)}:${pad(d.getSeconds())}${sign}${oh}:${om}`;}
function activeBabyId(s){return s.baby?.id||'saahas-2026';}
function livePumps(s){return(Array.isArray(s.entries)?s.entries:[]).filter(e=>e?.type==='pump'&&!e?.voidedAt&&e?.date&&e?.time);}
function liveBaby(s){const id=activeBabyId(s);return(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e.babyId||e.babyId===id));}

function styles(){
  if(document.getElementById('mfChatStyles'))return;
  const s=document.createElement('style');s.id='mfChatStyles';s.textContent=`
  .mf-chat-btn{position:fixed;z-index:90;right:18px;bottom:24px;width:58px;height:58px;border:0;border-radius:50%;background:var(--mom,#7653c6);color:#fff;box-shadow:0 14px 34px rgba(36,30,63,.28);display:grid;place-items:center;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.mf-chat-btn:hover{transform:translateY(-2px);box-shadow:0 17px 38px rgba(36,30,63,.32)}.mf-chat-btn svg{width:26px;height:26px}.mf-chat-btn .dot{position:absolute;right:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#55c38f;border:2px solid var(--surface,#fff)}
  .mf-chat-panel{position:fixed;z-index:89;right:18px;bottom:94px;width:min(410px,calc(100vw - 24px));height:min(650px,74vh);background:var(--surface,#fff);color:var(--ink,#20202a);border:1px solid var(--line-soft,var(--line,#e7e5ed));border-radius:24px;box-shadow:0 24px 70px rgba(27,24,43,.22);overflow:hidden;display:none;grid-template-rows:auto 1fr auto}.mf-chat-panel.open{display:grid}
  .mf-chat-head{padding:14px 15px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line-soft,var(--line,#eee));background:linear-gradient(145deg,color-mix(in srgb,var(--mom,#7653c6) 9%,var(--surface,#fff)),var(--surface,#fff))}.mf-chat-avatar{width:38px;height:38px;border-radius:14px;background:var(--mom,#7653c6);color:#fff;display:grid;place-items:center;font-weight:900}.mf-chat-head-text{min-width:0;flex:1}.mf-chat-head-text strong,.mf-chat-head-text small{display:block}.mf-chat-head-text strong{font-size:.95rem}.mf-chat-head-text small{font-size:.7rem;color:var(--muted,#74717d);margin-top:2px}.mf-chat-close{width:38px;height:38px;border:0;border-radius:12px;background:transparent;color:var(--muted,#777);font-size:1.4rem;cursor:pointer}
  .mf-chat-body{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}.mf-chat-welcome{padding:12px 13px;border-radius:16px;background:var(--surface-2,#f7f5fa);font-size:.78rem;line-height:1.5;color:var(--muted,#706d78)}.mf-chat-row{display:flex}.mf-chat-row.user{justify-content:flex-end}.mf-chat-msg{max-width:88%;padding:10px 12px;border-radius:16px;font-size:.82rem;line-height:1.5;white-space:pre-wrap;overflow-wrap:anywhere}.mf-chat-row.user .mf-chat-msg{background:var(--mom,#7653c6);color:#fff;border-bottom-right-radius:5px}.mf-chat-row.assistant .mf-chat-msg{background:var(--surface-2,#f7f5fa);color:var(--ink,#222);border-bottom-left-radius:5px}.mf-chat-typing{font-size:.75rem;color:var(--muted,#777);padding:2px 5px}
  .mf-chat-quick{display:flex;gap:6px;overflow:auto;padding:0 14px 9px;scrollbar-width:none}.mf-chat-quick::-webkit-scrollbar{display:none}.mf-chat-quick button{white-space:nowrap;border:1px solid var(--line-soft,var(--line,#e6e3ec));background:var(--surface,#fff);color:var(--ink,#222);border-radius:999px;padding:7px 10px;font:inherit;font-size:.7rem;font-weight:750;cursor:pointer}
  .mf-chat-compose{border-top:1px solid var(--line-soft,var(--line,#eee));padding:10px;background:var(--surface,#fff)}.mf-chat-form{display:flex;align-items:flex-end;gap:8px}.mf-chat-input{flex:1;resize:none;min-height:44px;max-height:112px;border:1px solid var(--line-soft,var(--line,#dedbe6));border-radius:15px;background:var(--surface-2,#faf9fb);color:var(--ink,#222);padding:11px 12px;font:inherit;font-size:.83rem;line-height:1.35;outline:none}.mf-chat-input:focus{border-color:color-mix(in srgb,var(--mom,#7653c6) 55%,var(--line,#ddd))}.mf-chat-send{width:44px;height:44px;border:0;border-radius:14px;background:var(--mom,#7653c6);color:#fff;display:grid;place-items:center;cursor:pointer;font-size:1.1rem}.mf-chat-send:disabled{opacity:.45;cursor:default}.mf-chat-note{display:block;margin:7px 3px 0;font-size:.62rem;color:var(--muted,#777);line-height:1.35}
  @media(max-width:700px){.mf-chat-btn{right:14px;bottom:calc(78px + env(safe-area-inset-bottom));width:56px;height:56px}.mf-chat-panel{right:10px;bottom:calc(143px + env(safe-area-inset-bottom));width:calc(100vw - 20px);height:min(620px,70vh);border-radius:22px}}
  `;document.head.appendChild(s);
}

function context(){
  const s=readState();
  const cleanMom=e=>({type:e.type||null,date:e.date||null,time:e.time||null,amountMl:e.amountMl??null,durationMinutes:e.durationMinutes??e.durationMin??e.duration??null,side:e.side||null,voidedAt:e.voidedAt||null});
  const cleanBaby=e=>({babyId:e.babyId||e.baby_id||null,eventType:e.eventType||e.event_type||null,date:e.date||null,time:e.time||null,subtype:e.subtype||null,feedingType:e.feedingType||e.feeding_type||null,amountOz:e.amountOz??e.amount_oz??null,durationMinutes:e.durationMinutes??e.duration_minutes??null,totalMinutes:e.totalMinutes??e.total_minutes??null,leftMinutes:e.leftMinutes??e.left_minutes??null,rightMinutes:e.rightMinutes??e.right_minutes??null,side:e.side||null,weightLb:e.weightLb??e.weight_lb??null,weightOz:e.weightOz??e.weight_oz??null,lengthIn:e.lengthIn??e.length_in??null,headIn:e.headIn??e.head_in??null,milestoneId:e.milestoneId??e.milestone_id??null,milestoneText:e.milestoneText??e.milestone_text??null,milestoneGroup:e.milestoneGroup??e.milestone_group??null,milestoneMonth:e.milestoneMonth??e.milestone_month??null,voidedAt:e.voidedAt||null});
  let dynamicPlan=null;
  try{const p=window.MilkFlowDynamicPump?.getPlan?.();if(p)dynamicPlan={target:p.target,remaining:p.remaining,preferredGapMinutes:p.preferred,future:Array.isArray(p.future)?p.future:[],last:p.last?cleanMom(p.last):null,lastGapMinutes:p.lastGap??null};}catch{}
  return {
    currentLocalTime:localTimestamp(),
    timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||null,
    currentWorkspace:s.ui?.workspace||null,
    activeBaby:s.baby?{id:s.baby.id||null,name:s.baby.name||null,birthDate:s.baby.birthDate||null}:null,
    dynamicPlan,
    recentMom:(Array.isArray(s.entries)?s.entries:[]).filter(e=>!e?.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`)).slice(-40).map(cleanMom),
    recentBaby:(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`)).slice(-80).map(cleanBaby),
    localConversation:readChat().slice(-12).map(m=>({role:m.role,text:String(m.text||'').slice(0,1000)}))
  };
}

function renderMessages(){
  const body=document.getElementById('mfChatBody');if(!body)return;
  const list=readChat();
  body.innerHTML=`<div class="mf-chat-welcome">Talk to me naturally 💛 You can say “6:50am 200ml”, “I slept in”, “when should I pump next?”, or ask about Baby. Pump, nursing, bottle and diaper logs can be added right from chat.</div>`+list.map(m=>`<div class="mf-chat-row ${m.role==='user'?'user':'assistant'}"><div class="mf-chat-msg">${esc(m.text)}</div></div>`).join('');
  body.scrollTop=body.scrollHeight;
}

function add(role,text,extra={}){const list=readChat();list.push({role,text:String(text),at:Date.now(),...extra});saveChat(list);renderMessages();}
function setBusy(v){busy=v;const send=document.getElementById('mfChatSend'),input=document.getElementById('mfChatInput'),body=document.getElementById('mfChatBody');if(send)send.disabled=v;if(input)input.disabled=v;document.getElementById('mfChatTyping')?.remove();if(v&&body){const d=document.createElement('div');d.id='mfChatTyping';d.className='mf-chat-typing';d.textContent='MilkFlow is thinking…';body.appendChild(d);body.scrollTop=body.scrollHeight;}}

function parseDateFromText(text){const d=new Date();if(/\byesterday\b/i.test(text))d.setDate(d.getDate()-1);return dateKey(d);}
function parseExplicitTime(text){
  let m=String(text).match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(a\.?m\.?|p\.?m\.?)\b/i);
  if(m){let h=+m[1],min=+(m[2]||0);const pm=/p/i.test(m[3]);if(h===12)h=0;if(pm)h+=12;return `${pad(h)}:${pad(min)}`;}
  m=String(text).match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);if(m)return `${pad(+m[1])}:${pad(+m[2])}`;
  if(/\b(now|just now|just pumped|just nursed|just fed|just changed)\b/i.test(text))return clock(new Date());
  return null;
}
function parseMl(text){const m=String(text).match(/\b(\d{1,4}(?:\.\d+)?)\s*(?:ml|mL|millilit(?:er|re)s?)\b/i);return m?+m[1]:null;}
function parseOz(text){const m=String(text).match(/\b(\d{1,2}(?:\.\d+)?)\s*(?:oz|ounce|ounces)\b/i);return m?+m[1]:null;}
function parseMinutes(text){const m=String(text).match(/\b(\d{1,3})\s*(?:min|mins|minute|minutes)\b/i);return m?+m[1]:null;}
function parseNaturalAction(text){
  const q=String(text||'').trim(),date=parseDateFromText(q),time=parseExplicitTime(q),ml=parseMl(q),oz=parseOz(q),mins=parseMinutes(q);
  const bottleWords=/\b(formula|breast\s*milk|expressed|bottle)\b/i.test(q),nursing=/\b(nurs(?:e|ed|ing)?|breast\s*feed|breastfed|breastfeeding)\b/i.test(q),diaper=/\b(diaper|nappy)\b/i.test(q);
  if(ml!=null&&time&&!bottleWords&&!nursing)return{kind:'pump',date,time,amountMl:ml};
  if(nursing&&mins!=null){const side=/\bright\b/i.test(q)?'right':/\bleft\b/i.test(q)?'left':/\bboth\b/i.test(q)?'both':null;return{kind:'nursing',date,time:time||clock(new Date()),durationMinutes:mins,side};}
  if((diaper||/\b(wet|poopy|poop|dirty|mixed)\s+diaper\b/i.test(q))&&/\b(wet|poopy|poop|dirty|mixed|both)\b/i.test(q)){const subtype=/\b(mixed|both)\b/i.test(q)?'both':/\b(poopy|poop|dirty)\b/i.test(q)?'poop':'wet';return{kind:'diaper',date,time:time||clock(new Date()),subtype};}
  if(oz!=null&&bottleWords){const feedingType=/\bformula\b/i.test(q)?'formula':/\b(breast\s*milk|expressed)\b/i.test(q)?'expressed_milk':null;if(feedingType)return{kind:'feeding',date,time:time||clock(new Date()),amountOz:oz,feedingType};}
  return null;
}

function broadcastState(oldRaw,newRaw){
  try{window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,oldValue:oldRaw,newValue:newRaw,storageArea:localStorage,url:location.href}));}
  catch{window.dispatchEvent(new CustomEvent('milkflow:chat-data',{detail:{key:STATE_KEY}}));}
}
function writeState(s){const oldRaw=localStorage.getItem(STATE_KEY);s.savedAt=Math.max(Date.now(),Number(s.savedAt||0)+1);const raw=JSON.stringify(s);localStorage.setItem(STATE_KEY,raw);broadcastState(oldRaw,raw);}

async function syncMomEntry(e){
  const user=window.firebase?.auth?.().currentUser;if(!user||!window.firebase?.firestore)return false;
  try{const db=window.firebase.firestore();await db.collection('users').doc(user.uid).collection('entries').doc(e.id).set({type:e.type,date:e.date,time:e.time||'',amountMl:e.amountMl??null,durationMin:e.durationMin??null,side:e.side||null,quality:e.quality||null,note:e.note||'',source:e.source||'MilkFlow Chat',createdAt:e.createdAt||null,editedAt:e.editedAt||null,voidedAt:null,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});return true;}catch(err){console.warn('Chat pump cloud sync deferred',err);return false;}
}
async function syncBabyEntry(e){
  const user=window.firebase?.auth?.().currentUser;if(!user||!window.firebase?.firestore)return false;
  try{const db=window.firebase.firestore();await db.collection('users').doc(user.uid).collection('familyEvents').doc(e.id).set({...e,synced:true,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});return true;}catch(err){console.warn('Chat baby cloud sync deferred',err);return false;}
}

function pumpStats(s){
  const map={};for(const e of livePumps(s)){const d=map[e.date]||(map[e.date]={date:e.date,total:0,count:0,sessions:[]});d.total+=Number(e.amountMl)||0;d.count++;d.sessions.push(e);}
  for(const d of Object.values(map)){const o=Number(s.dailyOverrides?.[d.date]);if(Number.isFinite(o)&&o>d.total)d.total=o;}
  const rows=Object.values(map).sort((a,b)=>a.date.localeCompare(b.date));
  const highSession=livePumps(s).reduce((best,e)=>(Number(e.amountMl)||0)>(Number(best?.amountMl)||0)?e:best,null);
  const done=rows.filter(r=>r.date<today());const highDay=done.reduce((best,r)=>r.total>(best?.total||-1)?r:best,null);
  return{rows,highSession,highDay};
}
function nextPumpLine(){
  try{const p=window.MilkFlowDynamicPump?.getPlan?.();if(p?.remaining&&p.future?.length)return `💕 Next pump: around ${to12m(p.future[0]-10)}–${to12m(p.future[0]+10)}.`;if(p&&!p.remaining)return `💕 You’ve reached today’s ${p.target||6}-pump target.`;}catch{}
  return '';
}
function friendlyPumpReply(entry,duplicate=false){
  const s=readState(),stats=pumpStats(s),rows=stats.rows.slice(-7),day=stats.rows.find(r=>r.date===entry.date),recent=readChat().slice(-8).filter(m=>m.role==='user').map(m=>m.text).join(' '),lateStart=/slept|sleep|woke|alarm|overslept|slept in/i.test(recent);
  const lines=[];
  lines.push(duplicate?`I already have that one 💛 ${shortDate(entry.date)} · ${to12(entry.time)} · ${entry.amountMl} mL, so I didn’t duplicate it.`:`Got it! 🍼💛 ${shortDate(entry.date)} · ${to12(entry.time)} · ${entry.amountMl} mL logged.`);
  if(!duplicate&&lateStart&&entry.date===today())lines.push(`And that’s a lovely morning output after the later start — no need to cram in a catch-up pump.`);
  if(day)lines.push(`\n🌷 ${entry.date===today()?'Today so far':shortDate(entry.date)}: ${day.total} mL · ${day.count} pump${day.count===1?'':'s'}`);
  if(rows.length){lines.push(`\nRolling 7 days\n${rows.map(r=>`${r.date===today()?'• Today':`• ${shortDate(r.date)}`} — ${r.total} mL · ${r.count} pump${r.count===1?'':'s'}`).join('\n')}`);}
  if(stats.highSession)lines.push(`\n🏆 Highest session: ${stats.highSession.amountMl} mL — ${shortDate(stats.highSession.date)}`);
  if(stats.highDay)lines.push(`🏆 Best completed day: ${stats.highDay.total} mL — ${shortDate(stats.highDay.date)}`);
  const next=entry.date===today()?nextPumpLine():'';if(next)lines.push(next);
  return lines.join('\n');
}
function babyTodayReply(kind,e,duplicate=false){
  const s=readState(),name=s.baby?.name||'Baby',ev=liveBaby(s).filter(x=>x.date===e.date),n=ev.filter(x=>x.eventType==='nursing'),di=ev.filter(x=>x.eventType==='diaper'),feeds=ev.filter(x=>x.eventType==='feeding');
  const wet=di.filter(x=>String(x.subtype).toLowerCase()==='wet').length,poop=di.filter(x=>['poop','dirty'].includes(String(x.subtype).toLowerCase())).length,both=di.filter(x=>['both','mixed'].includes(String(x.subtype).toLowerCase())).length;
  let first='';if(kind==='nursing')first=`${duplicate?'Already logged':'Logged'} 💕 ${e.durationMinutes} min nursing${e.side?` on the ${e.side}`:''} at ${to12(e.time)}.`;if(kind==='diaper')first=`${duplicate?'Already logged':'Logged'} 💛 ${e.subtype==='wet'?'Wet':e.subtype==='poop'?'Poopy':'Mixed'} diaper at ${to12(e.time)}.`;if(kind==='feeding')first=`${duplicate?'Already logged':'Logged'} 🍼 ${e.amountOz} oz ${e.feedingType==='formula'?'formula':'breast milk'} at ${to12(e.time)}.`;
  return `${first}\n\n${name} today: ${n.length} nursing · ${feeds.length} bottle feed${feeds.length===1?'':'s'} · ${wet} wet · ${poop} poopy · ${both} mixed.`;
}

async function performAction(a){
  const s=readState();
  if(a.kind==='pump'){
    const existing=livePumps(s).find(e=>e.date===a.date&&e.time===a.time&&Number(e.amountMl)===Number(a.amountMl));
    if(existing)return{reply:friendlyPumpReply(existing,true),duplicate:true};
    const e={id:uid('chat-pump'),type:'pump',date:a.date,time:a.time,amountMl:a.amountMl,durationMin:null,side:null,quality:null,note:'',source:'MilkFlow Chat',createdAt:new Date().toISOString(),synced:false};
    s.entries=Array.isArray(s.entries)?s.entries:[];s.entries.push(e);s.last={...(s.last||{}),pumpMl:a.amountMl};writeState(s);await syncMomEntry(e);return{reply:friendlyPumpReply(e,false)};
  }
  const events=Array.isArray(s.babyEvents)?s.babyEvents:[];const bid=activeBabyId(s);let e;
  if(a.kind==='nursing')e={id:uid('chat-baby'),babyId:bid,eventType:'nursing',date:a.date,time:a.time,durationMinutes:a.durationMinutes,totalMinutes:a.durationMinutes,side:a.side||null,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString(),synced:false};
  if(a.kind==='diaper')e={id:uid('chat-baby'),babyId:bid,eventType:'diaper',date:a.date,time:a.time,subtype:a.subtype,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString(),synced:false};
  if(a.kind==='feeding')e={id:uid('chat-baby'),babyId:bid,eventType:'feeding',date:a.date,time:a.time,feedingType:a.feedingType,amountOz:a.amountOz,sourceFile:'MilkFlow Chat',createdAt:new Date().toISOString(),synced:false};
  if(!e)return null;
  const existing=events.find(x=>!x?.voidedAt&&x.babyId===bid&&x.eventType===e.eventType&&x.date===e.date&&x.time===e.time&&String(x.subtype||'')===String(e.subtype||'')&&String(x.feedingType||'')===String(e.feedingType||'')&&Number(x.amountOz||0)===Number(e.amountOz||0)&&Number(x.durationMinutes??x.totalMinutes??0)===Number(e.durationMinutes??e.totalMinutes??0)&&String(x.side||'')===String(e.side||''));
  if(existing)return{reply:babyTodayReply(a.kind,existing,true),duplicate:true};
  events.push(e);s.babyEvents=events;if(a.kind==='nursing')s.last={...(s.last||{}),nursingMin:a.durationMinutes};writeState(s);await syncBabyEntry(e);return{reply:babyTodayReply(a.kind,e,false)};
}

function localAnswer(q){
  const s=readState(),text=String(q||'').toLowerCase(),entries=livePumps(s),baby=liveBaby(s);
  if(/next.*pump|pump.*next|when.*pump/.test(text)){try{const p=window.MilkFlowDynamicPump?.getPlan?.();if(p?.remaining&&p.future?.length)return `Your next pump looks best around ${to12m(p.future[0]-10)}–${to12m(p.future[0]+10)} 💛 I’m using what you actually logged today, not forcing you back onto the old clock.`;if(p&&!p.remaining)return `You’ve completed today’s ${p.target||6}-pump target 🎉`; }catch{}return 'Your live pump plan is still loading. Open Mom Home once and I’ll use the current schedule.';}
  if(/7.?day|rolling|pump.*table|pumping.*summary/.test(text)){const st=pumpStats(s),rows=st.rows.slice(-7);if(!rows.length)return 'I don’t see pump records on this device yet.';return `🌷 Rolling 7 days\n${rows.map(r=>`• ${shortDate(r.date)} — ${r.total} mL · ${r.count} pump${r.count===1?'':'s'}`).join('\n')}${st.highSession?`\n\n🏆 Highest session: ${st.highSession.amountMl} mL — ${shortDate(st.highSession.date)}`:''}${st.highDay?`\n🏆 Best completed day: ${st.highDay.total} mL — ${shortDate(st.highDay.date)}`:''}`;}
  if(/baby|breast|nurs|diaper|wet|poop|poopy|mixed|feed/.test(text)){const d=today(),ev=baby.filter(e=>e.date===d),n=ev.filter(e=>e.eventType==='nursing'),di=ev.filter(e=>e.eventType==='diaper'),f=ev.filter(e=>e.eventType==='feeding');const mins=n.reduce((x,e)=>x+(Number(e.durationMinutes??e.totalMinutes)||0),0),wet=di.filter(e=>String(e.subtype).toLowerCase()==='wet').length,poop=di.filter(e=>['poop','dirty'].includes(String(e.subtype).toLowerCase())).length,both=di.filter(e=>['both','mixed'].includes(String(e.subtype).toLowerCase())).length;return `Today for ${s.baby?.name||'Baby'} 💛\n${n.length} nursing${mins?` · ${mins} min`:''}\n${f.length} bottle feed${f.length===1?'':'s'}\n${wet} wet · ${poop} poopy · ${both} mixed`;}
  return null;
}

async function sendMessage(text){
  if(busy)return;const message=String(text||'').trim();if(!message)return;add('user',message);const input=document.getElementById('mfChatInput');if(input){input.value='';input.style.height='44px';}
  const action=parseNaturalAction(message);
  if(action){setBusy(true);try{const out=await performAction(action);add('assistant',out?.reply||'Logged 💛',{localAction:true});}catch(err){console.error(err);add('assistant','I couldn’t save that entry. Your existing tracker data is safe — please try once more.');}finally{setBusy(false);document.getElementById('mfChatInput')?.focus();}return;}
  const local=localAnswer(message),url=endpoint(),user=window.firebase?.auth?.().currentUser;
  if(!url||!user){if(local){add('assistant',local,{localFallback:true});return;}add('assistant',!url?'The family assistant connection is not configured yet.':'I can still use this device for tracker questions, but sign in to your Family account for the full conversational assistant.');if(!user){try{document.getElementById('authDialog')?.showModal();}catch{}}return;}
  setBusy(true);
  try{const token=await user.getIdToken();const controller=new AbortController(),stop=setTimeout(()=>controller.abort(),25000);const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({message,context:context()}),signal:controller.signal});clearTimeout(stop);const data=await r.json().catch(()=>({}));if(!r.ok||!data.ok)throw new Error(data.error||`Request failed (${r.status})`);add('assistant',data.reply||'I could not form a response.');}
  catch(err){const fallback=localAnswer(message);add('assistant',fallback||`I lost the cloud assistant for a moment, but your tracker is safe. Try that message again in a bit. 💛`,{localFallback:true});}
  finally{setBusy(false);document.getElementById('mfChatInput')?.focus();}
}

function toggle(force){const p=document.getElementById('mfChatPanel');if(!p)return;const open=typeof force==='boolean'?force:!p.classList.contains('open');p.classList.toggle('open',open);document.getElementById('mfChatButton')?.setAttribute('aria-expanded',String(open));if(open){renderMessages();setTimeout(()=>document.getElementById('mfChatInput')?.focus(),80);}}
function mount(){
  if(document.getElementById('mfChatButton'))return;styles();const panel=document.createElement('section');panel.id='mfChatPanel';panel.className='mf-chat-panel';panel.setAttribute('aria-label','MilkFlow family chat');panel.innerHTML=`
    <div class="mf-chat-head"><div class="mf-chat-avatar">M</div><div class="mf-chat-head-text"><strong>MilkFlow chat</strong><small>Mom + Baby · talk naturally</small></div><button id="mfChatClose" class="mf-chat-close" type="button" aria-label="Close chat">×</button></div>
    <div id="mfChatBody" class="mf-chat-body"></div>
    <div><div class="mf-chat-quick"><button type="button" data-mf-prompt="When should I pump next?">Next pump</button><button type="button" data-mf-prompt="Show my rolling 7-day pumping summary.">7-day pumping</button><button type="button" data-mf-prompt="Summarize Baby today from what is logged.">Baby today</button></div><div class="mf-chat-compose"><form id="mfChatForm" class="mf-chat-form"><textarea id="mfChatInput" class="mf-chat-input" rows="1" placeholder="Tell MilkFlow anything…" aria-label="Message MilkFlow"></textarea><button id="mfChatSend" class="mf-chat-send" type="submit" aria-label="Send">➤</button></form><small class="mf-chat-note">Logs stay in your MilkFlow family data. Nursing time is never converted to milk volume.</small></div></div>`;
  const btn=document.createElement('button');btn.id='mfChatButton';btn.className='mf-chat-btn';btn.type='button';btn.setAttribute('aria-label','Open MilkFlow chat');btn.setAttribute('aria-expanded','false');btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg><span class="dot"></span>';document.body.append(panel,btn);
  btn.addEventListener('click',()=>toggle());document.getElementById('mfChatClose').addEventListener('click',()=>toggle(false));document.getElementById('mfChatForm').addEventListener('submit',e=>{e.preventDefault();sendMessage(document.getElementById('mfChatInput').value);});document.getElementById('mfChatInput').addEventListener('input',e=>{e.target.style.height='44px';e.target.style.height=`${Math.min(112,e.target.scrollHeight)}px`;});document.getElementById('mfChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('mfChatForm').requestSubmit();}});panel.addEventListener('click',e=>{const b=e.target.closest('[data-mf-prompt]');if(b)sendMessage(b.dataset.mfPrompt);});document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen())toggle(false);});renderMessages();
}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
