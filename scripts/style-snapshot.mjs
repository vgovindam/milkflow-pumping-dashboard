import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import {spawn, spawnSync} from 'node:child_process';

/* Computed-style snapshot, for cascade surgery.
 *
 * Removing an !important is not a textual change, it is a behavioural one, and the only
 * honest way to know whether a declaration was load-bearing is to measure the page before and
 * after. This walks a representative set of views, records the properties that decide how
 * something looks for every element, and writes them to JSON. Diff two runs and anything that
 * moved is a real regression rather than a guess.
 *
 *   node scripts/style-snapshot.mjs before.json
 *   ...edit CSS, npm run build...
 *   node scripts/style-snapshot.mjs after.json
 *   node scripts/style-snapshot.mjs --diff before.json after.json
 */

const ROOT = process.cwd();
const out = process.argv[2];

if(process.argv[2] === '--diff'){
  const a = JSON.parse(fs.readFileSync(process.argv[3], 'utf8'));
  const b = JSON.parse(fs.readFileSync(process.argv[4], 'utf8'));
  const diffs = [];
  for(const view of Object.keys(a)){
    const A = a[view] || {}, B = b[view] || {};
    const keys = new Set([...Object.keys(A), ...Object.keys(B)]);
    for(const el of keys){
      if(!A[el]){ diffs.push(`${view} :: ${el} :: APPEARED`); continue; }
      if(!B[el]){ diffs.push(`${view} :: ${el} :: VANISHED`); continue; }
      for(const prop of Object.keys(A[el]))
        if(A[el][prop] !== B[el][prop]) diffs.push(`${view} :: ${el} :: ${prop}: ${A[el][prop]} -> ${B[el][prop]}`);
    }
  }
  /* Grouped by property, because one token change shows up on fifty elements and the
     property is the thing you act on. */
  const byProp = {};
  for(const d of diffs){ const p = d.split(' :: ')[2].split(':')[0]; (byProp[p] ||= []).push(d); }
  console.log(`${diffs.length} computed-style differences across ${Object.keys(byProp).length} properties\n`);
  for(const [prop, list] of Object.entries(byProp).sort((x, y) => y[1].length - x[1].length)){
    console.log(`${prop} (${list.length})`);
    for(const d of list.slice(0, 4)) console.log(`   ${d}`);
    if(list.length > 4) console.log(`   ... ${list.length - 4} more`);
  }
  process.exit(diffs.length ? 1 : 0);
}
if(!out) throw new Error('usage: style-snapshot.mjs <out.json> | --diff a.json b.json');

const DIST = path.join(ROOT, 'dist');
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webp':'image/webp','.json':'application/json','.webmanifest':'application/manifest+json','.ico':'image/x-icon'};
const server = http.createServer((req, res) => {
  let p = new URL(req.url, 'http://localhost').pathname;
  if(p === '/' || p === '') p = '/index.html';
  const file = path.join(DIST, decodeURIComponent(p).replace(/^\/+/, ''));
  if(!file.startsWith(DIST) || !fs.existsSync(file) || fs.statSync(file).isDirectory()){ res.writeHead(404); return res.end(); }
  res.writeHead(200, {'content-type': mime[path.extname(file)] || 'application/octet-stream'});
  res.end(fs.readFileSync(file));
});
await new Promise(r => server.listen(4188, '127.0.0.1', r));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const onPath = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const bundles = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', `${process.env.HOME||''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`];
const named = onPath.find(c => spawnSync('which', [c], {encoding: 'utf8'}).status === 0);
const exe = named ? spawnSync('which', [named], {encoding: 'utf8'}).stdout.trim() : bundles.find(b => b && fs.existsSync(b));
if(!exe){ server.close(); throw new Error('Chrome not available'); }
const proc = spawn(exe, ['--headless=new','--no-sandbox','--disable-gpu','--remote-debugging-port=9245',`--user-data-dir=/tmp/mf-snap-${process.pid}`,'about:blank'], {stdio: 'ignore'});
let ready = false;
for(let i = 0; i < 100 && !ready; i++){ try{ ready = (await fetch('http://127.0.0.1:9245/json/version')).ok; }catch{} if(!ready) await sleep(100); }
if(!ready){ proc.kill(); server.close(); throw new Error('Chrome did not start'); }

const target = await (await fetch(`http://127.0.0.1:9245/json/new?${encodeURIComponent('http://127.0.0.1:4188/#mom-home')}`, {method: 'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if(m.id && pending.has(m.id)){ const x = pending.get(m.id); pending.delete(m.id); m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result); } };
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
const evalJs = async expression => { const r = await cdp('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true}); if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result.value; };
await cdp('Page.enable'); await cdp('Runtime.enable');
await cdp('Emulation.setDeviceMetricsOverride', {width: 393, height: 852, deviceScaleFactor: 1, mobile: true, screenWidth: 393, screenHeight: 852});
await sleep(2800);
await evalJs("document.documentElement.classList.remove('mf-booting')");

const PROPS = ['backgroundColor','backgroundImage','color','display','position','fontSize','fontWeight','paddingTop','paddingLeft','marginTop','borderRadius','borderTopColor','borderTopWidth','boxShadow','opacity','zIndex','gridTemplateColumns','flexDirection','textAlign','overflow','minHeight','width','fontFamily','letterSpacing','fontStyle','textTransform','lineHeight'];
const ROUTES = ['mom-home','baby-home','mom-history','baby-history','mom-trends','baby-trends','development','doctor','more','settings','set-appearance','mom-stash'];
const THEMES = ['safari','ocean','celestial'];

const snapshot = {};
for(const theme of THEMES){
  await evalJs(`localStorage.setItem('milkflow-experience-theme-v1',${JSON.stringify(theme)});window.MilkFlowExperience?.apply?.(${JSON.stringify(theme)});window.dispatchEvent(new CustomEvent('milkflow:experience-theme-change',{detail:{theme:${JSON.stringify(theme)}}}))`);
  for(const route of ROUTES){
    await evalJs(`location.hash=${JSON.stringify('#' + route)}`);
    for(let i = 0; i < 25; i++){ await sleep(80); if(await evalJs('document.body.dataset.screen||""') === route) break; }
    for(const mode of ['light','dark']){
      await evalJs(`document.documentElement.dataset.theme=${JSON.stringify(mode)}`);
      await sleep(190);
      snapshot[`${theme}/${mode}/${route}`] = await evalJs(`(()=>{
        const props=${JSON.stringify(PROPS)};const out={};const seen=new Map();
        for(const el of document.querySelectorAll('#view *, .topbar *, #bottomNav *, .page-head, .main')){
          const r=el.getBoundingClientRect(); if(r.width<1&&r.height<1) continue;
          const cls=(el.className&&el.className.baseVal!==undefined?el.className.baseVal:String(el.className||'')).trim().split(/\\s+/).slice(0,3).join('.');
          let key=el.tagName.toLowerCase()+(cls?'.'+cls:'');
          const n=(seen.get(key)||0)+1; seen.set(key,n); key+='#'+n;
          const cs=getComputedStyle(el); const rec={};
          for(const p of props) rec[p]=cs[p];
          out[key]=rec;
        }
        return out;
      })()`);
    }
  }
  process.stdout.write(`  ${theme} captured\n`);
}
ws.close(); proc.kill(); server.close();
fs.writeFileSync(out, JSON.stringify(snapshot));
const elements = Object.values(snapshot).reduce((n, v) => n + Object.keys(v).length, 0);
console.log(`Snapshot: ${Object.keys(snapshot).length} views, ${elements} elements -> ${out}`);
