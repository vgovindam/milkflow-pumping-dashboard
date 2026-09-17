(() => {
'use strict';

/* MilkFlow experience controller.
   One manifest owns visual assets/tokens only. Care data, routing, Firestore,
   notifications and semantic care behavior stay with the canonical app. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['safari','butterfly','princess','unicorn','clean']);
const root=document.documentElement;

/* Base scene SVGs are self-contained files, so they render reliably both as CSS
   backgrounds and <img> previews on iOS. The tall detail layer supplies the extra
   theme-specific characters/decor (monkey/parrot/butterflies/royal/dream accents)
   without using an SVG that depends on nested external <image> resources. */
const THEME_MANIFEST={
  safari:{title:'Safari Adventure',subtitle:'Wild days, bigger dreams',base:'./assets/themes/safari-world.svg',detail:'./assets/theme-details/safari.svg',iconSprite:'./assets/theme-icons/safari.svg'},
  butterfly:{title:'Butterfly Garden',subtitle:'Little moments, big magic',base:'./assets/themes/butterfly-garden.svg',detail:'./assets/theme-details/butterfly.svg',iconSprite:'./assets/theme-icons/butterfly.svg'},
  princess:{title:'Princess Palace',subtitle:'Kind hearts change the world',base:'./assets/themes/princess-palace.svg',detail:'./assets/theme-details/princess.svg',iconSprite:'./assets/theme-icons/princess.svg'},
  unicorn:{title:'Unicorn Dreams',subtitle:'Believe in brighter tomorrows',base:'./assets/themes/unicorn-dreams.svg',detail:'./assets/theme-details/unicorn.svg',iconSprite:'./assets/theme-icons/unicorn.svg'},
  clean:{title:'Clean',subtitle:'Quiet MilkFlow canvas',base:'',detail:'',iconSprite:''}
};

function normalize(value){if(value==='jungle'||value==='storybook')return 'safari';return THEMES.has(value)?value:'safari';}
function read(){try{return normalize(localStorage.getItem(KEY));}catch{return 'safari';}}
function assetUrl(path){return path?`url("${path}")`:'none';}
function preloadTheme(theme){for(const src of [theme.base,theme.detail,theme.iconSprite]){if(!src)continue;const img=new Image();img.decoding='async';img.src=src;}}
function apply(name=read()){
  const value=normalize(name),theme=THEME_MANIFEST[value];
  root.dataset.experienceTheme=value;
  root.style.setProperty('--mf-theme-art',assetUrl(theme.base));
  root.style.setProperty('--mf-theme-baby-scene',assetUrl(theme.base));
  root.style.setProperty('--mf-theme-mom-scene',assetUrl(theme.base));
  root.style.setProperty('--mf-theme-detail',assetUrl(theme.detail));
  root.style.setProperty('--mf-icon-sprite',assetUrl(theme.iconSprite));
  root.style.setProperty('--mf-theme-name',JSON.stringify(theme.title));
  root.style.setProperty('--mf-theme-tagline',JSON.stringify(theme.subtitle));
  document.querySelectorAll('[data-experience-theme-pick]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.experienceThemePick===value)));
  preloadTheme(theme);
  return value;
}
function save(name){const value=normalize(name);try{localStorage.setItem(KEY,value);}catch{}apply(value);window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:value}}));}
function themeCard(key,title,subtitle,base,detail){return `<button type="button" class="mf-experience-option" data-experience-theme-pick="${key}" data-theme-card="${key}" aria-pressed="false"><span class="mf-experience-preview" aria-hidden="true"><img class="mf-preview-base" src="${base}" alt="" decoding="async" loading="eager"><img class="mf-preview-detail" src="${detail}" alt="" decoding="async" loading="eager"></span><span class="mf-experience-copy"><strong>${title}</strong><small>${subtitle}</small></span></button>`;}
function themeCards(){return `${themeCard('safari','Safari Adventure','Wild days, bigger dreams','./assets/themes/safari-world.svg','./assets/theme-details/safari.svg')}${themeCard('butterfly','Butterfly Garden','Little moments, big magic','./assets/themes/butterfly-garden.svg','./assets/theme-details/butterfly.svg')}${themeCard('princess','Princess Palace','Kind hearts change the world','./assets/themes/princess-palace.svg','./assets/theme-details/princess.svg')}${themeCard('unicorn','Unicorn Dreams','Believe in brighter tomorrows','./assets/themes/unicorn-dreams.svg','./assets/theme-details/unicorn.svg')}`;}
function experiencePanel(){
  const screen=document.body.dataset.screen;
  if(screen!=='settings'&&screen!=='set-appearance')return;
  const view=document.getElementById('view');if(!view)return;
  let panel=document.getElementById('mfExperiencePanel');
  if(!panel){
    panel=document.createElement('section');panel.id='mfExperiencePanel';panel.className=`panel mf-experience-panel ${screen==='settings'?'mf-settings-theme-panel':''}`;
    const isSettings=screen==='settings';
    panel.innerHTML=`<div class="mf-experience-intro"><div><h3>${isSettings?'Choose a theme':'Choose your family world'}</h3><p>${isSettings?'Pick a look that feels like home for your little one.':'The selected world is used by the real Mom and Baby pages, not only the preview.'}</p></div>${isSettings?'':'<span class="mf-experience-scope">Mom + Baby</span>'}</div><div class="mf-experience-options" role="group" aria-label="Experience theme">${themeCards()}</div>${isSettings?'':`<button type="button" class="mf-experience-clean" data-experience-theme-pick="clean" aria-pressed="false"><span>Clean</span><small>Use the restrained MilkFlow canvas without illustrated scenery</small></button>`}`;
    const head=view.querySelector('.page-head');if(head)head.insertAdjacentElement('afterend',panel);else view.prepend(panel);
  }
  apply();
}
function settingsExtras(){
  if(document.body.dataset.screen!=='settings')return;
  const view=document.getElementById('view');if(!view)return;
  const head=view.querySelector('.page-head');
  if(head&&!head.querySelector('.mf-settings-subtitle')){
    const sub=document.createElement('p');sub.className='mf-settings-subtitle';sub.textContent='Make this little adventure yours';head.appendChild(sub);
    const mark=document.createElement('span');mark.className='mf-settings-corner-art';mark.setAttribute('aria-hidden','true');head.appendChild(mark);
  }
  if(!document.getElementById('mfSettingsShortcuts')){
    const dark=root.dataset.theme==='dark';
    const section=document.createElement('section');section.id='mfSettingsShortcuts';section.className='panel mf-settings-shortcuts';
    section.innerHTML=`<button type="button" class="mf-settings-row" data-theme-pick="${dark?'light':'dark'}"><span class="mf-settings-row-icon moon" aria-hidden="true"></span><span><strong>Dark Mode</strong><small>A calmer view for nighttime</small></span><i class="mf-settings-switch ${dark?'on':''}" aria-hidden="true"></i></button><button type="button" class="mf-settings-row" data-view="set-reminders"><span class="mf-settings-row-icon bell" aria-hidden="true"></span><span><strong>Reminders</strong><small>Feeding, pumping and more</small></span><b aria-hidden="true">›</b></button><button type="button" class="mf-settings-row" data-view="set-baby"><span class="mf-settings-row-icon profile" aria-hidden="true"></span><span><strong>Profile &amp; Personalization</strong><small>Your little one’s details</small></span><b aria-hidden="true">›</b></button><button type="button" class="mf-settings-row" data-view="set-account"><span class="mf-settings-row-icon family" aria-hidden="true"></span><span><strong>Family account</strong><small>Sync safely across your devices</small></span><b aria-hidden="true">›</b></button>`;
    document.getElementById('mfExperiencePanel')?.insertAdjacentElement('afterend',section);
  }
  if(!document.getElementById('mfSettingsMotto')){
    const note=document.createElement('div');note.id='mfSettingsMotto';note.className='mf-settings-motto';note.innerHTML='<span aria-hidden="true">⌁</span><strong>Different themes.<br>The same brighter tomorrows.</strong><i aria-hidden="true">♡</i>';
    document.getElementById('mfSettingsShortcuts')?.insertAdjacentElement('afterend',note);
  }
}
function syncThemeUi(){apply();experiencePanel();settingsExtras();}
let queued=false;
function afterCanonicalRender(){if(queued)return;queued=true;queueMicrotask(()=>requestAnimationFrame(()=>{queued=false;syncThemeUi();}));}

window.MilkFlowExperience={manifest:THEME_MANIFEST,current:read,apply,save};
apply();
document.addEventListener('click',e=>{const btn=e.target.closest('[data-experience-theme-pick]');if(btn)save(btn.dataset.experienceThemePick);});
window.addEventListener('storage',e=>{if(e.key===KEY)afterCanonicalRender();});
window.addEventListener('milkflow:base-rendered',afterCanonicalRender);
window.addEventListener('milkflow:experience-theme-change',afterCanonicalRender);
window.addEventListener('pageshow',afterCanonicalRender);
window.addEventListener('hashchange',afterCanonicalRender);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterCanonicalRender,{once:true});else afterCanonicalRender();
})();
