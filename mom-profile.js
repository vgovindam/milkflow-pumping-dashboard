(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
let timer=null,observing=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function write(s){s.savedAt=Date.now();localStorage.setItem(STATE_KEY,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(s)}));}
function momSticker(){return `<svg class="mf-mom-sticker-svg" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="mfMomG" x1="7" y1="7" x2="56" y2="58" gradientUnits="userSpaceOnUse"><stop stop-color="#ffd8ec"/><stop offset=".48" stop-color="#d9c7ff"/><stop offset="1" stop-color="#b8e7ff"/></linearGradient><linearGradient id="mfMomH" x1="18" y1="17" x2="45" y2="49" gradientUnits="userSpaceOnUse"><stop stop-color="#8f63e6"/><stop offset="1" stop-color="#c15fa5"/></linearGradient></defs><path d="M32 5.5c6.8 0 10.3 4.9 12.1 10.3 5.6.4 10.5 4.5 10.5 10.2 0 4.6-2.8 7.9-6.7 10.1.3 6.3-4.4 12.1-10.8 12.7-3.6 5.2-10.8 6.8-16 2.8-5.8.5-11-3.7-11.7-9.5C4.5 39.5 2.5 33.3 5.2 28c-2-5.6.8-11.8 6.2-14.1C13.3 8.7 19 5.5 24.6 7.1A14.5 14.5 0 0 1 32 5.5Z" fill="url(#mfMomG)" stroke="rgba(255,255,255,.92)" stroke-width="3"/><path d="M32 45.8 18.4 32.7c-5.6-5.5-1.7-15 6.1-15 3 0 5.8 1.5 7.5 4 1.7-2.5 4.5-4 7.5-4 7.8 0 11.7 9.5 6.1 15L32 45.8Z" fill="url(#mfMomH)"/><path d="m47.5 11.5 1.5 3.9 3.9 1.5-3.9 1.5-1.5 3.9-1.5-3.9-3.9-1.5 3.9-1.5 1.5-3.9ZM15.2 42.8l1 2.7 2.7 1-2.7 1-1 2.7-1-2.7-2.7-1 2.7-1 1-2.7Z" fill="#fff" opacity=".95"/></svg>`;}

function style(){if(document.getElementById('mfMomPhotoStyles'))return;const x=document.createElement('style');x.id='mfMomPhotoStyles';x.textContent=`
.mf-mom-photo-card{margin-top:14px;padding:15px;border:1px solid var(--line-soft,var(--line));border-radius:22px;background:linear-gradient(145deg,var(--surface),color-mix(in srgb,var(--mom-soft) 55%,var(--surface)));box-shadow:var(--shadow-soft)}
.mf-mom-photo-row{display:flex;align-items:center;gap:13px}.mf-mom-photo{width:76px;height:76px;border-radius:24px;overflow:hidden;display:grid;place-items:center;background:transparent;flex:0 0 auto}.mf-mom-photo img{width:100%;height:100%;object-fit:cover;border-radius:24px;border:3px solid rgba(255,255,255,.86);box-shadow:0 10px 22px rgba(74,49,126,.16)}.mf-mom-photo-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.mf-mom-photo-actions button{min-height:40px;border:1px solid var(--line-soft,var(--line));border-radius:13px;background:var(--surface);color:var(--ink);padding:0 12px;font:inherit;font-size:.76rem;font-weight:800;box-shadow:var(--shadow-soft)}.mf-mom-photo-card small{display:block;color:var(--muted);font-size:.69rem;line-height:1.4;margin-top:7px}
.mf-mom-avatar{width:50px;height:50px;border-radius:18px;overflow:hidden;display:grid;place-items:center;background:transparent;flex:0 0 auto;margin-bottom:8px}.mf-mom-avatar img{width:100%;height:100%;object-fit:cover;border-radius:18px;border:2px solid rgba(255,255,255,.86);box-shadow:0 8px 20px rgba(74,49,126,.18)}.mf-mom-sticker-svg{width:100%;height:100%;display:block;filter:drop-shadow(0 8px 10px rgba(77,49,129,.18))}
`;document.head.appendChild(x);}

async function sync(profile){
  try{
    const user=window.firebase?.auth?.().currentUser;if(!user||!window.firebase?.firestore)return;
    await firebase.firestore().collection('users').doc(user.uid).collection('private').doc('profile').set({profile},{merge:true});
  }catch(err){console.warn('Mom photo cloud sync deferred',err?.message||err);}
}
function savePhoto(data){const s=read();s.profile={...(s.profile||{}),momPhoto:data};write(s);sync(s.profile);renderSoon();}

function choose(){let input=document.getElementById('mfMomPhotoFile');if(!input){input=document.createElement('input');input.type='file';input.accept='image/*';input.id='mfMomPhotoFile';input.hidden=true;document.body.appendChild(input);input.addEventListener('change',e=>{const f=e.target.files?.[0];e.target.value='';if(f)readPhoto(f);});}input.click();}
function readPhoto(file){
  if(!/^image\//.test(file.type||''))return;
  const r=new FileReader();r.onload=()=>{const img=new Image();img.onload=()=>{const c=document.createElement('canvas'),size=320;c.width=c.height=size;const ctx=c.getContext('2d'),side=Math.min(img.width,img.height);ctx.drawImage(img,(img.width-side)/2,(img.height-side)/2,side,side,0,0,size,size);savePhoto(c.toDataURL('image/jpeg',.82));};img.src=r.result;};r.readAsDataURL(file);
}

function settingsCard(s){const p=s.profile||{},photo=p.momPhoto||'';return `<section id="mfMomPhotoCard" class="mf-mom-photo-card"><div class="mf-mom-photo-row"><div class="mf-mom-photo">${photo?`<img src="${esc(photo)}" alt="Mom profile">`:momSticker()}</div><div><strong>Mom photo</strong><div class="mf-mom-photo-actions"><button type="button" data-mf-mom-photo>${photo?'Change photo':'Add photo'}</button>${photo?'<button type="button" data-mf-mom-photo-clear>Remove</button>':''}</div><small>Shown on Mom home and saved with the family profile.</small></div></div></section>`;}

function render(){
  style();const s=read(),view=document.getElementById('view');if(!view)return;
  const existing=document.getElementById('mfMomPhotoCard');
  if(location.hash==='#set-baby'){
    const profileRow=view.querySelector('.profile-row');
    if(profileRow){const anchor=profileRow.closest('section')||profileRow.parentElement;if(!existing){const wrap=document.createElement('div');wrap.innerHTML=settingsCard(s);anchor.insertAdjacentElement('afterend',wrap.firstElementChild);}else{const wrap=document.createElement('div');wrap.innerHTML=settingsCard(s);existing.replaceWith(wrap.firstElementChild);}}
  }else existing?.remove();

  const hero=view.querySelector('.mom-hero .hero-copy');
  const old=document.getElementById('mfMomAvatar');
  if(hero&&location.hash==='#mom-home'){
    const p=s.profile||{},photo=p.momPhoto||'';
    const node=document.createElement('div');node.id='mfMomAvatar';node.className='mf-mom-avatar';node.innerHTML=photo?`<img src="${esc(photo)}" alt="Mom profile">`:momSticker();
    if(old)old.replaceWith(node);else hero.prepend(node);
  }else old?.remove();
}
function renderSoon(){clearTimeout(timer);timer=setTimeout(render,80);}

document.addEventListener('click',e=>{if(e.target.closest('[data-mf-mom-photo]'))choose();if(e.target.closest('[data-mf-mom-photo-clear]'))savePhoto('');});
window.addEventListener('storage',e=>{if(e.key===STATE_KEY)renderSoon();});window.addEventListener('hashchange',renderSoon);window.addEventListener('pageshow',renderSoon);
function mount(){if(observing)return;observing=true;const v=document.getElementById('view');if(v)new MutationObserver(renderSoon).observe(v,{childList:true,subtree:true});renderSoon();}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
