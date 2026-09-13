(() => {
'use strict';

const STATE_KEY = 'milkflow-family-v4-state';
const SNAPSHOT_KEY = 'milkflow-family-pre-import-backup';
const VERSION = 8;
const VIEWS = new Set([
  'mom-home','mom-history','mom-trends','mom-stash',
  'baby-home','baby-history','baby-trends','baby-growth',
  'development','doctor','more','settings',
  'set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about'
]);
// One navigation hierarchy. Tabs sit at depth 0; everything else is pushed from a single
// parent, which is what gives the app a real Back button instead of two drawers.
const PARENT = {
  'mom-stash':'more','baby-growth':'more','development':'more','doctor':'more','settings':'more',
  'set-account':'settings','set-baby':'settings','set-pumping':'settings',
  'set-reminders':'settings','set-data':'settings','set-appearance':'settings','set-about':'settings'
};
const depthOf = v => { let d=0, c=v; while(PARENT[c]){ c=PARENT[c]; d++; } return d; };
const DEFAULTS = {
  version: VERSION,
  profile: { dailyGoalMl: 760, stashMl: 0, momName: '' },
  baby: { id: 'saahas-2026', name: 'Saahas', feedingPreference: 'auto', birthDate: '', photo: '' },
  schedule: ['05:40','11:05','14:35','17:45','20:45','23:35'],
  entries: [],
  babyEvents: [],
  dailyOverrides: {},
  reminders: { enabled: false, leadMin: 10, lastSentKey: null, feedEnabled: false, feedGapMin: 180, feedLastKey: null },
  last: { bottleOz: null, pumpMl: null, pumpMin: null, nursingMin: null, sleepMin: null },
  cloud: { enabled: false, userId: null, email: null, lastSync: null, lastVerified: null, momCount: null, babyCount: null, lastError: null, lastErrorAt: null },
  ui: { workspace: 'mom', view: 'mom-home', theme: 'auto', momRange: 30, babyRange: 30, babyFilter: 'all', trendRange: 14, doctorRange: 14, reviewDate: '', historyMode: 'day' }
};

const $ = id => document.getElementById(id);
const clone = x => JSON.parse(JSON.stringify(x));
const sum = a => a.reduce((x,y) => x + y, 0);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const iso = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const today = () => iso(new Date());
const now = () => { const d = new Date(); return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; };
const fd = d => d ? new Intl.DateTimeFormat('en-US',{month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const fdl = d => d ? new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'}).format(new Date(`${d}T12:00:00`)) : '—';
const to12 = t => { if(!t) return '—'; const [h,m] = t.split(':').map(Number); return `${((h+11)%12)+1}:${String(m).padStart(2,'0')} ${h>=12?'PM':'AM'}`; };
const cap = s => String(s || '').replace(/_/g,' ').replace(/\b\w/g,c => c.toUpperCase());
const uid = p => `${p}-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
const byWhenDesc = (a,b) => `${b.date||''}${b.time||''}`.localeCompare(`${a.date||''}${a.time||''}`);

function normalizeSubtype(v){
  const s = String(v || '').trim().toLowerCase();
  if(s === 'dirty' || s === 'poopy') return 'poop';
  if(s === 'mixed') return 'both';
  if(['wet','poop','both'].includes(s)) return s;
  return s || null;
}
function normalizeBabyEvent(raw){
  const e = {...raw};
  // Explicit/local ids and Firestore document ids are authoritative.
  // migration_id is only a fallback for older imports that truly have no id.
  e.id = e.id || e.migration_id || uid('baby');
  e.babyId = e.baby_id || e.babyId || 'saahas-2026';
  e.eventType = e.event_type || e.eventType || null;
  e.date = e.date || '';
  e.time = e.time || '';
  if(e.eventType === 'diaper'){
    const original = e.subtype || e.status || null;
    e.subtype = normalizeSubtype(original);
    if(original && String(original).toLowerCase() !== e.subtype && !e.sourceSubtype) e.sourceSubtype = original;
  }
  e.feedingType = e.feeding_type || e.feedingType || null;
  e.amountOz = e.amount_oz ?? e.amountOz ?? null;
  e.durationMinutes = e.duration_minutes ?? e.durationMinutes ?? null;
  e.totalMinutes = e.total_minutes ?? e.totalMinutes ?? null;
  e.leftMinutes = e.left_minutes ?? e.leftMinutes ?? null;
  e.rightMinutes = e.right_minutes ?? e.rightMinutes ?? null;
  e.sourceFile = e.source_file || e.sourceFile || 'MilkFlow';
  e.sourceRow = e.source_row ?? e.sourceRow ?? null;
  e.exactSourceDuplicate = !!(e.exact_source_duplicate ?? e.exactSourceDuplicate);
  return e;
}
function normalizeLocalState(state){
  state.babyEvents = Array.isArray(state.babyEvents) ? state.babyEvents.map(normalizeBabyEvent) : [];
  return state;
}
function readState(){
  for(const key of [STATE_KEY,'milkflow-v3-state','milkflow-v2-state']){
    try{
      const raw = localStorage.getItem(key);
      if(!raw) continue;
      const p = JSON.parse(raw);
      return normalizeLocalState({
        ...clone(DEFAULTS), ...p,
        profile: {...DEFAULTS.profile,...(p.profile||{})},
        baby: {...DEFAULTS.baby,...(p.baby||{})},
        reminders: {...DEFAULTS.reminders,...(p.reminders||{})},
        cloud: {...DEFAULTS.cloud,...(p.cloud||{})},
        ui: {...DEFAULTS.ui,...(p.ui||{})},
        entries: Array.isArray(p.entries) ? p.entries : [],
        babyEvents: Array.isArray(p.babyEvents) ? p.babyEvents : [],
        dailyOverrides: p.dailyOverrides || {}
      });
    }catch(err){ console.warn('Ignoring unreadable local state',err); }
  }
  return clone(DEFAULTS);
}

const S = readState();
let dataVersion = 0;
let cloud = null;
let unsubscribers = [];
let renderTimer = null;
let view = (() => {
  const hash = location.hash.slice(1);
  if(VIEWS.has(hash)) return hash;
  if(VIEWS.has(S.ui.view)) return S.ui.view;
  return S.ui.workspace === 'baby' ? 'baby-home' : 'mom-home';
})();

function workspaceOf(v){
  if(v.startsWith('baby') || v === 'doctor' || v === 'development') return 'baby';
  if(v.startsWith('set-') || v === 'settings' || v === 'more') return S.ui.workspace === 'baby' ? 'baby' : 'mom';
  return 'mom';
}
function save(){
  S.version = VERSION;
  S.ui.view = view;
  S.ui.workspace = workspaceOf(view);
  S.savedAt = Date.now();
  dataVersion++;
  try{ localStorage.setItem(STATE_KEY,JSON.stringify(S)); }
  catch(err){ console.error('Local save failed',err); toast('This device is out of storage. Export a backup soon.',6000); }
}
// Records carry their own timestamps so two tabs/devices can be merged without losing either side.
const stampOf = e => Date.parse(e?.voidedAt || e?.editedAt || e?.createdAt || '') || 0;
// Union two record lists. Returns `changed` so a no-op merge writes nothing - without that,
// two open tabs would answer each other's storage events forever.
function unionById(mine,theirs,norm){
  const m = new Map((mine||[]).map(e => [e.id,e]));
  let changed = false;
  for(const raw of (Array.isArray(theirs) ? theirs : [])){
    const r = norm ? norm(raw) : raw;
    if(!r?.id) continue;
    const old = m.get(r.id);
    if(!old){ m.set(r.id,r); changed = true; }
    else if(stampOf(r) > stampOf(old)){ m.set(r.id,{...old,...r}); changed = true; }
  }
  return {list:[...m.values()], changed};
}
// Another tab of the same app wrote to localStorage. Union both sides instead of letting
// this tab's older in-memory copy overwrite records the other tab just created.
function adoptExternalState(raw){
  let p; try{ p = JSON.parse(raw); }catch{ return; }
  if(!p || typeof p !== 'object') return;
  const mom = unionById(S.entries, p.entries);
  const baby = unionById(S.babyEvents, p.babyEvents, normalizeBabyEvent);
  S.entries = mom.list; S.babyEvents = baby.list;
  let changed = mom.changed || baby.changed;

  if((p.savedAt||0) > (S.savedAt||0)){
    const settings = {profile:S.profile, baby:S.baby, schedule:S.schedule, dailyOverrides:S.dailyOverrides, reminders:S.reminders};
    const merged = {
      profile:{...S.profile, ...(p.profile||{})},
      baby:{...S.baby, ...(p.baby||{})},
      schedule:(Array.isArray(p.schedule) && p.schedule.length) ? p.schedule : S.schedule,
      dailyOverrides:{...S.dailyOverrides, ...(p.dailyOverrides||{})},
      reminders:{...S.reminders, ...(p.reminders||{})}
    };
    // Compare values, not timestamps: adopting on timestamp alone would also ping-pong.
    if(JSON.stringify(settings) !== JSON.stringify(merged)){
      Object.assign(S, merged);
      changed = true;
    }
  }
  if(!changed) return;
  save();
  clearTimeout(renderTimer); renderTimer = setTimeout(render,80);
}
window.addEventListener('storage', e => { if(e.key === STATE_KEY && e.newValue) adoptExternalState(e.newValue); });
function toast(text,ms=2800,action=null){
  const t=$('toast'); if(!t) return;
  t.innerHTML=`<span>${esc(text)}</span>`;
  if(action){ const b=document.createElement('button'); b.type='button'; b.className='toast-action'; b.textContent=action.label; b.addEventListener('click',()=>{ t.classList.remove('show'); action.run(); }); t.appendChild(b); }
  t.classList.add('show'); clearTimeout(t._timer); t._timer=setTimeout(()=>t.classList.remove('show'),ms);
}
function closeOverlays(){ document.body.classList.remove('locked'); $('sheet')?.classList.remove('open'); $('scrim')?.classList.remove('open'); }
function closeDialogs(){ document.querySelectorAll('dialog[open]').forEach(d => { try{ d.close(); }catch{} }); }
function setView(v,{replace=false}={}){
  if(!VIEWS.has(v)) v = S.ui.workspace === 'baby' ? 'baby-home' : 'mom-home';
  const same = v === view;
  const dir = same ? 'none' : depthOf(v) > depthOf(view) ? 'forward' : depthOf(v) < depthOf(view) ? 'back' : 'swap';
  const from = view;
  view = v; save();
  const url = `#${v}`;
  // pushState (not replaceState) so the device Back button walks back through screens
  // instead of leaving the app entirely. `from` lets goBack() pop instead of pushing.
  if(replace || same) history.replaceState({view:v,from},'',url); else history.pushState({view:v,from},'',url);
  closeOverlays(); closeDialogs(); render(dir);
  window.scrollTo({top:0,behavior:'auto'});
}
function goBack(){
  const p = PARENT[view];
  if(!p){ history.back(); return; }
  // If we arrived here from the parent, pop the real entry so the device Back button
  // does not end up walking forward through screens already visited.
  if(history.state && history.state.from === p){ history.back(); return; }
  setView(p,{replace:true});
}
window.addEventListener('popstate',e => {
  // Back also dismisses anything covering the screen, so it never leaves a stale overlay.
  closeOverlays(); closeDialogs();
  const v = e.state?.view || location.hash.slice(1);
  if(!VIEWS.has(v) || v === view) return;
  const dir = depthOf(v) > depthOf(view) ? 'forward' : depthOf(v) < depthOf(view) ? 'back' : 'swap';
  view = v; save(); render(dir); window.scrollTo({top:0,behavior:'auto'});
});

// Deep links and hand-edited URLs change the hash without a popstate, so route on that
// too. Guarded on v===view, which is also what keeps back/forward (which fire both
// events) from rendering twice.
window.addEventListener('hashchange',() => {
  const v = location.hash.slice(1);
  if(!VIEWS.has(v) || v === view) return;
  closeOverlays(); closeDialogs();
  const dir = depthOf(v) > depthOf(view) ? 'forward' : depthOf(v) < depthOf(view) ? 'back' : 'swap';
  view = v; save(); render(dir); window.scrollTo({top:0,behavior:'auto'});
});

function icon(name,cls=''){
  const paths={
    home:'<path d="M3 11.4 12 4l9 7.4"/><path d="M5.6 10.3V20h12.8v-9.7"/><path d="M9.4 20v-5.4a2.6 2.6 0 0 1 5.2 0V20"/>',
    drop:'<path d="M12 3.2c2.8 3 5.6 6.2 5.6 9.4a5.6 5.6 0 1 1-11.2 0c0-3.2 2.8-6.4 5.6-9.4Z"/>',
    poop:'<path d="M12.4 4.3c1.4.3 2 1.3 1.7 2.3h.5c1.5 0 2.6 1 2.6 2.2 0 .5-.2 1-.5 1.3 1.5.2 2.6 1.2 2.6 2.5 0 .6-.2 1.1-.6 1.5 1.1.4 1.8 1.2 1.8 2.2 0 1.5-1.6 2.7-3.6 2.7H7.1c-2 0-3.6-1.2-3.6-2.7 0-1 .7-1.8 1.8-2.2a2 2 0 0 1-.6-1.5c0-1.3 1.1-2.3 2.6-2.5a1.9 1.9 0 0 1-.5-1.3c0-1.2 1.1-2.2 2.6-2.2h.5c-.4-1.3.7-2.6 2.5-2.3Z"/><path d="M10 13.4h.01M14 13.4h.01"/>',
    mixed:'<path d="M8 3.6c1.9 2 3.8 4.2 3.8 6.3a3.8 3.8 0 1 1-7.6 0c0-2.1 1.9-4.3 3.8-6.3Z"/><path d="M17.6 10.6c1 .2 1.4 1 1.2 1.7h.3c1.1 0 1.9.7 1.9 1.6 0 .4-.2.7-.4 1 1.1.2 1.9.9 1.9 1.8 0 1.1-1.2 2-2.7 2h-5.6c-1.5 0-2.7-.9-2.7-2 0-.9.8-1.6 1.9-1.8a1.4 1.4 0 0 1-.4-1c0-.9.8-1.6 1.9-1.6h.3c-.3-1 .5-1.9 1.8-1.7Z"/>',
    nursing:'<path d="M20.8 5.2a5.2 5.2 0 0 0-7.4-.2L12 6.2l-1.4-1.2a5.2 5.2 0 0 0-7.2 7.4L12 21l8.6-8.4a5.2 5.2 0 0 0 .2-7.4Z"/><circle cx="9.4" cy="10.4" r="1.5"/><circle cx="14.6" cy="10.4" r="1.5"/>',
    heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8L12 21l7.8-7.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bottle:'<path d="M9.6 2.8h4.8"/><path d="M10.4 2.8v3.4L8.6 9v10a2.2 2.2 0 0 0 2.2 2.2h2.4a2.2 2.2 0 0 0 2.2-2.2V9l-1.8-2.8V2.8"/><path d="M8.6 12.4h6.8M8.6 16h6.8"/>',
    diaper:'<path d="M4.6 6.6c2.4 1.5 4.8 2.2 7.4 2.2s5-.7 7.4-2.2v8.2c-2.2 2.6-4.7 3.9-7.4 3.9s-5.2-1.3-7.4-3.9Z"/><path d="M8 8.7v8.1M16 8.7v8.1"/>',
    history:'<path d="M3.2 12a8.8 8.8 0 1 0 2.9-6.5"/><path d="M3.2 4.2v5h5"/><path d="M12 7.6V12l3.2 2"/>',
    chart:'<path d="M4 19.2V4.8"/><path d="M4 19.2h15.6"/><path d="m7.4 15.2 3.4-4.4 3 2 4.2-6.2"/>',
    snow:'<path d="M12 2.4v19.2"/><path d="m4 7 16 10M4 17 20 7"/><path d="m9.2 4.4 2.8 2.6 2.8-2.6M9.2 19.6l2.8-2.6 2.8 2.6"/>',
    baby:'<circle cx="12" cy="13" r="7.4"/><path d="M9.6 11.6h.01M14.4 11.6h.01"/><path d="M9.8 15.4c1.4 1.2 3 1.2 4.4 0"/><path d="M8.6 6.1C9.8 3.7 13 3.2 14.8 5"/>',
    plus:'<path d="M12 4.8v14.4M4.8 12h14.4"/>',
    minus:'<path d="M4.8 12h14.4"/>',
    more:'<circle cx="5" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.4" fill="currentColor" stroke="none"/>',
    menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
    close:'<path d="m6 6 12 12M18 6 6 18"/>',
    bell:'<path d="M18.4 8.4a6.4 6.4 0 1 0-12.8 0c0 6.8-2.8 7-2.8 9.2h18.4c0-2.2-2.8-2.4-2.8-9.2"/><path d="M9.8 21h4.4"/>',
    check:'<path d="m5 12.4 4.4 4.4L19 6.6"/>',
    settings:'<circle cx="12" cy="12" r="3"/><path d="M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5.1 11a7 7 0 0 0 0 2l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"/>',
    steth:'<path d="M6 3v5.2a4 4 0 0 0 8 0V3"/><path d="M10 12.2v1.6a5 5 0 0 0 10 0v-1.2"/><circle cx="20" cy="10" r="2.2"/><path d="M6 3H4.4M14 3h1.6"/>',
    growth:'<path d="M3.4 8.2h17.2a1 1 0 0 1 1 1v5.6a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V9.2a1 1 0 0 1 1-1Z"/><path d="M7 8.2v3.4M11 8.2v4.6M15 8.2v3.4M19 8.2v4.6"/>',
    moon:'<path d="M20.8 13.4A9 9 0 1 1 10.6 3.2a7 7 0 0 0 10.2 10.2Z"/><path d="M17 3.4v3M15.5 4.9h3"/>',
    shield:'<path d="M12 3 5 6v5c0 5 3 8 7 10 4-2 7-5 7-10V6Z"/><path d="m9 12 2 2 4-4"/>',
    upload:'<path d="M12 20.4V8.6"/><path d="m7.2 13 4.8-4.8L16.8 13"/><path d="M4.6 3.6h14.8"/>',
    download:'<path d="M12 3.6v11.8"/><path d="m7.2 11 4.8 4.8L16.8 11"/><path d="M4.6 20.4h14.8"/>',
    chevron:'<path d="m9.4 18 6-6-6-6"/>',
    clock:'<circle cx="12" cy="12" r="8.8"/><path d="M12 6.8V12l3.4 2.2"/>',
    spark:'<path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7Z"/><path d="m18.6 15.2.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>',
    edit:'<path d="M12.5 5.6H5.2A1.8 1.8 0 0 0 3.4 7.4v11.4a1.8 1.8 0 0 0 1.8 1.8h11.4a1.8 1.8 0 0 0 1.8-1.8v-7.3"/><path d="M17.4 3.6a2.2 2.2 0 0 1 3.1 3.1L12.4 15l-3.6.8.8-3.6Z"/>',
    trash:'<path d="M3.8 6.4h16.4"/><path d="M8.6 6.4V4.8a1.6 1.6 0 0 1 1.6-1.6h3.6a1.6 1.6 0 0 1 1.6 1.6v1.6"/><path d="M18.4 6.4v13.2a1.6 1.6 0 0 1-1.6 1.6H7.2a1.6 1.6 0 0 1-1.6-1.6V6.4"/><path d="M10.2 11v5.6M13.8 11v5.6"/>',
    sun:'<circle cx="12" cy="12" r="4.4"/><path d="M12 2.6v2.2M12 19.2v2.2M4.6 12H2.4M21.6 12h-2.2M6.3 6.3 4.8 4.8M19.2 19.2l-1.5-1.5M6.3 17.7l-1.5 1.5M19.2 4.8l-1.5 1.5"/>',
    timer:'<circle cx="12" cy="13.4" r="7.8"/><path d="M12 9.4v4h3"/><path d="M9.4 2.6h5.2"/>',
    calendar:'<rect x="3.4" y="5.2" width="17.2" height="15.4" rx="2.4"/><path d="M3.4 10h17.2"/><path d="M8.2 3v4.4M15.8 3v4.4"/>',
    cloud:'<path d="M17.4 18.6H7a4.4 4.4 0 0 1-.6-8.8 5.8 5.8 0 0 1 11.1 1.2 3.8 3.8 0 0 1-.1 7.6Z"/>',
    scale:'<path d="M12 3.4a8.6 8.6 0 0 1 8.6 8.6v6a2 2 0 0 1-2 2H5.4a2 2 0 0 1-2-2v-6A8.6 8.6 0 0 1 12 3.4Z"/><path d="M12 12V8.2"/><circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none"/>'
  };
  return `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.heart}</svg>`;
}
// Two-tone care glyphs for the large surfaces: a soft fill plus a crisp outline, all in
// currentColor, so every action keeps one identity across orbs, tiles, rows and sheets.
// Small chrome (nav bar, chips, chevrons) keeps the lighter line icons above.
function glyph(name,cls=''){
  const duo = (d,extra='') =>
    `<path class="g-fill" d="${d}"/><path class="g-line" d="${d}"/>${extra}`;
  const P = {
    // a full teardrop with a highlight
    drop: duo('M24 5.4c2.3 2.8 13.6 17 13.6 24.6a13.6 13.6 0 1 1-27.2 0C10.4 22.4 21.7 8.2 24 5.4Z',
      '<ellipse class="g-hi" cx="18.4" cy="29.6" rx="3.1" ry="4" transform="rotate(-18 18.4 29.6)"/>'),
    // three soft mounds, no cartoon face
    poop: duo('M26.9 8.6c2.9.6 4.1 3 3.3 5h.9c3.2 0 5.6 2.1 5.6 4.8 0 1-.3 2-1 2.7 3.1.5 5.4 2.6 5.4 5.2 0 1.2-.5 2.3-1.2 3.1 2.3.8 3.8 2.5 3.8 4.5 0 3.2-3.3 5.7-7.5 5.7H11.8c-4.2 0-7.5-2.5-7.5-5.7 0-2 1.5-3.7 3.8-4.5a4.3 4.3 0 0 1-1.2-3.1c0-2.6 2.3-4.7 5.4-5.2a4 4 0 0 1-1-2.7c0-2.7 2.4-4.8 5.6-4.8h.9c-.8-2.7 1.4-5.5 5.3-5h3.8Z',
      '<path class="g-hi" d="M16.6 31.4h3M28.4 31.4h3"/>'),
    // wet + poopy together: a drop leaning on a mound
    mixed: duo('M16.4 4.8c1.7 2.1 9.4 11.9 9.4 17.1a9.4 9.4 0 1 1-18.8 0C7 16.7 14.7 6.9 16.4 4.8Z',
      '<path class="g-fill" d="M35.1 20.4c2.1.4 2.9 2.1 2.4 3.6h.7c2.3 0 4 1.5 4 3.5 0 .7-.2 1.4-.7 1.9 2.2.4 3.9 1.9 3.9 3.7 0 2.3-2.4 4.1-5.4 4.1H26.6c-3 0-5.4-1.8-5.4-4.1 0-1.8 1.7-3.3 3.9-3.7a2.9 2.9 0 0 1-.7-1.9c0-2 1.7-3.5 4-3.5h.7c-.5-2 1-3.9 3.8-3.6Z"/><path class="g-line" d="M35.1 20.4c2.1.4 2.9 2.1 2.4 3.6h.7c2.3 0 4 1.5 4 3.5 0 .7-.2 1.4-.7 1.9 2.2.4 3.9 1.9 3.9 3.7 0 2.3-2.4 4.1-5.4 4.1H26.6c-3 0-5.4-1.8-5.4-4.1 0-1.8 1.7-3.3 3.9-3.7a2.9 2.9 0 0 1-.7-1.9c0-2 1.7-3.5 4-3.5h.7c-.5-2 1-3.9 3.8-3.6Z"/>'),
    // bottle with cap, shoulders and a milk line
    bottle: duo('M19.6 11.2h8.8v3.9l3.4 4.3a6.4 6.4 0 0 1 1.4 4v14.2a5.2 5.2 0 0 1-5.2 5.2h-8a5.2 5.2 0 0 1-5.2-5.2V23.4a6.4 6.4 0 0 1 1.4-4l3.4-4.3Z',
      '<rect class="g-line-f" x="18.4" y="4.4" width="11.2" height="6.6" rx="3.3"/><path class="g-hi" d="M18.8 26.2h7M18.8 31h4.6"/>'),
    // a parent cradling a baby: large figure, small figure nestled at the chest
    nursing: '<circle class="g-fill" cx="16.6" cy="12.4" r="6.6"/><circle class="g-line" cx="16.6" cy="12.4" r="6.6"/>'
      + '<path class="g-fill" d="M5.4 43.2c0-8.4 5-14 11.2-14 3.2 0 6 1.5 8 4"/>'
      + '<path class="g-line" d="M5.4 43.2c0-8.4 5-14 11.2-14 3.2 0 6 1.5 8 4"/>'
      + '<circle class="g-fill" cx="31.4" cy="25.4" r="5.2"/><circle class="g-line" cx="31.4" cy="25.4" r="5.2"/>'
      + '<path class="g-fill" d="M22.6 43.2c0-5.6 3.9-9.4 8.8-9.4s8.8 3.8 8.8 9.4Z"/>'
      + '<path class="g-line" d="M22.6 43.2c0-5.6 3.9-9.4 8.8-9.4s8.8 3.8 8.8 9.4"/>'
      + '<path class="g-hi" d="M24.2 33.6c-2.4-1.6-4.2-2-6.4-1.8"/>',
    // pump: a funnel flange narrowing into a collection bottle, with a falling drop
    pump: '<path class="g-fill" d="M10.6 7.2h26.8a2 2 0 0 1 1.9 2.7l-5.2 12.5a3 3 0 0 0-.2 1.1v1.1H18.1v-1.1a3 3 0 0 0-.2-1.1L12.7 9.9a2 2 0 0 1 1.9-2.7Z"/>'
      + '<path class="g-line" d="M10.6 7.2h26.8a2 2 0 0 1 1.9 2.7l-5.2 12.5a3 3 0 0 0-.2 1.1v1.1H18.1v-1.1a3 3 0 0 0-.2-1.1L12.7 9.9a2 2 0 0 1 1.9-2.7Z"/>'
      + '<path class="g-fill" d="M19.4 27.4h9.2a4.4 4.4 0 0 1 4.4 4.4v7a4.4 4.4 0 0 1-4.4 4.4h-9.2a4.4 4.4 0 0 1-4.4-4.4v-7a4.4 4.4 0 0 1 4.4-4.4Z"/>'
      + '<path class="g-line" d="M19.4 27.4h9.2a4.4 4.4 0 0 1 4.4 4.4v7a4.4 4.4 0 0 1-4.4 4.4h-9.2a4.4 4.4 0 0 1-4.4-4.4v-7a4.4 4.4 0 0 1 4.4-4.4Z"/>'
      + '<path class="g-line-f" d="M24 12.4c1.5 1.9 2.7 3.6 2.7 4.9a2.7 2.7 0 1 1-5.4 0c0-1.3 1.2-3 2.7-4.9Z"/>'
      + '<path class="g-line-f" d="M15 36.4h18v2.4a4.4 4.4 0 0 1-4.4 4.4h-9.2a4.4 4.4 0 0 1-4.4-4.4Z" opacity=".38"/>',
    // crescent with two small stars
    moon: duo('M40.4 27.8A16.6 16.6 0 1 1 21.4 8.2a12.9 12.9 0 0 0 19 19.6Z',
      '<path class="g-line-f" d="m35.6 6.4 1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2ZM42 16.6l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7Z"/>'),
    // baby scale: a curved weighing tray on a plinth with a readout
    scale: '<path class="g-fill" d="M8.4 20.4h31.2a3 3 0 0 1 3 3.3l-1.3 11.6a4 4 0 0 1-4 3.5H10.7a4 4 0 0 1-4-3.5L5.4 23.7a3 3 0 0 1 3-3.3Z"/>'
      + '<path class="g-line" d="M8.4 20.4h31.2a3 3 0 0 1 3 3.3l-1.3 11.6a4 4 0 0 1-4 3.5H10.7a4 4 0 0 1-4-3.5L5.4 23.7a3 3 0 0 1 3-3.3Z"/>'
      + '<path class="g-line" d="M13.6 20.4c0-5.8 4.6-10 10.4-10s10.4 4.2 10.4 10"/>'
      + '<path class="g-line-f" d="M18.6 27.6h10.8a1.7 1.7 0 0 1 0 3.4H18.6a1.7 1.7 0 0 1 0-3.4Z"/>'
  };
  return `<svg class="gly ${cls}" viewBox="0 0 48 48" aria-hidden="true">${P[name]||P.drop}</svg>`;
}
// Navigation marks. Inactive is a clean line; active fills the same silhouette, which is
// how a native tab bar shows state without changing the shape you learned to aim for.
function navIcon(name,on=false){
  // `line` is the whole readable glyph and is always drawn; `fill` is only the soft body
  // added when the tab is selected. Detail must live in `line`, or an unselected tab
  // degrades to a bare silhouette - an empty circle instead of a face.
  const M={
    mom:{fill:'<path class="g-fill" d="M12 3.4c2.7 2.9 5.5 6.1 5.5 9.2a5.5 5.5 0 1 1-11 0c0-3.1 2.8-6.3 5.5-9.2Z"/>',
         line:'<path class="g-line" d="M12 3.4c2.7 2.9 5.5 6.1 5.5 9.2a5.5 5.5 0 1 1-11 0c0-3.1 2.8-6.3 5.5-9.2Z"/><path class="g-hi" d="M9.1 13.2c0 1.5.8 2.7 2 3.2"/>'},
    baby:{fill:'<circle class="g-fill" cx="12" cy="13.6" r="6.9"/>',
          line:'<circle class="g-line" cx="12" cy="13.6" r="6.9"/><path class="g-line" d="M8.9 7.1c1.2-2.2 4.1-2.6 5.8-.9"/>'
               +'<path class="g-line-f" d="M10.6 13.1a.95.95 0 1 1-1.9 0 .95.95 0 0 1 1.9 0ZM15.3 13.1a.95.95 0 1 1-1.9 0 .95.95 0 0 1 1.9 0Z"/>'
               +'<path class="g-hi" d="M10 16.2c1.3 1.1 2.7 1.1 4 0"/>'},
    history:{fill:'<circle class="g-fill" cx="12" cy="12.4" r="8.2"/>',
             line:'<path class="g-line" d="M4 12.4a8.2 8.2 0 1 0 2.6-6"/><path class="g-line" d="M3.5 4.9v4.6h4.6"/><path class="g-line" d="M12 8v4.6l3.1 1.8"/>'},
    trends:{fill:'<rect class="g-fill" x="4.1" y="12.8" width="4.1" height="7.1" rx="1.7"/><rect class="g-fill" x="9.9" y="8.6" width="4.1" height="11.3" rx="1.7"/><rect class="g-fill" x="15.7" y="4.6" width="4.1" height="15.3" rx="1.7"/>',
            line:'<rect class="g-line" x="4.1" y="12.8" width="4.1" height="7.1" rx="1.7"/><rect class="g-line" x="9.9" y="8.6" width="4.1" height="11.3" rx="1.7"/><rect class="g-line" x="15.7" y="4.6" width="4.1" height="15.3" rx="1.7"/>'},
    home:{fill:'<path class="g-fill" d="M12 3.3 3.6 10.4V20a1 1 0 0 0 1 1h14.8a1 1 0 0 0 1-1v-9.6Z"/>',
          line:'<path class="g-line" d="M3.6 10.4 12 3.3l8.4 7.1"/><path class="g-line" d="M5.5 9.2V20a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.2"/><path class="g-line" d="M9.6 21v-5.2a2.4 2.4 0 0 1 4.8 0V21"/>'},
    more:{fill:'<circle class="g-fill" cx="12" cy="12" r="8.6"/>',
          line:'<path class="g-line-f" d="M7 12a1.55 1.55 0 1 1-3.1 0A1.55 1.55 0 0 1 7 12ZM13.55 12a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0ZM20.1 12a1.55 1.55 0 1 1-3.1 0 1.55 1.55 0 0 1 3.1 0Z"/>'}
  };
  const m=M[name]||M.mom;
  return `<svg class="gly nav-gly${on?' on':''}" viewBox="0 0 24 24" aria-hidden="true">${on?m.fill:''}${m.line}</svg>`;
}
const GLYPHS = new Set(['drop','poop','mixed','bottle','nursing','pump','moon','scale']);
// Large surfaces use the glyph when one exists, otherwise fall back to the line icon.
const bigIcon = (name,cls='') => GLYPHS.has(name) ? glyph(name,cls) : icon(name,cls);

function babyIllustration(){
  return `<svg class="scene" viewBox="0 0 220 150" aria-hidden="true"><defs><linearGradient id="bgB" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#e8f8ff"/><stop offset="1" stop-color="#eef0ff"/></linearGradient></defs><rect x="10" y="16" width="200" height="122" rx="42" fill="url(#bgB)"/><circle cx="52" cy="46" r="18" fill="#fff6c9"/><circle cx="170" cy="38" r="12" fill="#e8ddff"/><path d="M37 111c17-20 40-30 69-30 31 0 57 11 77 32" fill="none" stroke="#b7e8dc" stroke-width="17" stroke-linecap="round"/><circle cx="111" cy="76" r="33" fill="#fff"/><path d="M96 73h.01M126 73h.01" stroke="#42556f" stroke-width="4" stroke-linecap="round"/><path d="M101 88c7 5 14 5 21 0" fill="none" stroke="#6c86a6" stroke-width="3" stroke-linecap="round"/><path d="M91 52c10-10 28-13 42-3" fill="none" stroke="#7f9bbd" stroke-width="5" stroke-linecap="round"/><path d="M69 41c-7-7-15-5-18 3 7 0 12 3 16 8" fill="#fff"/></svg>`;
}
const momEntries = () => S.entries.filter(e => !e.voidedAt);
const pumps = () => momEntries().filter(e => e.type === 'pump');
const nurses = () => momEntries().filter(e => e.type === 'nursing');
let _babyCache = null, _babyCacheV = -1;
const babyEvents = () => {
  if(_babyCacheV === dataVersion && _babyCache) return _babyCache;
  _babyCacheV = dataVersion;
  _babyCache = S.babyEvents.filter(e => !e.voidedAt).map(normalizeBabyEvent);
  return _babyCache;
};
let _byDate = null, _byDateV = -1;
function babyByDate(){
  if(_byDateV === dataVersion && _byDate) return _byDate;
  _byDateV = dataVersion;
  _byDate = new Map();
  for(const e of babyEvents()){
    if(!_byDate.has(e.date)) _byDate.set(e.date,[]);
    _byDate.get(e.date).push(e);
  }
  return _byDate;
}
const dayP = d => pumps().filter(e => e.date === d).sort((a,b)=>(a.time||'').localeCompare(b.time||''));
const dayLogged = d => sum(dayP(d).map(e => +e.amountMl || 0));
const dayOverride = d => { const v = +S.dailyOverrides?.[d]; return Number.isFinite(v) ? v : null; };
// A confirmed daily total covers sessions that were never logged individually, so it acts as a
// floor - not a replacement. Taking the override verbatim hid logged pumps once the logged
// sessions for that day added up to more than the confirmed figure.
const dayTotal = d => { const o = dayOverride(d), l = dayLogged(d); return o === null ? l : Math.max(o, l); };
const dayAdjusted = d => { const o = dayOverride(d); return o !== null && o > dayLogged(d); };
const babyOn = (d,t) => { const a = babyByDate().get(d) || []; return t ? a.filter(e => e.eventType === t) : a; };
function dateList(n,end=today()){ const out=[], d=new Date(`${end}T12:00:00`); for(let i=n-1;i>=0;i--){ const x=new Date(d); x.setDate(d.getDate()-i); out.push(iso(x)); } return out; }
const daysBetween = (a,b) => Math.round((new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`))/86400000);
function earliestDate(scope){
  const src = scope === 'baby' ? babyEvents().map(e => e.date)
            : scope === 'mom' ? [...momEntries().map(e => e.date), ...Object.keys(S.dailyOverrides||{})]
            : [...momEntries().map(e => e.date), ...babyEvents().map(e => e.date)];
  const ds = src.filter(Boolean).sort();
  return ds[0] || today();
}
// `range` 9999 means "all recorded history" - without it, anything older than 30 days was
// simply unreachable from Trends and the Doctor summary even though History still listed it.
function rangeDays(range,scope){
  if(+range < 9999) return +range;
  return Math.max(1, Math.min(daysBetween(earliestDate(scope), today()) + 1, 400));
}
const RANGE_PILLS = [[7,'7 days'],[14,'14 days'],[30,'30 days'],[90,'90 days'],[9999,'All']];
function rollingAvg(n=7){ const vals=dateList(n).map(dayTotal).filter(v=>v>0); return vals.length ? Math.round(sum(vals)/vals.length) : 0; }
function lastPump(){ return pumps().slice().sort(byWhenDesc)[0] || null; }
const mins = t => t ? (+String(t).slice(0,2)*60 + +String(t).slice(3,5)) : 0;
const sortedSchedule = () => [...S.schedule].filter(Boolean).sort((a,b) => mins(a)-mins(b));
function nextPump(){ const d=new Date(), m=d.getHours()*60+d.getMinutes(), s=sortedSchedule(); return s.find(t => mins(t) > m) || s[0] || '--:--'; }
// Pair each planned slot with the pump actually logged nearest to it (each pump used once)
// instead of pairing by array position, which marked the 5:40 slot done when the first
// pump of the day was really the 11:05 one.
function scheduleSlots(d){
  const logged = dayP(d).map((e,i) => ({e,i}));
  const used = new Set();
  const slots = sortedSchedule().map(t => {
    let best = null, bestDiff = Infinity;
    for(const {e,i} of logged){
      if(used.has(i) || !e.time) continue;
      const diff = Math.abs(mins(e.time) - mins(t));
      if(diff < bestDiff){ bestDiff = diff; best = i; }
    }
    if(best !== null && bestDiff <= 150){ used.add(best); return {time:t, entry:logged[best].e}; }
    return {time:t, entry:null};
  });
  const extras = logged.filter(({i}) => !used.has(i)).map(({e}) => ({time:e.time, entry:e, extra:true}));
  return [...slots, ...extras].sort((a,b) => mins(a.entry?.time || a.time) - mins(b.entry?.time || b.time));
}
function babyStats(d){
  const diapers = babyOn(d,'diaper').filter(e => !e.exactSourceDuplicate);
  const feeds = babyOn(d,'feeding').filter(e => !e.exactSourceDuplicate);
  const nursing = babyOn(d,'nursing').filter(e => !e.exactSourceDuplicate);
  const sleep = babyOn(d,'sleep').filter(e => !e.exactSourceDuplicate);
  const wetOnly = diapers.filter(e => e.subtype === 'wet').length;
  const poopOnly = diapers.filter(e => e.subtype === 'poop').length;
  const mixed = diapers.filter(e => e.subtype === 'both').length;
  const breastMilkBottles = feeds.filter(e => e.feedingType === 'expressed_milk');
  const formulaBottles = feeds.filter(e => e.feedingType === 'formula');
  return {
    wetOnly, poopOnly, mixed,
    wetTotal: wetOnly + mixed,
    poopTotal: poopOnly + mixed,
    diapers: wetOnly + poopOnly + mixed,
    feeds: feeds.length + nursing.length,
    bottles: feeds.length,
    nursing: nursing.length,
    breastMilkBottles: breastMilkBottles.length,
    formulaBottles: formulaBottles.length,
    breastMilkOz: sum(breastMilkBottles.map(e => +e.amountOz || 0)),
    formulaOz: sum(formulaBottles.map(e => +e.amountOz || 0)),
    bottleOz: sum(feeds.map(e => +e.amountOz || 0)),
    sleepMin: sum(sleep.map(e => +e.durationMinutes || 0))
  };
}
function latestGrowth(){ return babyEvents().filter(e => e.eventType === 'growth').sort(byWhenDesc)[0] || null; }
function feedingPreference(){
  if(['mostly_breastfed','mostly_formula','mixed'].includes(S.baby.feedingPreference)) return S.baby.feedingPreference;
  const cutoff = new Date(`${today()}T12:00:00`); cutoff.setDate(cutoff.getDate()-30); const min=iso(cutoff);
  const recent = babyEvents().filter(e => e.date >= min && (e.eventType === 'feeding' || e.eventType === 'nursing'));
  const breast = recent.filter(e => e.eventType === 'nursing' || e.feedingType === 'expressed_milk').length;
  const formula = recent.filter(e => e.eventType === 'feeding' && e.feedingType === 'formula').length;
  if(!breast && !formula) return 'mostly_breastfed';
  if(formula > breast*1.3) return 'mostly_formula';
  if(breast > formula*1.3) return 'mostly_breastfed';
  return 'mixed';
}

// "3h 20m ago" is what a parent actually wants at a glance, not a bare clock time.
const birthDate = () => S.baby.birthDate || '';
const ageDays = () => { const b = birthDate(); if(!b) return null; const d = daysBetween(b, today()); return Number.isFinite(d) && d >= 0 ? d : null; };
const ageWeeks = () => { const d = ageDays(); return d === null ? null : Math.floor(d/7); };
// Calendar months, so "4 months" lines up with how milestone guidance is written.
function ageMonths(){
  const b = birthDate(); if(!b) return null;
  const bd = new Date(`${b}T12:00:00`), nd = new Date(`${today()}T12:00:00`);
  let m = (nd.getFullYear()-bd.getFullYear())*12 + (nd.getMonth()-bd.getMonth());
  if(nd.getDate() < bd.getDate()) m--;
  return m < 0 ? null : m;
}
function ageLabel(){
  const d = ageDays(); if(d === null) return null;
  if(d < 14) return `${d} ${d===1?'day':'days'} old`;
  if(d < 70) { const w = Math.floor(d/7); return `${w} weeks old`; }
  const m = ageMonths(), rem = Math.floor((d - m*30.44)/7);
  if(m < 24) return rem > 0 ? `${m} months ${rem}w` : `${m} months old`;
  return `${Math.floor(m/12)}y ${m%12}m old`;
}

// Four gentle day parts: tints the app and drives the greeting on every load.
const DAY_PARTS = [
  {key:'morning',   from:5,  to:12, greet:'Good morning'},
  {key:'afternoon', from:12, to:17, greet:'Good afternoon'},
  {key:'evening',   from:17, to:21, greet:'Good evening'},
  {key:'night',     from:21, to:5,  greet:'Good night'}
];
function dayPart(){
  const h = new Date().getHours();
  return DAY_PARTS.find(p => p.from < p.to ? (h >= p.from && h < p.to) : (h >= p.from || h < p.to)) || DAY_PARTS[0];
}
// "auto" follows the day: the app goes dark for the night period, or whenever the device
// asks for dark. Night feeds are the reason this exists, not decoration.
function resolveTheme(){
  const pref = S.ui.theme || 'auto';
  if(pref === 'light' || pref === 'dark') return pref;
  if(dayPart().key === 'night') return 'dark';
  return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}
function applyDayPart(){
  const p = dayPart(), theme = resolveTheme(), root = document.documentElement;
  if(root.dataset.daypart !== p.key) root.dataset.daypart = p.key;
  if(root.dataset.theme !== theme){
    root.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#0e1016' : '#f4f4f9');
  }
  return p;
}
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change',()=>{ if((S.ui.theme||'auto')==='auto') applyDayPart(); });
function greeting(name){
  const p = dayPart(), g = p.greet;
  const ic = p.key === 'night' ? 'moon' : p.key === 'evening' ? 'moon' : 'sun';
  return `<span class="greet"><span class="greet-mark ${p.key}">${icon(ic)}</span>${name ? `${g}, ${esc(name)}` : g}</span>`;
}

function sinceLabel(date,time){
  if(!date) return null;
  const t=new Date(`${date}T${time||'00:00'}:00`);
  const diff=Date.now()-t.getTime();
  if(!Number.isFinite(diff)) return null;
  if(diff < 0) return null;
  const m=Math.round(diff/60000);
  if(m < 2) return 'just now';
  if(m < 60) return `${m}m ago`;
  const h=Math.floor(m/60);
  if(h < 24) return m%60 ? `${h}h ${m%60}m ago` : `${h}h ago`;
  const d=Math.round(h/24);
  return d <= 1 ? 'yesterday' : `${d} days ago`;
}
// untilLabel wraps past times to tomorrow, which is right for "next pump" but wrong on a
// schedule card for a slot that already went by today: pump-insights stamps that same card
// MISSED, so the card ended up reading "in 6h 26m" directly above "MISSED".
function slotNote(t){
  const m=mins(t); if(m==null) return 'Planned';
  const d0=new Date();
  return m < (d0.getHours()*60 + d0.getMinutes()) ? 'Earlier today' : (untilLabel(t)||'Planned');
}
function untilLabel(t){
  if(!t || t === '--:--') return '';
  const d0=new Date(); let diff=mins(t) - (d0.getHours()*60 + d0.getMinutes());
  if(diff < 0) diff += 1440;
  if(diff < 2) return 'now';
  if(diff < 60) return `in ${diff}m`;
  const h=Math.floor(diff/60);
  return diff%60 ? `in ${h}h ${diff%60}m` : `in ${h}h`;
}
function ring(pct,center,sub,tone='mom'){
  const r=52, c=2*Math.PI*r, p=Math.max(0,Math.min(1,pct||0));
  return `<div class="ring ${tone}"><svg viewBox="0 0 120 120" aria-hidden="true"><circle class="ring-bg" cx="60" cy="60" r="${r}"/><circle class="ring-fg" cx="60" cy="60" r="${r}" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-p)).toFixed(1)}"/></svg><div class="ring-label"><strong>${center}</strong><span>${sub}</span></div></div>`;
}
function chip(ic,text,cls=''){ return `<span class="chip ${cls}">${icon(ic)}${text}</span>`; }
const hoursSince = e => e ? (Date.now() - new Date(`${e.date}T${e.time||'00:00'}:00`).getTime())/3600000 : Infinity;
const isRecent = (e,maxHours=36) => { const h=hoursSince(e); return Number.isFinite(h) && h >= 0 && h <= maxHours; };
// ---------------------------------------------------------------- charts --
// All charts are inline SVG/CSS with no dependencies. Geometry lives in the SVG;
// every label is HTML, so text stays crisp at any container width. Lines use
// vector-effect="non-scaling-stroke" so stretching never distorts stroke weight.

// Long ranges are aggregated into weeks so a 90-day or All view stays readable.
function bucketDays(days,maxBars=45){
  if(days.length <= maxBars) return days.map(d => ({days:[d], label:fd(d), short:fd(d)}));
  const size = Math.ceil(days.length / maxBars), out = [];
  for(let i = 0; i < days.length; i += size){
    const chunk = days.slice(i, i+size);
    out.push({days:chunk, label:`${fd(chunk[0])} – ${fd(chunk[chunk.length-1])}`, short:fd(chunk[0])});
  }
  return out;
}
const avg = a => a.length ? sum(a)/a.length : 0;

// Vertical bars. `segments` turns each bar into a stack (diaper types).
function barChart(buckets,{value,segments=null,color='var(--mom)',format=v=>Math.round(v),emptyLabel='No data yet'}){
  const vals = buckets.map(value);
  const max = Math.max(...vals, 1);
  if(!vals.some(v => v > 0)) return `<div class="chart-empty">${emptyLabel}</div>`;
  const bars = buckets.map((b,i) => {
    const v = vals[i], h = v ? Math.max(4, Math.round(v/max*100)) : 2;
    const stack = segments
      ? segments.map(sg => { const sv = sg.value(b); return sv ? `<i class="seg" style="flex:${sv};background:${sg.color}" title="${esc(sg.label)}"></i>` : ''; }).join('')
      : `<i class="seg" style="flex:1;background:${color}"></i>`;
    return `<div class="cbar ${v?'':'is-empty'}"><span class="cbar-v">${v?format(v):''}</span><div class="cbar-track"><div class="cbar-fill" style="height:${h}%">${stack}</div></div><small>${b.short}</small></div>`;
  }).join('');
  return `<div class="chart-scroll"><div class="cbars" style="--n:${buckets.length}">${bars}</div></div>`;
}

// Smoothed area + line. Returns HTML label rail + SVG geometry.
function areaChart(buckets,{value,color='var(--mom)',format=v=>Math.round(v),unit='',emptyLabel='No data yet'}){
  let vals = buckets.map(value);
  if(!vals.some(v => v > 0)) return `<div class="chart-empty">${emptyLabel}</div>`;
  // Trim empty runs at each end so the line starts at the first real day instead of
  // climbing out of a flat zero. Interior zeros are kept - those are real days.
  let lo = vals.findIndex(v => v > 0);
  let hi = vals.length - 1; while(hi > lo && !vals[hi]) hi--;
  buckets = buckets.slice(lo, hi+1); vals = vals.slice(lo, hi+1);
  const n = vals.length, max = Math.max(...vals, 1), W = 100, H = 100;
  const x = i => n === 1 ? W/2 : (i/(n-1))*W;
  const y = v => H - (v/max)*(H-6) - 3;
  const pts = vals.map((v,i) => [x(i), y(v)]);
  const line = pts.map(([px,py],i) => `${i?'L':'M'}${px.toFixed(2)} ${py.toFixed(2)}`).join(' ');
  const area = `${line} L${W} ${H} L0 ${H} Z`;
  const id = `g${Math.random().toString(36).slice(2,8)}`;
  const dots = pts.map(([px,py],i) => (i === pts.length-1) ? `<circle cx="${px.toFixed(2)}" cy="${py.toFixed(2)}" r="2.4" fill="${color}" vector-effect="non-scaling-stroke"/>` : '').join('');
  return `<div class="chart-area">
    <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></linearGradient></defs>
      <path d="${area}" fill="url(#${id})"/>
      <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
      ${dots}
    </svg>
    <div class="chart-rail"><span>${format(vals[0])}${unit}</span><span class="peak">peak ${format(max)}${unit}</span><span>${format(vals[n-1])}${unit}</span></div>
    <div class="chart-rail dim"><span>${buckets[0].short}</span><span>${buckets[n-1].short}</span></div>
  </div>`;
}

// Proportional donut for a small set of categories.
function donut(segments,centerLabel,centerSub){
  const total = sum(segments.map(s => s.value));
  if(!total) return `<div class="chart-empty">No data yet</div>`;
  const R = 42, C = 2*Math.PI*R;
  let offset = 0;
  const rings = segments.filter(s => s.value > 0).map(s => {
    const len = (s.value/total)*C;
    const el = `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${s.color}" stroke-width="15" stroke-dasharray="${len.toFixed(2)} ${(C-len).toFixed(2)}" stroke-dashoffset="${(-offset).toFixed(2)}" stroke-linecap="butt"/>`;
    offset += len; return el;
  }).join('');
  const legend = segments.map(s => `<div><i style="background:${s.color}"></i><span>${esc(s.label)}</span><strong>${s.value}</strong><small>${total?Math.round(s.value/total*100):0}%</small></div>`).join('');
  return `<div class="donut-wrap"><div class="donut"><svg viewBox="0 0 120 120" aria-hidden="true"><circle cx="60" cy="60" r="${R}" fill="none" stroke="var(--line-soft)" stroke-width="15"/>${rings}</svg><div class="donut-center"><strong>${centerLabel}</strong><span>${centerSub}</span></div></div><div class="donut-legend">${legend}</div></div>`;
}

// Horizontal distribution bars (e.g. output by time of day).
function hBars(items,{format=v=>Math.round(v),unit=''}={}){
  const max = Math.max(...items.map(i => i.value), 1);
  if(!items.some(i => i.value > 0)) return `<div class="chart-empty">No data yet</div>`;
  return `<div class="hbars">${items.map(i => `<div class="hbar"><span class="hbar-label">${icon(i.icon)}${esc(i.label)}</span><div class="hbar-track"><div class="hbar-fill" style="width:${Math.max(2,Math.round(i.value/max*100))}%;background:${i.color}"></div></div><b>${format(i.value)}${unit}</b><small>${esc(i.sub||'')}</small></div>`).join('')}</div>`;
}

// Direction badge comparing the latest window with the one before it.
function trendBadge(recent,previous,{unit='',goodIsUp=true}={}){
  if(!previous) return '';
  const delta = recent - previous, pct = Math.round(delta/previous*100);
  if(!Number.isFinite(pct) || Math.abs(pct) < 3) return `<span class="delta flat">Steady</span>`;
  const up = delta > 0, good = up === goodIsUp;
  return `<span class="delta ${good?'up':'down'}">${up?'▲':'▼'} ${Math.abs(pct)}%<em>vs previous</em></span>`;
}
function metric(label,value,sub,ic,tone='mom'){ return `<article class="metric ${tone}"><div class="metric-icon">${icon(ic)}</div><div><span>${label}</span><strong>${value}</strong><small>${sub}</small></div></article>`; }
function panel(title,content,action=''){ return `<section class="panel"><div class="panel-head"><h3>${title}</h3>${action}</div>${content}</section>`; }
function empty(ic,title,sub,action=''){ return `<div class="empty"><div class="empty-icon">${icon(ic)}</div><strong>${title}</strong><span>${sub||''}</span>${action}</div>`; }
function pills(items,active,attr){ return `<div class="pills">${items.map(([v,l])=>`<button ${attr}="${v}" class="${String(v)===String(active)?'active':''}">${l}</button>`).join('')}</div>`; }

function momHome(){
  const d=today(), total=dayTotal(d), count=dayP(d).length, lp=lastPump();
  const goal=+S.profile.dailyGoalMl||760, next=nextPump();
  const since=lp?sinceLabel(lp.date,lp.time):null;
  const avg=rollingAvg();
  const pace=avg?Math.round((total/Math.max(avg,1))*100):0;
  return `<section class="hero mom-hero">
    ${ring(goal?total/goal:0,`${total}`,`of ${goal} mL`,'mom')}
    <div class="hero-copy">
      <span class="eyebrow">${greeting(S.profile.momName)}</span>
      <h2>${total?`${total} mL today`:'Ready when you are'}</h2>
      <p>${count?`${count} ${count===1?'pump':'pumps'} logged`:'No pumps logged yet today'}</p>
      <div class="chips">${chip('clock',`Next ${to12(next)} · ${untilLabel(next)}`)}${since?chip('history',`Last ${since}`):''}</div>
    </div>
  </section>
  <div class="quick-grid mom-grid two">
    <button class="quick-tile mom" data-mom="pump"><span class="tile-art">${glyph('pump')}</span><strong>Pump</strong><small>Log milk</small></button>
    <button class="quick-tile nurse" data-mom="nursing"><span class="tile-art">${glyph('nursing')}</span><strong>Nursing</strong><small>Log session</small></button>
  </div>
  <div class="metric-grid mom-summary">${metric('7-day avg',`${avg} mL`,'per pumping day','chart')}${metric('Today vs avg',count&&avg?`${pace}%`:'—',count&&avg?'of your average':'after your first pump','spark')}${metric('Freezer stash',`${(+S.profile.stashMl||0).toLocaleString()} mL`,'saved milk','snow')}</div>
  ${panel('Pump plan',scheduleStrip(),'<button data-view="set-pumping">Edit</button>')}
  ${panel('Recent',recentMom(5),'<button data-view="mom-history">See all</button>')}`;
}
function scheduleStrip(){
  const slots=scheduleSlots(today());
  return `<div class="schedule-strip">${slots.map(({time,entry,extra})=>{
    const done=!!entry;
    return `<div class="schedule-card ${done?'done':''} ${extra?'extra':''}"><div>${done?icon('check'):icon('clock')}</div><strong>${to12(entry?entry.time:time)}</strong><small>${done?`${entry.amountMl||0} mL`:slotNote(time)}</small>${extra?'<em>Extra</em>':''}</div>`;
  }).join('')}</div>`;
}
function recentMom(n){ const a=momEntries().slice().sort(byWhenDesc).slice(0,n); if(!a.length) return empty('history','No Mom history yet','Log a pump or import your private backup.','<button class="primary-link" data-import>Import backup</button>'); return `<div class="rows">${a.map(momRow).join('')}</div>`; }
function momRow(e){ return `<button type="button" class="row" data-record="mom:${esc(e.id)}"><div class="row-icon mom">${bigIcon(e.type==='pump'?'pump':'nursing')}</div><div class="row-main"><strong>${e.type==='pump'?`${e.amountMl||0} mL`:`${e.durationMin||0} min nursing`}</strong><span>${fd(e.date)} · ${to12(e.time)}${e.side?` · ${cap(e.side)}`:''}${e.note?` · ${esc(e.note)}`:''}</span></div><div class="row-go">${icon('chevron')}</div></button>`; }
function momHistory(){
  const range=S.ui.momRange ?? 30, all=+range>=9999, cutoff=all?'':dateList(rangeDays(range,'mom'))[0];
  const a=momEntries().filter(e=>all||e.date>=cutoff).sort(byWhenDesc);
  return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>History</h2></div><button class="round-action" data-mom="pump">${icon('plus')}<span>Pump</span></button></div>${pills([[7,'7 days'],[30,'30 days'],[90,'90 days'],[9999,'All']],range,'data-mom-range')}${panel('',a.length?`<div class="rows">${a.map(momRow).join('')}</div>`:empty('history','No Mom records here','Try a wider date range.'))}`;
}
const TIME_BANDS = [
  {key:'morning', label:'Morning', sub:'5am – 11am', from:5*60, to:11*60, color:'var(--mom)', icon:'sun'},
  {key:'midday',  label:'Midday',  sub:'11am – 5pm', from:11*60, to:17*60, color:'var(--mom-2)', icon:'clock'},
  {key:'evening', label:'Evening', sub:'5pm – 10pm', from:17*60, to:22*60, color:'#e08bbe', icon:'clock'},
  {key:'night',   label:'Night',   sub:'10pm – 5am', from:22*60, to:5*60, color:'#7d8ad6', icon:'moon'}
];
const inBand = (t,b) => { const m = mins(t); return b.from < b.to ? (m >= b.from && m < b.to) : (m >= b.from || m < b.to); };

function momTrends(){
  const range = S.ui.trendRange ?? 14, days = dateList(rangeDays(range,'mom'));
  const buckets = bucketDays(days);
  const vals = days.map(dayTotal);
  const sessions = pumps().filter(e => e.date >= days[0]);
  const avgSession = sessions.length ? Math.round(sum(sessions.map(e => +e.amountMl||0))/sessions.length) : 0;
  const best = sessions.reduce((m,e) => (+e.amountMl||0) > (+m?.amountMl||0) ? e : m, null);
  const activeDays = days.filter(d => dayTotal(d) > 0);
  const perDay = activeDays.length ? Math.round(sum(activeDays.map(dayTotal))/activeDays.length) : 0;
  const sessionsPerDay = activeDays.length ? (sessions.length/activeDays.length).toFixed(1) : '0.0';

  // Latest half of the window against the half before it.
  const half = Math.floor(days.length/2);
  const recentAvg = avg(days.slice(half).map(dayTotal).filter(v => v > 0));
  const priorAvg = avg(days.slice(0,half).map(dayTotal).filter(v => v > 0));

  const bandTotals = TIME_BANDS.map(b => {
    const inB = sessions.filter(e => e.time && inBand(e.time,b));
    return {...b, value: sum(inB.map(e => +e.amountMl||0)), count: inB.length};
  });
  const topBand = bandTotals.slice().sort((a,b) => b.value-a.value)[0];
  const adjustedDays = days.filter(dayAdjusted).length;

  // 7-day rolling average, so the supply direction is readable through daily noise.
  const rollingBy = new Map(days.map((d,i) => { const w = days.slice(Math.max(0,i-6), i+1).map(dayTotal).filter(v => v > 0); return [d, w.length ? Math.round(sum(w)/w.length) : 0]; }));

  return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>Milk trends</h2></div></div>
  ${pills(RANGE_PILLS,range,'data-trend-range')}
  <div class="metric-grid">${metric('Per pumping day',`${perDay} mL`,`${activeDays.length} active days`,'chart')}${metric('Avg pump',`${avgSession} mL`,`${sessions.length} sessions`,'drop')}${metric('Best pump',`${best?.amountMl||0} mL`,best?fd(best.date):'—','spark')}${metric('Pumps / day',sessionsPerDay,'on active days','timer')}</div>
  ${panel(`Daily output${adjustedDays?' ':''}`,barChart(buckets,{value:b => Math.round(avg(b.days.map(dayTotal))), color:'var(--mom)', emptyLabel:'No pumping logged in this range'}) + (adjustedDays?`<p class="chart-note">${adjustedDays} day${adjustedDays>1?'s':''} use a confirmed daily total that is higher than the sessions logged individually.</p>`:''),
    `<span class="panel-note">${days.length} days</span>`)}
  ${panel('Supply direction',areaChart(buckets,{value:b => Math.round(avg(b.days.map(d => rollingBy.get(d) || 0))), color:'var(--mom)', unit:' mL', emptyLabel:'Needs a few more days'}),trendBadge(recentAvg,priorAvg,{goodIsUp:true}))}
  ${panel('When you produce most',hBars(bandTotals.map(b => ({...b, sub:`${b.count} ${b.count===1?'pump':'pumps'}`})),{unit:' mL'}) + (topBand&&topBand.value?`<p class="chart-note">Strongest window: <strong>${topBand.label.toLowerCase()}</strong> (${topBand.sub}).</p>`:''))}
  ${panel('Recent sessions',recentMom(6),'<button data-view="mom-history">See all</button>')}`;
}
function momStash(){ return `<div class="page-head"><div><span class="eyebrow">MOM</span><h2>Freezer stash</h2></div></div><section class="stash-hero"><div class="stash-art">${icon('snow')}</div><div><strong>${(+S.profile.stashMl||0).toLocaleString()} mL</strong><span>saved milk</span></div></section>${panel('Update stash',`<div class="stash-buttons"><button data-stash="-30">−30</button><button data-stash="30">+30</button><button data-stash="60">+60</button><button data-stash="120">+120</button></div><label class="field"><span>Exact amount (mL)</span><input id="stashExact" type="number" inputmode="numeric" min="0" value="${+S.profile.stashMl||0}"></label>`)}`; }

// ---------------------------------------------------- development stages --
// Source: CDC "Learn the Signs. Act Early." milestone checklists (2022 revision).
// US federal government work, public domain. These describe what MOST children
// (about 75%) can do by each age - they are not a test and not a diagnosis.
// Deliberately NOT the Wonder Weeks "leap" schedule, which is proprietary and
// whose developmental claims are not clinically established.
const MILESTONES = [
  {m:2, label:'2 months', tag:'First smiles', groups:{
    social:['Calms down when spoken to or picked up','Looks at your face','Seems happy to see you when you walk up','Smiles when you talk to or smile at them'],
    language:['Makes sounds other than crying','Reacts to loud sounds'],
    cognitive:['Watches you as you move','Looks at a toy for several seconds'],
    movement:['Holds head up when on tummy','Moves both arms and both legs','Opens hands briefly']}},
  {m:4, label:'4 months', tag:'Cooing and reaching', groups:{
    social:['Smiles on their own to get your attention','Chuckles when you try to make them laugh','Looks at you, moves, or makes sounds to get or keep your attention'],
    language:['Makes cooing sounds like "oooo" and "aahh"','Makes sounds back when you talk to them','Turns head towards the sound of your voice'],
    cognitive:['Opens mouth when they see the breast or bottle if hungry','Looks at their hands with interest'],
    movement:['Holds head steady without support when you are holding them','Holds a toy when you put it in their hand','Uses their arm to swing at toys','Brings hands to mouth','Pushes up onto elbows or forearms when on tummy']}},
  {m:6, label:'6 months', tag:'Rolling and laughing', groups:{
    social:['Knows familiar people','Likes to look at themselves in a mirror','Laughs'],
    language:['Takes turns making sounds with you','Blows raspberries','Makes squealing noises'],
    cognitive:['Puts things in their mouth to explore them','Reaches to grab a toy they want','Closes lips to show they do not want more food'],
    movement:['Rolls from tummy to back','Pushes up with straight arms when on tummy','Leans on hands to support themselves when sitting']}},
  {m:9, label:'9 months', tag:'Sitting and babbling', groups:{
    social:['Is shy, clingy, or fearful around strangers','Shows several facial expressions','Looks when you call their name','Reacts when you leave','Smiles or laughs during peek-a-boo'],
    language:['Makes different sounds like "mamamama" and "bababababa"','Lifts arms up to be picked up'],
    cognitive:['Looks for objects when dropped out of sight','Bangs two things together'],
    movement:['Gets to a sitting position by themselves','Moves things from one hand to the other','Uses fingers to rake food towards themselves','Sits without support']}},
  {m:12, label:'12 months', tag:'First words and steps', groups:{
    social:['Plays games with you, like pat-a-cake'],
    language:['Waves bye-bye','Calls a parent "mama" or "dada" or another special name','Understands "no"'],
    cognitive:['Puts something in a container','Looks for things they see you hide'],
    movement:['Pulls up to stand','Walks holding on to furniture','Drinks from a cup without a lid as you hold it','Picks things up between thumb and pointer finger']}},
  {m:15, label:'15 months', tag:'Walking and copying', groups:{
    social:['Copies other children while playing','Shows you an object they like','Claps when excited','Hugs a stuffed doll or toy','Shows you affection'],
    language:['Tries to say one or two words besides "mama" or "dada"','Looks at a familiar object when you name it','Follows directions given with both a gesture and words','Points to ask for something'],
    cognitive:['Tries to use things the right way','Stacks at least two small objects'],
    movement:['Takes a few steps on their own','Uses fingers to feed themselves']}},
  {m:18, label:'18 months', tag:'Exploring on their own', groups:{
    social:['Moves away from you but looks to make sure you are close by','Points to show you something interesting','Puts hands out for you to wash them','Looks at a few pages in a book with you','Helps you dress them'],
    language:['Tries to say three or more words besides "mama" or "dada"','Follows one-step directions without a gesture'],
    cognitive:['Copies you doing chores','Plays with toys in a simple way'],
    movement:['Walks without holding on','Scribbles','Drinks from a cup without a lid and may spill','Feeds themselves with fingers','Tries to use a spoon','Climbs on and off a couch or chair without help']}},
  {m:24, label:'2 years', tag:'Two-word phrases', groups:{
    social:['Notices when others are hurt or upset','Looks at your face to see how to react in a new situation'],
    language:['Points to things in a book when you ask','Says at least two words together, like "more milk"','Points to at least two body parts','Uses more gestures than just waving and pointing'],
    cognitive:['Holds something in one hand while using the other','Tries to use switches, knobs, or buttons','Plays with more than one toy at the same time'],
    movement:['Kicks a ball','Runs','Walks up a few stairs with or without help','Eats with a spoon']}}
];
const MILESTONE_GROUPS = {
  social:{label:'Social & emotional', icon:'nursing', color:'var(--growth-ink)'},
  language:{label:'Language', icon:'bell', color:'var(--feed-ink)'},
  cognitive:{label:'Learning & thinking', icon:'spark', color:'var(--mixed-ink)'},
  movement:{label:'Movement', icon:'growth', color:'var(--wet-ink)'}
};
const milestoneId = (m,group,i) => `ms-${m}-${group}-${i}`;
const milestoneTotal = st => Object.values(st.groups).reduce((a,g) => a+g.length, 0);
// Marked milestones are ordinary baby events, so they land in History, sync and export.
function markedMilestones(){
  const set = new Map();
  for(const e of babyEvents()) if(e.eventType === 'milestone' && e.milestoneId) set.set(e.milestoneId, e);
  return set;
}
function currentStage(){
  const m = ageMonths();
  if(m === null) return null;
  let stage = MILESTONES[0];
  for(const st of MILESTONES) if(m >= st.m) stage = st;
  // before 2 months the first checklist is still the one ahead of them
  return m < MILESTONES[0].m ? MILESTONES[0] : stage;
}

const BABY_EVENT_TONE = {
  diaper_wet:{color:'var(--wet-ink)', label:'Wet'},
  diaper_poop:{color:'var(--poop-ink)', label:'Poopy'},
  diaper_both:{color:'var(--mixed-ink)', label:'Mixed'},
  feeding:{color:'var(--feed-ink)', label:'Bottle'},
  nursing:{color:'var(--growth-ink)', label:'Nursing'},
  sleep:{color:'var(--sleep-ink)', label:'Sleep'},
  growth:{color:'var(--growth-ink)', label:'Growth'},
  milestone:{color:'var(--mixed-ink)', label:'Milestone'}
};
const toneKey = e => e.eventType === 'diaper' ? `diaper_${e.subtype||'wet'}` : e.eventType;
const toneOf = e => BABY_EVENT_TONE[toneKey(e)] || {color:'var(--baby)', label:cap(e.eventType)};

// A ring measured against this baby's own recent average - never an invented clinical target.
function statRing(value,average,label,sub,color){
  const base = Math.max(average, value, 1);
  const pct = Math.max(0, Math.min(1, value/base));
  const r = 26, c = 2*Math.PI*r;
  return `<div class="stat-ring" style="--c:${color}">
    <div class="stat-ring-dial">
      <svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="${r}" class="sr-bg"/><circle cx="32" cy="32" r="${r}" class="sr-fg" stroke-dasharray="${c.toFixed(1)}" stroke-dashoffset="${(c*(1-pct)).toFixed(1)}"/></svg>
      <b>${value}</b>
    </div>
    <span>${label}</span><small>${sub}</small>
  </div>`;
}

// Today's events laid along a 24-hour track: clustering and gaps are visible at a glance.
function dayTimeline(){
  const evs = babyOn(today()).filter(e => !e.exactSourceDuplicate && e.time && e.eventType !== 'milestone' && e.eventType !== 'growth').sort((a,b) => mins(a.time)-mins(b.time));
  const d = new Date(), nowPct = ((d.getHours()*60 + d.getMinutes())/1440)*100;
  const dots = evs.map(e => {
    const t = toneOf(e);
    return `<button type="button" class="tl-dot" data-record="baby:${esc(e.id)}" style="left:${(mins(e.time)/1440*100).toFixed(2)}%;--c:${t.color}" aria-label="${esc(t.label)} at ${to12(e.time)}"></button>`;
  }).join('');
  const ticks = [0,6,12,18,24].map(h => `<span style="left:${(h/24*100).toFixed(2)}%">${h===0?'12a':h===12?'12p':h>12?`${h-12}p`:`${h}a`}</span>`).join('');
  return `<section class="timeline-card">
    <div class="timeline-head"><strong>Today's rhythm</strong><span>${evs.length} ${evs.length===1?'entry':'entries'}</span></div>
    <div class="timeline-track">
      <div class="tl-now" style="left:${nowPct.toFixed(2)}%"></div>
      ${dots || '<span class="tl-empty" data-label="Nothing logged yet today"></span>'}
    </div>
    <div class="tl-ticks">${ticks}</div>
  </section>`;
}

const hhmm = d => `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
const fmtGap = m => m >= 60 ? (m%60 ? `${Math.floor(m/60)}h ${m%60}m` : `${Math.floor(m/60)}h`) : `${m}m`;
// Next feed is derived from the last one plus the chosen gap - there is no fixed clock
// schedule for a baby, unlike the Mom pump plan.
function nextFeedDue(last){
  if(!S.reminders.feedEnabled || !last || !last.date || !last.time) return null;
  const gap = +S.reminders.feedGapMin || 180;
  const due = new Date(new Date(`${last.date}T${last.time}:00`).getTime() + gap*60000);
  if(!Number.isFinite(due.getTime())) return null;
  const diff = Math.round((due.getTime() - Date.now())/60000);
  return diff <= 0
    ? {overdue:true, due, label:`Due ${fmtGap(Math.abs(diff))} ago`}
    : {overdue:false, due, label:`Next ${to12(hhmm(due))}`};
}

// ---------------------------------------------------------- activity feed --
// Per-activity detail line, e.g. "Nursing, right · 12 min" or "3.5 oz formula".
function activityDetail(e){
  if(!e) return '';
  if(e.eventType === 'nursing'){ const m = e.durationMinutes ?? e.totalMinutes; return `Nursing${e.side?`, ${cap(e.side)}`:''}${m?` · ${m} min`:''}`; }
  if(e.eventType === 'feeding') return `${(+e.amountOz||0).toFixed(1)} oz ${e.feedingType==='formula'?'formula':'breast milk'}`;
  if(e.eventType === 'diaper') return e.subtype==='both'?'Mixed':e.subtype==='poop'?'Poopy':'Wet';
  if(e.eventType === 'sleep'){ const m = +e.durationMinutes||0; return m>=60?`Slept ${Math.floor(m/60)} hr ${m%60} min`:`Slept ${m} min`; }
  if(e.eventType === 'growth') return 'Growth measurement';
  if(e.eventType === 'milestone') return e.milestoneText || 'Milestone';
  return cap(e.eventType);
}
function dayRollup(st,kind){
  if(kind === 'feed'){
    const bits = [];
    if(st.nursing) bits.push(`nursing ${st.nursing}`);
    if(st.breastMilkBottles) bits.push(`breast milk ${st.breastMilkOz.toFixed(1)} oz`);
    if(st.formulaBottles) bits.push(`formula ${st.formulaOz.toFixed(1)} oz`);
    return st.feeds ? `Fed ${st.feeds} ${st.feeds===1?'time':'times'}${bits.length?`: ${bits.join(', ')}`:''}` : 'Nothing logged today';
  }
  if(kind === 'diaper'){
    const bits = [];
    if(st.wetOnly) bits.push(`wet ${st.wetOnly}`);
    if(st.poopOnly) bits.push(`poopy ${st.poopOnly}`);
    if(st.mixed) bits.push(`mixed ${st.mixed}`);
    return st.diapers ? `${st.diapers} ${st.diapers===1?'change':'changes'}${bits.length?`: ${bits.join(', ')}`:''}` : 'Nothing logged today';
  }
  const m = st.sleepMin;
  return m ? `${Math.floor(m/60)} hr ${m%60} min today` : 'Nothing logged today';
}
// The three rows a parent checks first: how long since, what it was, and today's total.
function activityStrip(){
  const st = babyStats(today());
  const live = babyEvents().filter(e => !e.exactSourceDuplicate).slice().sort(byWhenDesc);
  const rows = [
    {kind:'feed',   label:'Feed',   icon:'bottle', color:'var(--feed-ink)',  bg:'var(--feed)',  find:e => e.eventType==='feeding'||e.eventType==='nursing', act:'data-feed', glyphOf:e => e?.eventType==='nursing'?'nursing':'bottle'},
    {kind:'diaper', label:'Diaper', icon:'diaper', color:'var(--wet-ink)',   bg:'var(--wet)',   find:e => e.eventType==='diaper', act:'data-diaper="wet"', glyphOf:e => e?.subtype==='poop'?'poop':e?.subtype==='both'?'mixed':'drop'},
    {kind:'sleep',  label:'Sleep',  icon:'moon',   color:'var(--sleep-ink)', bg:'var(--sleep)', find:e => e.eventType==='sleep', act:'data-sleep'}
  ].map(r => {
    const last = live.find(r.find);
    const ago = last ? sinceLabel(last.date,last.time) : null;
    const due = r.kind === 'feed' ? nextFeedDue(last) : null;
    const tone = r.kind==='diaper' && last ? toneOf(last).color : r.color;
    return `<div class="act-row" style="--c:${tone};--bg:${r.bg}">
      <button type="button" class="act-main" ${last?`data-record="baby:${esc(last.id)}"`:r.act}>
        <span class="act-icon">${bigIcon(r.glyphOf?r.glyphOf(last):r.icon)}</span>
        <span class="act-body">
          <span class="act-when">${ago?esc(ago):`No ${r.label.toLowerCase()} logged yet`}</span>
          <strong>${last?esc(activityDetail(last)):`Tap + to log a ${r.label.toLowerCase()}`}</strong>
          <small>${esc(dayRollup(st,r.kind))}</small>
        </span>
      </button>
      <button type="button" class="act-add" ${r.act} aria-label="Log ${esc(r.label)}">${icon('plus')}</button>
      ${due?`<span class="act-due ${due.overdue?'due':''}">${icon('bell')}${esc(due.label)}</span>`:''}
    </div>`;
  }).join('');
  return `<section class="act-strip">${rows}</section>`;
}

// ------------------------------------------------------------- day review --
const BABY_FILTERS = [['all','All'],['feed','Feeds'],['diaper','Diapers'],['sleep','Sleep'],['growth','Growth'],['milestone','Milestones']];
function reviewStats(d){
  const st = babyStats(d);
  const nursingMin = sum(babyOn(d,'nursing').filter(e => !e.exactSourceDuplicate).map(e => +(e.durationMinutes ?? e.totalMinutes) || 0));
  const line = (cls,label,value) => `<div class="stat-line ${cls}"><span>${label}</span><b>${value}</b></div>`;
  return `<section class="review-stats">
    ${line('feed','Nursing', st.nursing ? `${nursingMin} min · ${st.nursing}×` : '—')}
    ${line('feed','Bottle', st.bottles ? `${st.bottleOz.toFixed(2)} oz (breast ${st.breastMilkOz.toFixed(2)}, formula ${st.formulaOz.toFixed(2)})` : '—')}
    ${line('diaper','Diapers', st.diapers ? `${st.diapers}× — wet ${st.wetOnly}, poopy ${st.poopOnly}, mixed ${st.mixed}` : '—')}
    ${line('sleep','Sleep', st.sleepMin ? `${Math.floor(st.sleepMin/60)} hr ${st.sleepMin%60} min · ${babyOn(d,'sleep').length}×` : '—')}
  </section>`;
}
function babyHome(){
  const t = today(), s = babyStats(t), pref = feedingPreference();
  const prefLabel = pref==='mostly_formula'?'Mostly formula':pref==='mixed'?'Mixed feeding':'Mostly breastfed';
  const live = babyEvents().filter(e => !e.exactSourceDuplicate).slice().sort(byWhenDesc);
  const lastFeed = live.find(e => e.eventType==='feeding' || e.eventType==='nursing');

  // seven-day averages give each ring an honest baseline
  const week = dateList(8).slice(0,7).map(babyStats);
  const wk = k => week.length ? sum(week.map(r => r[k]))/week.length : 0;

  const feedAgo = lastFeed ? sinceLabel(lastFeed.date,lastFeed.time) : null;
  const stageTag = ageMonths() !== null ? (currentStage()?.tag || '') : '';
  const hero = isRecent(lastFeed)
    ? `<h2>Fed <em>${feedAgo}</em></h2>`
    : `<h2>${esc(S.baby.name)}</h2>`;

  return `<section class="baby-stage">
    <div class="stage-glow" aria-hidden="true"></div>
    <div class="stage-body">
      <div class="stage-avatar">${S.baby.photo?`<img src="${esc(S.baby.photo)}" alt="${esc(S.baby.name)}">`:babyIllustration()}</div>
      <div class="stage-copy">
        <span class="eyebrow">${greeting()}${ageLabel()?` · ${esc(ageLabel())}`:''}</span>
        ${hero}
        <p>${prefLabel}${s.feeds?` · ${s.feeds} ${s.feeds===1?'feed':'feeds'} today`:' · nothing logged today'}</p>
        <div class="chips">${stageTag?chip('spark',esc(stageTag)):''}${!isRecent(lastFeed)&&lastFeed?chip('history',`Last feed ${fd(lastFeed.date)}`):''}</div>
      </div>
    </div>
  </section>

  ${activityStrip()}

  <button class="feed-cta" data-feed>
    <span class="cta-medallion">${glyph('bottle')}</span>
    <span class="cta-copy"><strong>Log a feed</strong><small>${lastFeed?`Last ${feedAgo}`:'Nurse, breast milk or formula'}</small></span>
    <span class="cta-go">${icon('chevron')}</span>
  </button>

  <div class="orb-row" aria-label="Quick diaper logging">
    <button class="orb wet" data-diaper="wet"><span class="orb-face">${glyph('drop')}</span><strong>Wet</strong></button>
    <button class="orb poop" data-diaper="poop"><span class="orb-face">${glyph('poop')}</span><strong>Poopy</strong></button>
    <button class="orb mixed" data-diaper="both"><span class="orb-face">${glyph('mixed')}</span><strong>Mixed</strong></button>
  </div>

  <div class="pill-row">
    <button data-sleep>${icon('moon')}<span>Sleep</span></button>
    <button data-growth>${icon('scale')}<span>Growth</span></button>
    
    <button data-view="baby-trends">${icon('chart')}<span>Trends</span></button>
  </div>

  ${dayTimeline()}

  <section class="ring-row">
    ${statRing(s.wetTotal, wk('wetTotal'), 'Wet', `avg ${wk('wetTotal').toFixed(1)}`, 'var(--wet-ink)')}
    ${statRing(s.poopTotal, wk('poopTotal'), 'Poopy', `avg ${wk('poopTotal').toFixed(1)}`, 'var(--poop-ink)')}
    ${statRing(s.feeds, wk('feeds'), 'Feeds', `avg ${wk('feeds').toFixed(1)}`, 'var(--feed-ink)')}
    ${statRing(+s.bottleOz.toFixed(1), wk('bottleOz'), 'Bottle oz', `avg ${wk('bottleOz').toFixed(1)}`, 'var(--baby-ink)')}
  </section>

  ${panel('Recent care',recentBaby(5),'<button data-view="baby-history">See all</button>')}`;
}
function babyLabel(e){
  if(e.eventType==='diaper') return e.subtype==='both'?'Mixed diaper':e.subtype==='poop'?'Poopy diaper':'Wet diaper';
  if(e.eventType==='feeding') return `${(+e.amountOz||0).toFixed(1)} oz ${e.feedingType==='formula'?'formula':'breast milk'}`;
  if(e.eventType==='nursing') return `${e.durationMinutes??e.totalMinutes??0} min nursing`;
  if(e.eventType==='sleep') return `${Math.round((+e.durationMinutes||0)/6)/10} hr sleep`;
  if(e.eventType==='growth') return 'Growth measurement';
  if(e.eventType==='milestone') return e.milestoneText || 'Milestone';
  return cap(e.eventType);
}
function babyRow(e){
  const ic=e.eventType==='feeding'?'bottle':e.eventType==='diaper'?(e.subtype==='wet'?'drop':e.subtype==='poop'?'poop':'mixed'):e.eventType==='nursing'?'nursing':e.eventType==='growth'?'scale':e.eventType==='milestone'?'spark':'moon';
  return `<button type="button" class="row" data-record="baby:${esc(e.id)}"><div class="row-icon baby ${e.eventType==='diaper'?`sub-${esc(e.subtype)}`:`kind-${esc(e.eventType)}`}">${bigIcon(ic)}</div><div class="row-main"><strong>${babyLabel(e)}</strong><span>${fd(e.date)} · ${to12(e.time)}${e.note?` · ${esc(e.note)}`:''}${e.exactSourceDuplicate?' · source duplicate preserved':''}</span></div><div class="row-go">${icon('chevron')}</div></button>`;
}
function recentBaby(n){ const a=babyEvents().filter(e=>!e.exactSourceDuplicate).slice().sort(byWhenDesc).slice(0,n); if(!a.length) return empty('baby','No Baby history yet','Use one of the four buttons above to start.'); return `<div class="rows">${a.map(babyRow).join('')}</div>`; }
function babyHistory(){
  const mode = S.ui.historyMode === 'all' ? 'all' : 'day';
  const seg = `<div class="segmented" role="tablist">
    <button data-history-mode="day" class="${mode==='day'?'on':''}" role="tab" aria-selected="${mode==='day'}">By day</button>
    <button data-history-mode="all" class="${mode==='all'?'on':''}" role="tab" aria-selected="${mode==='all'}">All entries</button>
  </div>`;
  const head = `<div class="page-head"><div><span class="eyebrow">${esc(S.baby.name).toUpperCase()}</span><h2>History</h2></div><button class="round-action baby" data-add>${icon('plus')}<span>Add</span></button></div>${seg}`;
  return head + (mode === 'day' ? historyByDay() : historyAll());
}
function historyByDay(){
  const sel = S.ui.reviewDate && (babyByDate().has(S.ui.reviewDate) || S.ui.reviewDate === today()) ? S.ui.reviewDate : today();
  const strip = dateList(14).map(d => {
    const dt = new Date(`${d}T12:00:00`), isToday = d === today();
    return `<button type="button" class="day-chip ${d===sel?'sel':''} ${isToday?'today':''}" data-review-date="${d}">
      <b>${isToday?'Today':dt.getDate()}</b><span>${isToday?fd(d):new Intl.DateTimeFormat('en-US',{weekday:'short'}).format(dt)}</span></button>`;
  }).join('');
  const filter = S.ui.babyFilter || 'all';
  const matches = e => filter==='all' || (filter==='feed' && (e.eventType==='feeding'||e.eventType==='nursing')) || e.eventType===filter;
  const evs = babyOn(sel).filter(e => !e.exactSourceDuplicate && matches(e)).sort((a,b) => (a.time||'').localeCompare(b.time||''));
  const list = evs.length ? evs.map(revRow).join('')
    : empty('history','Nothing here',`No ${filter==='all'?'entries':BABY_FILTERS.find(f=>f[0]===filter)[1].toLowerCase()} logged on ${fd(sel)}.`);
  return `<div class="day-strip">${strip}</div>
  <div class="review-head"><strong>${fdl(sel)}</strong><span>${evs.length} ${evs.length===1?'entry':'entries'}</span></div>
  ${reviewStats(sel)}
  ${pills(BABY_FILTERS,filter,'data-baby-filter')}
  <section class="rev-list">${list}</section>`;
}
function historyAll(){
  const range = S.ui.babyRange ?? 30, all = +range >= 9999, filter = S.ui.babyFilter || 'all';
  const cutoff = all ? '' : dateList(rangeDays(range,'baby'))[0];
  const matches = e => filter==='all' || (filter==='feed' && (e.eventType==='feeding'||e.eventType==='nursing')) || e.eventType===filter;
  const a = babyEvents().filter(e => (all||e.date>=cutoff) && matches(e)).sort(byWhenDesc);
  return `${pills([[7,'7 days'],[30,'30 days'],[90,'90 days'],[9999,'All']],range,'data-baby-range')}
  ${pills(BABY_FILTERS,filter,'data-baby-filter')}
  ${panel('',a.length?`<div class="rows">${a.map(babyRow).join('')}</div>`:empty('history','No matching records','Try another filter or date range.'),`<span class="panel-note">${a.length} ${a.length===1?'entry':'entries'}</span>`)}`;
}
function revRow(e){
  const t = toneOf(e);
  const ic = e.eventType==='feeding'?'bottle':e.eventType==='diaper'?(e.subtype==='wet'?'drop':e.subtype==='poop'?'poop':'mixed'):e.eventType==='nursing'?'nursing':e.eventType==='growth'?'scale':e.eventType==='milestone'?'spark':'moon';
  return `<button type="button" class="rev-row" data-record="baby:${esc(e.id)}" style="--c:${t.color}">
    <span class="rev-time">${to12(e.time)}</span>
    <span class="rev-icon">${bigIcon(ic)}</span>
    <span class="rev-body"><strong>${esc(activityDetail(e))}</strong>${e.note?`<small>${esc(e.note)}</small>`:''}</span>
    <span class="rev-go">${icon('chevron')}</span>
  </button>`;
}
function dailyBabyRows(n){ return dateList(n).map(d=>({d,...babyStats(d)})); }
function avgFromActive(rows,key){ const active=rows.filter(r=>r.diapers||r.feeds||r.bottleOz); return active.length ? (sum(active.map(r=>r[key]))/active.length).toFixed(1) : '0.0'; }
function babyDailyTable(rows){
  const body=rows.slice().reverse().map(r=>`<div class="daily-row"><div class="daily-date"><strong>${fdl(r.d)}</strong><small>${r.diapers} diapers · ${r.feeds} feeds</small></div><div class="daily-cell wet"><span>Wet only</span><b>${r.wetOnly}</b></div><div class="daily-cell poop"><span>Poopy only</span><b>${r.poopOnly}</b></div><div class="daily-cell mixed"><span>Mixed</span><b>${r.mixed}</b></div><div class="daily-cell feeds"><span>Feeds</span><b>${r.feeds}</b></div><div class="daily-cell milk"><span>Bottle milk</span><b>${r.bottleOz.toFixed(1)} <small>oz</small></b></div></div>`).join('');
  return `<div class="daily-table"><div class="daily-row daily-head"><div>Date</div><div>Wet only</div><div>Poopy only</div><div>Mixed</div><div>Feeds</div><div>Bottle milk</div></div>${body}</div>`;
}
function babyTrends(){
  const range = S.ui.trendRange ?? 14, n = rangeDays(range,'baby'), days = dateList(n);
  const rows = dailyBabyRows(n);
  const byDate = new Map(rows.map(r => [r.d,r]));
  const buckets = bucketDays(days);
  const stat = k => b => avg(b.days.map(d => byDate.get(d)?.[k] || 0));

  const active = rows.filter(r => r.diapers || r.feeds || r.bottleOz);
  const totalNursing = sum(rows.map(r => r.nursing));
  const totalBreast = sum(rows.map(r => r.breastMilkBottles));
  const totalFormula = sum(rows.map(r => r.formulaBottles));
  const totalSleep = sum(rows.map(r => r.sleepMin));

  const half = Math.floor(rows.length/2);
  const recentFeeds = avg(rows.slice(half).filter(r => r.feeds).map(r => r.feeds));
  const priorFeeds = avg(rows.slice(0,half).filter(r => r.feeds).map(r => r.feeds));
  const recentOz = avg(rows.slice(half).filter(r => r.bottleOz).map(r => r.bottleOz));
  const priorOz = avg(rows.slice(0,half).filter(r => r.bottleOz).map(r => r.bottleOz));

  return `<div class="page-head"><div><span class="eyebrow">${esc(S.baby.name).toUpperCase()}</span><h2>Daily trends</h2></div></div>
  ${pills(RANGE_PILLS,range,'data-trend-range')}
  <div class="metric-grid baby-summary">${metric('Wet / day',avgFromActive(rows,'wetTotal'),'includes mixed','drop','baby')}${metric('Poopy / day',avgFromActive(rows,'poopTotal'),'includes mixed','poop','baby')}${metric('Feeds / day',avgFromActive(rows,'feeds'),'nursing + bottles','bottle','baby')}${metric('Bottle milk / day',`${avgFromActive(rows,'bottleOz')} oz`,'logged bottles','bottle','baby')}</div>

  ${panel('Diapers per day',barChart(buckets,{
    value: b => avg(b.days.map(d => byDate.get(d)?.diapers || 0)),
    segments: [
      {label:'Wet only', color:'var(--wet-ink)', value: stat('wetOnly')},
      {label:'Poopy only', color:'var(--poop-ink)', value: stat('poopOnly')},
      {label:'Mixed', color:'var(--mixed-ink)', value: stat('mixed')}
    ],
    format: v => v.toFixed(v < 10 ? 1 : 0),
    emptyLabel:'No diapers logged in this range'
  }) + `<div class="chart-legend"><span><i style="background:var(--wet-ink)"></i>Wet only</span><span><i style="background:var(--poop-ink)"></i>Poopy only</span><span><i style="background:var(--mixed-ink)"></i>Mixed</span></div>`,
    `<span class="panel-note">${active.length} active days</span>`)}

  ${panel('Feeds per day',areaChart(buckets,{value:stat('feeds'), color:'var(--feed-ink)', format:v => v.toFixed(1), emptyLabel:'No feeds logged in this range'}),trendBadge(recentFeeds,priorFeeds,{goodIsUp:true}))}

  ${panel('Bottle milk per day',areaChart(buckets,{value:stat('bottleOz'), color:'var(--baby)', format:v => v.toFixed(1), unit:' oz', emptyLabel:'No bottles logged in this range'}),trendBadge(recentOz,priorOz,{goodIsUp:true}))}

  ${panel('Feeding mix',donut([
      {label:'Nursing', value:totalNursing, color:'var(--growth-ink)'},
      {label:'Breast-milk bottles', value:totalBreast, color:'var(--feed-ink)'},
      {label:'Formula bottles', value:totalFormula, color:'var(--baby)'}
    ], totalNursing+totalBreast+totalFormula, 'feeds'))}

  ${totalSleep ? panel('Sleep logged',areaChart(buckets,{value:b => avg(b.days.map(d => (byDate.get(d)?.sleepMin || 0)/60)), color:'var(--sleep-ink)', format:v => v.toFixed(1), unit:' hr', emptyLabel:'No sleep logged'}),'') : ''}

  ${panel('Daily log',babyDailyTable(rows.slice(-14)) + (rows.length>14?`<p class="chart-note">Showing the most recent 14 of ${rows.length} days. <strong>Doctor summary</strong> lists the full range, and History lists every entry.</p>`:''),`<span class="panel-note">${Math.min(rows.length,14)} days</span>`)}`;
}
function babyGrowth(){
  const a=babyEvents().filter(e=>e.eventType==='growth').sort(byWhenDesc), g=a[0];
  return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>Growth</h2></div><button class="round-action baby" data-growth>${icon('plus')}<span>Add</span></button></div><div class="metric-grid three">${metric('Weight',g?.weightLb!=null?`${g.weightLb} lb${g.weightOz?` ${g.weightOz} oz`:''}`:'—',g?fd(g.date):'No measurement','scale','baby')}${metric('Length',g?.lengthIn!=null?`${g.lengthIn} in`:'—','latest','growth','baby')}${metric('Head',g?.headIn!=null?`${g.headIn} in`:'—','latest','growth','baby')}</div>${panel('Measurements',a.length?`<div class="rows">${a.map(e=>{
    const parts=[e.weightLb!=null?`${e.weightLb} lb${e.weightOz?` ${e.weightOz} oz`:''}`:null,e.lengthIn!=null?`${e.lengthIn} in long`:null].filter(Boolean);
    const head=e.headIn!=null?` · head ${e.headIn} in`:'';
    return `<button type="button" class="row" data-record="baby:${esc(e.id)}"><div class="row-icon baby kind-growth">${icon('scale')}</div><div class="row-main"><strong>${parts.length?parts.join(' · '):'Measurement'}</strong><span>${fd(e.date)}${head}</span></div><div class="row-go">${icon('chevron')}</div></button>`;
  }).join('')}</div>`:empty('growth','No measurements yet','Add measurements from pediatric visits.'))}<div class="clinical-note">For children under 2, clinicians generally follow weight, length, weight-for-length and head circumference over time using WHO growth standards.</div>`;
}
function developmentView(){
  const born = birthDate();
  if(!born) return `<div class="page-head"><div><span class="eyebrow">${esc(S.baby.name).toUpperCase()}</span><h2>Development</h2></div></div>
    ${empty('spark','Add a date of birth','The development timeline follows your baby\'s age, so it needs a birthday to line up.','<button class="primary-link" data-view="set-baby">Add date of birth</button>')}`;

  const months = ageMonths(), marked = markedMilestones();
  const stage = currentStage();
  const stageId = selectedStage ?? stage.m;
  const shown = MILESTONES.find(x => x.m === +stageId) || stage;
  const span = MILESTONES[MILESTONES.length-1].m;

  // journey track: one band per checklist, positioned by age
  const bands = MILESTONES.map((st,i) => {
    const next = MILESTONES[i+1]?.m ?? span+6;
    const left = (st.m/(span+6))*100, width = ((next-st.m)/(span+6))*100;
    const done = Object.entries(st.groups).reduce((a,[g,items]) => a + items.filter((_,j) => marked.has(milestoneId(st.m,g,j))).length, 0);
    const total = milestoneTotal(st);
    const state = months >= next ? 'past' : months >= st.m ? 'now' : 'ahead';
    return `<button type="button" class="band ${state} ${+stageId===st.m?'sel':''}" data-stage="${st.m}" style="left:${left.toFixed(2)}%;width:${width.toFixed(2)}%" aria-label="${esc(st.label)}">
      <span class="band-fill" style="width:${total?Math.round(done/total*100):0}%"></span><em>${st.label.replace(' months','m').replace(' years','y').replace('2 years','2y')}</em></button>`;
  }).join('');
  const agePct = months === null ? 0 : Math.max(0, Math.min(100, (months/(span+6))*100));

  const stageDone = Object.entries(shown.groups).reduce((a,[g,items]) => a + items.filter((_,j) => marked.has(milestoneId(shown.m,g,j))).length, 0);
  const stageTotal = milestoneTotal(shown);

  const groups = Object.entries(shown.groups).map(([g,items]) => {
    const meta = MILESTONE_GROUPS[g];
    return `<section class="ms-group" style="--c:${meta.color}">
      <div class="ms-group-head">${icon(meta.icon)}<strong>${meta.label}</strong></div>
      ${items.map((text,j) => {
        const id = milestoneId(shown.m,g,j), on = marked.has(id);
        return `<button type="button" class="ms-item ${on?'on':''}" data-milestone="${id}" data-ms-text="${esc(text)}" data-ms-group="${g}" data-ms-month="${shown.m}">
          <span class="ms-check">${on?icon('check'):''}</span><span>${esc(text)}</span></button>`;
      }).join('')}
    </section>`;
  }).join('');

  const isCurrent = shown.m === stage.m;
  return `<div class="page-head"><div><span class="eyebrow">${esc(S.baby.name).toUpperCase()}</span><h2>Development</h2></div><span class="age-badge">${esc(ageLabel()||'')}</span></div>

  <section class="journey">
    <div class="journey-head"><strong>Milestone journey</strong><span>${months!==null?`${months} month${months===1?'':'s'}`:''}</span></div>
    <div class="journey-track">${bands}<div class="journey-now" style="left:${agePct.toFixed(2)}%"></div></div>
    <div class="journey-legend"><span><i class="k-past"></i>Passed</span><span><i class="k-now"></i>Now</span><span><i class="k-ahead"></i>Ahead</span></div>
  </section>

  <section class="stage-card ${isCurrent?'is-now':''}">
    <div class="stage-ring">${ring(stageTotal?stageDone/stageTotal:0,`${stageDone}`,`of ${stageTotal}`,'baby')}</div>
    <div>
      <span class="eyebrow">${isCurrent?'WHERE YOU ARE':'CHECKLIST'}</span>
      <strong>${esc(shown.label)} · ${esc(shown.tag)}</strong>
      <p>Most children can do these by ${esc(shown.label)}. Tap anything you have seen — it saves to history.</p>
    </div>
  </section>

  ${groups}

  <div class="clinical-note">Milestones are from the CDC “Learn the Signs. Act Early.” checklists and describe what about 75% of children can do by each age. Babies develop at their own pace, so this is a conversation starter, not a test or a diagnosis. Share concerns with your pediatrician — acting early makes a real difference.</div>`;
}

function doctorView(){
  const range=S.ui.doctorRange ?? 14, n=rangeDays(range,'baby'), rows=dailyBabyRows(n), active=rows.filter(r=>r.diapers||r.feeds||r.bottleOz), g=latestGrowth(), pref=feedingPreference();
  const totalNursing=sum(active.map(r=>r.nursing)), totalBottles=sum(active.map(r=>r.bottles));
  return `<div class="page-head"><div><span class="eyebrow">BABY</span><h2>Doctor summary</h2></div><button class="round-action baby" data-print>${icon('steth')}<span>Print</span></button></div>${pills(RANGE_PILLS,range,'data-doctor-range')}
  <section class="doctor-summary-card"><div>${icon('steth')}</div><div><strong>${esc(S.baby.name)} · ${n}-day snapshot</strong><span>Quick answers from logged care</span></div></section>
  <div class="qa-grid"><div><span>Feeding pattern</span><strong>${pref==='mostly_formula'?'Mostly formula':pref==='mixed'?'Mixed feeding':'Mostly breastfed'}</strong></div><div><span>Wet diapers</span><strong>${avgFromActive(rows,'wetTotal')} / day</strong><small>includes mixed</small></div><div><span>Poopy diapers</span><strong>${avgFromActive(rows,'poopTotal')} / day</strong><small>includes mixed</small></div><div><span>Mixed diapers</span><strong>${avgFromActive(rows,'mixed')} / day</strong></div><div><span>Feeds</span><strong>${avgFromActive(rows,'feeds')} / day</strong><small>${totalNursing} nursing · ${totalBottles} bottles</small></div><div><span>Latest growth</span><strong>${g?`${g.weightLb??'—'} lb · ${g.lengthIn??'—'} in`:'Not logged'}</strong></div></div>
  ${panel('Daily review',babyDailyTable(rows))}
  <div class="clinical-note">This is a log summary, not a diagnosis. Around and after 6 weeks, stool frequency can vary widely, so your pediatrician may look at feeding, wet diapers, growth and the overall pattern together.</div>`;
}

function dataStatus(){
  const localMom=momEntries().length, localBaby=babyEvents().length, cloudKnown=S.cloud.momCount!=null&&S.cloud.babyCount!=null, match=cloudKnown&&S.cloud.momCount===localMom&&S.cloud.babyCount===localBaby;
  return `<section class="data-status ${match?'good':''}"><div>${icon(match?'check':'shield')}</div><div><strong>${S.cloud.enabled?(match?'Device and cloud match':'Family account connected'):'This device only'}</strong><span>${localMom} Mom · ${localBaby} Baby on this device${cloudKnown?` · ${S.cloud.momCount} Mom · ${S.cloud.babyCount} Baby online`:''}</span>${S.cloud.lastSync?`<small>Last sync ${new Date(S.cloud.lastSync).toLocaleString()}</small>`:''}</div></section>`;
}
function notificationStatus(){
  if(!('Notification' in window)) return 'System alerts are not supported in this browser.';
  if(Notification.permission==='granted') return 'System alerts are allowed while the browser can deliver them.';
  if(Notification.permission==='denied') return 'System alerts are blocked in browser settings.';
  return 'System alert permission has not been granted yet.';
}
const renderers={
  'mom-home':momHome,'mom-history':momHistory,'mom-trends':momTrends,'mom-stash':momStash,
  'baby-home':babyHome,'baby-history':babyHistory,'baby-trends':babyTrends,'baby-growth':babyGrowth,
  development:developmentView,doctor:doctorView,more:moreView,settings:settingsView,
  'set-account':setAccount,'set-baby':setBaby,'set-pumping':setPumping,
  'set-reminders':setReminders,'set-data':setData,'set-appearance':setAppearance,'set-about':setAbout
};
const titles={'mom-home':'Mom','mom-history':'Mom history','mom-trends':'Milk trends','mom-stash':'Stash','baby-home':'Baby','baby-history':'Baby history','baby-trends':'Daily trends','baby-growth':'Growth',development:'Development',doctor:'Doctor summary',more:'More',settings:'Settings',
  'set-account':'Family account','set-baby':'Baby profile','set-pumping':'Pumping','set-reminders':'Reminders','set-data':'Backup & data','set-appearance':'Appearance','set-about':'About'};
function render(dir='none'){
  applyDayPart();
  const el=$('view');
  $('pageTitle').textContent=titles[view]||'MilkFlow';
  document.body.dataset.screen=view;
  document.body.dataset.depth=depthOf(view);
  // Back button names where it returns to, the way an iOS nav bar does.
  const parent=PARENT[view];
  const back=$('backLabel');
  if(back) back.textContent = parent ? (titles[parent]||'Back') : '';
  document.querySelector('.back-btn')?.classList.toggle('show',!!parent);
  el.innerHTML=(renderers[view]||momHome)();
  if(dir!=='none' && !matchMedia('(prefers-reduced-motion: reduce)').matches){
    el.classList.remove('nav-forward','nav-back','nav-swap');
    void el.offsetWidth;
    el.classList.add(dir==='forward'?'nav-forward':dir==='back'?'nav-back':'nav-swap');
  }
  const workspace=workspaceOf(view); S.ui.workspace=workspace; save();
  document.querySelectorAll('.sidebar [data-view]').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  const babyTab=$('personaTabs')?.lastElementChild;
  if(babyTab) babyTab.textContent=S.baby.name||'Baby';
  document.querySelectorAll('[data-workspace]').forEach(b=>b.classList.toggle('active',b.dataset.workspace===workspace));
  renderSideNav(); renderBottomNav(); syncBadge(); bindViewInputs();
}
const IN_MORE=new Set(['more','settings','doctor','baby-growth','development','mom-stash']);
const SIDE_NAV=[
  {label:'MOM',items:[['mom-home','Home','home'],['mom-history','History','history'],['mom-trends','Trends','chart'],['mom-stash','Freezer stash','snow']]},
  {label:'BABY',items:[['baby-home','Home','baby'],['baby-history','History','history'],['baby-trends','Trends','chart'],['baby-growth','Growth','scale'],['development','Development','spark'],['doctor','Doctor summary','steth']]},
  {label:'FAMILY',items:[['settings','Settings','settings']]}
];
function renderSideNav(){
  const el=$('sideNav'); if(!el) return;
  el.innerHTML=SIDE_NAV.map(g=>`<div class="side-label">${g.label}</div><nav>${g.items.map(([v,l,ic])=>`<button data-view="${v}" class="${view===v?'active':''}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>`).join('');
}
// One bar, five fixed destinations. Mom and Baby are tabs rather than a mode switch, so a
// tab never changes meaning under you; History and Trends carry their own Mom/Baby segment
// inside the screen, where the choice is visible instead of hidden in a global mode.
function renderBottomNav(){
  const nav=$('bottomNav'); if(!nav) return;
  const baby=workspaceOf(view)==='baby';
  const home=baby?'baby-home':'mom-home', hist=baby?'baby-history':'mom-history', trend=baby?'baby-trends':'mom-trends';
  const tab=(v,label,ic,on)=>`<button data-view="${v}" class="${on?'active':''}"${on?' aria-current="page"':''}>${navIcon(ic,on)}<span>${esc(label)}</span></button>`;
  nav.innerHTML =
    tab(home,'Home','home',view===home)
    + tab(hist,'History','history',view==='mom-history'||view==='baby-history')
    + `<button class="add-tab" data-add aria-label="Add a record">${icon('plus')}<span>Add</span></button>`
    + tab(trend,'Trends','trends',view==='mom-trends'||view==='baby-trends')
    + tab('more','More','more',IN_MORE.has(view)||view.startsWith('set-'));
}
// Sync lives quietly at the foot of the page - it matters when it breaks, not while it works.
function syncBadge(){
  const f=$('syncFoot'), t=$('syncTitle'), sub=$('syncSubtitle');
  if(f){
    const st = syncState();
    const when = S.cloud.lastSync ? sinceLabel(iso(new Date(S.cloud.lastSync)), hhmm(new Date(S.cloud.lastSync))) : null;
    const copy = st==='error' ? esc(S.cloud.lastError)
      : st==='synced' ? `Synced to ${esc(S.cloud.email||'your family account')}${when?` · ${when}`:''}`
      : 'Saved on this device. Sign in to sync across phones.';
    f.className = `sync-foot ${st}`;
    f.innerHTML = `<button type="button" data-view="set-account">
      <span class="sf-mark">${icon(st==='error'?'bell':st==='synced'?'cloud':'shield')}</span>
      <span class="sf-copy"><strong>${st==='error'?'Sync problem':st==='synced'?'Synced':'On this device'}</strong><small>${copy}</small></span>
      <span class="sf-go">${icon('chevron')}</span></button>`;
  }
  if(t) t.textContent=S.cloud.enabled?'Family account connected':'On this device';
  if(sub) sub.textContent=S.cloud.enabled?(S.cloud.email||'Family account'):'Sign in to sync across devices';
}

// iOS-style grouped list: a coloured icon tile, a label, an optional value, a chevron.
function listRow(cfg){
  const {view:v, label, sub='', value='', icon:ic, color, action=''} = cfg;
  const attr = v ? `data-view="${v}"` : action;
  return `<button type="button" class="grp-row" ${attr}>
    <span class="grp-icon" style="background:${color}">${icon(ic)}</span>
    <span class="grp-label"><strong>${esc(label)}</strong>${sub?`<small>${esc(sub)}</small>`:''}</span>
    ${value?`<span class="grp-value">${esc(value)}</span>`:''}
    <span class="grp-go">${icon('chevron')}</span>
  </button>`;
}
const group = (title,rows) => `${title?`<div class="grp-title">${esc(title)}</div>`:''}<section class="grp">${rows.join('')}</section>`;
const TILE = {
  blue:'#3b82c4', teal:'#2f9f8f', green:'#3f9d5c', amber:'#d09134', pink:'#cf6591',
  purple:'#7a56d6', indigo:'#5b5fc7', red:'#cf5a5a', slate:'#6b7487', cyan:'#3a9cc0'
};

// More is no longer scoped to whichever person you happened to be looking at, and no
// longer offers a third way to switch between them - the tab bar owns that now.
function moreView(){
  const name=S.baby.name||'Baby';
  return `<div class="page-head"><div><span class="eyebrow">FAMILY</span><h2>More</h2></div></div>
  ${group('Mom',[
    listRow({view:'mom-stash', label:'Freezer stash', sub:`${(+S.profile.stashMl||0).toLocaleString()} mL saved`, icon:'snow', color:TILE.cyan})
  ])}
  ${group(name,[
    listRow({view:'baby-growth', label:'Growth', sub:'Weight, length, head', icon:'scale', color:TILE.green}),
    listRow({view:'development', label:'Development', sub:'Milestones by age', icon:'spark', color:TILE.amber}),
    listRow({view:'doctor', label:'Doctor summary', sub:'Printable visit notes', icon:'steth', color:TILE.teal})
  ])}
  ${group('Family',[
    listRow({view:'settings', label:'Settings', sub:'Account, profile, reminders', icon:'settings', color:TILE.slate})
  ])}`;
}

// ---------------------------------------------------------------- settings --
function remindersSummary(){
  const on = [S.reminders.enabled && 'Pump', S.reminders.feedEnabled && 'Feed'].filter(Boolean);
  return on.length ? `${on.join(' + ')} on` : 'Off';
}
function subHead(title,sub=''){ return `<div class="page-head"><div><span class="eyebrow">SETTINGS</span><h2>${esc(title)}</h2></div></div>${sub?`<p class="page-intro">${esc(sub)}</p>`:''}`; }

function settingsView(){
  const cloud = S.cloud.enabled;
  return `<div class="page-head"><div><span class="eyebrow">FAMILY</span><h2>Settings</h2></div></div>
  ${dataStatus()}
  ${group('',[
    listRow({view:'set-account', label:'Family account', sub:cloud?esc(S.cloud.email||'Signed in'):'Not signed in', icon:'cloud', color:TILE.blue}),
    listRow({view:'set-baby', label:'Baby profile', sub:`${esc(S.baby.name)}${ageLabel()?` · ${esc(ageLabel())}`:''}`, icon:'baby', color:TILE.pink})
  ])}
  ${group('',[
    listRow({view:'set-pumping', label:'Pumping', sub:`Goal ${(+S.profile.dailyGoalMl||0).toLocaleString()} mL · ${S.schedule.length} sessions`, icon:'drop', color:TILE.purple}),
    listRow({view:'set-reminders', label:'Reminders', sub:remindersSummary(), icon:'bell', color:TILE.red})
  ])}
  ${group('',[
    listRow({view:'set-appearance', label:'Appearance', sub:`${cap(S.ui.theme||'auto')} · ${cap(resolveTheme())} now`, icon:'sun', color:TILE.amber}),
    listRow({view:'set-data', label:'Backup & data', sub:'Import, export, cloud check', icon:'download', color:TILE.indigo}),
    listRow({view:'set-about', label:'About MilkFlow', sub:'Version and privacy', icon:'shield', color:TILE.slate})
  ])}`;
}
function setAccount(){
  const err = S.cloud.lastError;
  return `${subHead('Family account','One account on every device keeps Mom and Baby history in sync.')}
  ${err?`<section class="alert"><div class="alert-mark">${icon('bell')}</div><div><strong>Sync problem</strong><span>${esc(err)}</span>${S.cloud.lastErrorAt?`<small>Last seen ${new Date(S.cloud.lastErrorAt).toLocaleString()}</small>`:''}</div></section>
  <div class="alert-actions"><button data-cloud-check>${icon('cloud')} Retry now</button><button data-signout>Sign out and back in</button></div>`:''}
  ${dataStatus()}
  ${S.cloud.enabled
    ? panel('Signed in',`<div class="setting-row"><div><strong>${esc(S.cloud.email||'Signed in')}</strong><span>New records sync automatically to every device using this account.</span></div><div class="setting-actions"><button data-cloud-check>Check cloud</button><button data-signout>Sign out</button></div></div>`)
    : panel('Not signed in',`<div class="setting-row"><div><strong>This device only</strong><span>Sign in with one family account to see the same history everywhere. Signing in merges cloud and device history; it never erases local records.</span></div><button class="primary-link" data-auth>Sign in</button></div>`)}`;
}
function setBaby(){
  return `${subHead('Baby profile')}
  ${panel('Photo and details',`<div class="profile-row">
    <div class="profile-photo">${S.baby.photo?`<img src="${esc(S.baby.photo)}" alt="">`:babyIllustration()}</div>
    <div class="profile-photo-actions"><button data-photo>${icon('upload')} ${S.baby.photo?'Change photo':'Add photo'}</button>${S.baby.photo?'<button data-photo-clear>Remove</button>':''}<small>Shown on Baby home and stored with your family account.</small></div>
  </div>
  <div class="settings-grid"><label class="field"><span>Baby's name</span><input id="babyName" type="text" maxlength="40" value="${esc(S.baby.name)}"></label><label class="field"><span>Date of birth</span><input id="babyBirth" type="date" max="${today()}" value="${esc(S.baby.birthDate||'')}"></label><label class="field"><span>Your name</span><input id="momName" type="text" maxlength="40" placeholder="Used for the greeting" value="${esc(S.profile.momName||'')}"></label></div>
  ${S.baby.birthDate?`<p class="chart-note">${esc(S.baby.name)} is <strong>${esc(ageLabel()||'')}</strong>. Development follows this date.</p>`:'<p class="chart-note">Add a date of birth to unlock the development timeline.</p>'}`)}
  ${panel('Usual feeding',`<label class="field"><span>How ${esc(S.baby.name)} usually feeds</span><select id="feedingPreference"><option value="auto" ${S.baby.feedingPreference==='auto'?'selected':''}>Choose from recent history</option><option value="mostly_breastfed" ${S.baby.feedingPreference==='mostly_breastfed'?'selected':''}>Mostly breastfed</option><option value="mostly_formula" ${S.baby.feedingPreference==='mostly_formula'?'selected':''}>Mostly formula</option><option value="mixed" ${S.baby.feedingPreference==='mixed'?'selected':''}>Mixed feeding</option></select></label><p class="chart-note">This only changes which bottle type is suggested first when you log a feed.</p>`)}`;
}
function setPumping(){
  return `${subHead('Pumping')}
  ${panel('Daily target',`<div class="settings-grid"><label class="field"><span>Daily goal (mL)</span><input id="goalMl" type="number" inputmode="numeric" min="0" value="${+S.profile.dailyGoalMl||760}"></label><label class="field"><span>Freezer stash (mL)</span><input id="stashMl" type="number" inputmode="numeric" min="0" value="${+S.profile.stashMl||0}"></label></div>`)}
  ${panel('Pump plan',`<div class="settings-grid">${S.schedule.map((t,i)=>`<label class="field"><span>Pump ${i+1}</span><input data-schedule="${i}" type="time" value="${t}"></label>`).join('')}</div><p class="chart-note">Home matches each logged pump to the nearest planned time, so an off-schedule session still counts.</p>`)}`;
}
function setReminders(){
  return `${subHead('Reminders')}
  ${panel('Pump reminders',`<div class="setting-row"><div><strong>${S.reminders.enabled?'On':'Off'}</strong><span>Nudges you shortly before each planned pump time.</span></div><button data-reminders>${S.reminders.enabled?'Turn off':'Turn on'}</button></div>`)}
  ${panel('Feed reminders',`<div class="setting-row"><div><strong>${S.reminders.feedEnabled?'On':'Off'}</strong><span>Nudges you when ${esc(S.baby.name)} is due, based on the last feed plus your chosen gap.</span></div><button data-feed-reminders>${S.reminders.feedEnabled?'Turn off':'Turn on'}</button></div>
  ${S.reminders.feedEnabled?`<label class="field" style="margin-top:12px"><span>Remind me this long after a feed</span><select id="feedGap">${[120,150,180,210,240,300].map(m=>`<option value="${m}" ${(+S.reminders.feedGapMin||180)===m?'selected':''}>${fmtGap(m)}</option>`).join('')}</select></label>`:''}`)}
  <div class="clinical-note">A browser cannot wake a closed app, so these arrive while MilkFlow is open or installed and running. Treat them as a nudge, not an alarm clock. ${esc(notificationStatus())}</div>`;
}
function setData(){
  const localMom = momEntries().length, localBaby = babyEvents().length;
  return `${subHead('Backup & data')}
  ${dataStatus()}
  ${panel('Private backup',`<div class="setting-row"><div><strong>Export a backup</strong><span>Downloads every Mom and Baby record, your profile and settings as a private JSON file.</span></div><button data-export>${icon('download')} Export</button></div>`)}
  ${panel('Restore or merge',`<div class="setting-row"><div><strong>Import a file</strong><span>Import merges by record ID and never deletes existing history. A snapshot of this device is taken first.</span></div><button data-import>${icon('upload')} Import</button></div>`)}
  ${S.cloud.enabled?panel('Cloud check',`<div class="setting-row"><div><strong>Compare with the cloud</strong><span>${localMom} Mom · ${localBaby} Baby on this device${S.cloud.momCount!=null?` · ${S.cloud.momCount} Mom · ${S.cloud.babyCount} Baby online`:''}</span></div><button data-cloud-check>Check cloud</button></div>`):''}`;
}
function setAppearance(){
  const cur = S.ui.theme || 'auto';
  const opt = (v,label,sub) => `<button type="button" class="theme-opt ${cur===v?'on':''}" data-theme-pick="${v}">
    <span class="theme-swatch ${v}"><i></i><i></i><i></i></span><strong>${label}</strong><small>${sub}</small></button>`;
  return `${subHead('Appearance')}
  ${panel('Theme',`<div class="theme-grid">
    ${opt('auto','Automatic','Light through the day, dark at night')}
    ${opt('light','Light','Always light')}
    ${opt('dark','Dark','Always dark')}
  </div><p class="chart-note">Automatic follows the clock — the app turns dark during the night period, which is when most feeds get logged. It also follows your device if that is set to dark.</p>`)}
  ${panel('Right now',`<div class="about-list"><div><span>Time of day</span><b>${cap(dayPart().key)}</b></div><div><span>Theme in use</span><b>${cap(resolveTheme())}</b></div></div>`)}`;
}
function setAbout(){
  return `${subHead('About MilkFlow')}
  ${panel('This app',`<div class="about-list"><div><span>Records on this device</span><b>${momEntries().length} Mom · ${babyEvents().length} Baby</b></div><div><span>Sync</span><b>${S.cloud.enabled?'Family account':'This device only'}</b></div><div><span>Offline</span><b>Available</b></div></div>`)}
  <div class="clinical-note">MilkFlow is a private log for your family. Nothing you record is shared with anyone, and entries are never permanently deleted from the app — removing one only hides it from history and totals.</div>
  <div class="clinical-note">Development milestones come from the CDC “Learn the Signs. Act Early.” checklists and describe what about 75% of children can do by each age. Doctor summary is a summary of what you logged. Neither is a diagnosis — share concerns with your pediatrician.</div>`;
}

function openSheet(html){ $('sheet').innerHTML=`<div class="sheet-handle"></div>${html}`; $('sheet').classList.add('open'); $('scrim').classList.add('open'); document.body.classList.add('locked'); }
function addSheet(){
  if(workspaceOf(view)==='mom') return openSheet(`<div class="sheet-head"><strong>Add Mom care</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions two"><button data-mom="pump">${glyph('pump')}<strong>Pump</strong><span>Milk output</span></button><button data-mom="nursing">${glyph('nursing')}<strong>Nursing</strong><span>Breastfeed</span></button></div>`);
  openSheet(`<div class="sheet-head"><strong>Add Baby care</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions"><button data-feed>${glyph('bottle')}<strong>Feed</strong><span>Nurse or bottle</span></button><button data-diaper="wet">${glyph('drop')}<strong>Wet</strong></button><button data-diaper="poop">${glyph('poop')}<strong>Poopy</strong></button><button data-diaper="both">${glyph('mixed')}<strong>Mixed</strong></button><button data-sleep>${glyph('moon')}<strong>Sleep</strong></button><button data-growth>${glyph('scale')}<strong>Growth</strong></button></div>`);
}
function feedSheet(){
  const pref=feedingPreference();
  openSheet(`<div class="sheet-head"><strong>How did baby feed?</strong><button data-close>${icon('close')}</button></div><div class="sheet-actions three"><button data-feed-type="nursing">${glyph('nursing')}<strong>Nursing</strong></button><button data-feed-type="expressed_milk" class="${pref!=='mostly_formula'?'recommended':''}">${glyph('bottle')}<strong>Breast milk</strong><span>Bottle</span></button><button data-feed-type="formula" class="${pref==='mostly_formula'?'recommended':''}">${glyph('bottle')}<strong>Formula</strong><span>Bottle</span></button></div>`);
}
function findRecord(kind,id){ return (kind==='mom' ? S.entries : S.babyEvents).find(e => e.id === id) || null; }
function recordTitle(kind,e){ return kind==='mom' ? (e.type==='pump' ? `${e.amountMl||0} mL pump` : `${e.durationMin||0} min nursing`) : babyLabel(e); }
function openRecordSheet(kind,id){
  const e=findRecord(kind,id); if(!e) return;
  const ic = kind==='mom' ? (e.type==='pump'?'drop':'nursing') : (e.eventType==='feeding'?'bottle':e.eventType==='diaper'?(e.subtype==='wet'?'drop':e.subtype==='poop'?'poop':'mixed'):e.eventType==='nursing'?'nursing':e.eventType==='growth'?'scale':'moon');
  openSheet(`<div class="sheet-head"><strong>Entry</strong><button data-close aria-label="Close">${icon('close')}</button></div>
  <div class="record-card"><div class="record-icon ${kind}">${bigIcon(ic)}</div><div><strong>${esc(recordTitle(kind,e))}</strong><span>${fdl(e.date)} · ${to12(e.time)}</span>${e.note?`<small>${esc(e.note)}</small>`:''}</div></div>
  <div class="record-actions"><button data-edit-record="${kind}:${esc(e.id)}">${icon('edit')}<span>Edit</span></button><button class="danger" data-void-record="${kind}:${esc(e.id)}">${icon('trash')}<span>Remove</span></button></div>
  <p class="record-note">Removing hides the entry from history and totals. It is never erased, and you can undo it.</p>`);
}
// Soft-void only: the record keeps its id and stays in local + cloud storage, so nothing is
// ever destroyed and the removal can be undone or reversed from a backup.
async function voidRecord(kind,id){
  const e=findRecord(kind,id); if(!e) return;
  closeOverlays();
  e.voidedAt=new Date().toISOString(); e.synced=false; save(); render();
  try{ kind==='mom' ? await pushMom(e) : await pushBabies([e]); }catch{}
  toast('Entry removed',6000,{label:'Undo',run:()=>restoreRecord(kind,id)});
}
async function restoreRecord(kind,id){
  const e=findRecord(kind,id); if(!e) return;
  delete e.voidedAt; e.editedAt=new Date().toISOString(); e.synced=false; save(); render();
  try{ kind==='mom' ? await pushMom(e) : await pushBabies([e]); }catch{}
  toast('Entry restored');
}
let editing=null;
let selectedStage=null;
function setDialogEditTarget(dialogId,ref){
  const d=$(dialogId); if(!d) return;
  if(ref){ d.dataset.editKind=ref.kind; d.dataset.editId=ref.id; }
  else { delete d.dataset.editKind; delete d.dataset.editId; }
}
function dialogEditTarget(){
  for(const id of ['momDialog','diaperDialog','feedDialog','growthDialog','sleepDialog']){
    const d=$(id);
    if(d?.open && d.classList.contains('is-edit') && d.dataset.editKind && d.dataset.editId) return {kind:d.dataset.editKind,id:d.dataset.editId};
  }
  return editing;
}
function editRecord(kind,id){
  const e=findRecord(kind,id); if(!e) return;
  closeOverlays();
  let handled=true, dialogId=null;
  if(kind==='mom'){
    dialogId='momDialog';
    openMomDialog(e.type,true);
    $('momDate').value=e.date||today(); $('momTime').value=e.time||now();
    $('momAmount').value=e.amountMl??''; $('momDuration').value=e.durationMin??'';
    $('momNote').value=e.note||''; if(e.side) $('momSide').value=e.side;
  } else if(e.eventType==='diaper'){
    dialogId='diaperDialog';
    openDiaperDialog(e.subtype,true);
    $('diaperDate').value=e.date; $('diaperTime').value=e.time; $('diaperNote').value=e.note||'';
  } else if(e.eventType==='feeding'||e.eventType==='nursing'){
    dialogId='feedDialog';
    openFeedDialog(e.eventType==='nursing'?'nursing':(e.feedingType||'expressed_milk'),true);
    $('feedDate').value=e.date; $('feedTime').value=e.time;
    $('feedAmount').value=e.amountOz??''; $('feedDuration').value=e.durationMinutes??e.totalMinutes??'';
    if(e.side) $('feedSide').value=e.side;
  } else if(e.eventType==='growth'){
    dialogId='growthDialog';
    openGrowthDialog(true);
    $('growthDate').value=e.date; $('growthWeightLb').value=e.weightLb??''; $('growthWeightOz').value=e.weightOz??'';
    $('growthLength').value=e.lengthIn??''; $('growthHead').value=e.headIn??''; $('growthNote').value=e.note||'';
  } else if(e.eventType==='sleep'){
    dialogId='sleepDialog';
    openSleepDialog(true);
    $('sleepDate').value=e.date; $('sleepTime').value=e.time; $('sleepMinutes').value=e.durationMinutes??'';
  } else handled=false;
  // Set AFTER opening: showDialog may close an already-open dialog, and that fires the
  // 'close' handler which clears `editing` - an edit would silently become a new record.
  editing = handled ? {kind,id} : null;
  if(handled) setDialogEditTarget(dialogId,editing);
  if(!handled) toast('That entry type cannot be edited yet.');
}
// Dialogs are shared between "add" and "edit"; `editing` decides which one a submit means.
function commitRecord(list,built){
  const editRef=dialogEditTarget();
  if(editRef){
    const e=findRecord(editRef.kind,editRef.id);
    editing=null;
    if(e){ Object.assign(e,built,{id:e.id,createdAt:e.createdAt||built.createdAt,editedAt:new Date().toISOString(),synced:false}); return e; }
    // A failed edit lookup must never silently become a brand-new record.
    toast('That entry changed while you were editing it. Reopen it and try again.');
    return null;
  }
  list.push(built); return built;
}
// showModal() throws if the dialog is already open (double-tap), so always reset first.
function showDialog(id,isEdit){
  const d=$(id); if(!d) return;
  if(!isEdit) setDialogEditTarget(id,null);
  if(d.open){ try{ d.close(); }catch{} }
  d.classList.toggle('is-edit',!!isEdit);
  d.querySelectorAll('[data-save-label]').forEach(b => b.textContent = isEdit ? 'Save changes' : b.dataset.saveLabel);
  try{ d.showModal(); }catch{}
}
// --------------------------------------------------------- number entry ----
// A big readable value, chunky +/- keys and presets taken from what this family has
// actually logged. Typing still works - the value itself is the input.
function stepper(id,{value='',unit,step,min=0,max=9999,decimals=0,presets=[],tone='mom'}){
  const chips = presets.length
    ? `<div class="preset-row">${presets.map(p => `<button type="button" data-preset="${id}:${p}">${p}${unit?`<em>${esc(unit)}</em>`:''}</button>`).join('')}</div>`
    : '';
  return `<div class="stepper ${tone}" data-stepper="${id}" data-step="${step}" data-min="${min}" data-max="${max}" data-dec="${decimals}">
    <button type="button" class="step-key" data-bump="${id}:-1" aria-label="Less">${icon('minus')}</button>
    <label class="step-value">
      <input id="${id}" type="number" inputmode="decimal" step="${step}" min="${min}" max="${max}" value="${value}" placeholder="0">
      ${unit?`<span>${esc(unit)}</span>`:''}
    </label>
    <button type="button" class="step-key" data-bump="${id}:1" aria-label="More">${icon('plus')}</button>
  </div>${chips}`;
}
// Most-used recent values, rounded to the field's step, newest first.
function commonValues(getter,step,limit=4){
  const vals = getter().filter(v => Number.isFinite(v) && v > 0);
  const tally = new Map();
  for(const v of vals){ const k = Math.round(v/step)*step; tally.set(k,(tally.get(k)||0)+1); }
  return [...tally.entries()].sort((a,b) => b[1]-a[1] || b[0]-a[0]).slice(0,limit)
    .map(([v]) => +v.toFixed(step < 1 ? 1 : 0)).sort((a,b) => a-b);
}
const recentBottleOz = () => babyEvents().filter(e => e.eventType==='feeding').sort(byWhenDesc).slice(0,60).map(e => +e.amountOz);
const recentNursingMin = () => babyEvents().filter(e => e.eventType==='nursing').sort(byWhenDesc).slice(0,40).map(e => +(e.durationMinutes ?? e.totalMinutes));
const recentSleepMin = () => babyEvents().filter(e => e.eventType==='sleep').sort(byWhenDesc).slice(0,40).map(e => +e.durationMinutes);
const recentPumpMl = () => pumps().sort(byWhenDesc).slice(0,40).map(e => +e.amountMl);
const recentPumpMin = () => pumps().sort(byWhenDesc).slice(0,40).map(e => +e.durationMin);

// "When" without a fiddly time picker: tap back in steps, or open the real fields.
function whenRow(dateId,timeId){
  return `<div class="when-row">
    <div class="when-quick">
      <button type="button" data-when="${timeId}:0">Now</button>
      <button type="button" data-when="${timeId}:15">15m ago</button>
      <button type="button" data-when="${timeId}:30">30m ago</button>
      <button type="button" data-when="${timeId}:60">1h ago</button>
    </div>
    <details class="optional when-exact"><summary>Change date or time</summary>
      <div class="form-grid"><label class="field"><span>Date</span><input id="${dateId}" type="date" required></label><label class="field"><span>Time</span><input id="${timeId}" type="time" required></label></div>
    </details>
  </div>`;
}
function bumpStepper(id,dir){
  const el = $(id); if(!el) return;
  const box = el.closest('[data-stepper]');
  const step = +box.dataset.step || 1, min = +box.dataset.min, max = +box.dataset.max, dec = +box.dataset.dec;
  const next = Math.min(max, Math.max(min, (+el.value || 0) + dir*step));
  el.value = dec ? next.toFixed(dec) : String(Math.round(next));
  el.dispatchEvent(new Event('input',{bubbles:true}));
}
function setWhen(timeId,minsAgo){
  const d = new Date(Date.now() - minsAgo*60000);
  const t = $(timeId); if(t) t.value = hhmm(d);
  const dateEl = $(timeId.replace('Time','Date')); if(dateEl) dateEl.value = iso(d);
  document.querySelectorAll(`[data-when^="${timeId}:"]`).forEach(b => b.classList.toggle('on', b.dataset.when === `${timeId}:${minsAgo}`));
}

function dialogHead(title,id){ return `<div class="dialog-head"><h2>${esc(title)}</h2><button type="button" data-dismiss="${id}" aria-label="Close">${icon('close')}</button></div>`; }
function dialogActions(id,saveLabel='Save',tone=''){
  return `<div class="form-actions"><button type="button" data-dismiss="${id}">Cancel</button><button class="save ${tone}" data-save-label="${esc(saveLabel)}">${esc(saveLabel)}</button></div>`;
}
function showDialog(id,isEdit){
  const d=$(id); if(!d) return;
  if(d.open){ try{ d.close(); }catch{} }
  d.classList.toggle('is-edit',!!isEdit);
  d.querySelectorAll('[data-save-label]').forEach(b => b.textContent = isEdit ? 'Save changes' : b.dataset.saveLabel);
  try{ d.showModal(); }catch{}
}

function openMomDialog(type,isEdit=false){
  closeOverlays(); if(!isEdit) editing=null;
  const pump = type === 'pump';
  $('momFormBody').innerHTML =
    `<input id="momType" type="hidden" value="${esc(type)}">` +
    dialogHead((isEdit?'Edit ':'')+(pump?'Pump':'Nursing'),'momDialog') +
    `<section class="form-section"><div class="form-section-title">${pump?'How much milk?':'How long?'}</div>
      ${pump
        ? stepper('momAmount',{unit:'mL',step:10,max:2000,presets:commonValues(recentPumpMl,10),tone:'mom'})
        : stepper('momDuration',{unit:'min',step:1,max:240,presets:commonValues(recentNursingMin,1),tone:'mom'})}
    </section>
    <section class="form-section"><div class="form-section-title">When</div>${whenRow('momDate','momTime')}</section>
    <section class="form-section"><div class="form-section-title">Details</div>
      ${pump ? stepper('momDuration',{unit:'min',step:5,max:240,presets:commonValues(recentPumpMin,5,3),tone:'mom'}) : ''}
      ${!pump ? `<div class="choice-row" data-choice="momSide">${['left','both','right'].map(v=>`<button type="button" data-pick="momSide:${v}">${cap(v)}</button>`).join('')}</div><input id="momSide" type="hidden" value="right">` : ''}
      <details class="optional"><summary>Add a note</summary><textarea id="momNote" rows="2" placeholder="Anything worth remembering"></textarea></details>
    </section>` +
    dialogActions('momDialog');
  setWhen('momTime',0);
  if(!pump) pickChoice('momSide', S.last.nursingSide || 'right');
  if(pump && S.last.pumpMin) $('momDuration').value = S.last.pumpMin;
  if($('momAmount')) $('momAmount').required = pump;
  if($('momDuration') && !pump) $('momDuration').required = true;
  showDialog('momDialog',isEdit);
}
function openDiaperDialog(kind,isEdit=false){
  closeOverlays(); if(!isEdit) editing=null;
  const k = normalizeSubtype(kind);
  const label = k==='wet'?'Wet diaper':k==='poop'?'Poopy diaper':'Mixed diaper';
  $('diaperFormBody').innerHTML =
    `<input id="diaperKind" type="hidden" value="${esc(k)}">` +
    dialogHead((isEdit?'Edit ':'')+label,'diaperDialog') +
    `<section class="form-section"><div class="form-section-title">Kind</div>
      <div class="choice-row big" data-choice="diaperKind">${[['wet','Wet','drop'],['poop','Poopy','poop'],['both','Mixed','mixed']].map(([v,l,ic])=>`<button type="button" data-pick="diaperKind:${v}">${glyph(ic)}<span>${l}</span></button>`).join('')}</div>
    </section>
    <section class="form-section"><div class="form-section-title">When</div>${whenRow('diaperDate','diaperTime')}
      <details class="optional"><summary>Add a note</summary><textarea id="diaperNote" rows="2" placeholder="Colour, rash, anything unusual"></textarea></details>
    </section>` +
    dialogActions('diaperDialog','Save','baby');
  setWhen('diaperTime',0); pickChoice('diaperKind',k);
  showDialog('diaperDialog',isEdit);
}
function openFeedDialog(type,isEdit=false){
  closeOverlays(); if(!isEdit) editing=null;
  const nursing = type === 'nursing';
  const title = nursing?'Nursing':type==='formula'?'Formula bottle':'Breast-milk bottle';
  $('feedFormBody').innerHTML =
    `<input id="feedType" type="hidden" value="${esc(type)}">` +
    dialogHead((isEdit?'Edit ':'')+title,'feedDialog') +
    `<section class="form-section"><div class="form-section-title">${nursing?'How long?':'How much?'}</div>
      ${nursing
        ? stepper('feedDuration',{unit:'min',step:1,max:180,presets:commonValues(recentNursingMin,1),tone:'baby'})
        : stepper('feedAmount',{unit:'oz',step:0.5,max:20,decimals:1,presets:commonValues(recentBottleOz,0.5),tone:'baby'})}
    </section>
    ${nursing?`<section class="form-section"><div class="form-section-title">Side</div>
      <div class="choice-row" data-choice="feedSide">${['left','both','right'].map(v=>`<button type="button" data-pick="feedSide:${v}">${cap(v)}</button>`).join('')}</div><input id="feedSide" type="hidden" value="right">
    </section>`:''}
    <section class="form-section"><div class="form-section-title">When</div>${whenRow('feedDate','feedTime')}</section>` +
    dialogActions('feedDialog','Save','baby');
  setWhen('feedTime',0);
  if(nursing) pickChoice('feedSide', S.last.nursingSide || 'right');
  else if(S.last.bottleOz) $('feedAmount').value = S.last.bottleOz;
  showDialog('feedDialog',isEdit);
}
function openSleepDialog(isEdit=false){
  closeOverlays(); if(!isEdit) editing=null;
  $('sleepFormBody').innerHTML =
    dialogHead((isEdit?'Edit ':'')+'Sleep','sleepDialog') +
    `<section class="form-section"><div class="form-section-title">How long did ${esc(S.baby.name)} sleep?</div>
      ${stepper('sleepMinutes',{unit:'min',step:15,max:960,presets:commonValues(recentSleepMin,15),tone:'baby'})}
    </section>
    <section class="form-section"><div class="form-section-title">Started</div>${whenRow('sleepDate','sleepTime')}</section>` +
    dialogActions('sleepDialog','Save','baby');
  setWhen('sleepTime',0);
  if(S.last.sleepMin) $('sleepMinutes').value = S.last.sleepMin;
  showDialog('sleepDialog',isEdit);
}
function openGrowthDialog(isEdit=false){
  closeOverlays(); if(!isEdit) editing=null;
  $('growthFormBody').innerHTML =
    dialogHead((isEdit?'Edit ':'')+'Growth','growthDialog') +
    `<section class="form-section"><div class="form-section-title">Weight</div>
      <div class="dual-stepper">${stepper('growthWeightLb',{unit:'lb',step:1,max:120,tone:'baby'})}${stepper('growthWeightOz',{unit:'oz',step:1,max:15,tone:'baby'})}</div>
    </section>
    <section class="form-section"><div class="form-section-title">Length and head</div>
      <div class="dual-stepper">${stepper('growthLength',{unit:'in',step:0.5,max:60,decimals:1,tone:'baby'})}${stepper('growthHead',{unit:'in',step:0.5,max:40,decimals:1,tone:'baby'})}</div>
    </section>
    <section class="form-section"><div class="form-section-title">When</div>
      <label class="field"><span>Date</span><input id="growthDate" type="date" max="${today()}" required></label>
      <details class="optional"><summary>Add a note</summary><textarea id="growthNote" rows="2" placeholder="From the pediatric visit"></textarea></details>
    </section>` +
    dialogActions('growthDialog','Save','baby');
  $('growthDate').value = today();
  showDialog('growthDialog',isEdit);
}
function pickChoice(id,value){
  const el=$(id); if(el) el.value=value;
  document.querySelectorAll(`[data-pick^="${id}:"]`).forEach(b => b.classList.toggle('on', b.dataset.pick === `${id}:${value}`));
}
// Closing a dialog by any route (Cancel, ×, Esc) must drop the pending edit.
['momDialog','diaperDialog','feedDialog','growthDialog','sleepDialog'].forEach(id => $(id)?.addEventListener('close',()=>{ editing=null; setDialogEditTarget(id,null); }));

function bindViewInputs(){
  // A 30-day chart overflows: the most recent days matter most, so open scrolled to them.
  document.querySelectorAll('.chart-scroll').forEach(el => { el.scrollLeft = el.scrollWidth; });
  // The day strip runs oldest-to-newest; open on the selected day, which is usually Today.
  document.querySelectorAll('.day-strip').forEach(el => {
    const sel = el.querySelector('.day-chip.sel');
    if(sel && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, sel.offsetLeft - el.clientWidth + sel.offsetWidth + 12);
  });
  document.querySelectorAll('.schedule-strip').forEach(el => {
    const next=el.querySelector('.schedule-card:not(.done)');
    if(next && el.scrollWidth > el.clientWidth) el.scrollLeft = Math.max(0, next.offsetLeft - 12);
  });
  $('stashExact')?.addEventListener('change',e=>{ S.profile.stashMl=Math.max(0,+e.target.value||0); save(); pushProfile().catch(()=>{}); render(); });
  $('goalMl')?.addEventListener('change',e=>{ S.profile.dailyGoalMl=Math.max(0,+e.target.value||0); save(); pushProfile().catch(()=>{}); });
  $('stashMl')?.addEventListener('change',e=>{ S.profile.stashMl=Math.max(0,+e.target.value||0); save(); pushProfile().catch(()=>{}); });
  $('feedingPreference')?.addEventListener('change',e=>{ S.baby.feedingPreference=e.target.value; save(); pushProfile().catch(()=>{}); render(); });
  $('babyName')?.addEventListener('change',e=>{ const v=e.target.value.trim(); if(v){ S.baby.name=v; save(); pushProfile().catch(()=>{}); render(); } });
  $('babyBirth')?.addEventListener('change',e=>{ S.baby.birthDate=e.target.value||''; save(); pushProfile().catch(()=>{}); render(); });
  $('momName')?.addEventListener('change',e=>{ S.profile.momName=e.target.value.trim(); save(); pushProfile().catch(()=>{}); render(); });
  $('feedGap')?.addEventListener('change',e=>{ S.reminders.feedGapMin=+e.target.value||180; S.reminders.feedLastKey=null; save(); pushProfile().catch(()=>{}); render(); });
  document.querySelectorAll('[data-schedule]').forEach(x=>x.addEventListener('change',()=>{ S.schedule[+x.dataset.schedule]=x.value; save(); pushProfile().catch(()=>{}); }));
}

// A marked milestone is a normal baby event, so it appears in History, syncs and exports.
async function toggleMilestone(id,text,group,month){
  const existing = S.babyEvents.find(e => e.milestoneId === id && !e.voidedAt);
  if(existing){
    existing.voidedAt = new Date().toISOString(); existing.synced = false; save(); render();
    try{ await pushBabies([existing]); }catch{}
    toast('Milestone cleared',5000,{label:'Undo',run:()=>{ delete existing.voidedAt; existing.editedAt=new Date().toISOString(); save(); render(); pushBabies([existing]).catch(()=>{}); }});
    return;
  }
  // restore a previously cleared one rather than creating a duplicate
  const prior = S.babyEvents.find(e => e.milestoneId === id);
  if(prior){ delete prior.voidedAt; prior.editedAt=new Date().toISOString(); prior.synced=false; save(); render(); try{ await pushBabies([prior]); }catch{} toast('Milestone noted'); return; }
  const x = normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'milestone',date:today(),time:now(),
    milestoneId:id,milestoneText:text,milestoneGroup:group,milestoneMonth:month,note:'',sourceFile:'MilkFlow',createdAt:new Date().toISOString(),synced:false});
  S.babyEvents.push(x); save(); render();
  try{ await pushBabies([x]); }catch{ toast('Saved on this device. Cloud will retry.'); }
  toast('Milestone noted');
}

// Photos are downscaled before storing so the profile document stays small.
function readPhoto(file){
  if(!file) return;
  if(!/^image\//.test(file.type)) return toast('That file is not an image.');
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const size = 320, c = document.createElement('canvas');
      c.width = c.height = size;
      const ctx = c.getContext('2d');
      const side = Math.min(img.width, img.height);
      ctx.drawImage(img, (img.width-side)/2, (img.height-side)/2, side, side, 0, 0, size, size);
      try{
        S.baby.photo = c.toDataURL('image/jpeg', 0.82);
        save(); pushProfile().catch(()=>{}); render(); toast('Photo updated');
      }catch(err){ console.error(err); toast('That photo could not be saved.'); }
    };
    img.onerror = () => toast('That image could not be read.');
    img.src = reader.result;
  };
  reader.onerror = () => toast('That image could not be read.');
  reader.readAsDataURL(file);
}

function snapshot(){ try{ localStorage.setItem(SNAPSHOT_KEY,JSON.stringify(S)); }catch{} }
function mapBaby(x){ return normalizeBabyEvent({...x,synced:false}); }
function mergeMom(current,incoming){ const m=new Map(current.map(e=>[e.id,e])); for(const e of incoming){ if(!e?.id) continue; if(!m.has(e.id)) m.set(e.id,{...e,synced:false}); } return [...m.values()]; }
function mergeBaby(current,incoming){
  const m=new Map(current.map(e=>[e.id,normalizeBabyEvent(e)]));
  for(const raw of incoming){ const e=normalizeBabyEvent(raw); if(!e.id) continue; if(!m.has(e.id)) m.set(e.id,{...e,synced:false}); else m.set(e.id,normalizeBabyEvent({...e,...m.get(e.id)})); }
  return [...m.values()];
}
async function importBackup(file){
  let d; try{ d=JSON.parse(await file.text()); }catch{ return toast('That file could not be read.'); }
  let mom=[],baby=[],profile=null,schedule=null,overrides={},babyProfile=null;
  if(d.schema_version==='milkflow-family-bundle-2'){
    mom=Array.isArray(d.mom?.entries)?d.mom.entries:[];
    baby=Array.isArray(d.baby?.events)?d.baby.events.map(mapBaby):[];
    profile=d.mom?.profile||null; schedule=d.mom?.schedule||null; overrides=d.mom?.dailyOverrides||{};
    // The baby profile (name, date of birth, photo) was exported but never restored.
    babyProfile=d.baby?.profile||null;
  }else if(Array.isArray(d.events)){
    baby=d.events.filter(x=>x.owner_scope==='baby'&&String(x.date||'').startsWith('2026-')).map(mapBaby);
  }else if(Array.isArray(d.entries)){
    mom=d.entries; profile=d.profile||null; schedule=d.schedule||null; overrides=d.dailyOverrides||{};
  }
  if(!mom.length&&!baby.length&&!babyProfile&&!profile) return toast('No compatible family records found.');
  snapshot(); const beforeMom=momEntries().length, beforeBaby=babyEvents().length;
  S.entries=mergeMom(S.entries,mom); S.babyEvents=mergeBaby(S.babyEvents,baby);
  if(profile) S.profile={...S.profile,...profile};
  if(babyProfile) S.baby={...S.baby,...babyProfile};
  if(Array.isArray(schedule)&&schedule.length) S.schedule=schedule; S.dailyOverrides={...S.dailyOverrides,...overrides};
  save(); const addedMom=momEntries().length-beforeMom, addedBaby=babyEvents().length-beforeBaby;
  toast(`Added ${addedMom} Mom · ${addedBaby} Baby records`,4000);
  if(S.cloud.enabled){ try{ await reconcile(); await verifyCloud(true); toast('Family history saved to cloud.',3500); }catch(err){ console.error(err); toast('Saved on this device. Cloud will retry.',4000); } }
  setView(addedMom?'mom-history':addedBaby?'baby-history':S.ui.workspace==='baby'?'baby-home':'mom-home');
}
function exportBackup(){
  const data={schema_version:'milkflow-family-bundle-2',exported_at:new Date().toISOString(),mom:{entries:momEntries(),profile:S.profile,schedule:S.schedule,dailyOverrides:S.dailyOverrides},baby:{events:babyEvents(),profile:S.baby}};
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}), url=URL.createObjectURL(blob), a=document.createElement('a'); a.href=url; a.download=`milkflow-family-backup-${today()}.json`; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast('Private backup exported.');
}

async function initCloud(){
  const c=window.MILKFLOW_CONFIG||{}; if(!c.enableCloudSync||!c.firebaseConfig||!window.firebase) return syncBadge();
  try{
    if(!firebase.apps.length) firebase.initializeApp(c.firebaseConfig);
    cloud={auth:firebase.auth(),db:firebase.firestore()};
    try{ await cloud.db.enablePersistence({synchronizeTabs:true}); }catch{}
    cloud.auth.onAuthStateChanged(async user=>{
      stopRealtime(); S.cloud.userId=user?.uid||null; S.cloud.email=user?.email||null; S.cloud.enabled=!!user; save(); syncBadge();
      if(user){ try{ await reconcile(); startRealtime(); await verifyCloud(true); clearCloudError(); }catch(err){ noteCloudError(err,'signin'); toast('Sync needs attention — see Settings.',4500); } }
      render();
    });
  }catch(err){ noteCloudError(err,'init'); toast('Cloud connection needs attention.'); }
}
// Sync problems used to vanish into console.error plus a vague toast. Keep the real
// reason so the footer and the account page can say what happened and what to do.
function noteCloudError(err,context){
  const code = err?.code || '';
  const friendly =
    code.includes('permission-denied') ? 'Your account does not have access to this data. Sign out and sign in again.' :
    code.includes('unauthenticated') || code.includes('user-token-expired') || code.includes('user-disabled') ? 'Your session expired. Sign in again to resume syncing.' :
    code.includes('unavailable') || code.includes('network') ? 'No connection to the cloud. Entries are safe on this device and will sync when you are back online.' :
    code.includes('quota') || code.includes('resource-exhausted') ? 'The cloud is temporarily rate-limited. It will retry shortly.' :
    (err?.message || 'Sync could not finish.');
  S.cloud.lastError = friendly;
  S.cloud.lastErrorAt = new Date().toISOString();
  console.error(`[sync:${context}]`, err);
  save();
}
function clearCloudError(){ if(S.cloud.lastError){ S.cloud.lastError=null; S.cloud.lastErrorAt=null; save(); } }
const syncState = () => !S.cloud.enabled ? 'device' : S.cloud.lastError ? 'error' : 'synced';

const userRef=()=>cloud?.db.collection('users').doc(S.cloud.userId);
const momRef=()=>userRef().collection('entries');
const babyRef=()=>userRef().collection('familyEvents');
const profileRef=()=>userRef().collection('private').doc('profile');
async function repairRemoteBabyDocs(docs){
  if(!cloud||!S.cloud.userId) return;
  const fixes=[];
  docs.forEach(doc=>{
    const raw={...doc.data(),id:doc.id}; const normalized=normalizeBabyEvent(raw);
    const rawSubtype=String(raw.subtype||raw.status||'').toLowerCase();
    if(raw.eventType==='diaper' && normalized.subtype && normalized.subtype!==rawSubtype){ fixes.push({ref:doc.ref,subtype:normalized.subtype,sourceSubtype:raw.sourceSubtype||raw.subtype||raw.status||null}); }
  });
  for(let i=0;i<fixes.length;i+=350){ const batch=cloud.db.batch(); fixes.slice(i,i+350).forEach(f=>batch.set(f.ref,{subtype:f.subtype,sourceSubtype:f.sourceSubtype,normalizedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true})); await batch.commit(); }
}
async function reconcile(){
  if(!cloud||!S.cloud.userId) return;
  const [ms,bs,ps]=await Promise.all([momRef().get(),babyRef().get(),profileRef().get()]);
  await repairRemoteBabyDocs(bs.docs);
  const remoteMom=new Map(ms.docs.map(d=>[d.id,{...d.data(),id:d.id,synced:true}]));
  const remoteBaby=new Map(bs.docs.map(d=>[d.id,{...normalizeBabyEvent({...d.data(),id:d.id}),synced:true}]));
  const localMom=new Map(S.entries.map(e=>[e.id,e])); for(const [id,r] of remoteMom) localMom.set(id,{...(localMom.get(id)||{}),...r,synced:true}); S.entries=[...localMom.values()];
  const localBaby=new Map(S.babyEvents.map(e=>[e.id,normalizeBabyEvent(e)])); for(const [id,r] of remoteBaby) localBaby.set(id,normalizeBabyEvent({...(localBaby.get(id)||{}),...r,synced:true})); S.babyEvents=[...localBaby.values()];
  if(ps.exists){ const p=ps.data(); S.profile={...S.profile,...(p.profile||{})}; S.baby={...S.baby,...(p.baby||{})}; if(Array.isArray(p.schedule))S.schedule=p.schedule; S.dailyOverrides={...S.dailyOverrides,...(p.dailyOverrides||{})}; S.reminders={...S.reminders,...(p.reminders||{})}; }
  for(const e of S.entries) if(!remoteMom.has(e.id)) await pushMom(e);
  await pushBabies(S.babyEvents.filter(e=>!remoteBaby.has(e.id)));
  await pushProfile(); S.cloud.lastSync=new Date().toISOString(); save();
}
async function pushMom(e){ if(!cloud||!S.cloud.userId) return; await momRef().doc(e.id).set({type:e.type,date:e.date,time:e.time||'',amountMl:e.amountMl??null,durationMin:e.durationMin??null,side:e.side||null,quality:e.quality||null,note:e.note||'',source:e.source||'MilkFlow',createdAt:e.createdAt||null,editedAt:e.editedAt||null,voidedAt:e.voidedAt||null,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); e.synced=true; S.cloud.lastSync=new Date().toISOString(); save(); }
async function pushBabies(arr){
  if(!cloud||!S.cloud.userId||!arr.length) return;
  for(let i=0;i<arr.length;i+=350){ const part=arr.slice(i,i+350).map(normalizeBabyEvent), batch=cloud.db.batch(); for(const e of part) batch.set(babyRef().doc(e.id),{...e,synced:true,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); await batch.commit(); part.forEach(e=>e.synced=true); }
  S.cloud.lastSync=new Date().toISOString(); save();
}
async function pushProfile(){ if(!cloud||!S.cloud.userId) return; await profileRef().set({profile:S.profile,baby:S.baby,schedule:S.schedule,dailyOverrides:S.dailyOverrides,reminders:S.reminders,updatedAt:firebase.firestore.FieldValue.serverTimestamp()},{merge:true}); S.cloud.lastSync=new Date().toISOString(); save(); }
function startRealtime(){
  stopRealtime(); if(!cloud||!S.cloud.userId) return;
  const mergeSnapshot=(snap,key)=>{
    const current=new Map(S[key].map(e=>[e.id,e])); let changed=false;
    snap.docChanges().forEach(change=>{
      if(change.type==='removed') return;
      let r={...change.doc.data(),id:change.doc.id,synced:true}; if(key==='babyEvents') r=normalizeBabyEvent(r);
      const old=current.get(r.id); const next={...(old||{}),...r};
      if(!old||JSON.stringify({...old,updatedAt:undefined})!==JSON.stringify({...next,updatedAt:undefined})){ current.set(r.id,next); changed=true; }
    });
    if(changed){ S[key]=[...current.values()]; save(); clearTimeout(renderTimer); renderTimer=setTimeout(render,120); }
  };
  unsubscribers.push(momRef().onSnapshot(s=>mergeSnapshot(s,'entries'),e=>{ noteCloudError(e,'mom-stream'); render(); }));
  unsubscribers.push(babyRef().onSnapshot(s=>mergeSnapshot(s,'babyEvents'),e=>{ noteCloudError(e,'baby-stream'); render(); }));
  unsubscribers.push(profileRef().onSnapshot(d=>{ if(!d.exists)return; const p=d.data(); S.profile={...S.profile,...(p.profile||{})}; S.baby={...S.baby,...(p.baby||{})}; if(Array.isArray(p.schedule))S.schedule=p.schedule; S.dailyOverrides={...S.dailyOverrides,...(p.dailyOverrides||{})}; save(); clearTimeout(renderTimer); renderTimer=setTimeout(render,120); },e=>console.warn('Profile realtime',e)));
}
function stopRealtime(){ unsubscribers.forEach(fn=>{try{fn();}catch{}}); unsubscribers=[]; }
async function verifyCloud(quiet=false){
  if(!cloud||!S.cloud.userId){ if(!quiet)toast('Sign in first.'); return null; }
  try{ const [m,b]=await Promise.all([momRef().get(),babyRef().get()]); S.cloud.momCount=m.size; S.cloud.babyCount=b.size; S.cloud.lastVerified=new Date().toISOString(); clearCloudError(); save(); if(!quiet)toast(`Cloud: ${m.size} Mom · ${b.size} Baby`,3500); return {mom:m.size,baby:b.size}; }catch(err){ noteCloudError(err,'verify'); if(!quiet)toast('Cloud check failed — see Settings.'); return null; }
}

async function toggleReminders(){
  const turningOn=!S.reminders.enabled;
  if(turningOn&&'Notification'in window&&Notification.permission==='default'){ try{ await Notification.requestPermission(); }catch{} }
  S.reminders.enabled=turningOn; save(); try{ await pushProfile(); }catch{} render(); toast(turningOn?'Pump reminders are on.':'Pump reminders are off.');
}
function tickReminders(){
  feedReminderTick();
  if(!S.reminders.enabled) return; const d=new Date(), m=d.getHours()*60+d.getMinutes(), dt=today();
  S.schedule.forEach((t,i)=>{ const target=+t.slice(0,2)*60 + +t.slice(3)-(+S.reminders.leadMin||0), key=`${dt}-${i}-${target}`; if(Math.abs(m-target)<=1&&S.reminders.lastSentKey!==key&&dayP(dt).length<=i){ toast(`Pump ${i+1} is coming up · ${to12(t)}`,7000); if('Notification'in window&&Notification.permission==='granted'){ try{ new Notification('Pump reminder',{body:`Pump ${i+1} · ${to12(t)}`}); }catch{} } S.reminders.lastSentKey=key; save(); } });
}

// Fires once per due feed while the app is open. Browsers cannot wake a closed page,
// so this is a prompt, never an alarm clock - the Settings copy says so plainly.
function feedReminderTick(){
  if(!S.reminders.feedEnabled) return;
  const last = babyEvents().filter(e => !e.exactSourceDuplicate && (e.eventType==='feeding'||e.eventType==='nursing')).sort(byWhenDesc)[0];
  const due = nextFeedDue(last);
  if(!due || !due.overdue) return;
  const key = `${last.id}-${S.reminders.feedGapMin}`;
  if(S.reminders.feedLastKey === key) return;
  S.reminders.feedLastKey = key; save();
  const msg = `${S.baby.name} is due for a feed`;
  toast(msg, 8000, {label:'Log', run:()=>feedSheet()});
  if('Notification' in window && Notification.permission === 'granted'){
    try{ new Notification('Feed reminder',{body:`${msg} · last feed ${sinceLabel(last.date,last.time)||''}`,tag:'milkflow-feed'}); }catch{}
  }
}
async function toggleFeedReminders(){
  const on = !S.reminders.feedEnabled;
  if(on && 'Notification' in window && Notification.permission === 'default'){ try{ await Notification.requestPermission(); }catch{} }
  S.reminders.feedEnabled = on; S.reminders.feedLastKey = null; save();
  try{ await pushProfile(); }catch{}
  render(); toast(on ? 'Feed reminders are on while the app is open.' : 'Feed reminders are off.');
}

function handleClick(e){
  if(e.target.closest('[data-close]')||e.target.id==='scrim'){ closeOverlays(); return; }
  const ws=e.target.closest('[data-workspace]'); if(ws){ S.ui.workspace=ws.dataset.workspace; setView(ws.dataset.workspace==='baby'?'baby-home':'mom-home'); return; }
  const route=e.target.closest('[data-view]'); if(route){ setView(route.dataset.view); return; }
  if(e.target.closest('[data-back]')){ goBack(); return; }
  if(e.target.closest('[data-add]')){ addSheet(); return; }
  const hm=e.target.closest('[data-history-mode]'); if(hm){ S.ui.historyMode=hm.dataset.historyMode; save(); render(); return; }
  const rd=e.target.closest('[data-review-date]'); if(rd){ S.ui.reviewDate=rd.dataset.reviewDate; save(); render(); return; }
  const stg=e.target.closest('[data-stage]'); if(stg){ selectedStage=+stg.dataset.stage; render(); return; }
  const ms=e.target.closest('[data-milestone]'); if(ms){ toggleMilestone(ms.dataset.milestone,ms.dataset.msText,ms.dataset.msGroup,+ms.dataset.msMonth); return; }
  const pick=e.target.closest('[data-pick]'); if(pick){ const [id,v]=pick.dataset.pick.split(':'); pickChoice(id,v); if(id==='diaperKind'){ const t=$('diaperDialog')?.querySelector('h2'); if(t) t.textContent=(editing?'Edit ':'')+(v==='wet'?'Wet diaper':v==='poop'?'Poopy diaper':'Mixed diaper'); } return; }
  const dis=e.target.closest('[data-dismiss]'); if(dis){ $(dis.dataset.dismiss)?.close(); return; }
  const tp=e.target.closest('[data-theme-pick]'); if(tp){ S.ui.theme=tp.dataset.themePick; save(); applyDayPart(); render(); return; }
  const bump=e.target.closest('[data-bump]'); if(bump){ const [id,d]=bump.dataset.bump.split(':'); bumpStepper(id,+d); return; }
  const pre=e.target.closest('[data-preset]'); if(pre){ const [id,v]=pre.dataset.preset.split(':'); const el=$(id); if(el){ el.value=v; el.dispatchEvent(new Event('input',{bubbles:true})); } return; }
  const wq=e.target.closest('[data-when]'); if(wq){ const [tid,m]=wq.dataset.when.split(':'); setWhen(tid,+m); return; }
  if(e.target.closest('[data-photo]')){ $('photoFile').click(); return; }
  if(e.target.closest('[data-photo-clear]')){ S.baby.photo=''; save(); pushProfile().catch(()=>{}); render(); toast('Photo removed'); return; }
  const rec=e.target.closest('[data-record]'); if(rec){ const [k,...r]=rec.dataset.record.split(':'); openRecordSheet(k,r.join(':')); return; }
  const er=e.target.closest('[data-edit-record]'); if(er){ const [k,...r]=er.dataset.editRecord.split(':'); editRecord(k,r.join(':')); return; }
  const vr=e.target.closest('[data-void-record]'); if(vr){ const [k,...r]=vr.dataset.voidRecord.split(':'); voidRecord(k,r.join(':')); return; }
  const mom=e.target.closest('[data-mom]'); if(mom){ openMomDialog(mom.dataset.mom); return; }
  if(e.target.closest('[data-feed]')){ feedSheet(); return; }
  const ft=e.target.closest('[data-feed-type]'); if(ft){ openFeedDialog(ft.dataset.feedType); return; }
  const diaper=e.target.closest('[data-diaper]'); if(diaper){ openDiaperDialog(diaper.dataset.diaper); return; }
  if(e.target.closest('[data-growth]')){ openGrowthDialog(); return; }
  if(e.target.closest('[data-sleep]')){ openSleepDialog(); return; }
  if(e.target.closest('[data-import]')){ $('importFile').click(); return; }
  if(e.target.closest('[data-export]')){ exportBackup(); return; }
  if(e.target.closest('[data-cloud-check]')){ verifyCloud().then(render); return; }
  if(e.target.closest('[data-reminders]')){ toggleReminders(); return; }
  if(e.target.closest('[data-feed-reminders]')){ toggleFeedReminders(); return; }
  if(e.target.closest('[data-auth]')){ $('authDialog').showModal(); return; }
  if(e.target.closest('[data-signout]')){ cloud?.auth.signOut(); return; }
  if(e.target.closest('[data-print]')){ window.print(); return; }
  const mr=e.target.closest('[data-mom-range]'); if(mr){ S.ui.momRange=+mr.dataset.momRange; save(); render(); return; }
  const br=e.target.closest('[data-baby-range]'); if(br){ S.ui.babyRange=+br.dataset.babyRange; save(); render(); return; }
  const bf=e.target.closest('[data-baby-filter]'); if(bf){ S.ui.babyFilter=bf.dataset.babyFilter; save(); render(); return; }
  const tr=e.target.closest('[data-trend-range]'); if(tr){ S.ui.trendRange=+tr.dataset.trendRange; save(); render(); return; }
  const dr=e.target.closest('[data-doctor-range]'); if(dr){ S.ui.doctorRange=+dr.dataset.doctorRange; save(); render(); return; }
  const st=e.target.closest('[data-stash]'); if(st){ S.profile.stashMl=Math.max(0,(+S.profile.stashMl||0)+ +st.dataset.stash); save(); pushProfile().catch(()=>{}); render(); return; }
}
document.addEventListener('click',handleClick);

$('momForm').addEventListener('submit',async e=>{ e.preventDefault(); const type=$('momType').value, wasEdit=!!editing;
  if(type==='pump'){ S.last.pumpMl=+$('momAmount').value||null; S.last.pumpMin=+$('momDuration').value||null; } else { S.last.nursingMin=+$('momDuration').value||null; S.last.nursingSide=$('momSide')?.value||null; } const x=commitRecord(S.entries,{id:uid('mom'),type,date:$('momDate').value,time:$('momTime').value,amountMl:type==='pump'?+$('momAmount').value||0:null,durationMin:+$('momDuration').value||null,side:type==='nursing'?$('momSide').value:null,note:$('momNote').value.trim(),source:'MilkFlow',createdAt:new Date().toISOString(),synced:false}); save(); $('momDialog').close(); try{await pushMom(x);}catch{toast('Saved on this device. Cloud will retry.');} render(); toast(wasEdit?'Entry updated':(type==='pump'?'Pump saved':'Nursing saved')); });
$('diaperForm').addEventListener('submit',async e=>{ e.preventDefault(); const wasEdit=!!editing; const x=commitRecord(S.babyEvents,normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'diaper',date:$('diaperDate').value,time:$('diaperTime').value,subtype:$('diaperKind').value,note:$('diaperNote').value.trim(),sourceFile:'MilkFlow',createdAt:new Date().toISOString(),synced:false})); save(); $('diaperDialog').close(); try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');} render(); toast(wasEdit?'Entry updated':'Diaper logged'); });
$('feedForm').addEventListener('submit',async e=>{ e.preventDefault(); const type=$('feedType').value, wasEdit=!!editing, stamp=new Date().toISOString();
  if(type==='nursing'){ S.last.nursingMin=+$('feedDuration').value||null; S.last.nursingSide=$('feedSide')?.value||null; } else { S.last.bottleOz=+$('feedAmount').value||null; } const built=type==='nursing'?normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'nursing',date:$('feedDate').value,time:$('feedTime').value,durationMinutes:+$('feedDuration').value||null,side:$('feedSide').value,note:'',sourceFile:'MilkFlow',createdAt:stamp,synced:false}):normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'feeding',date:$('feedDate').value,time:$('feedTime').value,feedingType:type,amountOz:+$('feedAmount').value||0,note:'',sourceFile:'MilkFlow',createdAt:stamp,synced:false}); const x=commitRecord(S.babyEvents,built); save(); $('feedDialog').close(); try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');} render(); toast(wasEdit?'Entry updated':'Feed logged'); });
$('growthForm').addEventListener('submit',async e=>{ e.preventDefault(); const wasEdit=!!editing; const x=commitRecord(S.babyEvents,normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'growth',date:$('growthDate').value,time:'12:00',weightLb:$('growthWeightLb').value===''?null:+$('growthWeightLb').value,weightOz:$('growthWeightOz').value===''?null:+$('growthWeightOz').value,lengthIn:$('growthLength').value===''?null:+$('growthLength').value,headIn:$('growthHead').value===''?null:+$('growthHead').value,note:$('growthNote').value.trim(),sourceFile:'MilkFlow',createdAt:new Date().toISOString(),synced:false})); save(); $('growthDialog').close(); try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');} setView('baby-growth'); toast(wasEdit?'Measurement updated':'Measurement saved'); });
$('sleepForm').addEventListener('submit',async e=>{ e.preventDefault(); const wasEdit=!!editing; S.last.sleepMin=+$('sleepMinutes').value||null; const x=commitRecord(S.babyEvents,normalizeBabyEvent({id:uid('baby'),babyId:S.baby.id,eventType:'sleep',date:$('sleepDate').value,time:$('sleepTime').value,durationMinutes:+$('sleepMinutes').value||0,sourceFile:'MilkFlow',createdAt:new Date().toISOString(),synced:false})); save(); $('sleepDialog').close(); try{await pushBabies([x]);}catch{toast('Saved on this device. Cloud will retry.');} render(); toast(wasEdit?'Entry updated':'Sleep logged'); });
$('authForm').addEventListener('submit',async e=>{ e.preventDefault(); if(!cloud)return toast('Cloud is not ready yet.'); try{ await cloud.auth.signInWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value); $('authDialog').close(); }catch(err){toast(err.message,4500);} });
$('createAccount').addEventListener('click',async()=>{ if(!cloud)return toast('Cloud is not ready yet.'); try{ await cloud.auth.createUserWithEmailAndPassword($('authEmail').value.trim(),$('authPassword').value); $('authDialog').close(); }catch(err){toast(err.message,4500);} });
$('importFile').addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) importBackup(f); e.target.value=''; });
$('photoFile')?.addEventListener('change',e=>{ const f=e.target.files?.[0]; if(f) readPhoto(f); e.target.value=''; });

S.babyEvents=S.babyEvents.map(normalizeBabyEvent); save();
// Seed the first history entry so Back from the very first screen behaves predictably.
applyDayPart();
if('scrollRestoration' in history) history.scrollRestoration = 'manual';
history.replaceState({view},'',`#${view}`);
render(); window.scrollTo(0,0);
// a late font/layout pass can nudge the offset, so settle it once more after paint
requestAnimationFrame(() => window.scrollTo(0,0));
initCloud(); tickReminders(); setInterval(tickReminders,60000);
})();
