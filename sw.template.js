// Generated into dist/sw.js by scripts/build.mjs. Do not edit a built sw.js by hand.
const VERSION='milkflow-v__MILKFLOW_VERSION__';
const SHELL=__MILKFLOW_SHELL__;

try{
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');
  if(self.firebase&&!firebase.apps.length){
    firebase.initializeApp({
      apiKey:'AIzaSyAUfC16n_ZSSZtmJZoz2UVfQVbLePu1BvA',
      authDomain:'milkflow-pumping-dashboard.firebaseapp.com',
      projectId:'milkflow-pumping-dashboard',
      storageBucket:'milkflow-pumping-dashboard.firebasestorage.app',
      messagingSenderId:'479317112379',
      appId:'1:479317112379:web:e60993ab8490435d6d0e1e'
    });
  }
  if(self.firebase?.messaging){
    const messaging=firebase.messaging();
    messaging.onBackgroundMessage(payload=>{
      const d=payload?.data||{};
      const route=String(d.route||'baby-home').replace(/^#/,'');
      const url=new URL(`#${route}`,self.registration.scope).href;
      return self.registration.showNotification(d.title||'MilkFlow family update',{
        body:d.body||'New care was logged on another device.',
        icon:'./milkflow-family-v3-192.png',badge:'./milkflow-family-v3-192.png',
        tag:d.alertId||`milkflow-${d.recordId||Date.now()}`,renotify:false,
        data:{url,alertId:d.alertId||''}
      });
    });
  }
}catch(err){console.warn('MilkFlow push messaging unavailable',err?.message||err);}

self.addEventListener('install',event=>{
  event.waitUntil(caches.open(VERSION).then(cache=>Promise.all(SHELL.map(url=>cache.add(url).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
/* This used to be network-first for EVERYTHING: every launch re-fetched index.html, all the
 * stylesheets, all eighteen scripts and the theme artwork, and the cache only came into play
 * when the network failed outright. On a phone that is the pause where the background is
 * painted and nothing else is - the app was effectively not cached at all.
 *
 * Every asset is versioned (?v=<version>) and the cache is named for the version, so a new
 * release always means a new cache and a fresh fetch. That makes cache-first safe for assets.
 * The document itself stays network-first, so a new release is still picked up on launch, and
 * falls back to the cached shell when there is no signal.
 */
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  if(url.origin!==self.location.origin||url.pathname.endsWith('/sw.js'))return;

  if(req.mode==='navigate'){
    event.respondWith(fetch(req).then(res=>{
      if(res&&res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy)).catch(()=>{});}
      return res;
    }).catch(async()=>{
      const hit=await caches.match(req,{ignoreSearch:true});
      if(hit)return hit;
      const shell=await caches.match('./index.html',{ignoreSearch:true});
      return shell||Response.error();
    }));
    return;
  }

  event.respondWith((async()=>{
    const cache=await caches.open(VERSION);
    const hit=await cache.match(req,{ignoreSearch:true});
    const fresh=fetch(req).then(res=>{
      if(res&&res.ok)cache.put(req,res.clone()).catch(()=>{});
      return res;
    }).catch(()=>null);
    if(hit){event.waitUntil(fresh);return hit;}
    const res=await fresh;
    return res||Response.error();
  })());
});
self.addEventListener('notificationclick',event=>{
  event.notification.close();
  const url=event.notification.data?.url||self.registration.scope;
  event.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(async clients=>{
    const scope=new URL(self.registration.scope);
    const existing=clients.find(c=>{try{const u=new URL(c.url);return u.origin===scope.origin&&u.pathname.startsWith(scope.pathname);}catch{return false;}});
    if(existing){try{await existing.navigate(url);}catch{}return existing.focus();}
    return self.clients.openWindow?self.clients.openWindow(url):null;
  }));
});
