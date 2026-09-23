(() => {
'use strict';

/* MilkFlow experience controller.
   One manifest owns visual assets/tokens only. Care data, routing, Firestore,
   notifications and semantic care behavior stay with the canonical app. */
const KEY='milkflow-experience-theme-v1';
const THEMES=new Set(['nocturne','tide','ember','meadow','clean']);
const root=document.documentElement;

/* One explicit asset owns each visual job. Light and dark are separately authored scenes,
   not one scene with its colours swapped.

   Every world is a vector scene now. The previous four shipped painted WebP plates at three
   widths, which is why they needed a width picker - and why dark mode was the light painting
   pushed towards black until the animals disappeared into it. Stars, tide, bioluminescence
   and lit glass are all things a gradient does better than a photograph anyway, and one SVG
   is smaller than the smallest of the three WebPs it replaces. */
const plate=(theme,mode,role)=>`./assets/themes-v2/${theme}/${mode}/${role}.svg`;
const assetSet=theme=>Object.fromEntries(['light','dark'].map(mode=>[mode,{
  babyPage:plate(theme,mode,'baby-background'),
  babyHero:plate(theme,mode,'baby-hero'),
  momPage:plate(theme,mode,'mom-background'),
  momHero:plate(theme,mode,'mom-hero'),
  preview:plate(theme,mode,'settings-preview')
}]));
const THEME_MANIFEST={
  nocturne:{title:'Nocturne',subtitle:'Deep indigo, quiet hours',assets:assetSet('nocturne'),iconSprite:'./assets/theme-icons/nocturne.svg'},
  tide:{title:'Tide',subtitle:'Cool slate, clear water',assets:assetSet('tide'),iconSprite:'./assets/theme-icons/tide.svg'},
  ember:{title:'Ember',subtitle:'Warm charcoal, low light',assets:assetSet('ember'),iconSprite:'./assets/theme-icons/ember.svg'},
  meadow:{title:'Meadow',subtitle:'Soft stone, green shade',assets:assetSet('meadow'),iconSprite:'./assets/theme-icons/meadow.svg'},
  clean:{title:'Clean',subtitle:'Quiet MilkFlow canvas',assets:{light:{},dark:{}},iconSprite:''}
};

/* Care icons are a generated design system: assets/care-icons/<theme>/<action>.svg, built by
   scripts/generate-care-icons.mjs from one semantic base shape per action and one palette per
   theme. The registry answers "which file for this action in the current world" and returns
   null when a combination does not exist, so the caller keeps ownership of its own fallback
   instead of this module reaching into the DOM to patch icons in after render. */
const CARE_ICON_ACTIONS=new Set(['milk','nurse','formula','wet','poop','mixed','pump']);
const CARE_ICON_THEMES=new Set(['nocturne','tide','ember','meadow']);
function careIcon(action,themeName){
  const theme=normalize(themeName===undefined?read():themeName);
  if(!CARE_ICON_ACTIONS.has(action)||!CARE_ICON_THEMES.has(theme))return null;
  return `./assets/care-icons/${theme}/${action}.svg`;
}
/* The world's own signature, for section headers that want theme flavour without implying
   a care action. */
function themeMotif(themeName){
  const theme=normalize(themeName===undefined?read():themeName);
  return CARE_ICON_THEMES.has(theme)?`./assets/care-icons/${theme}/motif.svg`:null;
}

/* Old worlds map to the new one closest in mood, so a family that had chosen something does
   not get silently reset to the default. jungle and storybook are two generations back. */
const RETIRED={jungle:'nocturne',storybook:'nocturne',safari:'nocturne',butterfly:'tide',princess:'ember',unicorn:'meadow',deepspace:'nocturne',aurora:'tide',neonreef:'ember',crystalcity:'meadow'};
function normalize(value){if(RETIRED[value])return RETIRED[value];return THEMES.has(value)?value:'nocturne';}
function read(){try{return normalize(localStorage.getItem(KEY));}catch{return 'nocturne';}}
function assetUrl(path){return path?`url("${path}")`:'none';}
function mode(){return root.dataset.theme==='dark'?'dark':'light';}
function preloadTheme(theme,assets){
  const realm=document.body?.dataset.realm==='baby'?'baby':'mom';
  const sources=realm==='baby'?[assets.babyPage,assets.babyHero,theme.iconSprite]:[assets.momPage,assets.momHero,theme.iconSprite];
  for(const src of sources){if(!src)continue;const img=new Image();img.decoding='async';img.src=src;}
}
/* Both modes are published, and CSS picks - see the resolver at the top of
   experience-system.css.
   Publishing only the resolved scene meant this function had to be re-run at exactly the
   moment the mode changed, and anything that changed data-theme without going through here
   left the plate behind: light mode rendered light cards over the dark artwork. A custom
   property that CSS resolves cannot fall out of step, whoever flips the mode. */
const SCENE_ROLES=[['baby-scene','babyPage'],['baby-hero','babyHero'],['mom-scene','momPage'],['mom-hero','momHero'],['preview','preview']];
function apply(name=read()){
  const value=normalize(name),theme=THEME_MANIFEST[value],assets=theme.assets[mode()]||{};
  root.dataset.experienceTheme=value;
  for(const [token,role] of SCENE_ROLES)
    for(const m of ['light','dark'])
      root.style.setProperty(`--mf-theme-${token}-${m}`,assetUrl(theme.assets[m]?.[role]));
  root.style.setProperty('--mf-icon-sprite',assetUrl(theme.iconSprite));
  root.style.setProperty('--mf-theme-name',JSON.stringify(theme.title));
  root.style.setProperty('--mf-theme-tagline',JSON.stringify(theme.subtitle));
  document.querySelectorAll('[data-theme-card]').forEach(card=>{const img=card.querySelector('img');if(img)img.src=previewFor(card.dataset.themeCard);});
  document.querySelectorAll('[data-experience-theme-pick]').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.experienceThemePick===value)));
  preloadTheme(theme,assets);
  return value;
}
function save(name){const value=normalize(name);try{localStorage.setItem(KEY,value);}catch{}apply(value);window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:value}}));}
function previewFor(key){return THEME_MANIFEST[key].assets[mode()].preview;}
function themeCard(key,title,subtitle){return `<button type="button" class="mf-experience-option" data-experience-theme-pick="${key}" data-theme-card="${key}" aria-pressed="false"><span class="mf-experience-preview" aria-hidden="true"><img class="mf-preview-scene" src="${previewFor(key)}" alt="" decoding="async" loading="lazy"></span><span class="mf-experience-copy"><strong>${title}</strong><small>${subtitle}</small></span></button>`;}
function themeCards(){return `${themeCard('nocturne','Nocturne','Deep indigo, quiet hours')}${themeCard('tide','Tide','Cool slate, clear water')}${themeCard('ember','Ember','Warm charcoal, low light')}${themeCard('meadow','Meadow','Soft stone, green shade')}`;}
/* The theme picker used to be injected into the Settings landing page AND into Appearance,
   with a separate Dark Mode row next to it - three places to change how the app looks, two of
   them saying the same thing. It lives on Appearance only now, beside the light/dark control,
   so there is one screen that owns the look. */
function experiencePanel(){
  const screen=document.body.dataset.screen;
  if(screen!=='set-appearance')return;
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
  const screen=document.body.dataset.screen;
  if(screen!=='settings'&&screen!=='set-appearance')return;
  const view=document.getElementById('view');if(!view)return;
  const head=view.querySelector('.page-head');
  if(screen==='settings'&&head&&!head.querySelector('.mf-settings-subtitle')){
    const sub=document.createElement('p');sub.className='mf-settings-subtitle';sub.textContent='Make this little adventure yours';head.appendChild(sub);
    const mark=document.createElement('span');mark.className='mf-settings-corner-art';mark.setAttribute('aria-hidden','true');head.appendChild(mark);
  }
  /* Dark Mode and Sounds belong with the world picker on Appearance - they are all "how the
     app looks and feels". Reminders and the profile stay in the Settings list, where they are
     already rows; showing them twice was half of why Settings felt duplicated. */
  if(screen==='set-appearance'&&!document.getElementById('mfSettingsShortcuts')){
    const dark=root.dataset.theme==='dark';
    const section=document.createElement('section');section.id='mfSettingsShortcuts';section.className='panel mf-settings-shortcuts';
    const sounds=localStorage.getItem('milkflow-interface-sounds-v1')!=='off';
    section.innerHTML=`<button type="button" class="mf-settings-row" data-theme-pick="${dark?'light':'dark'}"><span class="mf-settings-row-icon moon" aria-hidden="true"></span><span><strong>Dark Mode</strong><small>A calmer view for nighttime</small></span><i class="mf-settings-switch ${dark?'on':''}" aria-hidden="true"></i></button><button type="button" class="mf-settings-row" data-sound-toggle aria-pressed="${sounds}"><span class="mf-settings-row-icon sound" aria-hidden="true"></span><span><strong>Sounds</strong><small>Gentle interface feedback</small></span><i class="mf-settings-switch ${sounds?'on':''}" aria-hidden="true"></i></button>`;
    const anchor=document.getElementById('mfExperiencePanel');
    if(anchor)anchor.insertAdjacentElement('afterend',section);
    else view.querySelector('.page-head')?.insertAdjacentElement('afterend',section);
  }
  if(screen==='set-appearance'&&!document.getElementById('mfSettingsMotto')){
    const note=document.createElement('div');note.id='mfSettingsMotto';note.className='mf-settings-motto';note.innerHTML='<span aria-hidden="true">⌁</span><strong>Different themes.<br>The same brighter tomorrows.</strong><i aria-hidden="true">♡</i>';
    document.getElementById('mfSettingsShortcuts')?.insertAdjacentElement('afterend',note);
  }
}
function syncThemeUi(){apply();experiencePanel();settingsExtras();}
let queued=false;
function afterCanonicalRender(){if(queued)return;queued=true;queueMicrotask(()=>requestAnimationFrame(()=>{queued=false;syncThemeUi();}));}

window.MilkFlowExperience={manifest:THEME_MANIFEST,current:read,apply,save,careIcon,themeMotif,careIconActions:[...CARE_ICON_ACTIONS]};
apply();
/* app.js renders its first screen at the end of its own execution, and this file loads after
   it - so that first paint asks for careIcon() before the registry exists and falls back to a
   plain glyph. apply() alone does not fix that, because only save() announces a change, and
   on a cold start nobody saves. Announce once on load so the canonical render picks up the
   illustrated icons instead of leaving the Mom tiles on fallback glyphs until the next
   interaction. Everything listening is idempotent, so this costs one extra render at boot. */
window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{reason:'registry-ready'}}));
document.addEventListener('click',e=>{const btn=e.target.closest('[data-experience-theme-pick]');if(btn)save(btn.dataset.experienceThemePick);if(e.target.closest('[data-theme-pick]'))setTimeout(afterCanonicalRender,0);const sound=e.target.closest('[data-sound-toggle]');if(sound){const enabled=sound.getAttribute('aria-pressed')!=='true';localStorage.setItem('milkflow-interface-sounds-v1',enabled?'on':'off');sound.setAttribute('aria-pressed',String(enabled));sound.querySelector('.mf-settings-switch')?.classList.toggle('on',enabled);}});
window.addEventListener('storage',e=>{if(e.key===KEY)afterCanonicalRender();});
window.addEventListener('milkflow:base-rendered',afterCanonicalRender);
window.addEventListener('milkflow:experience-theme-change',afterCanonicalRender);
window.addEventListener('pageshow',afterCanonicalRender);
window.addEventListener('hashchange',afterCanonicalRender);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',afterCanonicalRender,{once:true});else afterCanonicalRender();
})();
