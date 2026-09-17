(() => {
'use strict';

/* First-class visual-theme controller. It owns presentation preference and theme artwork
   only; MilkFlow records, routing and calculations stay with app.js. All updates are tied
   to explicit render/theme events — no MutationObserver and no post-render polling. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['storybook','clean']);
const root=document.documentElement;
const ANIMAL_ASSETS={
  bear:'./assets/animals/bear.svg',
  bunny:'./assets/animals/rabbit.svg',
  fox:'./assets/animals/fox.svg',
  owl:'./assets/animals/owl.svg',
  whale:'./assets/animals/beaver.svg'
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

/* Storybook animals are real SVG assets, but the original inline SVG is retained as a
   fallback. We only hide the fallback after the replacement image has actually loaded,
   so a cache/network failure can never create the empty circles seen in the broken build. */
function decorateThemeArtwork(){
  document.querySelectorAll('.mf-animal-sticker').forEach(sticker=>{
    const kind=Object.keys(ANIMAL_ASSETS).find(k=>sticker.classList.contains(k));
    if(!kind)return;
    let img=sticker.querySelector(':scope > img.mf-storybook-animal');
    if(!img){
      img=document.createElement('img');
      img.className='mf-storybook-animal';
      img.src=ANIMAL_ASSETS[kind];
      img.alt='';
      img.setAttribute('aria-hidden','true');
      img.decoding='async';
      img.draggable=false;
      img.addEventListener('load',()=>sticker.classList.add('has-storybook-art'),{once:true});
      img.addEventListener('error',()=>{
        sticker.classList.remove('has-storybook-art');
        img.remove();
      },{once:true});
      sticker.prepend(img);
    }else if(img.complete&&img.naturalWidth){
      sticker.classList.add('has-storybook-art');
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
        <button type="button" class="mf-experience-option" data-experience-theme-pick="clean" aria-pressed="false">
          <span class="mf-experience-preview clean" aria-hidden="true"><i class="clean"></i></span>
          <span class="mf-experience-copy"><strong>Clean</strong><small>The simpler MilkFlow visual system</small></span>
        </button>
      </div>
      <p class="chart-note">This changes artwork and surfaces only. Pumping, baby-care history, cloud sync and calculations are unchanged.</p>`;
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

apply();
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-experience-theme-pick]');
  if(!btn)return;
  save(btn.dataset.experienceThemePick);
});
window.addEventListener('storage',e=>{if(e.key===KEY)syncThemeUi();});
window.addEventListener('milkflow:base-rendered',()=>{settingsPanel();decorateThemeArtwork();});
window.addEventListener('pageshow',syncThemeUi);
window.addEventListener('hashchange',()=>setTimeout(syncThemeUi,0));
if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',syncThemeUi,{once:true});
else syncThemeUi();
})();
