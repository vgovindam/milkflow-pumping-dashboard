(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
let renderTimer=null;

function readState(){
  try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}
}
function localDate(){
  const d=new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function todayOutput(s){
  const date=localDate();
  const logged=(Array.isArray(s.entries)?s.entries:[])
    .filter(e=>!e?.voidedAt&&e.type==='pump'&&e.date===date)
    .reduce((n,e)=>n+(Number(e.amountMl)||0),0);
  const confirmed=Number(s.dailyOverrides?.[date]);
  return Number.isFinite(confirmed)?Math.max(logged,confirmed):logged;
}

function style(){
  if(document.getElementById('mfModernStickerStyles'))return;
  const s=document.createElement('style');
  s.id='mfModernStickerStyles';
  s.textContent=`
  /* -----------------------------------------------------------------------
     MilkFlow modern family surface.
     The earlier shiny badge treatment made the home screen read like a lab
     dashboard. This pass deliberately removes badge-on-badge visuals, heavy
     borders and glowing metric boxes. Care actions use large illustration-like
     line art, while data sits lower in the visual hierarchy.
     -------------------------------------------------------------------- */

  .mf-mom-home .view{max-width:1020px}

  /* Top greeting: one calm surface, not a results card. */
  .mf-mom-home .mom-hero{
    position:relative;
    display:block;
    min-height:214px;
    padding:27px 28px 24px;
    overflow:hidden;
    border:0;
    border-radius:30px;
    box-shadow:none;
    background:
      radial-gradient(90% 125% at 104% -10%,color-mix(in srgb,var(--mom) 18%,transparent),transparent 62%),
      linear-gradient(145deg,color-mix(in srgb,var(--surface) 96%,var(--mom-soft)),color-mix(in srgb,var(--surface-2) 86%,var(--mom-soft)));
  }
  .mf-mom-home .mom-hero::before{
    content:'';
    position:absolute;
    width:220px;height:220px;
    right:-92px;bottom:-132px;
    border-radius:50%;
    background:color-mix(in srgb,var(--mom) 8%,transparent);
    filter:blur(2px);
    pointer-events:none;
  }
  .mf-mom-home .mom-hero .ring{display:none!important}
  .mf-mom-home .mom-hero .hero-copy{position:relative;z-index:2;max-width:680px;padding:0}
  .mf-mom-home .mom-hero .eyebrow{margin-bottom:13px}
  .mf-mom-home .mom-hero .greet{font-size:13px;font-weight:750;color:var(--ink-2)}
  .mf-mom-home .mom-hero .greet-mark{width:26px;height:26px;border-radius:10px;box-shadow:none;transform:none;background:color-mix(in srgb,var(--mom) 10%,var(--surface-2));color:var(--mom)}
  .mf-mom-home .mom-hero h2{font-size:clamp(31px,5.5vw,43px);line-height:1.02;letter-spacing:-.045em;margin:0 0 9px}
  .mf-mom-home .mom-hero p{font-size:13.5px;color:var(--muted);font-weight:650}
  .mf-mom-home .mom-hero .chips{margin-top:18px;gap:8px}
  .mf-mom-home .mom-hero .chip{border:0;box-shadow:none;background:color-mix(in srgb,var(--surface) 74%,transparent);padding:8px 12px;font-size:11.5px}
  .mf-mom-home .mom-hero .chip:first-child{background:color-mix(in srgb,var(--mom) 13%,var(--surface));color:var(--mom-ink)}

  .mf-goal-progress{margin-top:18px;max-width:430px;display:grid;gap:7px}
  .mf-goal-progress-copy{display:flex;align-items:center;justify-content:space-between;gap:12px;color:var(--muted);font-size:10.5px;font-weight:700}
  .mf-goal-progress-copy b{font-size:11.5px;color:var(--ink-2);font-weight:800}
  .mf-goal-progress-track{height:6px;border-radius:999px;overflow:hidden;background:color-mix(in srgb,var(--mom) 9%,var(--surface-2))}
  .mf-goal-progress-track i{height:100%;display:block;border-radius:inherit;background:linear-gradient(90deg,var(--mom),var(--mom-2));box-shadow:none;transition:width .35s ease}

  /* Actual Mom photo only. No fallback initial, heart badge or decorative sticker. */
  .mf-mom-home #mfMomAvatar{
    position:absolute;right:24px;top:24px;z-index:4;
    width:58px;height:58px;margin:0;border-radius:20px;overflow:hidden;
    background:transparent;box-shadow:none;
  }
  .mf-mom-home #mfMomAvatar img{width:100%;height:100%;object-fit:cover;border-radius:20px;border:2px solid color-mix(in srgb,var(--surface) 80%,transparent);box-shadow:0 7px 20px rgba(18,22,36,.12)}
  .mf-mom-home .mom-hero:has(#mfMomAvatar) .hero-copy{padding-right:76px}

  /* Primary care actions: illustration-like line art, not a lab badge in a square. */
  .mf-mom-home .quick-grid.mom-grid.two{max-width:none;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:14px 0 13px}
  .mf-mom-home .quick-tile{
    min-height:122px;
    padding:19px 20px;
    border:0;
    border-radius:25px;
    box-shadow:none;
    justify-content:flex-end;
    isolation:isolate;
  }
  .mf-mom-home .quick-tile::before{
    content:'';position:absolute;right:-24px;top:-34px;width:154px;height:154px;border-radius:50%;
    background:rgba(255,255,255,.17);pointer-events:none;z-index:0;
  }
  .mf-mom-home .quick-tile::after{
    content:'✦';position:absolute;right:22px;top:17px;font-size:15px;line-height:1;opacity:.5;z-index:2;
  }
  .mf-mom-home .quick-tile.mom{background:linear-gradient(145deg,color-mix(in srgb,var(--mom) 15%,var(--surface)),color-mix(in srgb,var(--mom) 26%,var(--surface)));color:var(--mom-ink)}
  .mf-mom-home .quick-tile.nurse{background:linear-gradient(145deg,color-mix(in srgb,var(--growth-ink) 9%,var(--surface)),color-mix(in srgb,var(--growth) 72%,var(--surface)));color:var(--growth-ink)}
  .mf-mom-home .quick-tile .tile-art{
    position:absolute;right:18px;top:22px;width:68px;height:68px;
    display:grid;place-items:center;
    border:0!important;border-radius:0!important;background:transparent!important;
    box-shadow:none!important;transform:none!important;overflow:visible;
  }
  .mf-mom-home .quick-tile .tile-art::before,.mf-mom-home .quick-tile .tile-art::after{display:none!important}
  .mf-mom-home .quick-tile .tile-art .gly{width:62px;height:62px;filter:none!important;opacity:.9}
  .mf-mom-home .quick-tile .gly .g-fill{opacity:.11}
  .mf-mom-home .quick-tile .gly .g-line{stroke-width:1.7}
  .mf-mom-home .quick-tile strong{font-size:20px;letter-spacing:-.025em;position:relative;z-index:2}
  .mf-mom-home .quick-tile small{font-size:11.5px;margin-top:4px;opacity:.72;position:relative;z-index:2}

  /* Summary becomes a light horizontally-scannable strip. */
  .mf-mom-home .metric-grid.mom-summary{display:flex;gap:8px;overflow-x:auto;scroll-snap-type:x proximity;padding:0 0 3px;margin-bottom:18px;scrollbar-width:none}
  .mf-mom-home .metric-grid.mom-summary::-webkit-scrollbar{display:none}
  .mf-mom-home .metric-grid.mom-summary .metric{
    flex:1 0 205px;min-height:82px;padding:14px 15px;border:0;border-radius:20px;
    background:color-mix(in srgb,var(--surface) 84%,var(--surface-2));
    box-shadow:none;gap:11px;scroll-snap-align:start;
  }
  .mf-mom-home .metric-grid.mom-summary .metric-icon{width:36px;height:36px;border:0!important;border-radius:12px!important;background:color-mix(in srgb,var(--mom) 10%,var(--surface-2));box-shadow:none!important;color:var(--mom)}
  .mf-mom-home .metric-grid.mom-summary .metric-icon .ico{width:18px;height:18px;filter:none!important}
  .mf-mom-home .metric-grid.mom-summary .metric span{font-size:9.5px;letter-spacing:.02em;text-transform:none;font-weight:750;color:var(--muted)}
  .mf-mom-home .metric-grid.mom-summary .metric strong{font-size:20px;letter-spacing:-.025em}
  .mf-mom-home .metric-grid.mom-summary .metric small{font-size:9.5px;color:var(--muted)}

  /* Home sections breathe on the page instead of stacking dark bordered boxes. */
  .mf-mom-home #view>.panel{border:0;background:transparent;box-shadow:none;padding:5px 0 4px;border-radius:0;margin-bottom:18px}
  .mf-mom-home #view>.panel .panel-head{padding:0 2px;margin-bottom:11px}
  .mf-mom-home #view>.panel .panel-head h3{font-size:20px;letter-spacing:-.025em}
  .mf-mom-home #view>.panel .panel-head button{border:0;background:transparent;color:var(--mom);font-weight:800;padding:7px 4px}

  /* Pump plan reads like a journey, not a lab result table. */
  .mf-mom-home .mf-pump-plan-panel .schedule-strip{position:relative;display:flex;gap:6px;overflow-x:auto;padding:8px 2px 7px;scrollbar-width:none}
  .mf-mom-home .mf-pump-plan-panel .schedule-strip::-webkit-scrollbar{display:none}
  .mf-mom-home .mf-pump-plan-panel .schedule-strip::before{content:'';position:absolute;left:22px;right:22px;top:29px;height:2px;background:var(--line-soft);z-index:0}
  .mf-mom-home .mf-pump-plan-panel .schedule-card{
    position:relative;z-index:1;flex:1 0 88px;min-width:88px;padding:0 4px 8px;
    border:0;background:transparent;box-shadow:none;text-align:center;display:grid;justify-items:center;gap:5px;
  }
  .mf-mom-home .mf-pump-plan-panel .schedule-card>div:first-child{width:43px;height:43px;border-radius:50%;display:grid;place-items:center;background:var(--surface-2);color:var(--muted);border:4px solid var(--bg)}
  .mf-mom-home .mf-pump-plan-panel .schedule-card>div:first-child .ico{width:18px;height:18px}
  .mf-mom-home .mf-pump-plan-panel .schedule-card.done>div:first-child{background:color-mix(in srgb,var(--good) 15%,var(--surface));color:var(--good)}
  .mf-mom-home .mf-pump-plan-panel .schedule-card.pc-next>div:first-child,.mf-mom-home .mf-pump-plan-panel .schedule-card.pi-next>div:first-child{background:var(--mom);color:#fff;box-shadow:0 0 0 5px color-mix(in srgb,var(--mom) 13%,transparent)}
  .mf-mom-home .mf-pump-plan-panel .schedule-card.pc-missed>div:first-child,.mf-mom-home .mf-pump-plan-panel .schedule-card.pi-missed>div:first-child{background:var(--surface-2);color:var(--muted);opacity:.62}
  .mf-mom-home .mf-pump-plan-panel .schedule-card strong{font-size:12px;font-weight:850;color:var(--ink)}
  .mf-mom-home .mf-pump-plan-panel .schedule-card small{font-size:9px;color:var(--muted);font-weight:650}
  .mf-mom-home .mf-pump-plan-panel .schedule-card em{font-size:8px;background:var(--mom-soft);color:var(--mom-ink);padding:2px 6px;border-radius:99px;font-style:normal;font-weight:800}

  /* Recent care becomes a clean list. */
  .mf-mom-home .mf-recent-panel .rows{background:var(--surface);border-radius:21px;overflow:hidden}
  .mf-mom-home .mf-recent-panel .row{border:0;border-bottom:1px solid var(--line-soft);border-radius:0;background:transparent;box-shadow:none;padding:12px 13px}
  .mf-mom-home .mf-recent-panel .row:last-child{border-bottom:0}
  .mf-mom-home .mf-recent-panel .row-icon{border:0!important;box-shadow:none!important;background:color-mix(in srgb,var(--mom) 9%,var(--surface-2))}

  /* App chrome: flatter, native-feeling and less like a floating diagnostics bar. */
  @media(max-width:760px){
    body.mf-mom-home{padding-bottom:calc(88px + env(safe-area-inset-bottom))}
    .mf-mom-home .view{padding:14px 15px 34px}
    .mf-mom-home .topbar{background:color-mix(in srgb,var(--bg) 88%,transparent);border-bottom:0}
    .mf-mom-home .mobile-workspace{min-width:210px;background:color-mix(in srgb,var(--surface) 78%,transparent);border:1px solid var(--line-soft);border-radius:18px;padding:3px;box-shadow:none}
    .mf-mom-home .mobile-workspace button{min-height:38px;border-radius:15px}
    .mf-mom-home .mobile-workspace button.active{box-shadow:none;background:var(--surface-2)}

    .mf-mom-home .mom-hero{min-height:226px;padding:24px 21px 22px;border-radius:28px;margin-bottom:12px}
    .mf-mom-home .mom-hero h2{font-size:36px;max-width:90%}
    .mf-mom-home .mom-hero p{font-size:13px}
    .mf-mom-home .mom-hero .chips{margin-top:16px}
    .mf-mom-home #mfMomAvatar{width:52px;height:52px;right:18px;top:18px;border-radius:18px}
    .mf-mom-home #mfMomAvatar img{border-radius:18px}

    .mf-mom-home .quick-grid.mom-grid.two{gap:10px;margin-top:10px}
    .mf-mom-home .quick-tile{min-height:112px;padding:17px;border-radius:23px}
    .mf-mom-home .quick-tile .tile-art{width:58px;height:58px;right:13px;top:17px}
    .mf-mom-home .quick-tile .tile-art .gly{width:54px;height:54px}
    .mf-mom-home .quick-tile strong{font-size:18px}

    .mf-mom-home .metric-grid.mom-summary .metric{flex-basis:174px;min-height:76px;padding:12px 13px;border-radius:18px}
    .mf-mom-home .metric-grid.mom-summary .metric:last-child:nth-child(odd){grid-column:auto;min-height:76px}

    .mf-mom-home #view>.panel .panel-head h3{font-size:19px}

    .mf-mom-home .bottom-nav{
      left:0!important;right:0!important;bottom:0!important;
      grid-template-columns:repeat(5,1fr)!important;
      border:0!important;border-top:1px solid var(--line-soft)!important;border-radius:0!important;
      padding:7px 10px calc(8px + env(safe-area-inset-bottom))!important;
      background:color-mix(in srgb,var(--bg) 88%,transparent)!important;
      box-shadow:0 -8px 26px rgba(10,13,22,.08)!important;
      backdrop-filter:blur(20px) saturate(1.2)!important;-webkit-backdrop-filter:blur(20px) saturate(1.2)!important;
    }
    .mf-mom-home .bottom-nav button{min-height:52px;border-radius:14px!important;background:transparent!important;box-shadow:none!important}
    .mf-mom-home .bottom-nav button.active{background:color-mix(in srgb,var(--mom) 8%,transparent)!important}
    .mf-mom-home .bottom-nav .add-tab{top:-14px}
    .mf-mom-home .bottom-nav .add-tab .ico{padding:10px;box-shadow:0 9px 22px color-mix(in srgb,var(--mom) 25%,transparent)}

    .mf-mom-home .mf-chat-btn{width:50px!important;height:50px!important;right:15px!important;bottom:calc(91px + env(safe-area-inset-bottom))!important;box-shadow:0 9px 24px rgba(35,27,66,.18)!important}
    .mf-mom-home .mf-chat-btn svg{width:23px!important;height:23px!important}
    .mf-mom-home .mf-chat-panel{bottom:calc(150px + env(safe-area-inset-bottom))!important}
  }

  @media(max-width:400px){
    .mf-mom-home .mom-hero{min-height:218px;padding:22px 18px 20px}
    .mf-mom-home .mom-hero h2{font-size:32px}
    .mf-mom-home .mom-hero .chip{font-size:10.5px;padding:7px 10px}
    .mf-mom-home .quick-tile{min-height:108px}
  }

  /* Dark mode stays calm: less purple haze, more neutral depth. */
  :root[data-theme="dark"] .mf-mom-home .mom-hero{
    background:
      radial-gradient(95% 120% at 108% -12%,rgba(148,111,224,.12),transparent 62%),
      linear-gradient(145deg,#171922,#191b25 58%,#1b1c27);
  }
  :root[data-theme="dark"] .mf-mom-home .quick-tile.mom{background:linear-gradient(145deg,#211c2e,#29203b);color:#c4a7ff}
  :root[data-theme="dark"] .mf-mom-home .quick-tile.nurse{background:linear-gradient(145deg,#241a22,#32202c);color:#ee9dc1}
  :root[data-theme="dark"] .mf-mom-home .metric-grid.mom-summary .metric{background:#171a22}
  :root[data-theme="dark"] .mf-mom-home .mf-recent-panel .rows{background:#171a22}
  `;
  document.head.appendChild(s);
}

function polishMomHome(){
  const isMom=location.hash==='#mom-home' || (!location.hash && document.body.dataset.screen==='mom-home');
  document.body.classList.toggle('mf-mom-home',isMom);
  if(!isMom)return;

  const view=document.getElementById('view');
  if(!view)return;

  // Rename dashboard-like labels into family language without touching stored data.
  const metrics=[...view.querySelectorAll('.metric-grid.mom-summary .metric')];
  const labels=[
    ['Your average','7-day pumping average'],
    ['Today','of your usual output'],
    ['Milk saved','freezer stash']
  ];
  metrics.forEach((m,i)=>{
    const [label,sub]=labels[i]||[];
    if(label){const l=m.querySelector('span');if(l)l.textContent=label;}
    if(sub){const s=m.querySelector('small');if(s)s.textContent=sub;}
  });

  // Tag the two home panels so their styling is semantic rather than nth-child based.
  view.querySelectorAll(':scope > .panel').forEach(p=>{
    p.classList.remove('mf-pump-plan-panel','mf-recent-panel');
    const title=(p.querySelector('.panel-head h3')?.textContent||'').trim().toLowerCase();
    if(title==='pump plan')p.classList.add('mf-pump-plan-panel');
    if(title==='recent')p.classList.add('mf-recent-panel');
  });

  // Replace the big medical-looking ring with a thin, quiet progress line.
  const hero=view.querySelector('.mom-hero');
  const copy=hero?.querySelector('.hero-copy');
  if(copy&&!copy.querySelector('.mf-goal-progress')){
    const state=readState();
    const total=todayOutput(state);
    const goal=Math.max(1,Number(state.profile?.dailyGoalMl)||760);
    const pct=Math.max(0,Math.min(100,Math.round(total/goal*100)));
    const el=document.createElement('div');
    el.className='mf-goal-progress';
    el.innerHTML=`<div class="mf-goal-progress-copy"><span>Today’s pumping</span><b>${pct}% of ${goal} mL</b></div><div class="mf-goal-progress-track"><i style="width:${pct}%"></i></div>`;
    copy.appendChild(el);
  }
}

function schedulePolish(){clearTimeout(renderTimer);renderTimer=setTimeout(polishMomHome,60);}
function mount(){
  style();
  polishMomHome();
  const view=document.getElementById('view');
  if(view)new MutationObserver(schedulePolish).observe(view,{childList:true,subtree:true});
  window.addEventListener('hashchange',schedulePolish);
  window.addEventListener('pageshow',schedulePolish);
  window.addEventListener('storage',e=>{if(e.key===STATE_KEY)schedulePolish();});
}

if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
