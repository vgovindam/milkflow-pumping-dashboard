(() => {
'use strict';

function renderReleaseInfo(){
  if(document.body.dataset.screen!=='set-about')return;
  const view=document.getElementById('view');
  if(!view||document.getElementById('mfReleaseInfo'))return;
  const build=window.MILKFLOW_BUILD||{};
  const version=String(build.version||'dev');
  const commit=String(build.commit||'local').slice(0,8);
  const panel=document.createElement('section');
  panel.id='mfReleaseInfo';
  panel.className='panel';
  panel.innerHTML=`<div class="panel-head"><h3>Release</h3><span class="panel-note">Production identity</span></div><div class="setting-row"><div><strong>MilkFlow ${version}</strong><span>Build ${commit}</span></div></div>`;
  view.appendChild(panel);
}

window.addEventListener('milkflow:base-rendered',renderReleaseInfo);
window.addEventListener('pageshow',renderReleaseInfo);
window.addEventListener('hashchange',renderReleaseInfo);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',renderReleaseInfo,{once:true});else renderReleaseInfo();
})();
