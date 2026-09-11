(() => {
  const stateKey = 'milkflow-family-v4-state';
  const icon = (name) => {
    const common = 'viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"';
    const paths = {
      heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      history:'<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/><path d="M12 8v4l2.5 2"/>',
      chart:'<path d="M4 19V5"/><path d="M4 19h16"/><path d="m7 15 3-4 3 2 4-6"/>',
      snow:'<path d="M12 2v20M4.2 6.5l15.6 9M4.2 17.5l15.6-9"/><path d="m9 4 3 2 3-2M9 20l3-2 3 2"/>',
      baby:'<circle cx="12" cy="12" r="8"/><path d="M9.5 10h.01M14.5 10h.01M9.5 14c1.6 1.3 3.4 1.3 5 0"/><path d="M8 4.7c1.4-2 3.8-2.1 5.2-.8"/>',
      timeline:'<path d="M7 3v18M17 3v18"/><circle cx="7" cy="7" r="2"/><circle cx="17" cy="12" r="2"/><circle cx="7" cy="17" r="2"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1L7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/>',
      drop:'<path d="M12 3s6 6.2 6 11a6 6 0 0 1-12 0c0-4.8 6-11 6-11Z"/>',
      bottle:'<path d="M9 3h6M10 3v4l-2 3v9a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-9l-2-3V3"/><path d="M8 13h8"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      check:'<path d="m5 12 4 4L19 6"/>',
      shield:'<path d="M12 3 5 6v5c0 4.6 2.9 8 7 10 4.1-2 7-5.4 7-10V6l-7-3Z"/><path d="m9 12 2 2 4-4"/>'
    };
    return `<svg class="mf-icon" ${common}>${paths[name] || paths.heart}</svg>`;
  };

  function readState(){ try{return JSON.parse(localStorage.getItem(stateKey)||'{}')}catch{return{}} }
  function writeState(s){ localStorage.setItem(stateKey,JSON.stringify(s)); }
  function fmt(d){ if(!d)return''; try{return new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(d+'T12:00:00'))}catch{return d} }

  function decorateStatic(){
    const map={'mom-home':'heart',today:'clock',history:'history',trends:'chart',stash:'snow','baby-home':'baby','baby-timeline':'timeline',settings:'settings'};
    document.querySelectorAll('[data-view]').forEach(btn=>{const s=btn.querySelector('span');if(s&&map[btn.dataset.view]&&!s.querySelector('svg'))s.innerHTML=icon(map[btn.dataset.view])});
    const qp=document.getElementById('quickPumpBtn'); if(qp&&!qp.querySelector('svg')) qp.innerHTML=icon('drop')+'<span>Pump</span>';
    const qn=document.getElementById('quickNurseBtn'); if(qn&&!qn.querySelector('svg')) qn.innerHTML=icon('heart')+'<span>Nursing</span>';
    document.querySelectorAll('[data-pump]').forEach(b=>{if(!b.querySelector('svg')){const text=b.textContent.trim().replace(/^＋\s*/,'');b.innerHTML=icon('drop')+`<span>${text||'Pump'}</span>`}});
    document.querySelectorAll('[data-nurse]').forEach(b=>{if(!b.querySelector('svg')){const text=b.textContent.trim().replace(/^♡\s*/,'');b.innerHTML=icon('heart')+`<span>${text||'Nursing'}</span>`}});
    document.querySelectorAll('[data-baby="wet"]').forEach(b=>{if(!b.querySelector('svg'))b.innerHTML=icon('drop')+'<span>Wet</span>'});
    document.querySelectorAll('[data-baby="bottle"]').forEach(b=>{if(!b.querySelector('svg'))b.innerHTML=icon('bottle')+'<span>Bottle</span>'});
  }

  function simplifyLanguage(){
    const eyebrow=document.getElementById('viewEyebrow'), title=document.getElementById('viewTitle');
    if(eyebrow){const m={'MOM COMMAND CENTER':'MOM','MOM DATA':'MOM','ANALYTICS':'MOM','MILK STORAGE':'MOM','BABY CARE':'BABY','BABY DATA':'BABY','SYSTEM':'FAMILY'};eyebrow.textContent=m[eyebrow.textContent.trim()]||eyebrow.textContent}
    if(title){const m={'Mom home':'Mom','Pumping history':'History','Trends':'Trends','Stash & runway':'Stash','Baby dashboard':'Baby','Baby timeline':'History','Settings & import':'Settings'};title.textContent=m[title.textContent.trim()]||title.textContent}
    const replacements=[
      ['Your pumping day, without the noise.','Your day'],['Your pumping, milk supply, freezer stash and reminders are here first. Baby care is one tap away, with each person’s records kept separate.','Pump · nurse · rest'],
      ['Today’s rhythm','Today'],['Your family-friendly six-session plan','Pump schedule'],['Smart mom insights','For you'],['Based on your own recent pattern',''],['Recent activity','Latest'],['Pumping and nursing',''],
      ['Everything for baby, right when you need it.','Baby today'],['Log diapers, bottles, nursing and sleep quickly. Baby records stay separate from Mom’s pumping numbers.','Feed · diaper · sleep'],['Quick diaper log','Diapers'],['One tap to save it. Add details only when you want to.',''],['Recent baby activity','Latest'],['Newest care events',''],
      ['Mom pumping & nursing history','Mom history'],['Your complete mom-side activity stream',''],['7-day production','Milk trend'],['Daily pumped volume against your target','Last 7 days'],['Family account','Account'],['Keeps your family data available across signed-in devices',''],['Baby history','Import'],['Imported from your previous baby tracker',''],['Pump schedule','Schedule'],['Used for your next pump time and reminders',''],['Helpful reminders for planned pumping times',''],['Mom preferences','Preferences'],['Adjust the numbers used on Mom’s dashboard','']
    ];
    document.querySelectorAll('#content *').forEach(el=>{if(el.children.length)return;for(const[a,b]of replacements)if(el.textContent===a){el.textContent=b;break}});
    decorateStatic();
  }

  async function verifyCloud(btn,note){
    const s=readState();
    if(!window.firebase||!firebase.auth().currentUser){note.className='verify-note warn';note.textContent='Sign in first.';return}
    btn.disabled=true; btn.textContent='Checking…';
    try{
      const uid=firebase.auth().currentUser.uid, db=firebase.firestore();
      const [mom,baby]=await Promise.all([db.collection('users').doc(uid).collection('entries').get(),db.collection('users').doc(uid).collection('familyEvents').get()]);
      const localMom=Array.isArray(s.entries)?s.entries.length:0, localBaby=Array.isArray(s.babyEvents)?s.babyEvents.length:0;
      const momOk=mom.size>=localMom, babyOk=baby.size>=localBaby;
      note.className='verify-note '+(momOk&&babyOk?'ok':'warn');
      note.textContent=momOk&&babyOk?`Cloud checked · Mom ${mom.size} · Baby ${baby.size}`:`Cloud ${mom.size}/${baby.size} · Device ${localMom}/${localBaby}`;
    }catch(e){note.className='verify-note warn';note.textContent='Could not check cloud. Try again online.'}
    finally{btn.disabled=false;btn.textContent='Check cloud'}
  }

  async function syncBundleToCloud(state,momEntries,babyEvents){
    if(!window.firebase||!firebase.auth().currentUser) return false;
    const uid=firebase.auth().currentUser.uid, db=firebase.firestore(), user=db.collection('users').doc(uid);
    const writeBatch=async(items,collection,mapper)=>{
      for(let i=0;i<items.length;i+=400){
        const batch=db.batch();
        items.slice(i,i+400).forEach(x=>batch.set(user.collection(collection).doc(x.id),mapper(x),{merge:true}));
        await batch.commit();
      }
    };
    await writeBatch(momEntries,'entries',e=>({type:e.type,date:e.date,time:e.time||'',amountMl:e.amountMl??null,durationMin:e.durationMin??null,side:e.side||null,quality:e.quality||null,note:e.note||'',occurredAt:`${e.date}T${e.time||'00:00'}:00`,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}));
    await writeBatch(babyEvents,'familyEvents',e=>({...e,synced:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()}));
    await user.collection('private').doc('profile').set({profile:state.profile||{},baby:state.baby||{},schedule:state.schedule||[],dailyOverrides:state.dailyOverrides||{},updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true});
    return true;
  }

  async function importCompleteBundle(file,input){
    let data; try{data=JSON.parse(await file.text())}catch{return false}
    if(data?.schema_version!=='milkflow-family-bundle-2') return false;
    const s=readState();
    const momIn=Array.isArray(data.mom?.entries)?data.mom.entries:[];
    const babyRaw=Array.isArray(data.baby?.events)?data.baby.events:[];
    const babyIn=babyRaw.map(r=>({id:r.migration_id||r.id,babyId:r.baby_id||'saahas-2026',eventType:r.event_type||r.eventType,date:r.date,time:r.time||'',subtype:r.status||r.subtype||null,feedingType:r.feeding_type||r.feedingType||null,amountOz:r.amount_oz??r.amountOz??null,totalMinutes:r.total_minutes??r.totalMinutes??null,leftMinutes:r.left_minutes??r.leftMinutes??null,rightMinutes:r.right_minutes??r.rightMinutes??null,durationMinutes:r.duration_minutes??r.durationMinutes??null,note:r.note||'',sourceFile:r.source_file||r.sourceFile||'Baby Tracker',sourceRow:r.source_row||r.sourceRow||null,exactSourceDuplicate:!!(r.exact_source_duplicate??r.exactSourceDuplicate),synced:false})).filter(e=>e.id&&e.date?.startsWith('2026-'));
    const momMap=new Map((Array.isArray(s.entries)?s.entries:[]).map(e=>[e.id,e])); momIn.forEach(e=>{if(e?.id&&!momMap.has(e.id))momMap.set(e.id,{...e,synced:false})});
    const babyMap=new Map((Array.isArray(s.babyEvents)?s.babyEvents:[]).map(e=>[e.id,e])); babyIn.forEach(e=>{if(!babyMap.has(e.id))babyMap.set(e.id,e)});
    s.entries=[...momMap.values()]; s.babyEvents=[...babyMap.values()];
    s.dailyOverrides={...(s.dailyOverrides||{}),...(data.mom?.dailyOverrides||{})};
    s.profile={...(s.profile||{}),...(data.mom?.profile||{})};
    if(Array.isArray(data.mom?.schedule)&&data.mom.schedule.length)s.schedule=data.mom.schedule;
    s.baby={...(s.baby||{}),...(data.baby?.profile||{})};
    writeState(s);
    try{
      const cloudSaved=await syncBundleToCloud(s,s.entries,s.babyEvents);
      if(cloudSaved){s.entries=s.entries.map(e=>({...e,synced:true}));s.babyEvents=s.babyEvents.map(e=>({...e,synced:true}));s.cloud={...(s.cloud||{}),enabled:true,userId:firebase.auth().currentUser.uid,email:firebase.auth().currentUser.email,lastSync:new Date().toISOString()};writeState(s)}
    }catch(e){console.error('Family import cloud sync failed',e)}
    input.value='';
    location.reload();
    return true;
  }

  function enhanceImport(){
    const input=document.getElementById('importFile'); if(!input||input.dataset.familyEnhanced)return;
    input.dataset.familyEnhanced='1'; const original=input.onchange;
    input.onchange=async e=>{const f=e.target.files?.[0];if(!f)return;const handled=await importCompleteBundle(f,input);if(!handled&&original)original.call(input,e)};
  }

  function addRecentHistoryHint(){
    if(document.getElementById('recentHistoryHint'))return;
    const title=document.getElementById('viewTitle'); if(!title)return;
    const s=readState(); const content=document.getElementById('content'); if(!content)return;
    const today=new Date().toISOString().slice(0,10);
    if(title.textContent.trim()==='Today'){
      const entries=(s.entries||[]).filter(e=>e.date); const todayEntries=entries.filter(e=>e.date===today);
      if(!todayEntries.length&&entries.length){const last=entries.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))[0];const card=document.createElement('button');card.id='recentHistoryHint';card.className='history-hint';card.dataset.view='history';card.innerHTML=`<span class="history-hint-icon">${icon('history')}</span><span><strong>No entries yet today</strong><small>History is saved through ${fmt(last.date)} · tap to view</small></span>`;content.prepend(card)}
    }
    if(title.textContent.trim()==='Baby'){
      const events=(s.babyEvents||[]).filter(e=>e.date); const todayEvents=events.filter(e=>e.date===today);
      if(!todayEvents.length&&events.length){const last=events.slice().sort((a,b)=>(b.date+(b.time||'')).localeCompare(a.date+(a.time||'')))[0];const card=document.createElement('button');card.id='recentHistoryHint';card.className='history-hint baby-hint';card.dataset.view='baby-timeline';card.innerHTML=`<span class="history-hint-icon">${icon('timeline')}</span><span><strong>No baby logs yet today</strong><small>History is saved through ${fmt(last.date)} · tap to view</small></span>`;content.prepend(card)}
    }
  }

  function addFamilyStatus(){
    if(document.getElementById('familyDataStatus'))return;
    const title=document.getElementById('viewTitle'); if(!title||title.textContent.trim()!=='Settings')return;
    const content=document.getElementById('content'); if(!content)return;
    const s=readState(),events=Array.isArray(s.babyEvents)?s.babyEvents:[],mom=Array.isArray(s.entries)?s.entries:[],syncedBaby=events.filter(e=>e.synced).length,syncedMom=mom.filter(e=>e.synced).length,signed=!!s.cloud?.enabled;
    const card=document.createElement('section');card.id='familyDataStatus';card.className='family-status-card';
    card.innerHTML=`<div class="family-status-head"><div class="family-status-icon">${icon('shield')}</div><div><span class="eyebrow">YOUR DATA</span><h3>${signed?'Family account connected':'On this device'}</h3></div><button class="btn ghost verify-btn" id="verifyCloudBtn">Check cloud</button></div><div class="family-status-grid"><div><span>Mom</span><strong>${mom.length.toLocaleString()}</strong><small>${syncedMom.toLocaleString()} cloud-marked</small></div><div><span>${s.baby?.name||'Baby'}</span><strong>${events.length.toLocaleString()}</strong><small>${syncedBaby.toLocaleString()} cloud-marked</small></div><div><span>Cloud</span><strong>${signed?'Connected':'Off'}</strong><small>${signed?(s.cloud?.email||'family account'):'sign in to sync'}</small></div><div><span>History</span><strong>${mom.length||events.length?'Loaded':'Empty'}</strong><small>${events.length?'baby history available':'import history once'}</small></div></div><div class="verify-note" id="verifyCloudNote">Check cloud to compare this device with Firebase.</div>`;
    content.prepend(card);
    const b=card.querySelector('#verifyCloudBtn'),n=card.querySelector('#verifyCloudNote');b.onclick=()=>verifyCloud(b,n);
  }

  function refresh(){simplifyLanguage();enhanceImport();addFamilyStatus();addRecentHistoryHint()}
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh()})};
  document.addEventListener('DOMContentLoaded',schedule);new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
})();