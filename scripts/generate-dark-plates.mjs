import fs from 'node:fs';
import path from 'node:path';
import {spawn, spawnSync} from 'node:child_process';

/* Night grade for the painted worlds.
 *
 * The previous dark plates were made by search-and-replacing hex values in the light
 * painting. That drains the colour out of everything equally, which is why Safari, Butterfly
 * and Princess all arrived as the same grey-brown mud with the animals barely visible: no
 * moonlight, no hue in the shadows, no light source anywhere in the frame.
 *
 * This is the pass a colour grader would actually do. Per pixel:
 *   1. drop exposure and bend the tone curve, so highlights roll off instead of clipping
 *   2. map luminance onto a three-point night ramp - shadow, mid, high - in the world's own
 *      night hue, so the dark has a colour rather than an absence of one
 *   3. blend that grade back against the dimmed original, which is what keeps a lion cub
 *      looking like a lion cub instead of a grey shape
 *   4. restore a little chroma, because every step above costs saturation
 *   5. lay in a moon: one soft off-centre light so the scene has a direction
 *
 * It runs in the headless Chrome this project already drives for QA, because this machine has
 * no Pillow, no sharp and no ImageMagick - only sips, which cannot do curves.
 */

const ROOT = process.cwd();
const THEMES = {
  safari:    {shadow: [7, 16, 14],   mid: [22, 40, 31],  high: [104, 136, 108], moon: [240, 222, 170], moonAt: [0.72, 0.15], exposure: 0.36, gamma: 1.62, grade: 0.66, chroma: 1.34, floor: 0.34},
  butterfly: {shadow: [13, 11, 26],  mid: [33, 27, 52],  high: [124, 110, 158], moon: [252, 214, 236], moonAt: [0.30, 0.12], exposure: 0.37, gamma: 1.60, grade: 0.64, chroma: 1.36, floor: 0.32},
  princess:  {shadow: [16, 11, 23],  mid: [40, 26, 47],  high: [140, 110, 144], moon: [255, 218, 232], moonAt: [0.50, 0.10], exposure: 0.37, gamma: 1.60, grade: 0.62, chroma: 1.34, floor: 0.32}
};
const ROLES = [
  ['baby-background', [480, 720, 941]], ['baby-hero', [640, 941]],
  ['mom-background', [480, 720, 941]], ['mom-hero', [640, 941]], ['settings-preview', [null]]
];

const sleep = ms => new Promise(r => setTimeout(r, ms));
const onPath = ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'];
const bundles = [
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  `${process.env.HOME || ''}/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`,
  '/Applications/Chromium.app/Contents/MacOS/Chromium'
];
const named = onPath.find(c => spawnSync('which', [c], {encoding: 'utf8'}).status === 0);
const exe = named ? spawnSync('which', [named], {encoding: 'utf8'}).stdout.trim() : bundles.find(b => b && fs.existsSync(b));
if(!exe) throw new Error('Chrome/Chromium not available for the night grade');

let proc = null, port = 0;
for(const p of [9232, 9233, 9234]){
  const c = spawn(exe, ['--headless=new', '--no-sandbox', '--disable-gpu', `--remote-debugging-port=${p}`,
    `--user-data-dir=/tmp/milkflow-dark-${process.pid}-${p}`, '--allow-file-access-from-files', 'about:blank'], {stdio: 'ignore'});
  let ready = false;
  for(let i = 0; i < 100 && !ready; i++){ try{ ready = (await fetch(`http://127.0.0.1:${p}/json/version`)).ok; }catch{} if(!ready) await sleep(100); }
  if(ready){ proc = c; port = p; break; }
  c.kill();
}
if(!proc) throw new Error('Could not start Chrome for the night grade');

const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, {method: 'PUT'})).json();
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let seq = 0; const pending = new Map();
ws.onmessage = e => { const m = JSON.parse(e.data); if(m.id && pending.has(m.id)){ const x = pending.get(m.id); pending.delete(m.id); m.error ? x.reject(new Error(m.error.message)) : x.resolve(m.result); } };
const cdp = (method, params = {}) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, {resolve, reject}); ws.send(JSON.stringify({id, method, params})); });
const evalJs = async expression => {
  const r = await cdp('Runtime.evaluate', {expression, returnByValue: true, awaitPromise: true});
  if(r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text);
  return r.result.value;
};
await cdp('Runtime.enable');

const GRADE = fs.readFileSync(path.join(ROOT, 'scripts/night-grade.js'), 'utf8');
await evalJs(GRADE);

let written = 0;
for(const [theme, cfg] of Object.entries(THEMES)){
  for(const [role, widths] of ROLES){
    for(const w of widths){
      const name = w ? `${role}@${w}.webp` : `${role}.webp`;
      const src = path.join(ROOT, 'assets/themes-v2', theme, 'light', name);
      if(!fs.existsSync(src)) continue;
      const b64 = fs.readFileSync(src).toString('base64');
      const out = await evalJs(`nightGrade("data:image/webp;base64,${b64}", ${JSON.stringify(cfg)})`);
      fs.writeFileSync(path.join(ROOT, 'assets/themes-v2', theme, 'dark', name), Buffer.from(out.split(',')[1], 'base64'));
      written++;
    }
  }
  process.stdout.write(`  ${theme} graded\n`);
}
ws.close(); proc.kill();
console.log(`Night grade wrote ${written} dark plates.`);
