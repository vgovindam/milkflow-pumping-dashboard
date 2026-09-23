/* The scene vocabulary.
 *
 * Every world is one 1000x2200 composite; the five roles the app needs (two heroes, two page
 * backgrounds, one settings preview) are crops of it, so they cannot drift apart.
 *
 * These are ATMOSPHERES, not pictures. The first attempt at this file drew subjects - a
 * planet, a fox, a jellyfish - and a subject in a wallpaper is a liability: it lands wherever
 * the crop puts it, which on a phone meant a cartoon planet sliced in half by the hero card.
 * What reads as a finished product is a deep colour field with real structure in it: a few
 * wide light sources, one piece of restrained geometry, and grain. Nothing competes with the
 * cards, and there is nothing to clip.
 */

export function rng(seed){
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const round = (n, p = 1) => Number(n.toFixed(p));

/* Grain is most of the difference between a gradient that looks designed and one that looks
   unfinished. It is generated inside a 160px tile and tiled, rather than run across the whole
   2200px frame, because feTurbulence over that area is genuinely slow on a phone. */
export function grain(opacity = 0.055){
  return {
    def: `<filter id="grainF" x="0" y="0" width="100%" height="100%">
  <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="2" stitchTiles="stitch" result="n"/>
  <feColorMatrix type="saturate" values="0"/>
</filter>
<pattern id="grain" width="160" height="160" patternUnits="userSpaceOnUse">
  <rect width="160" height="160" filter="url(#grainF)"/>
</pattern>`,
    shape: `<rect width="1000" height="2200" fill="url(#grain)" opacity="${opacity}"/>`
  };
}

/* A wide, soft light source. Four or five of these at different scales is what gives a flat
   gradient somewhere to come from. */
export function lamp(id, x, y, rx, ry, opacity = 1){
  return `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#${id})" opacity="${opacity}"/>`;
}
export function lampDef(id, color, stop = 0.85){
  return `<radialGradient id="${id}"><stop stop-color="${color}" stop-opacity="${stop}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
}

/* Hairline concentric arcs. The one piece of geometry each world gets: enough to read as
   deliberate, far too quiet to compete with a card sitting on top of it. */
export function contours(cx, cy, from, count, step, color, opacity = 0.14){
  let out = '';
  for(let i = 0; i < count; i++){
    const r = from + i * step;
    out += `<circle cx="${cx}" cy="${cy}" r="${round(r)}" fill="none" stroke="${color}" stroke-width="1.1" opacity="${round(opacity * (1 - i / (count * 1.6)), 3)}"/>`;
  }
  return out;
}

/* A long, slow diagonal sweep across the frame. */
export function sweep(id, d, width, opacity){
  return `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}" filter="url(#soften)"/>`;
}
export function sweepDef(id, color, x1, y1, x2, y2){
  return `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
  <stop stop-color="${color}" stop-opacity="0"/><stop offset=".45" stop-color="${color}" stop-opacity=".9"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
</linearGradient>`;
}

export function doc(label, body){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 2200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">\n${body}\n</svg>\n`;
}

/* One composition, four palettes. A design system has one layout and many skins; four
   hand-arranged scenes is four things to keep in step and four chances to get one wrong. */
export function field({label, base, lamps, sweeps, contour, grainAmount = 0.055, vignette}){
  const lampDefs = lamps.map((l, i) => lampDef(`L${i}`, l.color, l.stop ?? 0.85)).join('\n');
  const lampShapes = lamps.map((l, i) => lamp(`L${i}`, l.x, l.y, l.rx, l.ry, l.opacity ?? 1)).join('\n');
  const sweepDefs = sweeps.map((s, i) => sweepDef(`S${i}`, s.color, ...s.line)).join('\n');
  const sweepShapes = sweeps.map((s, i) => sweep(`S${i}`, s.d, s.width, s.opacity)).join('\n');
  const g = grain(grainAmount);
  return doc(label, `<defs>
<linearGradient id="base" x1="0" y1="0" x2="0" y2="1">
${base.map((c, i) => `  <stop offset="${round(i / (base.length - 1), 3)}" stop-color="${c}"/>`).join('\n')}
</linearGradient>
<filter id="soften" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="70"/></filter>
<radialGradient id="vig" cx=".5" cy=".42"><stop offset=".55" stop-color="${vignette}" stop-opacity="0"/><stop offset="1" stop-color="${vignette}" stop-opacity=".5"/></radialGradient>
${lampDefs}
${sweepDefs}
${g.def}
</defs>
<rect width="1000" height="2200" fill="url(#base)"/>
<g filter="url(#soften)">
${lampShapes}
</g>
${sweepShapes}
<g>${contours(contour.cx, contour.cy, contour.from, contour.count, contour.step, contour.color, contour.opacity)}</g>
<rect width="1000" height="2200" fill="url(#vig)"/>
${g.shape}`);
}
