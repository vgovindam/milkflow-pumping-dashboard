/* Drawing primitives for the illustrated cast.
 *
 * Every character in every theme is assembled from these parts, so a giraffe, a bunny and a
 * baby dragon share one face grammar: same eye spacing, same blush placement, same coat
 * shading. That is what makes 28 icons look like one illustrator drew them, and it means a
 * new character is ~10 lines of data rather than a new hand-drawn file.
 *
 * All coordinates are absolute in the 64x64 icon box. The head sits at HEAD; the semantic
 * prop badge sits at BADGE, which is why characters are drawn slightly up and to the left.
 */
export const HEAD = {cx: 29.6, cy: 27.4, rx: 17, ry: 16};
export const BADGE = {cx: 46, cy: 46, r: 10.2, scale: 0.48};

const r = n => Math.round(n * 100) / 100;

/* ------------------------------------------------------------------ atoms -- */
export const ellipse = (cx, cy, rx, ry, fill, extra = '') =>
  `<ellipse cx="${r(cx)}" cy="${r(cy)}" rx="${r(rx)}" ry="${r(ry)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const circle = (cx, cy, rad, fill, extra = '') =>
  `<circle cx="${r(cx)}" cy="${r(cy)}" r="${r(rad)}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const path = (d, fill, extra = '') =>
  `<path d="${d}" fill="${fill}"${extra ? ' ' + extra : ''}/>`;

export const stroke = (d, color, width, extra = '') =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${r(width)}" stroke-linecap="round" stroke-linejoin="round"${extra ? ' ' + extra : ''}/>`;

/* ------------------------------------------------------------------- head -- */
/** Rounded head with a soft under-shade and a hairline contour. */
export function head(c, {rx = HEAD.rx, ry = HEAD.ry, cx = HEAD.cx, cy = HEAD.cy} = {}) {
  return [
    ellipse(cx, cy, rx, ry, c.coat),
    ellipse(cx, cy + ry * 0.34, rx * 0.93, ry * 0.62, c.coat2, 'fill-opacity=".5"'),
    ellipse(cx, cy, rx, ry, 'none', `stroke="${c.ink}" stroke-opacity=".16" stroke-width="1"`)
  ].join('');
}

/* ------------------------------------------------------------------- ears -- */
export function earsRound(c, {dx = 15.6, dy = -10.4, rad = 6.6, inner = 3.4} = {}) {
  const y = HEAD.cy + dy;
  return [-1, 1].map(s => [
    circle(HEAD.cx + s * dx, y, rad, c.coat),
    circle(HEAD.cx + s * dx, y, inner, c.inner, 'fill-opacity=".85"')
  ].join('')).join('');
}

export function earsLeaf(c, {dx = 13.4, dy = -13.4, rx = 4.4, ry = 7, tilt = 24} = {}) {
  const y = HEAD.cy + dy;
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * dx;
    return `<g transform="rotate(${r(s * tilt)} ${r(x)} ${r(y)})">${ellipse(x, y, rx, ry, c.coat)}${ellipse(x, y + 0.6, rx * 0.5, ry * 0.58, c.inner, 'fill-opacity=".85"')}</g>`;
  }).join('');
}

export function earsLong(c, {dx = 8.2, dy = -19.6, rx = 3.9, ry = 10.6, tilt = 12} = {}) {
  const y = HEAD.cy + dy;
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * dx;
    return `<g transform="rotate(${r(s * tilt)} ${r(x)} ${r(y + ry)})">${ellipse(x, y, rx, ry, c.coat)}${ellipse(x, y + 0.8, rx * 0.46, ry * 0.7, c.inner, 'fill-opacity=".85"')}</g>`;
  }).join('');
}

export function earsPointed(c, {dx = 12.4, dy = -12.2, w = 6, h = 10.4} = {}) {
  const y = HEAD.cy + dy;
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * dx;
    return [
      path(`M${r(x - w / 2)} ${r(y + h / 2)} L${r(x + s * 0.5)} ${r(y - h / 2)} L${r(x + w / 2)} ${r(y + h / 2)} Z`, c.coat),
      path(`M${r(x - w / 2 + 1.5)} ${r(y + h / 2 - 1)} L${r(x + s * 0.4)} ${r(y - h / 2 + 2.6)} L${r(x + w / 2 - 1.5)} ${r(y + h / 2 - 1)} Z`, c.inner, 'fill-opacity=".85"')
    ].join('');
  }).join('');
}

export function earsFloppy(c, {dx = 15.4, dy = -4.4, rx = 5.2, ry = 8.6} = {}) {
  const y = HEAD.cy + dy;
  return [-1, 1].map(s => ellipse(HEAD.cx + s * dx, y, rx, ry, c.coat2)).join('');
}

/* ------------------------------------------------------------- headpieces -- */
export function ossicones(c) {
  const y = HEAD.cy - 15.8;
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * 6.2;
    return stroke(`M${r(x)} ${r(y + 4)} L${r(x + s * 1.4)} ${r(y - 3.4)}`, c.coat2, 2.6) +
      circle(x + s * 1.6, y - 4.4, 2.2, c.ink, 'fill-opacity=".72"');
  }).join('');
}

export function spiralHorn(c, {color = '#F6C866', cx = HEAD.cx, cy = HEAD.cy - 15.2} = {}) {
  return [
    path(`M${r(cx)} ${r(cy - 12.4)} L${r(cx - 3.5)} ${r(cy + 2.4)} L${r(cx + 3.5)} ${r(cy + 2.4)} Z`, color),
    stroke(`M${r(cx - 2.5)} ${r(cy - 0.6)} L${r(cx + 2.6)} ${r(cy - 1.8)}M${r(cx - 1.8)} ${r(cy - 4.2)} L${r(cx + 2)} ${r(cy - 5.2)}M${r(cx - 1)} ${r(cy - 7.6)} L${r(cx + 1.4)} ${r(cy - 8.2)}`, '#C98A1E', 1.1, 'stroke-opacity=".7"')
  ].join('');
}

export function hornsSmall(c, {color} = {}) {
  const tone = color || c.inner;
  const y = HEAD.cy - 14.6;
  return [-1, 1].map(s => path(
    `M${r(HEAD.cx + s * 5.4)} ${r(y + 3.2)} q${r(s * 1.2)} -5.4 ${r(s * 4)} -6.6 q${r(-s * 0.8)} 4 ${r(-s * 1.4)} 6.6 Z`, tone)).join('');
}

export function crown(c, {color = '#F6C866', gem = '#E2547E', cy = HEAD.cy - 16.4, cx = HEAD.cx, w = 13} = {}) {
  const h = 8.4;
  const x0 = cx - w / 2;
  return [
    path(`M${r(x0)} ${r(cy + h / 2)} L${r(x0 + 0.6)} ${r(cy - h / 2)} L${r(cx - w * 0.19)} ${r(cy - h * 0.06)} L${r(cx)} ${r(cy - h * 0.66)} L${r(cx + w * 0.19)} ${r(cy - h * 0.06)} L${r(x0 + w - 0.6)} ${r(cy - h / 2)} L${r(x0 + w)} ${r(cy + h / 2)} Z`, color),
    circle(cx, cy - h * 0.7, 1.7, gem),
    path(`M${r(x0 + 0.4)} ${r(cy + h / 2 - 1.8)} h${r(w - 0.8)} v1.8 h${r(-w + 0.8)} Z`, '#E4A82F', 'fill-opacity=".55"')
  ].join('');
}

export function tiara(c, {color = '#F3D89A', gem = '#D8567E', cy = HEAD.cy - 14.8} = {}) {
  return [
    stroke(`M${r(HEAD.cx - 9)} ${r(cy + 3.4)} q${9} -6.2 ${18} 0`, color, 2.6),
    path(`M${r(HEAD.cx)} ${r(cy - 5.6)} l2 3.9 4.2.7-3.1 3 .8 4.2-3.9-2.1-3.9 2.1.8-4.2-3.1-3 4.2-.7Z`, color),
    circle(HEAD.cx, cy - 1.1, 1.3, gem)
  ].join('');
}

export function bow(c, {color = '#EE85A8', cx = HEAD.cx + 11.4, cy = HEAD.cy - 12.4, s = 1} = {}) {
  return [
    path(`M${r(cx)} ${r(cy)} q${r(-6.4 * s)} ${r(-4.6 * s)} ${r(-6.6 * s)} ${r(0.6 * s)} q${r(0.2 * s)} ${r(4.6 * s)} ${r(6.6 * s)} ${r(-0.6 * s)}Z`, color),
    path(`M${r(cx)} ${r(cy)} q${r(6.4 * s)} ${r(-4.6 * s)} ${r(6.6 * s)} ${r(0.6 * s)} q${r(-0.2 * s)} ${r(4.6 * s)} ${r(-6.6 * s)} ${r(-0.6 * s)}Z`, color),
    circle(cx, cy, 2, color === '#EE85A8' ? '#D96A90' : color, 'fill-opacity=".9"')
  ].join('');
}

export function antennae(c, {color} = {}) {
  const tone = color || c.ink;
  const y = HEAD.cy - 13.8;
  return [-1, 1].map(s => stroke(
    `M${r(HEAD.cx + s * 4.4)} ${r(y + 3)} q${r(s * 2.4)} -6 ${r(s * 7.4)} -7.4`, tone, 1.5, 'stroke-opacity=".78"') +
    circle(HEAD.cx + s * 11.8, y - 4.4, 1.9, tone, 'fill-opacity=".78"')).join('');
}

export function hairBob(c, {color = '#7B4A2A'} = {}) {
  return [
    path(`M${r(HEAD.cx - 17.8)} ${r(HEAD.cy - 1)} a17.8 16.6 0 0 1 35.6 0 q-4 -6 -17.8 -6 q-13.8 0 -17.8 6Z`, color),
    ellipse(HEAD.cx, HEAD.cy - 12.6, 14.8, 8.4, color)
  ].join('');
}

/* ------------------------------------------------------------------ wings -- */
export function wingsBack(c, {c1, c2, cy = HEAD.cy - 2, dx = 15, rx = 11, ry = 13} = {}) {
  const a = c1 || c.wing1 || c.coat2;
  const b = c2 || c.wing2 || c.inner;
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * dx;
    return `<g transform="rotate(${r(s * -18)} ${r(x)} ${r(cy)})">${ellipse(x, cy, rx, ry, a, 'fill-opacity=".92"')}${ellipse(x, cy + ry * 0.42, rx * 0.66, ry * 0.42, b, 'fill-opacity=".85"')}</g>`;
  }).join('');
}

/* Butterfly / moth wings: four lobes, drawn around a slim body. */
export function butterflyWings(c, {c1, c2, cx = HEAD.cx, cy = HEAD.cy, spread = 15.4} = {}) {
  const a = c1 || c.wing1;
  const b = c2 || c.wing2;
  return [-1, 1].map(s => [
    ellipse(cx + s * spread * 0.78, cy - 6.2, 9.6, 11.2, a, `transform="rotate(${r(s * 18)} ${r(cx + s * spread * 0.78)} ${r(cy - 6.2)})"`),
    ellipse(cx + s * spread * 0.64, cy + 7.2, 7.4, 8, b, `transform="rotate(${r(s * -14)} ${r(cx + s * spread * 0.64)} ${r(cy + 7.2)})"`),
    circle(cx + s * spread * 0.9, cy - 8.2, 2.1, '#fff', 'fill-opacity=".55"'),
    circle(cx + s * spread * 0.7, cy + 8, 1.5, '#fff', 'fill-opacity=".45"')
  ].join('')).join('');
}

/* A feathered wing: leading edge swept up and out, three scalloped flight feathers on the
   trailing edge. Reads as a wing at icon size, where rotated ellipses read as clouds. */
export function wingFan(c, {color, edge, ax = HEAD.cx + 12.4, ay = HEAD.cy - 2, len = 19, lift = 13} = {}) {
  const fill = color || c.wing1 || c.coat2;
  const trim = edge || c.wing2 || c.inner;
  return [-1, 1].map(s => {
    const x = ax === null ? HEAD.cx : HEAD.cx + s * (ax - HEAD.cx);
    const d = `M${r(x)} ${r(ay)} C${r(x + s * len * 0.34)} ${r(ay - lift)} ${r(x + s * len * 0.84)} ${r(ay - lift * 1.1)} ${r(x + s * len)} ${r(ay - lift * 0.34)}` +
      ` q${r(-s * 1.6)} ${r(lift * 0.36)} ${r(-s * 5.6)} ${r(lift * 0.4)}` +
      ` q${r(-s * 1.2)} ${r(lift * 0.32)} ${r(-s * 5)} ${r(lift * 0.34)}` +
      ` q${r(-s * 1)} ${r(lift * 0.28)} ${r(-s * 4.4)} ${r(lift * 0.26)}Z`;
    return path(d, fill) + path(d, 'none', `stroke="${trim}" stroke-width="1.1" stroke-opacity=".9"`);
  }).join('');
}

/* ------------------------------------------------------------------ marks -- */
export function spots(c, {color, at = [[-9, -4, 3.1], [7.6, -6.4, 2.7], [-4.4, 5.6, 2.4], [9.4, 3.2, 2.9]]} = {}) {
  const tone = color || c.mark || c.coat2;
  return at.map(([dx, dy, rad]) => circle(HEAD.cx + dx, HEAD.cy + dy, rad, tone, 'fill-opacity=".62"')).join('');
}

export function stripes(c, {color, opacity = '.8'} = {}) {
  const tone = color || c.mark || c.ink;
  /* Each stripe starts thick at the outline and tapers inward, which is what makes a
     stripe read as a stripe rather than a smudge at 56px. */
  const rows = [[-11.4, 1.5, 7.4], [-4.6, 1.9, 8.6], [2.4, 1.7, 7.6], [8.6, 1.3, 5.4]];
  return [-1, 1].map(s => rows.map(([dy, w, len]) => {
    const edge = Math.sqrt(Math.max(0, 1 - (dy / HEAD.ry) ** 2)) * HEAD.rx;
    const x = HEAD.cx + s * (edge - 0.6);
    const y = HEAD.cy + dy;
    return path(
      `M${r(x)} ${r(y - w)} Q${r(x - s * len * 0.55)} ${r(y - w * 0.55)} ${r(x - s * len)} ${r(y + w * 0.35)} Q${r(x - s * len * 0.5)} ${r(y + w * 0.5)} ${r(x)} ${r(y + w)}Z`,
      tone, `fill-opacity="${opacity}"`);
  }).join('')).join('');
}

/* A short brush of upright hairs along the crown of the head: zebra and pony manes. */
export function forelockBrush(c, {color, count = 5, spread = 9, height = 4.2, width = 2.2} = {}) {
  const tone = color || c.mark || c.coat2;
  return Array.from({length: count}, (_, i) => {
    const t = count === 1 ? 0 : (i / (count - 1)) * 2 - 1;
    const x = HEAD.cx + t * spread;
    const y = HEAD.cy - HEAD.ry * 0.94 + Math.abs(t) * 2.6;
    return stroke(`M${r(x)} ${r(y + 1.8)} L${r(x + t * 1.4)} ${r(y - height)}`, tone, width);
  }).join('');
}

export function mane(c, {color} = {}) {
  const tone = color || c.mark || c.coat2;
  const petals = 11;
  return Array.from({length: petals}, (_, i) => {
    const angle = (i / petals) * Math.PI * 2;
    return circle(HEAD.cx + Math.cos(angle) * 17.4, HEAD.cy + Math.sin(angle) * 16.6, 5.4, tone);
  }).join('');
}

/* ------------------------------------------------------------------- face -- */
export function muzzle(c, {rx = 9.2, ry = 6.6, dy = 8.4, nose = 'oval', mouth = true} = {}) {
  const cy = HEAD.cy + dy;
  const parts = [ellipse(HEAD.cx, cy, rx, ry, c.inner, 'fill-opacity=".92"')];
  const ny = cy - ry * 0.42;
  if (nose === 'oval') parts.push(ellipse(HEAD.cx, ny, 2.9, 2.2, c.ink));
  if (nose === 'triangle') parts.push(path(`M${r(HEAD.cx - 2.9)} ${r(ny - 1.3)} h5.8 l-2.9 3.3 Z`, c.ink));
  if (nose === 'beak') parts.push(path(`M${r(HEAD.cx - 3.8)} ${r(ny - 1.6)} h7.6 l-3.8 5.2 Z`, c.beak || '#F0A63C'));
  if (mouth) parts.push(stroke(`M${r(HEAD.cx)} ${r(ny + 2.4)} q0 3 -3 3M${r(HEAD.cx)} ${r(ny + 2.4)} q0 3 3 3`, c.ink, 1.5, 'stroke-opacity=".8"'));
  return parts.join('');
}

export function trunk(c) {
  const x = HEAD.cx;
  const y = HEAD.cy + 4;
  return [
    path(`M${r(x - 3.4)} ${r(y)} q3.4 -1.4 6.8 0 l-.6 9.4 q0 5 -4.4 5 q-3 0 -3.2 -3 q-.2 -2.4 2.4 -2.4Z`, c.coat2),
    stroke(`M${r(x - 2.4)} ${r(y + 3.6)} h5M${r(x - 2.2)} ${r(y + 6.6)} h4.6`, c.ink, 1, 'stroke-opacity=".3"')
  ].join('');
}

export function eyes(c, {dx = 6.4, dy = -0.4, rx = 3.1, ry = 3.6, style = 'open'} = {}) {
  const y = HEAD.cy + dy;
  if (style === 'happy') {
    return [-1, 1].map(s => stroke(`M${r(HEAD.cx + s * dx - 3.2)} ${r(y + 1.2)} q3.2 -4.4 6.4 0`, c.ink, 2.4)).join('');
  }
  return [-1, 1].map(s => {
    const x = HEAD.cx + s * dx;
    return ellipse(x, y, rx, ry, c.ink) +
      circle(x - 1, y - 1.3, 1.25, '#fff', 'fill-opacity=".92"') +
      circle(x + 1, y + 1.2, 0.6, '#fff', 'fill-opacity=".55"');
  }).join('');
}

export function cheeks(c, {dx = 12.4, dy = 5.4, rx = 3.2, ry = 2.2} = {}) {
  return [-1, 1].map(s => ellipse(HEAD.cx + s * dx, HEAD.cy + dy, rx, ry, c.blush, 'fill-opacity=".62"')).join('');
}
