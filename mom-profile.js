(() => {
'use strict';

const STATE_KEY='milkflow-family-v4-state';
let timer=null,observing=false;

const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
function read(){try{return JSON.parse(localStorage.getItem(STATE_KEY)||'{}')||{};}catch{return {};}}
function write(s){s.savedAt=Date.now();localStorage.setItem(STATE_KEY,JSON.stringify(s));window.dispatchEvent(new StorageEvent('storage',{key:STATE_KEY,newValue:JSON.stringify(s)}));}
function photoPlaceholder(){return `<svg class="mf-mom-photo-empty" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="24" r="10"/><path d="M14 52c2.4-10 9-15 18-15s15.6 5 18 15"/><path d="M48 13v10M43 18h10"/></svg>`;}

function style(){if(document.getElementById('mfMomPhotoStyles'))return;const x=document.createElement('style');x.id='mfMomPhotoStyles';x.textContent=`
.mf-mom-photo-card{margin-top:14px;padding:16px;border:1px solid var(--line-soft,var(--line));border-radius:20px;background:var(--surface);box-shadow:none}
.mf-mom-photo-row{display:flex;align-items:center;gap:14px}.mf-mom-photo{width:76px;height:76px;border-radius:22px;overflow:hidden;display:grid;place-items:center;background:var(--surface-2);color:var(--muted);flex:0 0 auto;border:1px solid var(--line-soft)}.mf-mom-photo img{width:100%;height:100%;object-fit:cover;display:block}.mf-mom-photo-empty{width:42px;height:42px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;opacity:.75}.mf-mom-photo-actions{display:flex;flex-wrap:wrap;gap:7px;align-items:center}.mf-mom-photo-actions button{min-height:40px;border:0;border-radius:12px;background:var(--surface-2);color:var(--ink);padding:0 12px;font:inherit;font-size:.76rem;font-weight:800}.mf-mom-photo-card small{display:block;color:var(--muted);font-size:.69rem;line-height:1.4;margin-top:7px}
.mf-mom-avatar{width:54px;height:54px;border-radius:19px;overflow:hidden;display:grid;place-items:center;background:transparent;flex:0 0 auto}.mf-mom-avatar img{width:100%;height:100%;object-fit:cover;display:block}
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

function settingsCard(s){const p=s.profile||{},photo=p.momPhoto||'';return `<section id="mfMomPhotoCard" class="mf-mom-photo-card"><div class="mf-mom-photo-row"><div class="mf-mom-photo">${photo?`<img src="${esc(photo)}" alt="Mom profile">`:photoPlaceholder()}</div><div><strong>Mom photo</strong><div class="mf-mom-photo-actions"><button type="button" data-mf-mom-photo>${photo?'Change photo':'Add photo'}</button>${photo?'<button type="button" data-mf-mom-photo-clear>Remove</button>':''}</div><small>Optional. If you add one, it appears on Mom home and syncs with the family account.</small></div></div></section>`;}

function render(){
  style();const s=read(),view=document.getElementById('view');if(!view)return;
  const existing=document.getElementById('mfMomPhotoCard');
  if(location.hash==='#set-baby'){
    const profileRow=view.querySelector('.profile-row');
    if(profileRow){const anchor=profileRow.closest('section')||profileRow.parentElement;const wrap=document.createElement('div');wrap.innerHTML=settingsCard(s);if(existing)existing.replaceWith(wrap.firstElementChild);else anchor.insertAdjacentElement('afterend',wrap.firstElementChild);}
  }else existing?.remove();

  const hero=view.querySelector('.mom-hero');
  const old=document.getElementById('mfMomAvatar');
  const photo=s.profile?.momPhoto||'';
  if(hero&&location.hash==='#mom-home'&&photo){
    const node=document.createElement('div');node.id='mfMomAvatar';node.className='mf-mom-avatar';node.innerHTML=`<img src="${esc(photo)}" alt="Mom profile">`;
    if(old)old.replaceWith(node);else hero.appendChild(node);
  }else old?.remove();
}
function renderSoon(){clearTimeout(timer);timer=setTimeout(render,80);}

document.addEventListener('click',e=>{if(e.target.closest('[data-mf-mom-photo]'))choose();if(e.target.closest('[data-mf-mom-photo-clear]'))savePhoto('');});
window.addEventListener('storage',e=>{if(e.key===STATE_KEY)renderSoon();});window.addEventListener('hashchange',renderSoon);window.addEventListener('pageshow',renderSoon);
function mount(){if(observing)return;observing=true;const v=document.getElementById('view');if(v)new MutationObserver(renderSoon).observe(v,{childList:true,subtree:true});renderSoon();}
if(document.readyState==='loading')window.addEventListener('DOMContentLoaded',mount);else mount();
})();
