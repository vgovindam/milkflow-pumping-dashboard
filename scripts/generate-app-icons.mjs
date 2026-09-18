/* MilkFlow app icon pipeline.
 *
 * Source of truth: assets/brand/app-icon-source.webp (the illustrated brand mark, supplied
 * with a white page margin, rounded corners and a drop shadow baked in).
 *
 * Producing a usable app icon from that needs three things, and all three matter:
 *   1. Crop to the badge. A PWA/iOS icon must be full bleed; shipping the white margin puts
 *      a rounded square inside the platform's own rounded square.
 *   2. Fill the corners. A square crop of a rounded badge leaves white in the four corners.
 *      iOS composites transparency onto BLACK and applies its own squircle mask, so those
 *      corners are flood-filled with the badge's rim colour instead of left white or alpha.
 *      Only the white region CONNECTED to each corner is filled - a global replace would
 *      also hit the baby's white blanket inside the artwork.
 *   3. Stay opaque. Every output is written without an alpha channel.
 *
 * macOS `sips` does the decoding and scaling (no ImageMagick/Pillow on this machine); the
 * corner fill round-trips through BMP, which is trivially parseable without a library.
 *
 * Run: node scripts/generate-app-icons.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import os from 'node:os';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'assets/brand/app-icon-source.webp');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'milkflow-icons-'));
const sips = (...args) => execFileSync('sips', args, {stdio: ['ignore', 'ignore', 'pipe']});

/* Outputs, and why each exists. */
const PNG_TARGETS = [
  ['milkflow-family-v3-192.png', 192], // canonical: manifest, index.html, push notifications
  ['icon-192.png', 192],
  ['icon-512.png', 512],
  ['apple-touch-icon.png', 180],       // iOS home screen
  ['icon-180.png', 180],
  ['apple-touch-icon-167.png', 167],   // iPad Pro
  ['apple-touch-icon-152.png', 152]    // iPad
];
const NEAR_WHITE = 244;
const SVG_EMBED_PX = 128;              // keeps icon.svg light enough to be a favicon

function readBmp(file) {
  const d = fs.readFileSync(file);
  const off = d.readUInt32LE(10);
  const w = d.readInt32LE(18);
  let h = d.readInt32LE(22);
  const bottomUp = h > 0;
  h = Math.abs(h);
  const bpp = d.readUInt16LE(28) / 8;
  const stride = Math.ceil(bpp * w / 4) * 4;
  const at = (x, y) => off + ((bottomUp ? h - 1 - y : y) * stride) + x * bpp;
  return {d, w, h, at};
}

function fillCorners(bmpFile) {
  const {d, w, h, at} = readBmp(bmpFile);
  const get = (x, y) => {const i = at(x, y); return [d[i + 2], d[i + 1], d[i]];};
  const set = (x, y, c) => {const i = at(x, y); d[i + 2] = c[0]; d[i + 1] = c[1]; d[i] = c[2];};

  // Rim colour: sampled just inside the left edge at mid-height.
  let acc = [0, 0, 0], n = 0;
  for (let x = Math.round(w * 0.012); x < Math.round(w * 0.026); x++) {
    const c = get(x, h >> 1); acc = [acc[0] + c[0], acc[1] + c[1], acc[2] + c[2]]; n++;
  }
  const fill = acc.map(v => Math.round(v / n));

  const near = (x, y) => {const c = get(x, y); return c[0] >= NEAR_WHITE && c[1] >= NEAR_WHITE && c[2] >= NEAR_WHITE;};
  const seen = new Uint8Array(w * h);
  let filled = 0;
  for (const start of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) {
    if (!near(...start)) continue;
    const q = [start];
    while (q.length) {
      const [x, y] = q.pop();
      if (x < 0 || y < 0 || x >= w || y >= h || seen[y * w + x] || !near(x, y)) continue;
      seen[y * w + x] = 1; set(x, y, fill); filled++;
      q.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  fs.writeFileSync(bmpFile, d);
  return {fill, filled, total: w * h};
}

/* 1. crop to the badge, dropping the page margin and the drop shadow below it */
const src = path.join(TMP, 'src.png');
sips('-s', 'format', 'png', SRC, '--out', src);
const badge = path.join(TMP, 'badge.png');
sips('-c', '1144', '1144', src, '--out', badge);

/* 2. flood-fill the corners left behind by squaring off a rounded badge */
const work = path.join(TMP, 'work.bmp');
sips('-s', 'format', 'bmp', '-Z', '1024', badge, '--out', work);
const {fill, filled, total} = fillCorners(work);
const flat = path.join(TMP, 'flat.png');
sips('-s', 'format', 'png', work, '--out', flat);
const hex = fill.map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
console.log(`Corner fill #${hex} applied to ${filled} px (${(100 * filled / total).toFixed(2)}%)`);

/* 3. emit every size, all opaque */
for (const [name, size] of PNG_TARGETS) {
  const out = path.join(TMP, `${size}-${name}`);
  sips('-Z', String(size), '-s', 'format', 'png', flat, '--out', out);
  fs.copyFileSync(out, path.join(ROOT, name));
}

/* Maskable: Android may crop to a circle, so the art is inset into the safe zone. */
const inner = path.join(TMP, 'mask-inner.png');
sips('-Z', '410', '-s', 'format', 'png', flat, '--out', inner);
sips('--padToHeightWidth', '512', '512', '--padColor', hex, inner, '--out', path.join(ROOT, 'icon-maskable-512.png'));

/* favicon.ico: an ICO directory entry may point at PNG bytes directly. */
const fav = path.join(TMP, 'fav48.png');
sips('-Z', '48', '-s', 'format', 'png', flat, '--out', fav);
const favPng = fs.readFileSync(fav);
const head = Buffer.alloc(22);
head.writeUInt16LE(0, 0); head.writeUInt16LE(1, 2); head.writeUInt16LE(1, 4);
head.writeUInt8(48, 6); head.writeUInt8(48, 7); head.writeUInt8(0, 8); head.writeUInt8(0, 9);
head.writeUInt16LE(1, 10); head.writeUInt16LE(32, 12);
head.writeUInt32LE(favPng.length, 14); head.writeUInt32LE(22, 18);
fs.writeFileSync(path.join(ROOT, 'favicon.ico'), Buffer.concat([head, favPng]));

/* icon.svg is declared at sizes "any"; the mark is an illustration, so it is embedded
   rather than re-drawn as paths that could never match it. */
const svgPng = path.join(TMP, 'svg.png');
sips('-Z', String(SVG_EMBED_PX), '-s', 'format', 'png', flat, '--out', svgPng);
const b64 = fs.readFileSync(svgPng).toString('base64');
fs.writeFileSync(path.join(ROOT, 'icon.svg'),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SVG_EMBED_PX} ${SVG_EMBED_PX}" width="${SVG_EMBED_PX}" height="${SVG_EMBED_PX}" role="img" aria-label="MilkFlow">` +
  `<image href="data:image/png;base64,${b64}" x="0" y="0" width="${SVG_EMBED_PX}" height="${SVG_EMBED_PX}"/></svg>\n`);

fs.rmSync(TMP, {recursive: true, force: true});
console.log(`Generated ${PNG_TARGETS.length + 1} PNG icons, favicon.ico and icon.svg from assets/brand/app-icon-source.webp`);
