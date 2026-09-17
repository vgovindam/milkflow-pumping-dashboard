// MilkFlow service worker.
// Network-first app shell; Firestore/Firebase traffic is left to Firebase.
const VERSION = 'milkflow-stable45-human13';
const SHELL = [
  './', './index.html', './styles.css', './component-theme.css', './component-theme-core.css', './experience-themes.css', './jungle-theme.css', './doctor-summary.css',
  './app.js', './app-reliability.js', './cross-device-alerts.js', './core-ui.js', './experience-theme.js', './render-lifecycle.js', './plan-reliability.js', './network-reliability.js', './ai-coach-client.js', './app-update-notice.js', './family-chat.js', './doctor-summary.js', './config.js',
  './assets/themes/cloud-island.svg', './assets/themes/forest-clearing.svg', './assets/themes/jungle-canopy.svg',
  './assets/animals/bear.svg', './assets/animals/rabbit.svg', './assets/animals/fox.svg', './assets/animals/owl.svg', './assets/animals/beaver.svg',
  './assets/animals/elephant.svg', './assets/animals/monkey.svg', './assets/animals/tiger.svg', './assets/animals/parrot.svg', './assets/animals/hippo.svg',
  './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];

// Firebase Messaging is optional. If its CDN is temporarily unavailable the service
// worker still installs and MilkFlow keeps its normal offline/runtime behavior.
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
        icon:'./icon-192.png',
        badge:'./icon-192.png',
        tag:d.alertId||`milkflow-${d.recordId||Date.now()}`,
        renotify:false,
        data:{url,alertId:d.alertId||''}
      });
    });
  }
}catch(err){console.warn('MilkFlow push messaging unavailable',err?.message||err);}

self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>Promise.all(SHELL.map(url=>cache.add(url).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.endsWith('/sw.js'))return;
  event.respondWith(fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy)).catch(()=>{});}return res;}).catch(async()=>{const hit=await caches.match(req,{ignoreSearch:true});if(hit)return hit;if(req.mode==='navigate'){const shell=await caches.match('./index.html',{ignoreSearch:true});if(shell)return shell;}return Response.error();}));
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
