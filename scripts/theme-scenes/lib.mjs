/* Shared vocabulary for the four world scenes.
 *
 * Every scene is one 1000x2200 composite, because the five roles the app needs (two heroes,
 * two page backgrounds, one settings preview) are all crops of it - see roleViewBox in
 * generate-theme-assets.mjs. That is why the interest lives at the top and along the edges:
 * the middle band is where the app's own cards sit, and a busy middle is just noise behind
 * text.
 *
 * Light and dark are authored, not derived. The previous generation produced dark by
 * search-and-replacing hex values in the light artwork, which is how three different worlds
 * ended up as the same brown murk with the animals barely visible.
 */

/* Deterministic so a rebuild produces an identical file and the diff stays honest. */
export function rng(seed){
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

export const round = (n, p = 1) => Number(n.toFixed(p));

/* A star field, thinning towards the bottom of the frame so the sky reads as depth rather
   than as confetti. */
export function stars(seed, {count = 150, to = 1500, fill = '#ffffff', max = 2.6} = {}){
  const r = rng(seed);
  let out = '';
  for(let i = 0; i < count; i++){
    const y = Math.pow(r(), 1.5) * to;
    const x = r() * 1000;
    const rad = round(0.7 + r() * max, 2);
    const o = round(0.25 + r() * 0.7, 2);
    out += `<circle cx="${round(x)}" cy="${round(y)}" r="${rad}" fill="${fill}" opacity="${o}"/>`;
  }
  return out;
}

/* Four-pointed sparkles: the thing that reads as "space" at a glance where a round dot
   reads as dust. */
export function sparkle(x, y, s, fill, o = 1){
  return `<path d="M${x} ${y - s}q${s * 0.18} ${s * 0.82} ${s} ${s}q-${s * 0.82} ${s * 0.18} -${s} ${s}q-${s * 0.18} -${s * 0.82} -${s} -${s}q${s * 0.82} -${s * 0.18} ${s} -${s}Z" fill="${fill}" opacity="${o}"/>`;
}

export function sparkles(seed, list, fill){
  return list.map(([x, y, s, o]) => sparkle(x, y, s, fill, o ?? 1)).join('');
}

/* Bubbles / motes: same job as stars, for the worlds that are underwater or indoors. */
export function motes(seed, {count = 40, from = 900, to = 2200, fill = '#ffffff', max = 9} = {}){
  const r = rng(seed);
  let out = '';
  for(let i = 0; i < count; i++){
    const x = round(r() * 1000), y = round(from + r() * (to - from));
    const rad = round(2 + r() * max, 1), o = round(0.08 + r() * 0.3, 2);
    out += `<circle cx="${x}" cy="${y}" r="${rad}" fill="none" stroke="${fill}" stroke-width="1.6" opacity="${o}"/>`;
  }
  return out;
}

/* The defs every scene wants: a blur for glow, a stronger one for bloom, and a drop shadow
   for the few solid objects. */
export function commonDefs({glow = 26, bloom = 60} = {}){
  return `<filter id="glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="${glow}"/></filter>
<filter id="bloom" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${bloom}"/></filter>
<filter id="soft" x="-40%" y="-40%" width="180%" height="180%"><feGaussianBlur stdDeviation="9"/></filter>`;
}

export function doc(label, body){
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 2200" preserveAspectRatio="xMidYMid slice" role="img" aria-label="${label}">\n${body}\n</svg>\n`;
}
