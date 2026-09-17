(() => {
'use strict';

/* First-class visual-theme controller. It owns presentation preference and theme artwork
   only; MilkFlow records, routing, forms and calculations stay with app.js. Theme modules
   are explicit and switchable - no DOM-wide observers and no post-render polling. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['storybook','jungle','clean']);
const root=document.documentElement;
const ASSETS={
  storybook:{
    bear:'./assets/animals/bear.svg',
    bunny:'./assets/animals/rabbit.svg',
    fox:'./assets/animals/fox.svg',
    owl:'./assets/animals/owl.svg',
    whale:'./assets/animals/beaver.svg'
  },
  jungle:{
    bear:'./assets/animals/elephant.svg',
    bunny:'./assets/animals/monkey.svg',
    fox:'./assets/animals/tiger.svg',
    owl:'./assets/animals/parrot.svg',
    whale:'./assets/animals/hippo.svg'
  }
};

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
  decorateThemeArtwork();
  window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:name}}));
}

/* The original inline animal SVG is always retained as a functional fallback. A themed
   SVG is allowed to replace it only after the image has loaded successfully. Switching
   themes clears the previous ready state until the new asset is ready, so blank circles
   are impossible even with a stale PWA cache. */
function decorateThemeArtwork(){
  const theme=THEMES.has(root.dataset.experienceTheme)?root.dataset.experienceTheme:read();
  const themeAssets=ASSETS[theme]||null;
  document.querySelectorAll('.mf-animal-sticker').forEach(sticker=>{
    const kind=['bear','bunny','fox','owl','whale'].find(k=>sticker.classList.contains(k));
    if(!kind)return;
    let img=sticker.querySelector(':scope > img.mf-theme-animal');
    sticker.classList.remove('has-storybook-art','has-jungle-art','has-theme-art');

    if(!themeAssets){
      img?.remove();
      return;
    }

    const wanted=themeAssets[kind];
    if(!img){
      img=document.createElement('img');
      // mf-storybook-animal is retained as a compatibility hook for the existing Storybook
      // contract; mf-theme-animal is the generic contract used by all visual themes.
      img.className='mf-theme-animal mf-storybook-animal';
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.decoding='async';
      img.loading='eager';
      try{img.fetchPriority='high';}catch{}
      img.draggable=false;
      sticker.prepend(img);
    }

    const activate=()=>{
      if(img.dataset.asset!==wanted || root.dataset.experienceTheme!==theme)return;
      sticker.classList.add('has-theme-art');
      sticker.classList.add(theme==='jungle'?'has-jungle-art':'has-storybook-art');
    };
    const fail=()=>{
      sticker.classList.remove('has-theme-art','has-storybook-art','has-jungle-art');
    };

    if(img.dataset.asset!==wanted){
      img.dataset.asset=wanted;
      img.onload=activate;
      img.onerror=fail;
      img.src=wanted;
      // Safari can report a cached SVG as complete without dispatching a new load event.
      if(img.complete&&img.naturalWidth)activate();
    }else if(img.complete&&img.naturalWidth){
      activate();
    }
  });
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
          <span class="mf-experience-copy"><strong>Storybook</strong><small>Cloud Island for Mom · Woodland Forest for Baby</small></span>
        </button>
        <button type="button" class="mf-experience-option" data-experience-theme-pick="jungle" aria-pressed="false">
          <span class="mf-experience-preview jungle" aria-hidden="true"><i class="mom"></i><i class="baby"></i></span>
          <span class="mf-experience-copy"><strong>Jungle</strong><small>Cloud Island for Mom · Jungle Canopy for Baby</small></span>
        </button>
        <button type="button" class="mf-experience-option" data-experience-theme-pick="clean" aria-pressed="false">
          <span class="mf-experience-preview clean" aria-hidden="true"><i class="clean"></i></span>
          <span class="mf-experience-copy"><strong>Clean</strong><small>The restrained MilkFlow visual system</small></span>
        </button>
      </div>
      <p class="chart-note">Experience themes change artwork and surfaces only. Pumping, baby-care history, doctor reports, cloud sync and calculations are unchanged.</p>`;
    const firstPanel=view.querySelector('.panel');
    if(firstPanel) firstPanel.insertAdjacentElement('beforebegin',panel);
    else view.appendChild(panel);
  }
  apply();
}

function syncThemeUi(){
  apply();
  settingsPanel();
  decorateThemeArtwork();
}

/* app.js renders first and core-ui.js intentionally finishes its canonical home composition
   in a microtask. Theme art must run after that composition, otherwise the freshly-created
   animal cards replace the themed images. This is an explicit render phase, not polling. */
let postRenderQueued=false;
function afterCanonicalRender(){
  if(postRenderQueued)return;
  postRenderQueued=true;
  queueMicrotask(()=>requestAnimationFrame(()=>{
    postRenderQueued=false;
    syncThemeUi();
  }));
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
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',afterCanonicalRender,{once:true});
else afterCanonicalRender();
})();