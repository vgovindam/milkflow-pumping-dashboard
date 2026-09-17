// MilkFlow service worker.
// Network-first app shell; Firestore/Firebase traffic is left to Firebase.
const VERSION = 'milkflow-stable45-human12';
const SHELL = [
  './', './index.html', './styles.css', './component-theme.css', './component-theme-core.css', './experience-themes.css', './jungle-theme.css', './doctor-summary.css',
  './app.js', './app-reliability.js', './core-ui.js', './experience-theme.js', './render-lifecycle.js', './plan-reliability.js', './network-reliability.js', './ai-coach-client.js', './app-update-notice.js', './family-chat.js', './doctor-summary.js', './config.js',
  './assets/themes/cloud-island.svg', './assets/themes/forest-clearing.svg', './assets/themes/jungle-canopy.svg',
  './assets/animals/bear.svg', './assets/animals/rabbit.svg', './assets/animals/fox.svg', './assets/animals/owl.svg', './assets/animals/beaver.svg',
  './assets/animals/elephant.svg', './assets/animals/monkey.svg', './assets/animals/tiger.svg', './assets/animals/parrot.svg', './assets/animals/hippo.svg',
  './manifest.webmanifest', './icon.svg', './icon-192.png', './icon-512.png', './apple-touch-icon.png'
];
self.addEventListener('install',event=>{event.waitUntil(caches.open(VERSION).then(cache=>Promise.all(SHELL.map(url=>cache.add(url).catch(()=>{})))).then(()=>self.skipWaiting()));});
self.addEventListener('activate',event=>{event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));});
self.addEventListener('fetch',event=>{
  const req=event.request;if(req.method!=='GET')return;const url=new URL(req.url);if(url.origin!==self.location.origin||url.pathname.endsWith('/sw.js'))return;
  event.respondWith(fetch(req).then(res=>{if(res&&res.ok){const copy=res.clone();caches.open(VERSION).then(c=>c.put(req,copy)).catch(()=>{});}return res;}).catch(async()=>{const hit=await caches.match(req,{ignoreSearch:true});if(hit)return hit;if(req.mode==='navigate'){const shell=await caches.match('./index.html',{ignoreSearch:true});if(shell)return shell;}return Response.error();}));
});