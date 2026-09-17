(() => {
'use strict';

/* MilkFlow experience controller v3.
   Theme selection is a realm-wide preference. It never replaces semantic icons or
   modifies care data. Core UI owns interaction; this controller owns only the selected world. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['safari','butterfly','princess','unicorn','clean']);
const root=document.documentElement;

function normalize(value){
  if(value==='jungle'||value==='storybook')return 'safari';
  return THEMES.has(value)?value:'safari';
}
function read(){try{return normalize(localStorage.getItem(KEY));}catch{return 'safari';}}
function apply(name=read()){
  const value=normalize(name);
  root.dataset.experienceTheme=value;
  document.querySelectorAll('[data-experience-theme-pick]').forEach(btn=>{
    btn.setAttribute('aria-pressed',String(btn.dataset.experienceThemePick===value));
  });
  return value;
}
function save(name){
  const value=normalize(name);
  try{localStorage.setItem(KEY,value);}catch{}
  apply(value);
  window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:value}}));
}
function themeCard(key,title,subtitle,src){
  return `<button type="button" class="mf-experience-option" data-experience-theme-pick="${key}" aria-pressed="false">
    <span class="mf-experience-preview" aria-hidden="true"><img src="${src}" alt="" decoding="async" loading="eager"></span>
    <span class="mf-experience-copy"><strong>${title}</strong><small>${subtitle}</small></span>
  </button>`;
}
function settingsPanel(){
  if(document.body.dataset.screen!=='set-appearance')return;
  const view=document.getElementById('view');if(!view)return;
  let panel=document.getElementById('mfExperiencePanel');
  if(!panel){
    panel=document.createElement('section');
    panel.id='mfExperiencePanel';
    panel.className='panel mf-experience-panel';
    panel.innerHTML=`
      <div class="mf-experience-intro">
        <div><h3>Choose your family world</h3><p>The selected world follows both Vinni and Saahas across Home, History, Trends, Growth, Stash, Development and Doctor pages.</p></div>
        <span class="mf-experience-scope">Mom + Baby</span>
      </div>
      <div class="mf-experience-options" role="group" aria-label="Experience theme">
        ${themeCard('safari','Safari Adventure','Giraffe, lion, tiger and warm jungle scenery','./assets/themes/safari-world-v2.svg')}
        ${themeCard('butterfly','Butterfly Garden','Soft garden skies and butterfly magic','./assets/themes/butterfly-garden.svg')}
        ${themeCard('princess','Princess Palace','A gentle palace world with warm jewel tones','./assets/themes/princess-palace.svg')}
        ${themeCard('unicorn','Unicorn Dreams','Moonlight, clouds and dreamy pastel skies','./assets/themes/unicorn-dreams.svg')}
      </div>
      <button type="button" class="mf-experience-clean" data-experience-theme-pick="clean" aria-pressed="false"><span>Minimal</span><small>Keep Mom and Baby pages on the clean MilkFlow canvas</small></button>`;
    const firstPanel=view.querySelector('.panel');
    if(firstPanel)firstPanel.insertAdjacentElement('beforebegin',panel);else view.appendChild(panel);
  }
  apply();
}
function syncThemeUi(){apply();settingsPanel();}
let queued=false;
function afterCanonicalRender(){
  if(queued)return;
  queued=true;
  queueMicrotask(()=>requestAnimationFrame(()=>{queued=false;syncThemeUi();}));
}

apply();
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-experience-theme-pick]');
  if(!btn)return;
  save(btn.dataset.experienceThemePick);
});
window.addEventListener('storage',e=>{if(e.key===KEY)afterCanonicalRender();});
window.addEventListener('milkflow:base-rendered',afterCanonicalRender);
window.addEventListener('milkflow:experience-theme-change',afterCanonicalRender);
window.addEventListener('pageshow',afterCanonicalRender);
window.addEventListener('hashchange',afterCanonicalRender);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterCanonicalRender,{once:true});else afterCanonicalRender();
})();