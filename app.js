(() => {
  const STORAGE_KEY = 'milkflow-v2-state';
  const defaultState = {
    version: 2,
    profile: { dailyGoalMl: 760, babyMinOz: 20, babyMaxOz: 22, stashMl: 1120 },
    schedule: ['05:40','11:05','14:35','17:45','20:45','23:35'],
    entries: [],
    cloud: { enabled: false, userId: null, lastSync: null }
  };

  const state = loadState();
  let currentView = 'overview';
  let cloudClient = null;

  const el = id => document.getElementById(id);
  const fmtDate = d => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(d+'T12:00:00'));
  const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const to12 = t => { if(!t) return ''; const [h,m]=t.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
  const oz = ml => ml/29.5735;
  const sum = arr => arr.reduce((a,b)=>a+b,0);
  const pumpEntries = () => state.entries.filter(e=>e.type==='pump');
  const nursingEntries = () => state.entries.filter(e=>e.type==='nursing');
  const dayPump = date => pumpEntries().filter(e=>e.date===date);
  const dayTotal = date => sum(dayPump(date).map(e=>Number(e.amountMl)||0));

  function loadState(){
    try { const raw=localStorage.getItem(STORAGE_KEY); if(raw) return {...structuredClone(defaultState),...JSON.parse(raw)}; }
    catch(e){ console.warn('Could not read local state',e); }
    return structuredClone(defaultState);
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateSyncStatus(); }
  function toast(msg){ const t=el('toast'); t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2200); }

  async function initCloud(){
    const cfg=window.MILKFLOW_CONFIG||{};
    if(!cfg.enableCloudSync || !cfg.supabaseUrl || !cfg.supabasePublishableKey || !window.supabase){ updateSyncStatus(); return; }
    try{
      cloudClient=window.supabase.createClient(cfg.supabaseUrl,cfg.supabasePublishableKey,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      const {data:{session}}=await cloudClient.auth.getSession();
      if(session?.user){ state.cloud.enabled=true; state.cloud.userId=session.user.id; await pullCloud(); }
      cloudClient.auth.onAuthStateChange(async(_event,session)=>{ state.cloud.userId=session?.user?.id||null; state.cloud.enabled=!!session; saveState(); if(session) await pullCloud(); render(); });
    }catch(err){ console.error(err); }
    updateSyncStatus();
  }
  async function pullCloud(){
    if(!cloudClient||!state.cloud.userId) return;
    const {data,error}=await cloudClient.from('milkflow_entries').select('*').order('occurred_at',{ascending:true});
    if(error){ console.error(error); return; }
    if(data?.length){
      state.entries=data.map(r=>({id:r.id,type:r.entry_type,date:r.local_date,time:r.local_time?.slice(0,5)||'',amountMl:r.amount_ml,durationMin:r.duration_min,side:r.side,quality:r.quality,note:r.note||'',synced:true}));
      const {data:p}=await cloudClient.from('milkflow_profile').select('*').maybeSingle();
      if(p){ state.profile={dailyGoalMl:p.daily_goal_ml,babyMinOz:Number(p.baby_min_oz),babyMaxOz:Number(p.baby_max_oz),stashMl:p.stash_ml}; if(Array.isArray(p.schedule)) state.schedule=p.schedule; }
      state.cloud.lastSync=new Date().toISOString(); saveState();
    }
  }
  async function pushEntry(entry){
    if(!cloudClient||!state.cloud.userId) return;
    const payload={id:entry.id,user_id:state.cloud.userId,entry_type:entry.type,occurred_at:`${entry.date}T${entry.time}:00`,local_date:entry.date,local_time:entry.time,amount_ml:entry.amountMl||null,duration_min:entry.durationMin||null,side:entry.side||null,quality:entry.quality||null,note:entry.note||null};
    const {error}=await cloudClient.from('milkflow_entries').upsert(payload);
    if(!error){ entry.synced=true; state.cloud.lastSync=new Date().toISOString(); saveState(); } else console.error(error);
  }
  async function pushProfile(){
    if(!cloudClient||!state.cloud.userId) return;
    await cloudClient.from('milkflow_profile').upsert({user_id:state.cloud.userId,daily_goal_ml:state.profile.dailyGoalMl,baby_min_oz:state.profile.babyMinOz,baby_max_oz:state.profile.babyMaxOz,stash_ml:state.profile.stashMl,schedule:state.schedule,updated_at:new Date().toISOString()});
    state.cloud.lastSync=new Date().toISOString(); saveState();
  }
  function updateSyncStatus(){
    const online=!!state.cloud?.enabled;
    if(el('syncTitle')) el('syncTitle').textContent=online?'Cloud synced':'Local-first';
    if(el('syncSubtitle')) el('syncSubtitle').textContent=online?(state.cloud.lastSync?'Supabase connected · synced':'Supabase connected'):'Saved instantly on this device';
  }

  function lastNDates(n){ const out=[]; const d=new Date(); for(let i=n-1;i>=0;i--){ const x=new Date(d); x.setDate(d.getDate()-i); out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`); } return out; }
  function trendData(n=7){ return lastNDates(n).map(date=>({date,total:dayTotal(date)})); }
  function avgDaily(){ const vals=trendData(7).map(x=>x.total).filter(Boolean); return vals.length?Math.round(sum(vals)/vals.length):0; }
  function highestSession(){ return pumpEntries().reduce((m,e)=>(Number(e.amountMl)||0)>(Number(m?.amountMl)||0)?e:m,null); }
  function bestDay(){ return trendData(30).reduce((m,x)=>x.total>m.total?x:m,{date:null,total:0}); }
  function daysOfStash(){ const intake=((state.profile.babyMinOz+state.profile.babyMaxOz)/2)*29.5735; return intake?state.profile.stashMl/intake:0; }
  function todayProgress(){ return Math.min(100,Math.round((dayTotal(todayISO())/state.profile.dailyGoalMl)*100)||0); }
  function nextSlot(){ const now=new Date(); const mins=now.getHours()*60+now.getMinutes(); const sched=state.schedule.map(t=>({t,mins:Number(t.slice(0,2))*60+Number(t.slice(3))})); return sched.find(x=>x.mins>mins)?.t||state.schedule[0]; }

  function metric(cls,icon,label,value,sub,progress,delta=''){
    return `<article class="metric ${cls}"><div class="metric-top"><div class="metric-icon">${icon}</div>${delta?`<span class="delta">${delta}</span>`:''}</div><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-sub">${sub}</div>${progress!=null?`<div class="progress" style="--p:${Math.min(100,progress)}%"><i></i></div>`:''}</article>`;
  }
  function chartSVG(data){
    const W=720,H=220,pad={l:34,r:18,t:14,b:28}; const max=Math.max(state.profile.dailyGoalMl, ...data.map(d=>d.total), 100); const x=i=>pad.l+(i*(W-pad.l-pad.r)/Math.max(1,data.length-1)); const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/(max*1.15));
    const pts=data.map((d,i)=>`${x(i)},${y(d.total)}`).join(' '); const area=`${x(0)},${H-pad.b} ${pts} ${x(data.length-1)},${H-pad.b}`; const goalY=y(state.profile.dailyGoalMl);
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7656e8" stop-opacity=".18"/><stop offset="100%" stop-color="#7656e8" stop-opacity="0"/></linearGradient></defs>${[.25,.5,.75,1].map(f=>`<line class="chart-grid" x1="${pad.l}" x2="${W-pad.r}" y1="${pad.t+(H-pad.t-pad.b)*f}" y2="${pad.t+(H-pad.t-pad.b)*f}"/>`).join('')}<line class="chart-target" x1="${pad.l}" x2="${W-pad.r}" y1="${goalY}" y2="${goalY}"/><text class="chart-target-label" x="${W-pad.r-56}" y="${goalY-5}">goal ${state.profile.dailyGoalMl}mL</text><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${pts}"/>${data.map((d,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(d.total)}" r="4"/><text class="chart-label" x="${x(i)}" y="${H-8}" text-anchor="middle">${fmtDate(d.date)}</text>`).join('')}</svg>`;
  }

  function renderOverview(){
    const t=todayISO(), total=dayTotal(t), count=dayPump(t).length, hs=highestSession(), avg=avgDaily(); const surplus=Math.max(0,total-((state.profile.babyMinOz+state.profile.babyMaxOz)/2*29.5735));
    return `<div class="hero-grid">${metric('purple','◒','TODAY\'S OUTPUT',`${total} <small>mL</small>`,`${oz(total).toFixed(1)} oz · ${count} pumping sessions`,todayProgress(),count?`${todayProgress()}% goal`:'')}${metric('rose','♡','NURSING',`${nursingEntries().filter(e=>e.date===t).reduce((s,e)=>s+(Number(e.durationMin)||0),0)} <small>min</small>`,`${nursingEntries().filter(e=>e.date===t).length} sessions today`,null)}${metric('mint','◇','FREEZER STASH',`${state.profile.stashMl.toLocaleString()} <small>mL</small>`,`${oz(state.profile.stashMl).toFixed(1)} oz · ${daysOfStash().toFixed(1)} days runway`,Math.min(100,daysOfStash()/3*100))}${metric('amber','◎','NEXT PUMP',to12(nextSlot()),`${Math.max(0,state.schedule.length-count)} planned sessions remaining`,null)} </div>
    <div class="grid-2"><article class="card"><div class="card-head"><div><h3>7-day production intelligence</h3><p>Daily pumped volume with your target baseline</p></div><div class="segmented"><button class="active">7D</button><button>14D</button><button>30D</button></div></div><div class="chart-wrap">${chartSVG(trendData(7))}</div></article>
    <article class="card"><div class="card-head"><div><h3>Smart insights</h3><p>Patterns derived from your logged data</p></div></div><div class="insight-stack">
      <div class="insight purple"><div class="insight-icon">↗</div><div><strong>${avg?`${avg} mL 7-day average`:'Your trend will appear here'}</strong><span>${avg?'Use the weekly average—not a single pump—to judge direction.':'Log more sessions to unlock trend insights.'}</span></div></div>
      <div class="insight mint"><div class="insight-icon">${hs?'★':'◇'}</div><div><strong>${hs?`${hs.amountMl} mL is your strongest session`:'No personal best yet'}</strong><span>${hs?`${fmtDate(hs.date)} at ${to12(hs.time)}. Morning output can naturally run higher.`:'Your highest pump will be tracked automatically.'}</span></div></div>
      <div class="insight amber"><div class="insight-icon">≈</div><div><strong>${surplus?`${Math.round(surplus)} mL above midpoint intake today`:'Baby intake comparison'}</strong><span>Current reference range: ${state.profile.babyMinOz}–${state.profile.babyMaxOz} oz/day. Pumped volume and direct nursing are kept separate.</span></div></div>
    </div></article></div>
    <article class="card"><div class="card-head"><div><h3>Today’s rhythm</h3><p>Your family-friendly schedule · longer protected morning sleep window</p></div><button class="btn ghost" data-goto="schedule">Edit schedule</button></div>${scheduleHTML()}</article>`;
  }
  function scheduleHTML(){ const t=todayISO(); const logged=dayPump(t); const nowM=new Date().getHours()*60+new Date().getMinutes(); return `<div class="schedule-strip">${state.schedule.map((slot,i)=>{const e=logged[i]; const sm=Number(slot.slice(0,2))*60+Number(slot.slice(3)); const cls=e?'done':(!e&&sm>=nowM&&state.schedule.slice(0,i).every((_,j)=>logged[j])?'next':''); return `<div class="slot ${cls}"><i class="slot-dot"></i><div class="slot-time">SESSION ${i+1}</div><strong>${e?to12(e.time):to12(slot)}</strong><span>${e?`${e.amountMl} mL logged`:(cls==='next'?'Next planned':'Planned')}</span></div>`}).join('')}</div>`; }

  function entriesTable(entries){ if(!entries.length) return `<div class="empty"><strong>No entries yet</strong>Use “Log pump” or “Log nursing” to start building your timeline.</div>`; return `<table class="data-table"><thead><tr><th>DATE</th><th>TYPE</th><th>TIME</th><th>AMOUNT</th><th>DURATION</th><th>DETAIL</th><th>STATUS</th></tr></thead><tbody>${entries.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(e=>`<tr><td>${fmtDate(e.date)}</td><td><span class="pill ${e.type==='pump'?'pump':'nurse'}">${e.type==='pump'?'Pump':'Nursing'}</span></td><td>${to12(e.time)}</td><td>${e.type==='pump'?`${e.amountMl||0} mL`:'—'}</td><td>${e.durationMin?`${e.durationMin} min`:'—'}</td><td>${e.type==='pump'?(e.quality==='short'?'<span class="pill short">Short session</span>':(e.note||'Normal')):`${e.side||'—'} side`}</td><td>${e.synced?'<span class="pill pump">Cloud</span>':'<span class="pill short">Local</span>'}</td></tr>`).join('')}</tbody></table>`; }
  function renderSessions(){ const hs=highestSession(),bd=bestDay(); return `<div class="stat-row"><div class="stat-tile"><span>TOTAL PUMP SESSIONS</span><strong>${pumpEntries().length}</strong></div><div class="stat-tile"><span>PERSONAL BEST</span><strong>${hs?hs.amountMl:0} mL</strong></div><div class="stat-tile"><span>BEST DAY</span><strong>${bd.total||0} mL</strong></div><div class="stat-tile"><span>7-DAY AVG</span><strong>${avgDaily()} mL</strong></div></div><article class="card table-card"><div class="table-toolbar"><div><h3 style="margin:0;font:800 15px Manrope">Session history</h3><p style="margin:3px 0 0;font-size:10px;color:var(--muted)">Pumping and nursing in one searchable activity stream</p></div><input class="search" id="sessionSearch" placeholder="Search history…"></div><div id="sessionTable">${entriesTable(state.entries)}</div></article>`; }
  function renderTrends(){ const data=trendData(14); return `<div class="stat-row">${metric('purple','⌁','7-DAY AVERAGE',`${avgDaily()} <small>mL</small>`,'Rolling daily average',null)}${metric('sky','◒','AVG SESSION',`${pumpEntries().length?Math.round(sum(pumpEntries().map(e=>+e.amountMl||0))/pumpEntries().length):0} <small>mL</small>`,'Across all recorded pumps',null)}${metric('mint','★','BEST DAY',`${bestDay().total} <small>mL</small>`,bestDay().date?fmtDate(bestDay().date):'—',null)}${metric('amber','◎','GOAL',`${state.profile.dailyGoalMl} <small>mL</small>`,'Daily planning reference',null)}</div><article class="card"><div class="card-head"><div><h3>14-day production trend</h3><p>Use the rolling pattern to separate normal session variability from a real supply shift.</p></div></div><div class="chart-wrap">${chartSVG(data)}</div></article>`; }
  function renderStash(){ const days=daysOfStash(), intake=((state.profile.babyMinOz+state.profile.babyMaxOz)/2)*29.5735; return `<div class="hero-grid">${metric('mint','◇','CURRENT STASH',`${state.profile.stashMl.toLocaleString()} <small>mL</small>`,`${oz(state.profile.stashMl).toFixed(1)} oz frozen`,Math.min(100,days/3*100))}${metric('sky','≈','INTAKE MIDPOINT',`${Math.round(intake)} <small>mL/day</small>`,`${((state.profile.babyMinOz+state.profile.babyMaxOz)/2).toFixed(1)} oz/day`,null)}${metric('amber','◷','RUNWAY',`${days.toFixed(1)} <small>days</small>`,'At current midpoint intake',null)}${metric('rose','＋','STASH ACTION','Update','Keep the freezer total current',null)}</div><article class="card"><div class="card-head"><div><h3>Stash planning</h3><p>Freezer milk is a cushion, not a score. This view estimates coverage without encouraging unnecessary oversupply.</p></div><button class="btn primary" id="updateStashBtn">Update stash</button></div><div class="insight-stack"><div class="insight mint"><div class="insight-icon">◇</div><div><strong>${oz(state.profile.stashMl).toFixed(1)} oz available</strong><span>Equivalent to about ${days.toFixed(1)} days at your current intake midpoint.</span></div></div><div class="insight purple"><div class="insight-icon">◎</div><div><strong>Baby intake reference: ${state.profile.babyMinOz}–${state.profile.babyMaxOz} oz/day</strong><span>Nursing is intentionally not converted to estimated ounces because direct-transfer volume cannot be measured accurately from duration alone.</span></div></div></div></article>`; }
  function renderNursing(){ const entries=nursingEntries(); const mins=sum(entries.map(e=>+e.durationMin||0)); return `<div class="stat-row"><div class="stat-tile"><span>NURSING SESSIONS</span><strong>${entries.length}</strong></div><div class="stat-tile"><span>TOTAL NURSING TIME</span><strong>${mins} min</strong></div><div class="stat-tile"><span>RIGHT SIDE</span><strong>${entries.filter(e=>e.side==='right').length}</strong></div><div class="stat-tile"><span>LEFT / BOTH</span><strong>${entries.filter(e=>e.side!=='right').length}</strong></div></div><article class="card table-card"><div class="table-toolbar"><div><h3 style="margin:0;font:800 15px Manrope">Nursing history</h3><p style="margin:3px 0 0;font-size:10px;color:var(--muted)">Tracked separately from pumped output</p></div><button class="btn primary" id="nurseHereBtn">＋ Log nursing</button></div>${entriesTable(entries)}</article>`; }
  function renderSchedule(){ return `<article class="card"><div class="card-head"><div><h3>Daily pumping schedule</h3><p>Designed around your protected morning sleep window.</p></div></div>${scheduleHTML()}</article><article class="card" style="margin-top:14px"><div class="card-head"><div><h3>Edit target times</h3><p>These are planning targets, not rigid medical rules.</p></div></div><div class="settings-grid">${state.schedule.map((t,i)=>`<label>Session ${i+1}<input class="schedule-input" data-index="${i}" type="time" value="${t}"></label>`).join('')}</div><div style="display:flex;justify-content:flex-end;margin-top:14px"><button class="btn primary" id="saveScheduleBtn">Save schedule</button></div></article>`; }
  function renderSettings(){ const cfg=window.MILKFLOW_CONFIG||{}; return `<div class="settings-grid"><article class="card setting-card"><div class="card-head"><div><h3>Tracking preferences</h3><p>Personalize targets and intake references</p></div></div><label>Daily pumping goal (mL)<input id="goalInput" type="number" value="${state.profile.dailyGoalMl}"></label><label style="margin-top:10px">Baby intake minimum (oz)<input id="babyMinInput" type="number" step=".5" value="${state.profile.babyMinOz}"></label><label style="margin-top:10px">Baby intake maximum (oz)<input id="babyMaxInput" type="number" step=".5" value="${state.profile.babyMaxOz}"></label><button class="btn primary" id="savePrefsBtn" style="margin-top:14px">Save preferences</button></article><article class="card"><div class="card-head"><div><h3>Data & cloud</h3><p>Local-first with optional Supabase synchronization</p></div></div><div class="setting-line"><div><strong>Device storage</strong><span>Always on · immediate offline writes</span></div><span class="pill pump">Active</span></div><div class="setting-line"><div><strong>Supabase</strong><span>${cfg.enableCloudSync?'Configured in app':'Ready to connect after project selection'}</span></div><span class="pill ${cfg.enableCloudSync?'pump':'short'}">${cfg.enableCloudSync?'Connected':'Pending'}</span></div><div class="setting-line"><div><strong>Entries</strong><span>${state.entries.length} records stored</span></div><button class="btn ghost" id="exportBtn">Export JSON</button></div><div class="setting-line"><div><strong>Privacy</strong><span>Personal pump data is not embedded in the public GitHub source</span></div></div></article></div>`; }

  function render(){
    const titles={overview:['DAILY COMMAND CENTER','Overview'],sessions:['ACTIVITY DATABASE','Sessions'],trends:['SUPPLY INTELLIGENCE','Trends'],stash:['FREEZER PLANNING','Stash & Runway'],nursing:['DIRECT FEEDING','Nursing'],schedule:['ROUTINE DESIGN','Schedule'],settings:['APP & DATA','Settings']};
    el('viewEyebrow').textContent=titles[currentView][0]; el('viewTitle').textContent=titles[currentView][1]; document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
    const fn={overview:renderOverview,sessions:renderSessions,trends:renderTrends,stash:renderStash,nursing:renderNursing,schedule:renderSchedule,settings:renderSettings}[currentView]; el('content').innerHTML=fn(); bindDynamic();
  }
  function bindDynamic(){
    document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{currentView=b.dataset.goto;render();});
    const search=el('sessionSearch'); if(search) search.oninput=()=>{ const q=search.value.toLowerCase(); el('sessionTable').innerHTML=entriesTable(state.entries.filter(e=>JSON.stringify(e).toLowerCase().includes(q))); };
    if(el('updateStashBtn')) el('updateStashBtn').onclick=()=>{el('stashAmount').value=state.profile.stashMl;el('stashDialog').showModal();};
    if(el('nurseHereBtn')) el('nurseHereBtn').onclick=()=>openEntry('nursing');
    if(el('saveScheduleBtn')) el('saveScheduleBtn').onclick=async()=>{state.schedule=[...document.querySelectorAll('.schedule-input')].map(x=>x.value);saveState();await pushProfile();toast('Schedule updated');render();};
    if(el('savePrefsBtn')) el('savePrefsBtn').onclick=async()=>{state.profile.dailyGoalMl=+el('goalInput').value||760;state.profile.babyMinOz=+el('babyMinInput').value||20;state.profile.babyMaxOz=+el('babyMaxInput').value||22;saveState();await pushProfile();toast('Preferences saved');render();};
    if(el('exportBtn')) el('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`milkflow-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);};
  }
  function openEntry(type){
    el('entryType').value=type; el('dialogTitle').textContent=type==='pump'?'Log pump':'Log nursing'; el('dialogEyebrow').textContent=type==='pump'?'PUMP SESSION':'NURSING SESSION'; document.querySelectorAll('.pump-only').forEach(x=>x.classList.toggle('hidden',type!=='pump'));document.querySelectorAll('.nurse-only').forEach(x=>x.classList.toggle('hidden',type!=='nursing')); const now=new Date(); el('entryDate').value=todayISO();el('entryTime').value=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`; el('entryAmount').value='';el('entryDuration').value=type==='pump'?'30':'';el('entryNote').value=''; el('entryDialog').showModal();
  }
  function uuid(){ return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  document.addEventListener('DOMContentLoaded', async()=>{
    el('todayLabel').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
    document.querySelectorAll('.nav-item[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();el('sidebar').classList.remove('open');});
    el('menuBtn').onclick=()=>el('sidebar').classList.toggle('open'); el('quickPumpBtn').onclick=()=>openEntry('pump');el('quickNurseBtn').onclick=()=>openEntry('nursing');
    el('entryForm').addEventListener('submit',async e=>{ if(e.submitter?.value==='cancel')return; e.preventDefault(); const type=el('entryType').value; const entry={id:uuid(),type,date:el('entryDate').value,time:el('entryTime').value,amountMl:type==='pump'?+el('entryAmount').value||0:null,durationMin:+el('entryDuration').value||null,side:type==='nursing'?el('entrySide').value:null,quality:type==='pump'?el('entryQuality').value:null,note:el('entryNote').value.trim(),synced:false}; if(type==='pump'&&!entry.amountMl){toast('Add the pumped amount in mL');return;} state.entries.push(entry);saveState();el('entryDialog').close();render();await pushEntry(entry);toast(type==='pump'?`${entry.amountMl} mL pump saved`:'Nursing session saved');render();});
    el('stashForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();state.profile.stashMl=+el('stashAmount').value||0;saveState();el('stashDialog').close();await pushProfile();toast('Stash updated');render();});
    render(); await initCloud(); render();
  });
})();
