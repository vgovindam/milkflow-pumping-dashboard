(() => {
'use strict';

/* MilkFlow experience controller.
   One manifest owns the selected visual world. It does not own care data, routing,
   form state, Firestore, notifications, or semantic care icons. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['safari','butterfly','princess','unicorn','clean']);
const root=document.documentElement;

const THEME_MANIFEST={
  safari:{
    title:'Safari Adventure',
    subtitle:'Wild days, bigger dreams',
    preview:'./assets/themes/safari-world.svg',
    babyScene:'./assets/themes/safari-world.svg',
    momPortal:'./assets/themes/safari-adventure.svg'
  },
  butterfly:{
    title:'Butterfly Garden',
    subtitle:'Little moments, big magic',
    preview:'./assets/themes/butterfly-garden.svg',
    babyScene:'./assets/themes/butterfly-garden.svg',
    momPortal:'./assets/themes/butterfly-garden.svg'
  },
  princess:{
    title:'Princess Palace',
    subtitle:'Kind hearts change the world',
    preview:'./assets/themes/princess-palace.svg',
    babyScene:'./assets/themes/princess-palace.svg',
    momPortal:'./assets/themes/princess-palace.svg'
  },
  unicorn:{
    title:'Unicorn Dreams',
    subtitle:'Believe in brighter tomorrows',
    preview:'./assets/themes/unicorn-dreams.svg',
    babyScene:'./assets/themes/unicorn-dreams.svg',
    momPortal:'./assets/themes/unicorn-dreams.svg'
  },
  clean:{
    title:'Clean',
    subtitle:'Quiet MilkFlow canvas',
    preview:'',babyScene:'',momPortal:''
  }
};

function normalize(value){
  if(value==='jungle'||value==='storybook')return 'safari';
  return THEMES.has(value)?value:'safari';
}
function read(){try{return normalize(localStorage.getItem(KEY));}catch{return 'safari';}}
function assetUrl(path){return path?`url("${path}")`:'none';}
function apply(name=read()){
  const value=normalize(name),theme=THEME_MANIFEST[value];
  root.dataset.experienceTheme=value;
  root.style.setProperty('--mf-theme-baby-scene',assetUrl(theme.babyScene));
  root.style.setProperty('--mf-theme-mom-portal',assetUrl(theme.momPortal));
  root.style.setProperty('--mf-theme-name',JSON.stringify(theme.title));
  root.style.setProperty('--mf-theme-tagline',JSON.stringify(theme.subtitle));
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
        <div><h3>Choose your family world</h3><p>The artwork you choose is the artwork you see on the real Mom and Baby pages — not just a settings preview.</p></div>
        <span class="mf-experience-scope">Mom + Baby</span>
      </div>
      <div class="mf-experience-options" role="group" aria-label="Experience theme">
        ${themeCard('safari','Safari Adventure','Wild days, bigger dreams','./assets/themes/safari-world.svg')}
        ${themeCard('butterfly','Butterfly Garden','Little moments, big magic','./assets/themes/butterfly-garden.svg')}
        ${themeCard('princess','Princess Palace','Kind hearts change the world','./assets/themes/princess-palace.svg')}
        ${themeCard('unicorn','Unicorn Dreams','Believe in brighter tomorrows','./assets/themes/unicorn-dreams.svg')}
      </div>
      <button type="button" class="mf-experience-clean" data-experience-theme-pick="clean" aria-pressed="false"><span>Clean</span><small>Use the restrained MilkFlow canvas without illustrated scenery</small></button>`;
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

window.MilkFlowExperience={manifest:THEME_MANIFEST,current:read,apply,save};
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
