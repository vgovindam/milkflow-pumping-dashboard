(() => {
'use strict';
const STATE_KEY='milkflow-family-v4-state';
const CHAT_KEY='milkflow-family-chat-v1';
let changing=false;
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;};
const read=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const chat=()=>{try{const a=JSON.parse(localStorage.getItem(CHAT_KEY)||'[]');return Array.isArray(a)?a:[];}catch{return [];}};
function to12m(m){if(!Number.isFinite(m))return '—';const n=((Math.round(m)%1440)+1440)%1440,h=Math.floor(n/60),mm=n%60;return `${((h+11)%12)+1}:${pad(mm)} ${h>=12?'PM':'AM'}`;}
function localAnswer(q){
  const s=read(),text=String(q||'').toLowerCase();
  const entries=(Array.isArray(s.entries)?s.entries:[]).filter(e=>!e?.voidedAt&&e.type==='pump');
  const baby=(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt&&!e?.exactSourceDuplicate&&(!e.babyId||e.babyId===(s.baby?.id||'saahas-2026')));
  if(/next.*pump|pump.*next|when.*pump/.test(text)){
    try{const p=window.MilkFlowDynamicPump?.getPlan?.();if(p?.remaining&&p.future?.length)return `Your live plan shows the next pump around ${to12m(p.future[0])}. I’m using the pump times you actually logged today, not the old fixed clock.`;if(p&&!p.remaining)return `You’ve completed today’s ${p.target||6}-pump target. The next session starts with tomorrow’s plan.`;}catch{}
    return 'I can read your tracker locally, but the live pump plan is still loading. Reopen Mom Home once and I’ll use the current schedule.';
  }
  if(/7.?day|rolling|pump.*table|pumping.*summary/.test(text)){
    const days={};for(const e of entries){const d=days[e.date]||(days[e.date]={date:e.date,total:0,count:0});d.total+=Number(e.amountMl)||0;d.count++;}
    const rows=Object.values(days).sort((a,b)=>a.date.localeCompare(b.date)).slice(-7);
    if(!rows.length)return 'There are no pump records available on this device yet.';
    return `Recent pumping:\n${rows.map(r=>`${r.date}: ${r.total} mL · ${r.count} pump${r.count===1?'':'s'}`).join('\n')}`;
  }
  if(/baby|breast|nurs|diaper|wet|poop|poopy|mixed/.test(text)){
    const d=today(),ev=baby.filter(e=>e.date===d),n=ev.filter(e=>e.eventType==='nursing'),di=ev.filter(e=>e.eventType==='diaper');
    const mins=n.reduce((x,e)=>x+(Number(e.durationMinutes??e.totalMinutes)||0),0);
    const wet=di.filter(e=>String(e.subtype).toLowerCase()==='wet').length;
    const poop=di.filter(e=>['poop','dirty'].includes(String(e.subtype).toLowerCase())).length;
    const both=di.filter(e=>['both','mixed'].includes(String(e.subtype).toLowerCase())).length;
    return `Today for ${s.baby?.name||'Baby'}: ${n.length} breastfeeding session${n.length===1?'':'s'}${mins?` (${mins} min logged)`:''}, ${wet} wet, ${poop} poopy, and ${both} mixed diaper${di.length===1?'':'s'}.`;
  }
  return 'I can still read the tracker on this device while the cloud assistant reconnects. I can answer about your next pump, 7-day pumping, breastfeeding, and diapers right now.';
}
function repair(){
  if(changing)return;
  const body=document.getElementById('mfChatBody');if(!body)return;
  const list=chat();if(list.length<2)return;
  const last=list[list.length-1],prev=list[list.length-2];
  if(last?.role!=='assistant'||prev?.role!=='user')return;
  if(!/couldn.t reach milkflow chat|temporarily unavailable|took too long|request failed/i.test(String(last.text||'')))return;
  changing=true;
  try{
    last.text=localAnswer(prev.text);last.localFallback=true;localStorage.setItem(CHAT_KEY,JSON.stringify(list));
    const rows=body.querySelectorAll('.mf-chat-row.assistant .mf-chat-msg');const node=rows[rows.length-1];if(node)node.textContent=last.text;
  }finally{changing=false;}
}
function mount(){new MutationObserver(repair).observe(document.body,{childList:true,subtree:true,characterData:true});repair();}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
