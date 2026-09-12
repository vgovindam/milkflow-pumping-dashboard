(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
const CHAT_KEY='milkflow-family-chat-v1';
const MAX_LOCAL=40;
let busy=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const readState=()=>{try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}};
const readChat=()=>{try{return Array.isArray(JSON.parse(localStorage.getItem(CHAT_KEY)||'[]'))?JSON.parse(localStorage.getItem(CHAT_KEY)||'[]'):[];}catch{return [];}};
const saveChat=a=>{try{localStorage.setItem(CHAT_KEY,JSON.stringify(a.slice(-MAX_LOCAL)));}catch{}};

function endpoint(){return String(window.MILKFLOW_CONFIG?.familyChatEndpoint||'').trim();}
function isOpen(){return document.getElementById('mfChatPanel')?.classList.contains('open');}

function styles(){
  if(document.getElementById('mfChatStyles'))return;
  const s=document.createElement('style');s.id='mfChatStyles';s.textContent=`
  .mf-chat-btn{position:fixed;z-index:90;right:18px;bottom:24px;width:58px;height:58px;border:0;border-radius:50%;background:var(--mom,#7653c6);color:#fff;box-shadow:0 14px 34px rgba(36,30,63,.28);display:grid;place-items:center;cursor:pointer;transition:transform .18s ease,box-shadow .18s ease}.mf-chat-btn:hover{transform:translateY(-2px);box-shadow:0 17px 38px rgba(36,30,63,.32)}.mf-chat-btn svg{width:26px;height:26px}.mf-chat-btn .dot{position:absolute;right:3px;top:3px;width:12px;height:12px;border-radius:50%;background:#55c38f;border:2px solid var(--surface,#fff)}
  .mf-chat-panel{position:fixed;z-index:89;right:18px;bottom:94px;width:min(390px,calc(100vw - 24px));height:min(620px,72vh);background:var(--surface,#fff);color:var(--ink,#20202a);border:1px solid var(--line-soft,var(--line,#e7e5ed));border-radius:24px;box-shadow:0 24px 70px rgba(27,24,43,.22);overflow:hidden;display:none;grid-template-rows:auto 1fr auto}.mf-chat-panel.open{display:grid}
  .mf-chat-head{padding:14px 15px 12px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--line-soft,var(--line,#eee));background:linear-gradient(145deg,color-mix(in srgb,var(--mom,#7653c6) 9%,var(--surface,#fff)),var(--surface,#fff))}.mf-chat-avatar{width:38px;height:38px;border-radius:14px;background:var(--mom,#7653c6);color:#fff;display:grid;place-items:center;font-weight:900}.mf-chat-head-text{min-width:0;flex:1}.mf-chat-head-text strong,.mf-chat-head-text small{display:block}.mf-chat-head-text strong{font-size:.95rem}.mf-chat-head-text small{font-size:.7rem;color:var(--muted,#74717d);margin-top:2px}.mf-chat-close{width:38px;height:38px;border:0;border-radius:12px;background:transparent;color:var(--muted,#777);font-size:1.4rem;cursor:pointer}
  .mf-chat-body{overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;overscroll-behavior:contain}.mf-chat-welcome{padding:11px 12px;border-radius:15px;background:var(--surface-2,#f7f5fa);font-size:.78rem;line-height:1.45;color:var(--muted,#706d78)}.mf-chat-row{display:flex}.mf-chat-row.user{justify-content:flex-end}.mf-chat-msg{max-width:86%;padding:10px 12px;border-radius:16px;font-size:.82rem;line-height:1.45;white-space:pre-wrap;overflow-wrap:anywhere}.mf-chat-row.user .mf-chat-msg{background:var(--mom,#7653c6);color:#fff;border-bottom-right-radius:5px}.mf-chat-row.assistant .mf-chat-msg{background:var(--surface-2,#f7f5fa);color:var(--ink,#222);border-bottom-left-radius:5px}.mf-chat-typing{font-size:.75rem;color:var(--muted,#777);padding:2px 5px}
  .mf-chat-quick{display:flex;gap:6px;overflow:auto;padding:0 14px 9px;scrollbar-width:none}.mf-chat-quick::-webkit-scrollbar{display:none}.mf-chat-quick button{white-space:nowrap;border:1px solid var(--line-soft,var(--line,#e6e3ec));background:var(--surface,#fff);color:var(--ink,#222);border-radius:999px;padding:7px 10px;font:inherit;font-size:.7rem;font-weight:750;cursor:pointer}
  .mf-chat-compose{border-top:1px solid var(--line-soft,var(--line,#eee));padding:10px;background:var(--surface,#fff)}.mf-chat-form{display:flex;align-items:flex-end;gap:8px}.mf-chat-input{flex:1;resize:none;min-height:44px;max-height:112px;border:1px solid var(--line-soft,var(--line,#dedbe6));border-radius:15px;background:var(--surface-2,#faf9fb);color:var(--ink,#222);padding:11px 12px;font:inherit;font-size:.83rem;line-height:1.35;outline:none}.mf-chat-input:focus{border-color:color-mix(in srgb,var(--mom,#7653c6) 55%,var(--line,#ddd))}.mf-chat-send{width:44px;height:44px;border:0;border-radius:14px;background:var(--mom,#7653c6);color:#fff;display:grid;place-items:center;cursor:pointer;font-size:1.1rem}.mf-chat-send:disabled{opacity:.45;cursor:default}.mf-chat-note{display:block;margin:7px 3px 0;font-size:.62rem;color:var(--muted,#777);line-height:1.35}
  @media(max-width:700px){.mf-chat-btn{right:14px;bottom:calc(78px + env(safe-area-inset-bottom));width:56px;height:56px}.mf-chat-panel{right:10px;bottom:calc(143px + env(safe-area-inset-bottom));width:calc(100vw - 20px);height:min(600px,68vh);border-radius:22px}}
  `;document.head.appendChild(s);
}

function context(){
  const s=readState();
  const cleanMom=e=>({type:e.type||null,date:e.date||null,time:e.time||null,amountMl:e.amountMl??null,durationMinutes:e.durationMinutes??e.duration??null,side:e.side||null,voidedAt:e.voidedAt||null});
  const cleanBaby=e=>({eventType:e.eventType||e.event_type||null,date:e.date||null,time:e.time||null,subtype:e.subtype||null,feedingType:e.feedingType||e.feeding_type||null,amountOz:e.amountOz??e.amount_oz??null,durationMinutes:e.durationMinutes??e.duration_minutes??null,totalMinutes:e.totalMinutes??e.total_minutes??null,leftMinutes:e.leftMinutes??e.left_minutes??null,rightMinutes:e.rightMinutes??e.right_minutes??null,voidedAt:e.voidedAt||null});
  let dynamicPlan=null;
  try{
    const p=window.MilkFlowDynamicPump?.getPlan?.();
    if(p)dynamicPlan={target:p.target,remaining:p.remaining,preferredGapMinutes:p.preferred,future:Array.isArray(p.future)?p.future:[],last:p.last?cleanMom(p.last):null,lastGapMinutes:p.lastGap??null};
  }catch{}
  return {
    currentLocalTime:new Date().toISOString(),
    currentWorkspace:s.ui?.workspace||null,
    dynamicPlan,
    recentMom:(Array.isArray(s.entries)?s.entries:[]).filter(e=>!e?.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`)).slice(-24).map(cleanMom),
    recentBaby:(Array.isArray(s.babyEvents)?s.babyEvents:[]).filter(e=>!e?.voidedAt).sort((a,b)=>`${a.date||''}${a.time||''}`.localeCompare(`${b.date||''}${b.time||''}`)).slice(-40).map(cleanBaby)
  };
}

function renderMessages(){
  const body=document.getElementById('mfChatBody');if(!body)return;
  const list=readChat();
  body.innerHTML=`<div class="mf-chat-welcome">Ask about pumping, your rolling trend, today’s next pump, feeds, diapers, nursing, sleep, or other Baby tracking. MilkFlow uses your signed-in family data when available.</div>`+list.map(m=>`<div class="mf-chat-row ${m.role==='user'?'user':'assistant'}"><div class="mf-chat-msg">${esc(m.text)}</div></div>`).join('');
  body.scrollTop=body.scrollHeight;
}

function add(role,text){
  const list=readChat();list.push({role,text:String(text),at:Date.now()});saveChat(list);renderMessages();
}

function setBusy(v){
  busy=v;const send=document.getElementById('mfChatSend'),input=document.getElementById('mfChatInput'),body=document.getElementById('mfChatBody');
  if(send)send.disabled=v;if(input)input.disabled=v;
  document.getElementById('mfChatTyping')?.remove();
  if(v&&body){const d=document.createElement('div');d.id='mfChatTyping';d.className='mf-chat-typing';d.textContent='MilkFlow is thinking…';body.appendChild(d);body.scrollTop=body.scrollHeight;}
}

async function sendMessage(text){
  if(busy)return;
  const message=String(text||'').trim();if(!message)return;
  add('user',message);
  const input=document.getElementById('mfChatInput');if(input){input.value='';input.style.height='44px';}
  const url=endpoint();
  if(!url){add('assistant','The in-app chat backend is not connected yet.');return;}
  const user=window.firebase?.auth?.().currentUser;
  if(!user){
    add('assistant','Please sign in to your Family account first so I can use your private Mom and Baby data.');
    try{document.getElementById('authDialog')?.showModal();}catch{}
    return;
  }
  setBusy(true);
  try{
    const token=await user.getIdToken();
    const controller=new AbortController();const stop=setTimeout(()=>controller.abort(),25000);
    const r=await fetch(url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${token}`},body:JSON.stringify({message,context:context()}),signal:controller.signal});
    clearTimeout(stop);
    const data=await r.json().catch(()=>({}));
    if(!r.ok||!data.ok)throw new Error(data.error||`Request failed (${r.status})`);
    add('assistant',data.reply||'I could not form a response.');
  }catch(err){
    add('assistant',err?.name==='AbortError'?'That took too long. Your tracker data is safe; try again in a moment.':`I couldn’t reach MilkFlow chat right now. ${err?.message||''}`.trim());
  }finally{setBusy(false);document.getElementById('mfChatInput')?.focus();}
}

function toggle(force){
  const p=document.getElementById('mfChatPanel');if(!p)return;
  const open=typeof force==='boolean'?force:!p.classList.contains('open');
  p.classList.toggle('open',open);document.getElementById('mfChatButton')?.setAttribute('aria-expanded',String(open));
  if(open){renderMessages();setTimeout(()=>document.getElementById('mfChatInput')?.focus(),80);}
}

function mount(){
  if(document.getElementById('mfChatButton'))return;
  styles();
  const panel=document.createElement('section');panel.id='mfChatPanel';panel.className='mf-chat-panel';panel.setAttribute('aria-label','MilkFlow family chat');panel.innerHTML=`
    <div class="mf-chat-head"><div class="mf-chat-avatar">M</div><div class="mf-chat-head-text"><strong>MilkFlow chat</strong><small>Mom + Baby · private family assistant</small></div><button id="mfChatClose" class="mf-chat-close" type="button" aria-label="Close chat">×</button></div>
    <div id="mfChatBody" class="mf-chat-body"></div>
    <div><div class="mf-chat-quick"><button type="button" data-mf-prompt="When should I pump next?">Next pump</button><button type="button" data-mf-prompt="Show my rolling 7-day pumping summary.">7-day pumping</button><button type="button" data-mf-prompt="Summarize Baby today from what is logged.">Baby today</button></div><div class="mf-chat-compose"><form id="mfChatForm" class="mf-chat-form"><textarea id="mfChatInput" class="mf-chat-input" rows="1" placeholder="Ask MilkFlow…" aria-label="Message MilkFlow"></textarea><button id="mfChatSend" class="mf-chat-send" type="submit" aria-label="Send">➤</button></form><small class="mf-chat-note">Uses your tracker data. It is separate from your ChatGPT account conversation.</small></div></div>`;
  const btn=document.createElement('button');btn.id='mfChatButton';btn.className='mf-chat-btn';btn.type='button';btn.setAttribute('aria-label','Open MilkFlow chat');btn.setAttribute('aria-expanded','false');btn.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M8 9h8M8 13h5"/></svg><span class="dot"></span>';
  document.body.append(panel,btn);
  btn.addEventListener('click',()=>toggle());document.getElementById('mfChatClose').addEventListener('click',()=>toggle(false));
  document.getElementById('mfChatForm').addEventListener('submit',e=>{e.preventDefault();sendMessage(document.getElementById('mfChatInput').value);});
  document.getElementById('mfChatInput').addEventListener('input',e=>{e.target.style.height='44px';e.target.style.height=`${Math.min(112,e.target.scrollHeight)}px`;});
  document.getElementById('mfChatInput').addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();document.getElementById('mfChatForm').requestSubmit();}});
  panel.addEventListener('click',e=>{const b=e.target.closest('[data-mf-prompt]');if(b)sendMessage(b.dataset.mfPrompt);});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&isOpen())toggle(false);});
  renderMessages();
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
