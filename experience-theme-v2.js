(() => {
'use strict';
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['safari','butterfly','princess','unicorn','clean']);
const root=document.documentElement;
const SAFARI_ASSETS={bear:'./assets/animals/elephant.svg',bunny:'./assets/animals/monkey.svg',fox:'./assets/animals/tiger.svg',owl:'./assets/animals/parrot.svg',whale:'./assets/animals/hippo.svg'};
function normalize(value){if(value==='jungle'||value==='storybook')return'safari';return THEMES.has(value)?value:'safari';}
function read(){try{return normalize(localStorage.getItem(KEY));}catch{return'safari';}}
function apply(name=read()){const value=normalize(name);root.dataset.experienceTheme=value;document.querySelectorAll('[data-experience-theme-pick]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.experienceThemePick===value)));return value;}
function save(name){const value=normalize(name);try{localStorage.setItem(KEY,value);}catch{}apply(value);decorateThemeArtwork();window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:value}}));}
function decorateThemeArtwork(){
  const theme=normalize(root.dataset.experienceTheme||read());
  document.querySelectorAll('.mf-animal-sticker').forEach(sticker=>{
    const kind=['bear','bunny','fox','owl','whale'].find(k=>sticker.classList.contains(k));if(!kind)return;
    let img=sticker.querySelector(':scope > img.mf-theme-animal');sticker.classList.remove('has-storybook-art','has-jungle-art','has-theme-art');
    if(theme!=='safari'){img?.remove();return;}
    const wanted=SAFARI_ASSETS[kind];if(!img){img=document.createElement('img');img.className='mf-theme-animal';img.alt='';img.setAttribute('aria-hidden','true');img.decoding='async';img.loading='eager';img.draggable=false;sticker.prepend(img);}
    const activate=()=>{if(img.dataset.asset!==wanted||normalize(root.dataset.experienceTheme)!=='safari')return;sticker.classList.add('has-theme-art','has-jungle-art');};
    const fail=()=>sticker.classList.remove('has-theme-art','has-jungle-art');
    if(img.dataset.asset!==wanted){img.dataset.asset=wanted;img.onload=activate;img.onerror=fail;img.src=wanted;if(img.complete&&img.naturalWidth)activate();}else if(img.complete&&img.naturalWidth)activate();
  });
}
function themeCard(key,title,subtitle,src){return `<button type="button" class="mf-experience-option" data-experience-theme-pick="${key}" aria-pressed="false"><span class="mf-experience-preview" aria-hidden="true"><img src="${src}" alt="" decoding="async" loading="eager"></span><span class="mf-experience-copy"><strong>${title}</strong><small>${subtitle}</small></span></button>`;}
function settingsPanel(){
  if(document.body.dataset.screen!=='set-appearance')return;const view=document.getElementById('view');if(!view)return;let panel=document.getElementById('mfExperiencePanel');
  if(!panel){panel=document.createElement('section');panel.id='mfExperiencePanel';panel.className='panel mf-experience-panel';panel.innerHTML=`<div class="mf-experience-intro"><h3>Choose a theme</h3><p>Pick a world that feels right for your little one.</p></div><div class="mf-experience-options" role="group" aria-label="Experience theme">${themeCard('safari','Safari Adventure','Wild days, bigger dreams','./assets/themes/safari-adventure.svg')}${themeCard('butterfly','Butterfly Garden','Little moments, big magic','./assets/themes/butterfly-garden.svg')}${themeCard('princess','Princess Palace','Kind hearts, magical days','./assets/themes/princess-palace.svg')}${themeCard('unicorn','Unicorn Dreams','Believe in brighter tomorrows','./assets/themes/unicorn-dreams.svg')}</div><button type="button" class="mf-experience-clean" data-experience-theme-pick="clean" aria-pressed="false"><span>Minimal</span><small>Keep MilkFlow calm and simple</small></button>`;const firstPanel=view.querySelector('.panel');if(firstPanel)firstPanel.insertAdjacentElement('beforebegin',panel);else view.appendChild(panel);}
  apply();
}
function syncThemeUi(){apply();settingsPanel();decorateThemeArtwork();}
let queued=false;function afterCanonicalRender(){if(queued)return;queued=true;queueMicrotask(()=>requestAnimationFrame(()=>{queued=false;syncThemeUi();}));}
apply();document.addEventListener('click',e=>{const btn=e.target.closest('[data-experience-theme-pick]');if(btn)save(btn.dataset.experienceThemePick);});window.addEventListener('storage',e=>{if(e.key===KEY)afterCanonicalRender();});window.addEventListener('milkflow:base-rendered',afterCanonicalRender);window.addEventListener('milkflow:experience-theme-change',afterCanonicalRender);window.addEventListener('pageshow',afterCanonicalRender);window.addEventListener('hashchange',afterCanonicalRender);if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterCanonicalRender,{once:true});else afterCanonicalRender();
})();