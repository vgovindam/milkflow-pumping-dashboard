import {stars, sparkles, commonDefs, doc} from './lib.mjs';

/* Crystal City. A glass skyline with edge light, a monorail arc that crosses the hero crop,
   and floating platforms so the long page background has something in its lower half. */

function tower(x, w, top, base, fill, rim, cap){
  const h = base - top;
  return `<g>
  <path d="M${x} ${base}V${top + w * 0.42}L${x + w / 2} ${top}L${x + w} ${top + w * 0.42}V${base}Z" fill="${fill}"/>
  <path d="M${x} ${base}V${top + w * 0.42}L${x + w / 2} ${top}L${x + w} ${top + w * 0.42}V${base}" fill="none" stroke="${rim}" stroke-width="3.5" opacity=".9"/>
  <path d="M${x + w / 2} ${top}V${base}" stroke="${rim}" stroke-width="2" opacity=".35"/>
  ${Array.from({length: Math.max(2, Math.round(h / 230))}, (_, i) => {
    const y = top + w * 0.5 + (i + 1) * (h / (Math.round(h / 230) + 1));
    return `<path d="M${x + 6} ${y.toFixed(0)}h${w - 12}" stroke="${rim}" stroke-width="2.5" opacity=".26"/>`;
  }).join('')}
  <circle cx="${x + w / 2}" cy="${top - 14}" r="6" fill="${cap}"/>
  <circle cx="${x + w / 2}" cy="${top - 14}" r="18" fill="${cap}" opacity=".45" filter="url(#soft)"/>
</g>`;
}

function scene({sky, deep, wash, haze, glassFar, glassMid, glassNear, rimA, rimB, cap,
                rail, platform, star, botA, botB, visor, ink}){
  return `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop stop-color="${sky[0]}"/><stop offset=".34" stop-color="${sky[1]}"/>
  <stop offset=".68" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/>
</linearGradient>
<radialGradient id="hazeG"><stop stop-color="${haze}" stop-opacity=".8"/><stop offset="1" stop-color="${haze}" stop-opacity="0"/></radialGradient>
<linearGradient id="railG" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
  <stop stop-color="${rimA}" stop-opacity="0"/><stop offset=".4" stop-color="${rimA}"/>
  <stop offset=".8" stop-color="${rimB}"/><stop offset="1" stop-color="${rimB}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="bot" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="${botA}"/><stop offset="1" stop-color="${botB}"/></linearGradient>
${commonDefs({glow: 24})}
</defs>
<rect width="1000" height="2200" fill="url(#sky)"/>
<rect width="1000" height="2200" fill="${deep}" opacity="${wash}"/>
<g filter="url(#bloom)" opacity=".7">
  <ellipse cx="240" cy="360" rx="330" ry="260" fill="url(#hazeG)"/>
  <ellipse cx="840" cy="1420" rx="320" ry="300" fill="url(#hazeG)"/>
</g>
${stars(908132, {count: 110, to: 900, fill: star, max: 1.9})}

<!-- far skyline -->
<g opacity=".45">
  ${tower(40, 90, 520, 1180, glassFar, rimA, cap)}
  ${tower(170, 70, 680, 1180, glassFar, rimA, cap)}
  ${tower(800, 84, 600, 1180, glassFar, rimB, cap)}
  ${tower(910, 72, 720, 1180, glassFar, rimB, cap)}
</g>
<!-- mid skyline -->
<g opacity=".8">
  ${tower(-10, 120, 760, 1420, glassMid, rimA, cap)}
  ${tower(140, 104, 880, 1420, glassMid, rimB, cap)}
  ${tower(760, 132, 700, 1420, glassMid, rimB, cap)}
  ${tower(920, 108, 860, 1420, glassMid, rimA, cap)}
</g>

<!-- monorail: one long arc across the hero crop -->
<g>
  <path d="M-60 1000C220 830 470 1080 760 900 880 826 960 812 1060 828" fill="none" stroke="url(#railG)" stroke-width="30" opacity=".22" filter="url(#glow)"/>
  <path d="M-60 1000C220 830 470 1080 760 900 880 826 960 812 1060 828" fill="none" stroke="url(#railG)" stroke-width="6"/>
  <g transform="translate(398 963) rotate(6)">
    <rect x="-96" y="-30" width="192" height="52" rx="26" fill="${glassNear}"/>
    <rect x="-96" y="-30" width="192" height="52" rx="26" fill="none" stroke="${rimA}" stroke-width="3"/>
    <g fill="${rimA}" opacity=".85"><rect x="-70" y="-16" width="34" height="24" rx="10"/><rect x="-18" y="-16" width="34" height="24" rx="10"/><rect x="34" y="-16" width="34" height="24" rx="10"/></g>
    <circle cx="112" cy="-4" r="7" fill="${cap}"/>
  </g>
</g>

<!-- near towers, the ones that frame the page -->
<g>
  ${tower(-30, 190, 1180, 2200, glassNear, rimA, cap)}
  ${tower(838, 210, 1120, 2200, glassNear, rimB, cap)}
</g>

<!-- floating platforms -->
<g>
  <g transform="translate(300 1620)">
    <ellipse rx="120" ry="30" fill="${platform}"/>
    <ellipse rx="120" ry="30" fill="none" stroke="${rimA}" stroke-width="3" opacity=".8"/>
    <path d="M-120 0 0 96 120 0Z" fill="${platform}" opacity=".7"/>
    <ellipse cy="6" rx="150" ry="40" fill="${rimA}" opacity=".16" filter="url(#glow)"/>
  </g>
  <g transform="translate(660 1900) scale(.7)">
    <ellipse rx="120" ry="30" fill="${platform}"/>
    <ellipse rx="120" ry="30" fill="none" stroke="${rimB}" stroke-width="3" opacity=".8"/>
    <path d="M-120 0 0 96 120 0Z" fill="${platform}" opacity=".7"/>
  </g>
</g>
${sparkles(4, [[180, 250, 13], [820, 430, 10, .8], [520, 1520, 9, .7], [140, 1980, 10, .7]], star)}

<!-- hover bot, the world's mascot, sitting on the high platform -->
<g transform="translate(300 1530)">
  <g filter="url(#glow)" opacity=".45"><circle cy="10" r="92" fill="${rimA}"/></g>
  <rect x="-62" y="-52" width="124" height="112" rx="44" fill="url(#bot)"/>
  <rect x="-44" y="-30" width="88" height="62" rx="26" fill="${visor}"/>
  <circle cx="-18" cy="0" r="8" fill="${cap}"/><circle cx="18" cy="0" r="8" fill="${cap}"/>
  <path d="M-12 20q12 10 24 0" fill="none" stroke="${cap}" stroke-width="5" stroke-linecap="round"/>
  <path d="M0 -52v-30" stroke="${botB}" stroke-width="7" stroke-linecap="round"/>
  <circle cy="-90" r="11" fill="${cap}"/>
  <path d="M-62 -6h-26m176 0h-26" stroke="${botB}" stroke-width="10" stroke-linecap="round"/>
  <ellipse cy="74" rx="56" ry="13" fill="${rimA}" opacity=".5"/>
  <ellipse cy="74" rx="34" ry="8" fill="${cap}" opacity=".7"/>
</g>`;
}

export const dark = () => doc('Night skyline of glass towers with neon edge light, a monorail and a hover bot', scene({
  sky: ['#080725', '#140d33', '#22114a', '#0b0a26'],
  deep: '#03020e', wash: '.12', haze: '#7b3bff', star: '#e9e4ff',
  glassFar: '#1c1644', glassMid: '#272057', glassNear: '#332574',
  rimA: '#5fe6ff', rimB: '#ff6ad5', cap: '#9ff4ff',
  rail: '#5fe6ff', platform: '#2a1f5e',
  botA: '#f4f2ff', botB: '#c3bde8', visor: '#151033', ink: '#0a0820'
}));

export const light = () => doc('Daylight skyline of glass towers with soft neon edges, a monorail and a hover bot', scene({
  sky: ['#eef2ff', '#e9ebff', '#f6ecff', '#f2f6ff'],
  deep: '#ffffff', wash: '.22', haze: '#c3aaff', star: '#8e93cf',
  glassFar: '#d7defa', glassMid: '#cad3f6', glassNear: '#bcc7f2',
  rimA: '#2ab4d8', rimB: '#e364b4', cap: '#0f9fc4',
  rail: '#2ab4d8', platform: '#c6cdf0',
  botA: '#ffffff', botB: '#d5d9f2', visor: '#3c4272', ink: '#2a2f5a'
}));
