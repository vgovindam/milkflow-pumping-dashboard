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
      ['Your pumping day, without the noise.','Your day at a glance'],
      ['Your pumping, milk supply, freezer stash and reminders are here first. Baby care is one tap away, with each person’s records kept separate.','Pump, nurse, rest, repeat.'],
      ['Today’s rhythm','Today'],['Your family-friendly six-session plan','Pump schedule'],
      ['Smart mom insights','For you'],['Based on your own recent pattern','Your recent pattern'],
      ['Recent activity','Latest'],['Pumping and nursing','Mom care'],
      ['Everything for baby, right when you need it.','Baby today'],
      ['Log diapers, bottles, nursing and sleep quickly. Baby records stay separate from Mom’s pumping numbers.','Feeds, diapers and care.'],
      ['Quick diaper log','Diapers'],['One tap to save it. Add details only when you want to.','Tap to log'],
      ['Recent baby activity','Latest'],['Newest care events','Baby care'],
      ['Mom pumping & nursing history','Mom history'],['Your complete mom-side activity stream',''],
      ['7-day production','Milk trend'],['Daily pumped volume against your target','Last 7 days'],
      ['Family account','Account'],['Keeps your family data available across signed-in devices',''],
      ['Baby history','Import'],['Imported from your previous baby tracker',''],
      ['Pump schedule','Schedule'],['Used for your next pump time and reminders',''],
      ['Helpful reminders for planned pumping times',''],['Mom preferences','Preferences'],['Adjust the numbers used on Mom’s dashboard','']
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
      note.textContent=momOk&&babyOk?`Cloud checked: ${mom.size} Mom records and ${baby.size} Baby records are stored.`:`Cloud has ${mom.size} Mom / ${baby.size} Baby records. This device has ${localMom} / ${localBaby}. Keep this device online until counts match.`;
    }catch(e){note.className='verify-note warn';note.textContent='Could not verify cloud right now. Try again when online.'}
    finally{btn.disabled=false;btn.textContent='Check cloud'}
  }

  function addFamilyStatus(){
    if(document.getElementById('familyDataStatus'))return;
    const title=document.getElementById('viewTitle'); if(!title||title.textContent.trim()!=='Settings')return;
    const content=document.getElementById('content'); if(!content)return;
    const s=readState(),events=Array.isArray(s.babyEvents)?s.babyEvents:[],mom=Array.isArray(s.entries)?s.entries:[],synced=events.filter(e=>e.synced).length,signed=!!s.cloud?.enabled;
    const card=document.createElement('section');card.id='familyDataStatus';card.className='family-status-card';
    card.innerHTML=`<div class="family-status-head"><div class="family-status-icon">${icon('shield')}</div><div><span class="eyebrow">YOUR DATA</span><h3>${signed?'Family account connected':'On this device'}</h3></div><button class="btn ghost verify-btn" id="verifyCloudBtn">Check cloud</button></div><div class="family-status-grid"><div><span>Mom</span><strong>${mom.length.toLocaleString()}</strong><small>records</small></div><div><span>${s.baby?.name||'Baby'}</span><strong>${events.length.toLocaleString()}</strong><small>records</small></div><div><span>Cloud</span><strong>${signed?'Connected':'Off'}</strong><small>${signed?(s.cloud?.email||'family account'):'sign in to sync'}</small></div><div><span>Imported</span><strong>${synced===events.length&&events.length?'Ready':'Saved locally'}</strong><small>${events.length?'baby history loaded':'no baby history yet'}</small></div></div><div class="verify-note" id="verifyCloudNote">Tap “Check cloud” to compare this device with Firebase.</div>`;
    content.prepend(card);
    const b=card.querySelector('#verifyCloudBtn'),n=card.querySelector('#verifyCloudNote');b.onclick=()=>verifyCloud(b,n);
  }

  function refresh(){simplifyLanguage();addFamilyStatus()}
  let scheduled=false;const schedule=()=>{if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh()})};
  document.addEventListener('DOMContentLoaded',schedule);new MutationObserver(schedule).observe(document.documentElement,{subtree:true,childList:true});
})();