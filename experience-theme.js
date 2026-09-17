(() => {
'use strict';

/* First-class visual-theme controller. It owns only presentation preference and never
   reads/writes MilkFlow records. It uses explicit render events rather than DOM watching. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['storybook','clean']);
const root=document.documentElement;

function read(){
  try{ const v=localStorage.getItem(KEY); return THEMES.has(v)?v:'storybook'; }
  catch{ return 'storybook'; }
}
function apply(name=read()){
  const value=THEMES.has(name)?name:'storybook';
  root.dataset.experienceTheme=value;
  document.querySelectorAll('[data-experience-theme-pick]').forEach(btn=>{
    const on=btn.dataset.experienceThemePick===value;
    btn.setAttribute('aria-pressed',String(on));
  });
  return value;
}
function save(name){
  if(!THEMES.has(name))return;
  try{localStorage.setItem(KEY,name);}catch{}
  apply(name);
  window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:name}}));
}
function settingsPanel(){
  if(document.body.dataset.screen!=='set-appearance')return;
  const view=document.getElementById('view'); if(!view)return;
  let panel=document.getElementById('mfExperiencePanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='mfExperiencePanel';
    panel.className='panel mf-experience-panel';
    panel.innerHTML=`
      <div class="panel-head"><h3>Experience theme</h3><span class="panel-note">Visual only</span></div>
      <div class="mf-experience-options" role="group" aria-label="Experience theme">
        <button type="button" class="mf-experience-option" data-experience-theme-pick="storybook" aria-pressed="false">
          <span class="mf-experience-preview storybook" aria-hidden="true"><i class="mom"></i><i class="baby"></i></span>
          <strong>Storybook</strong><small>Cloud Island for Mom · Woodland Forest for Baby</small>
        </button>
        <button type="button" class="mf-experience-option" data-experience-theme-pick="clean" aria-pressed="false">
          <span class="mf-experience-preview clean" aria-hidden="true"><i class="clean"></i></span>
          <strong>Clean</strong><small>The simpler MilkFlow visual system</small>
        </button>
      </div>
      <p class="chart-note">This changes artwork and surfaces only. Pumping, baby-care history, cloud sync and calculations are unchanged.</p>`;
    const firstPanel=view.querySelector('.panel');
    if(firstPanel) firstPanel.insertAdjacentElement('beforebegin',panel);
    else view.appendChild(panel);
  }
  apply();
}

apply();
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-experience-theme-pick]');
  if(!btn)return;
  save(btn.dataset.experienceThemePick);
});
window.addEventListener('storage',e=>{if(e.key===KEY)apply();});
window.addEventListener('milkflow:base-rendered',settingsPanel);
window.addEventListener('pageshow',()=>{apply();settingsPanel();});
window.addEventListener('hashchange',()=>setTimeout(settingsPanel,0));
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',settingsPanel,{once:true});
else settingsPanel();
})();
