(() => {
  const STORAGE_KEY = 'milkflow-v3-state';
  const LEGACY_KEYS = ['milkflow-v2-state'];
  const defaultState = {
    version: 3,
    profile: { dailyGoalMl: 760, babyMinOz: 20, babyMaxOz: 22, stashMl: 1120 },
    schedule: ['05:40','11:05','14:35','17:45','20:45','23:35'],
    entries: [],
    dailyOverrides: {},
    cloud: { enabled: false, userId: null, email: null, lastSync: null }
  };

  const state = loadState();
  let currentView = 'overview';
  let cloudClient = null;
  let trendWindow = 7;

  const el = id => document.getElementById(id);
  const clone = obj => JSON.parse(JSON.stringify(obj));
  const fmtDate = d => new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(d+'T12:00:00'));
  const fmtDateLong = d => new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(d+'T12:00:00'));
  const todayISO = () => { const d=new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; };
  const to12 = t => { if(!t) return ''; const [h,m]=t.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
  const oz = ml => ml/29.5735;
  const sum = arr => arr.reduce((a,b)=>a+b,0);
  const esc = s => String(s??'').replace(/[&<>'\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#039;','\"':'&quot;'}[c]));
  const pumpEntries = () => state.entries.filter(e=>e.type==='pump');
  const nursingEntries = () => state.entries.filter(e=>e.type==='nursing');
  const dayPump = date => pumpEntries().filter(e=>e.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  const dayNursing = date => nursingEntries().filter(e=>e.date===date).sort((a,b)=>a.time.localeCompare(b.time));
  const calculatedDayTotal = date => sum(dayPump(date).map(e=>Number(e.amountMl)||0));
  const dayTotal = date => Number.isFinite(Number(state.dailyOverrides?.[date])) ? Number(state.dailyOverrides[date]) : calculatedDayTotal(date);

  function loadState(){
    for(const key of [STORAGE_KEY,...LEGACY_KEYS]){
      try{
        const raw=localStorage.getItem(key);
        if(raw){
          const parsed=JSON.parse(raw);
          const merged={...clone(defaultState),...parsed,profile:{...defaultState.profile,...(parsed.profile||{})},cloud:{...defaultState.cloud,...(parsed.cloud||{})}};
          if(!merged.dailyOverrides) merged.dailyOverrides={};
          return merged;
        }
      }catch(e){ console.warn('Could not read local state',e); }
    }
    return clone(defaultState);
  }
  function saveState(){ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); updateSyncStatus(); }
  function toast(msg){ const t=el('toast'); if(!t)return; t.textContent=msg; t.classList.add('show'); setTimeout(()=>t.classList.remove('show'),2400); }

  async function initCloud(){
    const cfg=window.MILKFLOW_CONFIG||{};
    if(!cfg.enableCloudSync || !cfg.firebaseConfig || !window.firebase){ updateSyncStatus(); return; }
    try{
      if(!window.firebase.apps.length) window.firebase.initializeApp(cfg.firebaseConfig);
      cloudClient={ auth: window.firebase.auth(), db: window.firebase.firestore() };
      try{ await cloudClient.db.enablePersistence({synchronizeTabs:true}); }catch(_e){}
      cloudClient.auth.onAuthStateChanged(async user=>{
        state.cloud.userId=user?.uid||null;
        state.cloud.email=user?.email||null;
        state.cloud.enabled=!!user;
        saveState();
        if(user) await reconcileCloud();
        render();
      });
    }catch(err){ console.error('Firebase init failed',err); toast('Cloud connection failed'); }
    updateSyncStatus();
  }
  function userEntriesRef(){ return cloudClient?.db.collection('users').doc(state.cloud.userId).collection('entries'); }
  function userProfileRef(){ return cloudClient?.db.collection('users').doc(state.cloud.userId).collection('private').doc('profile'); }
  async function reconcileCloud(){
    if(!cloudClient||!state.cloud.userId) return;
    try{
      const snap=await userEntriesRef().orderBy('occurredAt','asc').get();
      const remote=snap.docs.map(d=>({id:d.id,...d.data()})).map(r=>({
        id:r.id,type:r.type,date:r.date,time:r.time||'',amountMl:r.amountMl??null,durationMin:r.durationMin??null,
        side:r.side||null,quality:r.quality||null,note:r.note||'',synced:true
      }));
      const merged=new Map();
      for(const e of remote) merged.set(e.id,e);
      for(const e of state.entries) if(!merged.has(e.id)) merged.set(e.id,e);
      state.entries=[...merged.values()].sort((a,b)=>(a.date+a.time).localeCompare(b.date+b.time));
      const pSnap=await userProfileRef().get();
      if(pSnap.exists){
        const p=pSnap.data();
        state.profile={...state.profile,...(p.profile||{})};
        if(Array.isArray(p.schedule)) state.schedule=p.schedule;
        if(p.dailyOverrides && typeof p.dailyOverrides==='object') state.dailyOverrides={...state.dailyOverrides,...p.dailyOverrides};
      } else await pushProfile();
      for(const e of state.entries.filter(e=>!e.synced)) await pushEntry(e);
      state.cloud.lastSync=new Date().toISOString(); saveState();
    }catch(err){ console.error('Firebase sync failed',err); toast('Cloud sync needs attention'); }
  }
  async function pushEntry(entry){
    if(!cloudClient||!state.cloud.userId) return;
    try{
      await userEntriesRef().doc(entry.id).set({
        type:entry.type,date:entry.date,time:entry.time,amountMl:entry.amountMl??null,durationMin:entry.durationMin??null,
        side:entry.side||null,quality:entry.quality||null,note:entry.note||'',occurredAt:`${entry.date}T${entry.time}:00`,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()
      },{merge:true});
      entry.synced=true; state.cloud.lastSync=new Date().toISOString(); saveState();
    }catch(err){ console.error('Entry sync failed',err); }
  }
  async function deleteCloudEntry(id){ if(cloudClient&&state.cloud.userId){ try{ await userEntriesRef().doc(id).delete(); }catch(err){ console.error(err); } } }
  async function pushProfile(){
    if(!cloudClient||!state.cloud.userId) return;
    try{
      await userProfileRef().set({profile:state.profile,schedule:state.schedule,dailyOverrides:state.dailyOverrides,updatedAt:window.firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
      state.cloud.lastSync=new Date().toISOString(); saveState();
    }catch(err){ console.error('Profile sync failed',err); }
  }
  async function signIn(email,password){ if(!cloudClient) throw new Error('Firebase is not configured'); return cloudClient.auth.signInWithEmailAndPassword(email,password); }
  async function signUp(email,password){ if(!cloudClient) throw new Error('Firebase is not configured'); return cloudClient.auth.createUserWithEmailAndPassword(email,password); }
  async function signOut(){ if(cloudClient) await cloudClient.auth.signOut(); }
  function updateSyncStatus(){
    const online=!!state.cloud?.enabled;
    if(el('syncTitle')) el('syncTitle').textContent=online?'Cloud synced':'Local-first';
    if(el('syncSubtitle')) el('syncSubtitle').textContent=online?(state.cloud.lastSync?'Firebase connected · synced':'Firebase connected'):'Saved instantly on this device';
    if(el('cloudBadge')){ el('cloudBadge').textContent=online?'Synced':'Local'; el('cloudBadge').className=`cloud-badge ${online?'on':'off'}`; }
  }

  function lastNDates(n){ const out=[]; const d=new Date(); for(let i=n-1;i>=0;i--){ const x=new Date(d); x.setDate(d.getDate()-i); out.push(`${x.getFullYear()}-${String(x.getMonth()+1).padStart(2,'0')}-${String(x.getDate()).padStart(2,'0')}`); } return out; }
  function trendData(n=7){ return lastNDates(n).map(date=>({date,total:dayTotal(date)})); }
  function avgDaily(n=7){ const vals=trendData(n).map(x=>x.total).filter(Boolean); return vals.length?Math.round(sum(vals)/vals.length):0; }
  function highestSession(){ return pumpEntries().reduce((m,e)=>(Number(e.amountMl)||0)>(Number(m?.amountMl)||0)?e:m,null); }
  function bestDay(){ return trendData(60).reduce((m,x)=>x.total>m.total?x:m,{date:null,total:0}); }
  function daysOfStash(){ const intake=((state.profile.babyMinOz+state.profile.babyMaxOz)/2)*29.5735; return intake?state.profile.stashMl/intake:0; }
  function todayProgress(){ return Math.min(100,Math.round((dayTotal(todayISO())/state.profile.dailyGoalMl)*100)||0); }
  function nextSlot(){ const now=new Date(); const mins=now.getHours()*60+now.getMinutes(); const sched=state.schedule.map(t=>({t,mins:Number(t.slice(0,2))*60+Number(t.slice(3))})); return sched.find(x=>x.mins>mins)?.t||state.schedule[0]; }
  function avgSession(){ const p=pumpEntries(); return p.length?Math.round(sum(p.map(e=>+e.amountMl||0))/p.length):0; }
  function dailyAdherence(n=7){ const dates=lastNDates(n); return Math.round(dates.filter(d=>dayPump(d).length>=state.schedule.length).length/n*100); }
  function slotAverages(){
    const byDay={};
    for(const e of pumpEntries()){ (byDay[e.date]||(byDay[e.date]=[])).push(e); }
    Object.values(byDay).forEach(arr=>arr.sort((a,b)=>a.time.localeCompare(b.time)));
    return state.schedule.map((_,i)=>{ const vals=Object.values(byDay).map(arr=>Number(arr[i]?.amountMl)||0).filter(Boolean); return vals.length?Math.round(sum(vals)/vals.length):0; });
  }
  function pctDelta(a,b){ if(!b)return 0; return Math.round((a-b)/b*100); }

  function metric(cls,icon,label,value,sub,progress,delta=''){
    return `<article class="metric ${cls}"><div class="metric-top"><div class="metric-icon">${icon}</div>${delta?`<span class="delta">${esc(delta)}</span>`:''}</div><div class="metric-label">${label}</div><div class="metric-value">${value}</div><div class="metric-sub">${sub}</div>${progress!=null?`<div class="progress" style="--p:${Math.min(100,progress)}%"><i></i></div>`:''}</article>`;
  }
  function chartSVG(data){
    const W=760,H=250,pad={l:36,r:18,t:18,b:32}; const max=Math.max(state.profile.dailyGoalMl,...data.map(d=>d.total),100); const x=i=>pad.l+(i*(W-pad.l-pad.r)/Math.max(1,data.length-1)); const y=v=>pad.t+(H-pad.t-pad.b)*(1-v/(max*1.15));
    const pts=data.map((d,i)=>`${x(i)},${y(d.total)}`).join(' '); const area=`${x(0)},${H-pad.b} ${pts} ${x(data.length-1)},${H-pad.b}`; const goalY=y(state.profile.dailyGoalMl);
    return `<svg class="chart-svg" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none"><defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#7557f3" stop-opacity=".25"/><stop offset="100%" stop-color="#7557f3" stop-opacity="0"/></linearGradient></defs>${[.25,.5,.75,1].map(f=>`<line class="chart-grid" x1="${pad.l}" x2="${W-pad.r}" y1="${pad.t+(H-pad.t-pad.b)*f}" y2="${pad.t+(H-pad.t-pad.b)*f}"/>`).join('')}<line class="chart-target" x1="${pad.l}" x2="${W-pad.r}" y1="${goalY}" y2="${goalY}"/><text class="chart-target-label" x="${W-pad.r-58}" y="${goalY-7}">goal ${state.profile.dailyGoalMl}mL</text><polygon class="chart-area" points="${area}"/><polyline class="chart-line" points="${pts}"/>${data.map((d,i)=>`<circle class="chart-dot" cx="${x(i)}" cy="${y(d.total)}" r="4.5"/><text class="chart-label" x="${x(i)}" y="${H-10}" text-anchor="middle">${fmtDate(d.date)}</text>`).join('')}</svg>`;
  }
  function scheduleHTML(){
    const t=todayISO(), logged=dayPump(t), nowM=new Date().getHours()*60+new Date().getMinutes();
    return `<div class="schedule-strip">${state.schedule.map((slot,i)=>{ const e=logged[i]; const sm=Number(slot.slice(0,2))*60+Number(slot.slice(3)); const cls=e?'done':(!e&&sm>=nowM&&state.schedule.slice(0,i).every((_,j)=>logged[j])?'next':''); return `<div class="slot ${cls}"><i class="slot-dot"></i><div class="slot-time">SESSION ${i+1}</div><strong>${e?to12(e.time):to12(slot)}</strong><span>${e?`${e.amountMl} mL logged`:(cls==='next'?'Next planned':'Planned')}</span></div>`}).join('')}</div>`;
  }
  function entriesTable(entries){
    if(!entries.length) return `<div class="empty"><div class="empty-icon">◌</div><strong>No entries yet</strong><span>Use “Log pump” or “Log nursing” to start building your timeline.</span></div>`;
    return `<div class="table-scroll"><table class="data-table"><thead><tr><th>DATE</th><th>TYPE</th><th>TIME</th><th>AMOUNT</th><th>DURATION</th><th>DETAIL</th><th>SYNC</th><th></th></tr></thead><tbody>${entries.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).map(e=>`<tr><td><strong>${fmtDate(e.date)}</strong></td><td><span class="pill ${e.type==='pump'?'pump':'nurse'}">${e.type==='pump'?'Pump':'Nursing'}</span></td><td>${to12(e.time)}</td><td>${e.type==='pump'?`<strong>${e.amountMl||0} mL</strong>`:'—'}</td><td>${e.durationMin?`${e.durationMin} min`:'—'}</td><td>${e.type==='pump'?(e.quality==='short'?'<span class="pill short">Short session</span>':(esc(e.note)||'Normal')):`${esc(e.side||'—')} side`}</td><td>${e.synced?'<span class="sync-mini on">● Cloud</span>':'<span class="sync-mini">● Local</span>'}</td><td><button class="row-action" data-delete="${e.id}" title="Delete entry">×</button></td></tr>`).join('')}</tbody></table></div>`;
  }
  function recentActivity(limit=5){
    const items=state.entries.slice().sort((a,b)=>(b.date+b.time).localeCompare(a.date+a.time)).slice(0,limit);
    if(!items.length) return `<div class="empty compact"><strong>No activity yet</strong><span>Your newest entries will appear here.</span></div>`;
    return `<div class="activity-list">${items.map(e=>`<div class="activity-item"><div class="activity-icon ${e.type}">${e.type==='pump'?'◒':'♡'}</div><div class="activity-main"><strong>${e.type==='pump'?`${e.amountMl} mL pump`:`${e.durationMin||0} min nursing`}</strong><span>${fmtDateLong(e.date)} · ${to12(e.time)}${e.side?` · ${esc(e.side)}`:''}</span></div><span class="pill ${e.synced?'pump':'short'}">${e.synced?'Cloud':'Local'}</span></div>`).join('')}</div>`;
  }

  function renderOverview(){
    const t=todayISO(), total=dayTotal(t), count=dayPump(t).length, avg=avgDaily(), hs=highestSession(), prev=lastNDates(2)[0], delta=pctDelta(total,dayTotal(prev));
    return `<section class="welcome-banner"><div><span class="eyebrow light">MILKFLOW DAILY</span><h2>Your feeding command center</h2><p>One place for pumping, nursing, stash, schedule, and supply patterns.</p></div><div class="welcome-actions"><button class="btn light" id="overviewPump">＋ Log pump</button><button class="btn glass" id="overviewNurse">♡ Nursing</button></div></section>
    <div class="hero-grid">${metric('purple','◒','TODAY\'S OUTPUT',`${total} <small>mL</small>`,`${oz(total).toFixed(1)} oz · ${count}/${state.schedule.length} sessions`,todayProgress(),count?(delta?`${delta>0?'+':''}${delta}% vs yesterday`:`${todayProgress()}% goal`):'')}${metric('rose','♡','NURSING',`${sum(dayNursing(t).map(e=>+e.durationMin||0))} <small>min</small>`,`${dayNursing(t).length} direct-feed sessions`,null)}${metric('mint','◇','FREEZER STASH',`${state.profile.stashMl.toLocaleString()} <small>mL</small>`,`${oz(state.profile.stashMl).toFixed(1)} oz · ${daysOfStash().toFixed(1)} days`,Math.min(100,daysOfStash()/3*100))}${metric('amber','◎','NEXT PUMP',to12(nextSlot()),`${Math.max(0,state.schedule.length-count)} planned sessions remaining`,null)}</div>
    <div class="grid-2 wide-left"><article class="card"><div class="card-head"><div><span class="section-kicker">PRODUCTION</span><h3>Supply trend</h3><p>Daily pumped volume against your target baseline</p></div><div class="segmented trend-seg">${[7,14,30].map(n=>`<button data-window="${n}" class="${trendWindow===n?'active':''}">${n}D</button>`).join('')}</div></div><div class="chart-wrap">${chartSVG(trendData(trendWindow))}</div></article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">TODAY</span><h3>Session rhythm</h3><p>Planned versus completed</p></div><button class="text-link" data-goto="today">Open day →</button></div>${scheduleHTML()}<div class="mini-stats"><div><span>7-day avg</span><strong>${avg} mL</strong></div><div><span>Best session</span><strong>${hs?hs.amountMl:0} mL</strong></div><div><span>6-session days</span><strong>${dailyAdherence(7)}%</strong></div></div></article></div>
    <div class="grid-3"><article class="card"><div class="card-head"><div><span class="section-kicker">INSIGHTS</span><h3>What your data says</h3></div></div><div class="insight-stack"><div class="insight purple"><div class="insight-icon">↗</div><div><strong>${avg?`${avg} mL 7-day average`:'Trend building'}</strong><span>Weekly averages are more useful than judging a single pump.</span></div></div><div class="insight mint"><div class="insight-icon">★</div><div><strong>${hs?`${hs.amountMl} mL personal best`:'Personal best pending'}</strong><span>${hs?`${fmtDate(hs.date)} at ${to12(hs.time)}`:'Keep logging and MilkFlow will identify it.'}</span></div></div><div class="insight amber"><div class="insight-icon">◇</div><div><strong>${daysOfStash().toFixed(1)} days of stash runway</strong><span>Based on the midpoint of your baby’s intake range.</span></div></div></div></article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">RECENT</span><h3>Latest activity</h3></div><button class="text-link" data-goto="history">View all →</button></div>${recentActivity(5)}</article>
    <article class="card quick-card"><div class="card-head"><div><span class="section-kicker">QUICK ACCESS</span><h3>Jump anywhere</h3></div></div><div class="quick-grid"><button data-goto="today"><b>◫</b><span><strong>Today</strong><small>Daily timeline</small></span></button><button data-goto="trends"><b>⌁</b><span><strong>Trends</strong><small>Supply analytics</small></span></button><button data-goto="stash"><b>◇</b><span><strong>Stash</strong><small>Freezer runway</small></span></button><button data-goto="schedule"><b>◴</b><span><strong>Schedule</strong><small>Edit routine</small></span></button></div></article></div>`;
  }

  function renderToday(){
    const t=todayISO(), pumps=dayPump(t), nurses=dayNursing(t), total=dayTotal(t), calc=calculatedDayTotal(t), override=state.dailyOverrides?.[t];
    const remaining=Math.max(0,state.profile.dailyGoalMl-total);
    return `<div class="today-hero"><div><span class="eyebrow">TODAY · ${fmtDateLong(t).toUpperCase()}</span><h2>${total} mL <small>pumped</small></h2><p>${pumps.length} pumping sessions · ${nurses.length} nursing sessions · ${remaining?`${remaining} mL to planning goal`:'daily goal reached'}</p></div><div class="ring" style="--p:${todayProgress()*3.6}deg"><div><strong>${todayProgress()}%</strong><span>goal</span></div></div></div>
    <div class="grid-2"><article class="card"><div class="card-head"><div><span class="section-kicker">TIMELINE</span><h3>Pumping sessions</h3></div><button class="btn primary" id="todayPumpBtn">＋ Add pump</button></div>${pumps.length?`<div class="timeline">${pumps.map((e,i)=>`<div class="timeline-row"><div class="timeline-marker">${i+1}</div><div><strong>${to12(e.time)}</strong><span>${e.durationMin?`${e.durationMin} min · `:''}${e.quality==='short'?'short session':'pump session'}</span></div><div class="timeline-value">${e.amountMl} <small>mL</small></div></div>`).join('')}</div>`:`<div class="empty compact"><strong>No pumps logged today</strong><span>Add the first session when you’re ready.</span></div>`}</article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">PLAN</span><h3>Today’s schedule</h3></div></div>${scheduleHTML()}<div class="today-note"><b>Next planned:</b> ${to12(nextSlot())}. Your schedule is a guide, not a rigid timer.</div></article></div>
    <div class="grid-2"><article class="card"><div class="card-head"><div><span class="section-kicker">NURSING</span><h3>Direct feeding</h3></div><button class="btn ghost" id="todayNurseBtn">♡ Add nursing</button></div>${nurses.length?`<div class="timeline nursing">${nurses.map((e,i)=>`<div class="timeline-row"><div class="timeline-marker">♡</div><div><strong>${to12(e.time)}</strong><span>${esc(e.side||'')} side</span></div><div class="timeline-value">${e.durationMin||0} <small>min</small></div></div>`).join('')}</div>`:`<div class="empty compact"><strong>No nursing logged today</strong><span>Direct feeding stays separate from pumped volume.</span></div>`}</article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">DATA QUALITY</span><h3>Daily total</h3><p>Useful when an older day has missing individual sessions.</p></div></div><div class="setting-line"><div><strong>Calculated from entries</strong><span>${calc} mL</span></div><strong>${calc} mL</strong></div><div class="setting-line"><div><strong>Confirmed total override</strong><span>${override!=null?'Active':'Not set'}</span></div><div class="inline-control"><input id="todayOverride" type="number" placeholder="Optional" value="${override??''}"><button class="btn ghost" id="saveTodayOverride">Save</button></div></div></article></div>`;
  }

  function renderHistory(){
    const hs=highestSession(), bd=bestDay();
    return `<div class="stat-row">${metric('purple','◫','TOTAL ENTRIES',state.entries.length,'Pumping + nursing',null)}${metric('sky','◒','PUMP SESSIONS',pumpEntries().length,'Across all recorded days',null)}${metric('mint','★','PERSONAL BEST',`${hs?hs.amountMl:0} <small>mL</small>`,hs?`${fmtDate(hs.date)} · ${to12(hs.time)}`:'—',null)}${metric('amber','◎','BEST DAY',`${bd.total||0} <small>mL</small>`,bd.date?fmtDate(bd.date):'—',null)}</div><article class="card table-card"><div class="table-toolbar"><div><span class="section-kicker">DATABASE</span><h3>Activity history</h3><p>Pumping and nursing in one searchable stream</p></div><div class="toolbar-actions"><input class="search" id="sessionSearch" placeholder="Search date, amount, note…"><button class="btn ghost" id="historyPumpBtn">＋ Pump</button></div></div><div id="sessionTable">${entriesTable(state.entries)}</div></article>`;
  }

  function renderTrends(){
    const slots=slotAverages(), d7=avgDaily(7), prev7=(()=>{const d=lastNDates(14).slice(0,7).map(dayTotal).filter(Boolean);return d.length?Math.round(sum(d)/d.length):0})();
    const trend=pctDelta(d7,prev7);
    return `<div class="stat-row">${metric('purple','⌁','7-DAY AVERAGE',`${d7} <small>mL</small>`,`${trend>0?'+':''}${trend}% vs prior week`,null)}${metric('sky','◒','AVG SESSION',`${avgSession()} <small>mL</small>`,'Across all recorded pumps',null)}${metric('mint','★','BEST DAY',`${bestDay().total} <small>mL</small>`,bestDay().date?fmtDate(bestDay().date):'—',null)}${metric('amber','◎','6-SESSION ADHERENCE',`${dailyAdherence(7)}<small>%</small>`,'Last 7 calendar days',null)}</div>
    <div class="grid-2"><article class="card"><div class="card-head"><div><span class="section-kicker">TREND</span><h3>14-day production</h3><p>Confirmed daily totals are used when available.</p></div></div><div class="chart-wrap">${chartSVG(trendData(14))}</div></article><article class="card"><div class="card-head"><div><span class="section-kicker">SESSION PATTERN</span><h3>Average by pump number</h3><p>Helps show where your strongest sessions usually land.</p></div></div><div class="slot-bars">${slots.map((v,i)=>`<div><span>Session ${i+1}</span><div class="slotbar"><i style="width:${Math.min(100,v/Math.max(...slots,1)*100)}%"></i></div><strong>${v||0} mL</strong></div>`).join('')}</div></article></div>
    <article class="card"><div class="card-head"><div><span class="section-kicker">WEEKLY VIEW</span><h3>Daily production ledger</h3></div></div><div class="day-cards">${lastNDates(14).reverse().map(d=>`<div class="day-card"><span>${fmtDate(d)}</span><strong>${dayTotal(d)} mL</strong><small>${dayPump(d).length} pumps${state.dailyOverrides?.[d]!=null?' · confirmed total':''}</small></div>`).join('')}</div></article>`;
  }

  function renderStash(){
    const days=daysOfStash(), intake=((state.profile.babyMinOz+state.profile.babyMaxOz)/2)*29.5735;
    return `<div class="stash-hero"><div><span class="eyebrow light">FREEZER RESERVE</span><h2>${state.profile.stashMl.toLocaleString()} <small>mL</small></h2><p>${oz(state.profile.stashMl).toFixed(1)} oz available · about ${days.toFixed(1)} days at midpoint intake</p></div><div class="stash-orb">◇</div></div>
    <div class="hero-grid four">${metric('mint','◇','CURRENT STASH',`${state.profile.stashMl.toLocaleString()} <small>mL</small>`,`${oz(state.profile.stashMl).toFixed(1)} oz frozen`,Math.min(100,days/3*100))}${metric('sky','≈','INTAKE MIDPOINT',`${Math.round(intake)} <small>mL/day</small>`,`${((state.profile.babyMinOz+state.profile.babyMaxOz)/2).toFixed(1)} oz/day`,null)}${metric('amber','◷','RUNWAY',`${days.toFixed(1)} <small>days</small>`,'At current midpoint intake',null)}${metric('rose','＋','REFERENCE RANGE',`${state.profile.babyMinOz}–${state.profile.babyMaxOz} <small>oz</small>`,'Current daily intake reference',null)}</div>
    <div class="grid-2"><article class="card"><div class="card-head"><div><span class="section-kicker">QUICK ADJUST</span><h3>Add or use freezer milk</h3><p>Update the stash without retyping the full total.</p></div></div><div class="stash-adjust"><input id="stashAdjust" type="number" min="1" placeholder="Amount in mL"><button class="btn primary" id="stashAddBtn">＋ Add</button><button class="btn ghost" id="stashUseBtn">− Used</button></div><button class="text-link" id="setStashBtn">Set exact stash total instead →</button></article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">PLANNING</span><h3>Runway snapshot</h3></div></div><div class="runway-meter"><div style="--p:${Math.min(100,days/4*100)}%"><i></i></div><span>0 days</span><span>4+ days</span></div><div class="insight mint"><div class="insight-icon">◇</div><div><strong>${days.toFixed(1)} estimated days of coverage</strong><span>Direct nursing is not converted to ounces because duration alone cannot reliably measure transfer.</span></div></div></article></div>`;
  }

  function renderNursing(){
    const entries=nursingEntries(), mins=sum(entries.map(e=>+e.durationMin||0));
    return `<div class="stat-row">${metric('rose','♡','NURSING SESSIONS',entries.length,'All recorded direct feeds',null)}${metric('purple','◷','TOTAL TIME',`${mins} <small>min</small>`,'Recorded nursing duration',null)}${metric('sky','R','RIGHT SIDE',entries.filter(e=>e.side==='right').length,'Sessions logged',null)}${metric('mint','L','LEFT / BOTH',entries.filter(e=>e.side!=='right').length,'Sessions logged',null)}</div><article class="card table-card"><div class="table-toolbar"><div><span class="section-kicker">DIRECT FEEDING</span><h3>Nursing history</h3><p>Kept separate from pumped output</p></div><button class="btn primary" id="nurseHereBtn">＋ Log nursing</button></div>${entriesTable(entries)}</article>`;
  }

  function renderSchedule(){
    return `<div class="schedule-hero"><div><span class="eyebrow">YOUR ROUTINE</span><h2>Six-session daily plan</h2><p>Built around your protected morning sleep window and flexible real-life timing.</p></div><div class="schedule-count"><strong>${state.schedule.length}</strong><span>planned sessions</span></div></div><article class="card"><div class="card-head"><div><span class="section-kicker">DAILY RHYTHM</span><h3>Target times</h3><p>These are planning targets, not rigid medical rules.</p></div></div>${scheduleHTML()}</article><article class="card" style="margin-top:14px"><div class="card-head"><div><span class="section-kicker">EDIT ROUTINE</span><h3>Change target times</h3></div></div><div class="settings-grid">${state.schedule.map((t,i)=>`<label>Session ${i+1}<input class="schedule-input" data-index="${i}" type="time" value="${t}"></label>`).join('')}</div><div class="right-actions"><button class="btn primary" id="saveScheduleBtn">Save schedule</button></div></article>`;
  }

  function renderSettings(){
    const cfg=window.MILKFLOW_CONFIG||{}, signedIn=!!state.cloud.userId;
    return `<div class="settings-grid"><article class="card setting-card"><div class="card-head"><div><span class="section-kicker">GOALS</span><h3>Tracking preferences</h3><p>Personalize planning references</p></div></div><label>Daily pumping goal (mL)<input id="goalInput" type="number" value="${state.profile.dailyGoalMl}"></label><label>Baby intake minimum (oz)<input id="babyMinInput" type="number" step=".5" value="${state.profile.babyMinOz}"></label><label>Baby intake maximum (oz)<input id="babyMaxInput" type="number" step=".5" value="${state.profile.babyMaxOz}"></label><button class="btn primary" id="savePrefsBtn">Save preferences</button></article>
    <article class="card"><div class="card-head"><div><span class="section-kicker">DATA</span><h3>Cloud & backup</h3><p>Local-first with private Firebase synchronization</p></div></div><div class="setting-line"><div><strong>Device storage</strong><span>Immediate offline writes</span></div><span class="pill pump">Active</span></div><div class="setting-line"><div><strong>Firebase</strong><span>${signedIn?`Signed in as ${esc(state.cloud.email||'your account')}`:(cfg.enableCloudSync?'Ready — sign in below':'Not configured')}</span></div><span class="pill ${signedIn?'pump':'short'}">${signedIn?'Synced':'Signed out'}</span></div>${signedIn?`<div class="setting-line"><div><strong>Account</strong><span>Cloud data is scoped to your Firebase UID</span></div><button class="btn ghost" id="signOutBtn">Sign out</button></div>`:`<div class="auth-box"><label>Email<input id="authEmail" type="email" placeholder="you@example.com"></label><label>Password<input id="authPassword" type="password" minlength="6" placeholder="6+ characters"></label><div><button class="btn primary" id="signInBtn">Sign in</button><button class="btn ghost" id="signUpBtn">Create account</button></div></div>`}<div class="setting-line"><div><strong>Entries</strong><span>${state.entries.length} records stored</span></div><div class="inline-actions"><button class="btn ghost" id="importBtn">Import backup</button><button class="btn ghost" id="exportBtn">Export JSON</button></div></div><input id="importFile" type="file" accept="application/json" style="display:none"><div class="setting-line"><div><strong>Confirmed daily totals</strong><span>${Object.keys(state.dailyOverrides||{}).length} day(s) with manual totals</span></div></div><div class="privacy-box"><b>Privacy</b><span>Your personal pumping records are not embedded in the public GitHub source.</span></div></article></div>`;
  }

  function render(){
    const titles={overview:['DAILY COMMAND CENTER','Overview'],today:['TODAY','Daily timeline'],history:['ACTIVITY DATABASE','History'],trends:['SUPPLY INTELLIGENCE','Trends'],stash:['FREEZER PLANNING','Stash & Runway'],nursing:['DIRECT FEEDING','Nursing'],schedule:['ROUTINE DESIGN','Schedule'],settings:['APP & DATA','Settings']};
    el('viewEyebrow').textContent=titles[currentView][0]; el('viewTitle').textContent=titles[currentView][1];
    document.querySelectorAll('[data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===currentView));
    const fn={overview:renderOverview,today:renderToday,history:renderHistory,trends:renderTrends,stash:renderStash,nursing:renderNursing,schedule:renderSchedule,settings:renderSettings}[currentView];
    el('content').innerHTML=fn(); bindDynamic(); updateSyncStatus();
  }

  function bindDynamic(){
    document.querySelectorAll('[data-goto]').forEach(b=>b.onclick=()=>{currentView=b.dataset.goto;render();window.scrollTo({top:0,behavior:'smooth'});});
    document.querySelectorAll('.trend-seg [data-window]').forEach(b=>b.onclick=()=>{trendWindow=+b.dataset.window;render();});
    const search=el('sessionSearch'); if(search) search.oninput=()=>{ const q=search.value.toLowerCase(); el('sessionTable').innerHTML=entriesTable(state.entries.filter(e=>JSON.stringify(e).toLowerCase().includes(q))); bindDeleteButtons(); };
    if(el('overviewPump')) el('overviewPump').onclick=()=>openEntry('pump');
    if(el('overviewNurse')) el('overviewNurse').onclick=()=>openEntry('nursing');
    if(el('todayPumpBtn')) el('todayPumpBtn').onclick=()=>openEntry('pump');
    if(el('todayNurseBtn')) el('todayNurseBtn').onclick=()=>openEntry('nursing');
    if(el('historyPumpBtn')) el('historyPumpBtn').onclick=()=>openEntry('pump');
    if(el('nurseHereBtn')) el('nurseHereBtn').onclick=()=>openEntry('nursing');
    if(el('setStashBtn')) el('setStashBtn').onclick=()=>{el('stashAmount').value=state.profile.stashMl;el('stashDialog').showModal();};
    if(el('stashAddBtn')) el('stashAddBtn').onclick=async()=>{const v=+el('stashAdjust').value||0;if(!v)return toast('Enter an amount in mL');state.profile.stashMl+=v;saveState();await pushProfile();toast(`${v} mL added to stash`);render();};
    if(el('stashUseBtn')) el('stashUseBtn').onclick=async()=>{const v=+el('stashAdjust').value||0;if(!v)return toast('Enter an amount in mL');state.profile.stashMl=Math.max(0,state.profile.stashMl-v);saveState();await pushProfile();toast(`${v} mL removed from stash`);render();};
    if(el('saveTodayOverride')) el('saveTodayOverride').onclick=async()=>{const v=el('todayOverride').value.trim(); if(v==='') delete state.dailyOverrides[todayISO()]; else state.dailyOverrides[todayISO()]=+v; saveState(); await pushProfile(); toast(v===''?'Override cleared':'Confirmed total saved'); render();};
    if(el('saveScheduleBtn')) el('saveScheduleBtn').onclick=async()=>{state.schedule=[...document.querySelectorAll('.schedule-input')].map(x=>x.value);saveState();await pushProfile();toast('Schedule updated');render();};
    if(el('savePrefsBtn')) el('savePrefsBtn').onclick=async()=>{state.profile.dailyGoalMl=+el('goalInput').value||760;state.profile.babyMinOz=+el('babyMinInput').value||20;state.profile.babyMaxOz=+el('babyMaxInput').value||22;saveState();await pushProfile();toast('Preferences saved');render();};
    if(el('exportBtn')) el('exportBtn').onclick=()=>{const blob=new Blob([JSON.stringify({...state,cloud:{enabled:false,userId:null,email:null,lastSync:null}},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`milkflow-backup-${todayISO()}.json`;a.click();URL.revokeObjectURL(a.href);};
    if(el('signInBtn')) el('signInBtn').onclick=async()=>{try{await signIn(el('authEmail').value.trim(),el('authPassword').value);toast('Signed in · syncing your data');}catch(err){toast(err.message||'Sign in failed');}};
    if(el('signUpBtn')) el('signUpBtn').onclick=async()=>{try{await signUp(el('authEmail').value.trim(),el('authPassword').value);toast('Account created · syncing your data');}catch(err){toast(err.message||'Account creation failed');}};
    if(el('signOutBtn')) el('signOutBtn').onclick=async()=>{await signOut();toast('Signed out');};
    if(el('importBtn')) el('importBtn').onclick=()=>el('importFile').click();
    if(el('importFile')) el('importFile').onchange=async ev=>{const file=ev.target.files?.[0];if(!file)return;try{const incoming=JSON.parse(await file.text());if(!Array.isArray(incoming.entries))throw new Error('Invalid MilkFlow backup');const ids=new Set(state.entries.map(e=>e.id));for(const e of incoming.entries)if(!ids.has(e.id))state.entries.push({...e,synced:false});if(incoming.profile)state.profile={...state.profile,...incoming.profile};if(Array.isArray(incoming.schedule))state.schedule=incoming.schedule;if(incoming.dailyOverrides)state.dailyOverrides={...state.dailyOverrides,...incoming.dailyOverrides};saveState();if(state.cloud.userId)await reconcileCloud();toast(`${incoming.entries.length} historical records imported`);render();}catch(err){toast(err.message||'Import failed');}};
    bindDeleteButtons();
  }
  function bindDeleteButtons(){ document.querySelectorAll('[data-delete]').forEach(b=>b.onclick=async()=>{const id=b.dataset.delete;if(!confirm('Delete this entry?'))return;state.entries=state.entries.filter(e=>e.id!==id);saveState();await deleteCloudEntry(id);toast('Entry deleted');render();}); }
  function openEntry(type){
    el('entryType').value=type; el('dialogTitle').textContent=type==='pump'?'Log pump':'Log nursing'; el('dialogEyebrow').textContent=type==='pump'?'PUMP SESSION':'NURSING SESSION';
    document.querySelectorAll('.pump-only').forEach(x=>x.classList.toggle('hidden',type!=='pump')); document.querySelectorAll('.nurse-only').forEach(x=>x.classList.toggle('hidden',type!=='nursing'));
    const now=new Date(); el('entryDate').value=todayISO(); el('entryTime').value=`${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`; el('entryAmount').value=''; el('entryDuration').value=type==='pump'?'30':''; el('entryNote').value=''; el('entryDialog').showModal();
  }
  function uuid(){ return crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`; }

  document.addEventListener('DOMContentLoaded', async()=>{
    el('todayLabel').textContent=new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date());
    document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>{currentView=b.dataset.view;render();el('sidebar').classList.remove('open');window.scrollTo({top:0,behavior:'smooth'});});
    el('menuBtn').onclick=()=>el('sidebar').classList.toggle('open'); el('quickPumpBtn').onclick=()=>openEntry('pump'); el('quickNurseBtn').onclick=()=>openEntry('nursing');
    el('entryForm').addEventListener('submit',async e=>{ if(e.submitter?.value==='cancel')return; e.preventDefault(); const type=el('entryType').value; const entry={id:uuid(),type,date:el('entryDate').value,time:el('entryTime').value,amountMl:type==='pump'?+el('entryAmount').value||0:null,durationMin:+el('entryDuration').value||null,side:type==='nursing'?el('entrySide').value:null,quality:type==='pump'?el('entryQuality').value:null,note:el('entryNote').value.trim(),synced:false}; if(type==='pump'&&!entry.amountMl){toast('Add the pumped amount in mL');return;} state.entries.push(entry); saveState(); el('entryDialog').close(); render(); await pushEntry(entry); toast(type==='pump'?`${entry.amountMl} mL pump saved`:'Nursing session saved'); render(); });
    el('stashForm').addEventListener('submit',async e=>{if(e.submitter?.value==='cancel')return;e.preventDefault();state.profile.stashMl=+el('stashAmount').value||0;saveState();el('stashDialog').close();await pushProfile();toast('Stash updated');render();});
    render(); await initCloud(); render();
  });
})();
