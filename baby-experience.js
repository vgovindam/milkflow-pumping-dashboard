(() => {
'use strict';

const STYLE_ID='mfBabyExperienceStyles';
let scheduled=false;
let observer=null;

function icon(kind){
  const paths={
    bottle:'<path d="M10 3h4v3l1.7 2.2V19a2 2 0 0 1-2 2h-3.4a2 2 0 0 1-2-2V8.2L10 6V3Z"/><path d="M10 6h4M8.3 10h7.4"/>',
    diaper:'<path d="M4 8c2.7 1.3 5.3 2 8 2s5.3-.7 8-2v8.5c-2.1 2.3-4.8 3.5-8 3.5s-5.9-1.2-8-3.5V8Z"/><path d="M8 10.1c0 2.4 1.5 3.9 4 3.9s4-1.5 4-3.9"/>',
    history:'<path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6"/><path d="M4 4v4.6h4.6M12 7.5V12l3 2"/>',
    trend:'<path d="M4 19V5M4 19h16"/><path d="m7 15 3-4 3 2 5-7"/><path d="M15 6h3v3"/>',
    sparkle:'<path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5L12 3Z"/><path d="m18 14 .8 2.2L21 17l-2.2.8L18 20l-.8-2.2L15 17l2.2-.8L18 14Z"/>'
  };
  return `<svg viewBox="0 0 24 24" aria-hidden="true">${paths[kind]||paths.sparkle}</svg>`;
}

function addStyles(){
  if(document.getElementById(STYLE_ID))return;
  const s=document.createElement('style');
  s.id=STYLE_ID;
  s.textContent=`
  body[data-screen="baby-home"] .mf-animal-hero.mf-baby-experience-v2{
    min-height:254px!important;
    padding:23px 25px 20px!important;
    border-radius:36px 46px 38px 42px / 40px 34px 46px 37px!important;
    background:radial-gradient(circle at 13% 4%,rgba(255,255,255,.8),transparent 26%),radial-gradient(circle at 91% 11%,rgba(255,247,202,.94),transparent 18%),linear-gradient(135deg,#a7ddf4 0%,#c9ebdf 48%,#ffe0b9 100%)!important;
    box-shadow:0 20px 46px rgba(47,91,102,.15),inset 0 1px 0 rgba(255,255,255,.62)!important;
  }
  body[data-screen="baby-home"] .mf-animal-hero.mf-baby-experience-v2:after{height:92px!important;bottom:-48px!important;opacity:.82}
  body[data-screen="baby-home"] .mf-animal-profile{
    max-width:none!important;
    display:grid!important;
    grid-template-columns:90px minmax(0,1fr)!important;
    align-items:center!important;
    gap:15px!important;
    padding-right:108px;
  }
  body[data-screen="baby-home"] .mf-animal-profile .mf-profile-photo{width:90px!important;height:90px!important}
  body[data-screen="baby-home"] .mf-animal-copy{min-width:0}
  body[data-screen="baby-home"] .mf-animal-copy .welcome{
    display:flex!important;
    align-items:center!important;
    gap:8px!important;
    width:100%!important;
    max-width:520px!important;
    margin:0 0 3px!important;
    font-size:14px!important;
    line-height:1.25!important;
    font-weight:800!important;
    letter-spacing:-.01em!important;
    color:#2d6570!important;
    opacity:1!important;
    white-space:normal!important;
    text-wrap:balance;
  }
  .mf-baby-greeting-mark{flex:0 0 auto;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;background:rgba(255,255,255,.55);box-shadow:inset 0 1px 0 rgba(255,255,255,.8);font-size:14px}
  body[data-screen="baby-home"] .mf-animal-copy h2{margin:1px 0 0!important;font-size:36px!important;line-height:1!important;max-width:540px;white-space:normal!important;overflow:visible!important;text-overflow:clip!important;text-wrap:balance}
  body[data-screen="baby-home"] .mf-animal-copy>small{font-size:12px!important;line-height:1.35!important;margin-top:6px!important;color:#456b71!important;opacity:.9!important}
  .mf-baby-copy-note{margin:6px 0 0;font-size:11.5px;line-height:1.35;font-weight:700;color:#4f7377;max-width:460px}
  .mf-baby-glance-title{position:relative;z-index:4;display:flex;align-items:center;gap:7px;margin:17px 2px 7px;font-size:11px;font-weight:850;color:#37616a;letter-spacing:.01em}
  .mf-baby-glance-title svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  body[data-screen="baby-home"] .mf-animal-stats{
    position:relative!important;
    z-index:4!important;
    top:auto!important;
    right:auto!important;
    display:grid!important;
    grid-template-columns:repeat(2,minmax(0,1fr))!important;
    gap:10px!important;
    width:min(500px,100%)!important;
    margin:0!important;
  }
  body[data-screen="baby-home"] .mf-animal-stat{
    min-width:0!important;
    min-height:72px;
    padding:9px 12px 9px 9px!important;
    display:grid!important;
    grid-template-columns:50px minmax(0,1fr)!important;
    align-items:center!important;
    gap:9px!important;
    text-align:left!important;
    border:1px solid rgba(255,255,255,.66)!important;
    border-radius:24px 19px 25px 21px / 21px 25px 19px 24px!important;
    backdrop-filter:blur(12px);
    box-shadow:0 9px 22px rgba(48,88,97,.09),inset 0 1px 0 rgba(255,255,255,.65)!important;
  }
  body[data-screen="baby-home"] .mf-animal-stat.mf-stat-milk{background:linear-gradient(145deg,rgba(215,244,255,.94),rgba(174,226,246,.9) 62%,rgba(199,238,235,.9))!important;color:#15546c!important}
  body[data-screen="baby-home"] .mf-animal-stat.mf-stat-diapers{background:linear-gradient(145deg,rgba(255,246,213,.96),rgba(255,221,177,.9) 62%,rgba(236,222,255,.86))!important;color:#74451b!important}
  .mf-summary-animal{width:48px!important;height:48px!important;padding:5px;border-radius:50%;background:rgba(255,255,255,.54);box-shadow:inset 0 1px 0 rgba(255,255,255,.78);display:grid;place-items:center}
  .mf-summary-animal svg{width:100%!important;height:100%!important;position:static!important;transform:none!important;opacity:1!important}
  .mf-baby-stat-copy{min-width:0}.mf-baby-stat-copy strong,.mf-baby-stat-copy span{display:block!important}.mf-baby-stat-copy strong{font-size:18px!important;line-height:1.05!important;letter-spacing:-.02em}.mf-baby-stat-copy span{margin-top:3px!important;font-size:10.5px!important;line-height:1.15!important;font-weight:800!important;opacity:.84!important}
  body[data-screen="baby-home"] .mf-animal-hero>.bear{width:104px!important;height:104px!important;right:5px!important;top:6px!important;bottom:auto!important;opacity:.13;transform:rotate(-8deg)!important;filter:none!important}
  body[data-screen="baby-home"] .mf-animal-hero>.bunny{display:none!important}
  body[data-screen="baby-home"] .mf-animal-star.one{left:auto!important;right:74px!important;top:28px!important}.mf-animal-star.two{right:35px!important;top:71px!important}
  body[data-screen="baby-home"] .mf-care-label{justify-content:flex-start!important;gap:8px!important;margin-top:4px!important}
  body[data-screen="baby-home"] .mf-care-label small{margin-left:auto}
  .mf-label-icon,.mf-panel-title-icon{flex:0 0 auto;display:inline-grid;place-items:center;border-radius:12px}
  .mf-label-icon{width:29px;height:29px;background:rgba(255,255,255,.68);box-shadow:inset 0 1px 0 rgba(255,255,255,.8),0 5px 12px rgba(43,88,96,.07);color:#31788b}
  .mf-label-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  .mf-panel-title-icon{width:28px;height:28px;margin-right:7px;vertical-align:-7px;background:#e4f5f1;color:#397d6d}
  .mf-panel-title-icon svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:1.9;stroke-linecap:round;stroke-linejoin:round}
  body[data-screen="baby-home"] .mf-care-ribbon button svg{flex:0 0 auto}
  :root[data-theme="dark"] body[data-screen="baby-home"] .mf-animal-hero.mf-baby-experience-v2{background:radial-gradient(circle at 12% 5%,rgba(91,183,217,.18),transparent 28%),radial-gradient(circle at 90% 11%,rgba(227,184,92,.12),transparent 20%),linear-gradient(135deg,#173746,#1b463f 50%,#4d3e2d 120%)!important;color:#eefcff!important;box-shadow:0 20px 46px rgba(0,0,0,.24)!important}
  :root[data-theme="dark"] body[data-screen="baby-home"] .mf-animal-copy .welcome{color:#bfeaf0!important}:root[data-theme="dark"] body[data-screen="baby-home"] .mf-animal-copy>small,:root[data-theme="dark"] .mf-baby-copy-note{color:#c2d7da!important}
  :root[data-theme="dark"] .mf-baby-greeting-mark{background:rgba(255,255,255,.1)}:root[data-theme="dark"] .mf-baby-glance-title{color:#c9e7e3}
  :root[data-theme="dark"] body[data-screen="baby-home"] .mf-animal-stat.mf-stat-milk{background:linear-gradient(145deg,#173e50,#184d52)!important;color:#c6f1ff!important;border-color:rgba(128,213,231,.18)!important}
  :root[data-theme="dark"] body[data-screen="baby-home"] .mf-animal-stat.mf-stat-diapers{background:linear-gradient(145deg,#493817,#473246)!important;color:#ffe0a8!important;border-color:rgba(244,205,134,.18)!important}
  :root[data-theme="dark"] .mf-summary-animal,:root[data-theme="dark"] .mf-label-icon,:root[data-theme="dark"] .mf-panel-title-icon{background:rgba(255,255,255,.09);box-shadow:inset 0 1px 0 rgba(255,255,255,.06)}
  :root[data-theme="dark"] .mf-label-icon{color:#8cd3df}:root[data-theme="dark"] .mf-panel-title-icon{color:#8ad7c3}
  @media(max-width:760px){
    body[data-screen="baby-home"] .mf-animal-hero.mf-baby-experience-v2{min-height:274px!important;padding:18px 16px 16px!important;border-radius:31px 39px 32px 37px / 35px 30px 40px 32px!important}
    body[data-screen="baby-home"] .mf-animal-profile{grid-template-columns:76px minmax(0,1fr)!important;gap:12px!important;padding-right:0!important}
    body[data-screen="baby-home"] .mf-animal-profile .mf-profile-photo{width:76px!important;height:76px!important;border-width:4px!important}
    body[data-screen="baby-home"] .mf-animal-copy .welcome{font-size:13px!important;line-height:1.22!important;max-width:none!important}
    .mf-baby-greeting-mark{width:25px;height:25px;font-size:13px}
    body[data-screen="baby-home"] .mf-animal-copy h2{font-size:31px!important;line-height:1.02!important;margin-top:2px!important}
    body[data-screen="baby-home"] .mf-animal-copy>small{font-size:11px!important;margin-top:5px!important}.mf-baby-copy-note{font-size:10.5px;margin-top:5px;line-height:1.3}
    .mf-baby-glance-title{margin:14px 2px 6px;font-size:10.5px}
    body[data-screen="baby-home"] .mf-animal-stats{width:100%!important;gap:8px!important}
    body[data-screen="baby-home"] .mf-animal-stat{min-height:68px!important;grid-template-columns:43px minmax(0,1fr)!important;gap:7px!important;padding:8px 9px 8px 7px!important;border-radius:21px 17px 22px 18px / 19px 22px 17px 21px!important}
    .mf-summary-animal{width:42px!important;height:42px!important;padding:4px!important}.mf-baby-stat-copy strong{font-size:16px!important}.mf-baby-stat-copy span{font-size:9.5px!important}
    body[data-screen="baby-home"] .mf-animal-hero>.bear{width:82px!important;height:82px!important;right:-7px!important;top:2px!important;opacity:.1}
    body[data-screen="baby-home"] .mf-animal-star.one{right:42px!important;top:20px!important}.mf-animal-star.two{right:18px!important;top:57px!important}
  }
  `;
  document.head.appendChild(s);
}

function dayIndex(){
  const d=new Date();
  const start=new Date(d.getFullYear(),0,0);
  return Math.floor((d-start)/86400000);
}

function greetingFor(name){
  const h=new Date().getHours();
  let key='night',mark='🌙';
  if(h>=5&&h<8){key='early';mark='🌅';}
  else if(h>=8&&h<12){key='morning';mark='☀️';}
  else if(h>=12&&h<15){key='midday';mark='🌤️';}
  else if(h>=15&&h<18){key='afternoon';mark='🫧';}
  else if(h>=18&&h<21){key='evening';mark='✨';}
  const variants={
    early:[`Rise and shine, ${name}`,`A gentle start, ${name}`,`Morning cuddles, ${name}`,`Hello, early bird ${name}`,`A fresh little morning, ${name}`],
    morning:[`Good morning, ${name}`,`Morning sunshine, ${name}`,`Hello, bright eyes`,`A happy morning, ${name}`,`Tiny wins this morning`],
    midday:[`Hello, little explorer`,`A sweet midday check-in`,`Happy lunchtime, ${name}`,`Little moments, big day`,`How’s your day going, ${name}?`],
    afternoon:[`Good afternoon, ${name}`,`Cozy afternoon, little one`,`Hello, curious little explorer`,`Tiny wins this afternoon`,`A little afternoon check-in`],
    evening:[`Good evening, ${name}`,`Cozy evening, little star`,`Winding down together`,`Evening cuddles, ${name}`,`A calm little evening`],
    night:[`Good night, little star`,`Night owl check-in, ${name}`,`A quiet little night`,`Soft lights and sleepy cuddles`,`Sweet dreams are getting closer`]
  };
  const list=variants[key];
  const seed=(dayIndex()+name.length+(h>>1))%list.length;
  return {text:list[seed],mark};
}

function decorateStat(stat,sourceSelector,kind){
  if(!stat||stat.dataset.babyStat==='2')return;
  const value=stat.querySelector('strong')?.textContent?.trim()||'—';
  const label=stat.querySelector('span')?.textContent?.trim()||(kind==='milk'?'Milk today':'Diapers');
  const source=document.querySelector(sourceSelector+' > .mf-animal-sticker');
  const animal=source?.cloneNode(true);
  stat.textContent='';
  stat.dataset.babyStat='2';
  stat.classList.add(kind==='milk'?'mf-stat-milk':'mf-stat-diapers');
  if(animal){animal.classList.add('mf-summary-animal');stat.appendChild(animal);}
  else{const fallback=document.createElement('span');fallback.className='mf-summary-animal';fallback.textContent=kind==='milk'?'🐳':'🐻';stat.appendChild(fallback);}
  const copy=document.createElement('div');copy.className='mf-baby-stat-copy';copy.innerHTML=`<strong>${value}</strong><span>${label}</span>`;stat.appendChild(copy);
}

function addSectionIcons(root){
  root.querySelectorAll('.mf-care-label').forEach(label=>{
    if(label.querySelector('.mf-label-icon'))return;
    const first=label.querySelector('span');
    const text=(first?.textContent||'').trim().toLowerCase();
    const type=text.includes('diaper')?'diaper':text.includes('feed')?'bottle':null;
    if(!type)return;
    const badge=document.createElement('span');badge.className='mf-label-icon';badge.innerHTML=icon(type);label.prepend(badge);
  });
  root.querySelectorAll('.mf-care-ribbon button').forEach(btn=>{
    if(btn.querySelector('svg'))return;
    const t=btn.textContent.trim().toLowerCase();
    if(t==='history')btn.insertAdjacentHTML('afterbegin',icon('history'));
    if(t==='trends')btn.insertAdjacentHTML('afterbegin',icon('trend'));
  });
  document.querySelectorAll('body[data-screen="baby-home"] .panel-head h3').forEach(h=>{
    if(h.querySelector('.mf-panel-title-icon'))return;
    const t=h.textContent.trim().toLowerCase();
    if(t!=='recent care')return;
    const badge=document.createElement('span');badge.className='mf-panel-title-icon';badge.innerHTML=icon('history');h.prepend(badge);
  });
}

function enhanceBabyHome(){
  if(document.body.dataset.screen!=='baby-home')return;
  addStyles();
  const root=document.getElementById('mfCoreBaby');
  const hero=root?.querySelector('.mf-animal-hero');
  if(!root||!hero)return;
  if(hero.dataset.babyExperience!=='2'){
    hero.dataset.babyExperience='2';
    hero.classList.add('mf-baby-experience-v2');
    const copy=hero.querySelector('.mf-animal-copy');
    const name=copy?.querySelector('h2')?.textContent?.trim()||'Baby';
    const welcome=copy?.querySelector('.welcome');
    if(welcome){const g=greetingFor(name);welcome.innerHTML=`<span class="mf-baby-greeting-mark">${g.mark}</span><span>${g.text}</span>`;}
    if(copy&&!copy.querySelector('.mf-baby-copy-note')){const note=document.createElement('p');note.className='mf-baby-copy-note';note.textContent='Milk, diapers and little care moments — all together.';copy.appendChild(note);}
    const stats=hero.querySelector('.mf-animal-stats');
    if(stats&&!hero.querySelector('.mf-baby-glance-title')){const title=document.createElement('div');title.className='mf-baby-glance-title';title.innerHTML=`${icon('sparkle')}<span>Today at a glance</span>`;stats.before(title);}
    const cards=stats?.querySelectorAll('.mf-animal-stat')||[];
    decorateStat(cards[0],'.mf-feed-card.milk','milk');
    decorateStat(cards[1],'.mf-diaper-blob.poop','diapers');
  }
  addSectionIcons(root);
}

function schedule(){
  if(scheduled)return;
  scheduled=true;
  requestAnimationFrame(()=>{scheduled=false;enhanceBabyHome();});
}

function start(){
  addStyles();
  schedule();
  const view=document.getElementById('view');
  if(view&&!observer){observer=new MutationObserver(schedule);observer.observe(view,{childList:true,subtree:true});}
}

window.addEventListener('milkflow:base-rendered',()=>setTimeout(schedule,0));
window.addEventListener('pageshow',schedule);
window.addEventListener('hashchange',()=>setTimeout(schedule,0));
window.addEventListener('storage',()=>setTimeout(schedule,0));
document.addEventListener('click',e=>{if(e.target.closest('[data-workspace],[data-view],[data-feed-type],[data-diaper],[data-photo],[data-sleep],[data-growth]'))setTimeout(schedule,20);});
document.addEventListener('submit',e=>{if(['feedForm','diaperForm','sleepForm','growthForm'].includes(e.target?.id))setTimeout(schedule,30);});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
