(() => {
'use strict';

const COACH_KEY='milkflow-pumping-coach-v1';
let observer=null;
let timer=null;

function readPrefs(){
  try{return {target:6,mode:'normal',...(JSON.parse(localStorage.getItem(COACH_KEY)||'{}')||{})};}
  catch{return {target:6,mode:'normal'};}
}

function isMomHome(){
  const hash=location.hash.slice(1);
  return hash==='mom-home'||(!hash&&document.querySelector('.mom-hero'));
}

function style(){
  if(document.getElementById('pumpQuickStyles'))return;
  const el=document.createElement('style');
  el.id='pumpQuickStyles';
  el.textContent=`
  .pump-quick{margin:14px 0 8px;padding:15px;border:1px solid var(--line-soft,var(--line));border-radius:22px;background:var(--surface);box-shadow:0 8px 24px rgba(30,35,55,.05)}
  .pump-quick-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:11px}.pump-quick-head strong{font-size:1rem}.pump-quick-head span{font-size:.7rem;font-weight:800;color:var(--mom);background:var(--mom-soft,var(--surface-2));padding:6px 9px;border-radius:999px}
  .pump-quick-main{display:grid;grid-template-columns:1fr 1fr;gap:9px}.pump-quick-main button{min-height:58px;border:1px solid var(--line-soft,var(--line));border-radius:17px;background:var(--surface-2);color:var(--ink);font:inherit;font-weight:850;font-size:1rem;display:flex;align-items:center;justify-content:center;gap:7px}.pump-quick-main button.on{background:var(--mom);color:#fff;border-color:var(--mom);box-shadow:0 7px 18px color-mix(in srgb,var(--mom) 24%,transparent)}
  .pump-quick-label{margin:13px 0 7px;font-size:.72rem;font-weight:800;color:var(--muted)}
  .pump-quick-mode{display:grid;grid-template-columns:repeat(3,1fr);gap:7px}.pump-quick-mode button{min-height:43px;border:1px solid var(--line-soft,var(--line));border-radius:13px;background:transparent;color:var(--muted);font:inherit;font-size:.78rem;font-weight:800}.pump-quick-mode button.on{background:var(--surface-2);color:var(--ink);border-color:color-mix(in srgb,var(--mom) 24%,var(--line))}
  .pump-quick-note{display:block;margin-top:9px;color:var(--muted);font-size:.72rem;line-height:1.35}
  @media(max-width:560px){.pump-quick{margin-top:10px;border-radius:19px}.pump-quick-main button{min-height:62px;font-size:1.04rem}.pump-quick-mode button{min-height:46px}}
  `;
  document.head.appendChild(el);
}

function html(p){
  const ai=String(window.MILKFLOW_CONFIG?.aiCoachEndpoint||'').trim();
  return `<section id="pumpQuick" class="pump-quick" aria-label="Today's pump plan">
    <div class="pump-quick-head"><strong>Today’s pump plan</strong><span>${ai?'AI guidance on':'Adaptive coach'}</span></div>
    <div class="pump-quick-main" role="group" aria-label="Daily pump target">
      <button type="button" data-pc-target="6" class="${+p.target===6?'on':''}" aria-pressed="${+p.target===6}">6 pumps</button>
      <button type="button" data-pc-target="5" class="${+p.target===5?'on':''}" aria-pressed="${+p.target===5}">5 pumps</button>
    </div>
    <div class="pump-quick-label">How should today flex?</div>
    <div class="pump-quick-mode" role="group" aria-label="Day mode">
      <button type="button" data-pc-mode="normal" class="${p.mode==='normal'?'on':''}" aria-pressed="${p.mode==='normal'}">Normal</button>
      <button type="button" data-pc-mode="tired" class="${p.mode==='tired'?'on':''}" aria-pressed="${p.mode==='tired'}">Tired</button>
      <button type="button" data-pc-mode="travel" class="${p.mode==='travel'?'on':''}" aria-pressed="${p.mode==='travel'}">Travel</button>
    </div>
    <small class="pump-quick-note">Tap once. Your next-pump guidance and trend interpretation update automatically.</small>
  </section>`;
}

function render(){
  if(!isMomHome()){document.getElementById('pumpQuick')?.remove();return;}
  const view=document.getElementById('view'),hero=view?.querySelector('.mom-hero');
  if(!view||!hero)return;
  style();
  const p=readPrefs();
  const existing=document.getElementById('pumpQuick');
  const wrap=document.createElement('div');wrap.innerHTML=html(p);const next=wrap.firstElementChild;
  if(existing)existing.replaceWith(next);
  else hero.insertAdjacentElement('afterend',next);
}

function renderSoon(){clearTimeout(timer);timer=setTimeout(render,70);}

window.addEventListener('DOMContentLoaded',()=>{
  const view=document.getElementById('view');
  if(view){observer=new MutationObserver(renderSoon);observer.observe(view,{childList:true,subtree:true});}
  renderSoon();
});
window.addEventListener('hashchange',renderSoon);
window.addEventListener('pageshow',renderSoon);
window.addEventListener('storage',e=>{if(e.key===COACH_KEY)renderSoon();});
document.addEventListener('click',e=>{if(e.target.closest('[data-pc-target],[data-pc-mode]'))setTimeout(renderSoon,120);});
})();
