import {stars, sparkles, commonDefs, doc} from './lib.mjs';

/* Aurora. Ribbons across the top third, a ridge line low enough that the page background
   gets a horizon, and a still lake that repeats the ribbon colour as a reflection. */

function ribbon(d, id, w, o){
  return `<path d="${d}" fill="none" stroke="url(#${id})" stroke-width="${w}" stroke-linecap="round" opacity="${o}" filter="url(#glow)"/>`;
}

function scene({sky, a1, a2, a3, ridgeFar, ridgeMid, ridgeNear, lake, lakeGlow, star,
                furA, furB, ink, wash, deep, snow}){
  return `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop stop-color="${sky[0]}"/><stop offset=".34" stop-color="${sky[1]}"/>
  <stop offset=".66" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/>
</linearGradient>
<linearGradient id="rA" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
  <stop stop-color="${a1}" stop-opacity="0"/><stop offset=".3" stop-color="${a1}"/>
  <stop offset=".7" stop-color="${a2}"/><stop offset="1" stop-color="${a2}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="rB" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
  <stop stop-color="${a2}" stop-opacity="0"/><stop offset=".35" stop-color="${a2}"/>
  <stop offset=".75" stop-color="${a3}"/><stop offset="1" stop-color="${a3}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="rC" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="1000" y2="0">
  <stop stop-color="${a3}" stop-opacity="0"/><stop offset=".45" stop-color="${a3}"/>
  <stop offset="1" stop-color="${a1}" stop-opacity="0"/>
</linearGradient>
<linearGradient id="lakeG" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${lakeGlow}"/><stop offset="1" stop-color="${lake}"/></linearGradient>
<linearGradient id="fur" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="${furA}"/><stop offset="1" stop-color="${furB}"/></linearGradient>
${commonDefs({glow: 34})}
</defs>
<rect width="1000" height="2200" fill="url(#sky)"/>
<rect width="1000" height="2200" fill="${deep}" opacity="${wash}"/>

${stars(77321, {count: 150, to: 1200, fill: star, max: 2.1})}

<!-- the ribbons: three passes, each a wide soft stroke with a brighter core on top -->
<g>
  ${ribbon('M-60 470C140 250 330 560 520 330 700 120 860 420 1060 250', 'rA', 96, .55)}
  ${ribbon('M-60 470C140 250 330 560 520 330 700 120 860 420 1060 250', 'rA', 26, .95)}
  ${ribbon('M-60 660C170 470 300 760 540 520 740 320 880 600 1060 440', 'rB', 84, .45)}
  ${ribbon('M-60 660C170 470 300 760 540 520 740 320 880 600 1060 440', 'rB', 20, .9)}
  ${ribbon('M-60 900C180 740 320 990 560 790 760 620 900 840 1060 720', 'rC', 70, .34)}
  ${ribbon('M-60 900C180 740 320 990 560 790 760 620 900 840 1060 720', 'rC', 14, .75)}
</g>
${sparkles(2, [[150, 300, 13], [830, 210, 11, .85], [420, 176, 9, .7], [660, 1010, 10, .8], [220, 1120, 8, .6]], star)}

<!-- ridges -->
<path d="M0 1180 150 1010l120 110 180-190 170 170 130-120 250 210v180H0Z" fill="${ridgeFar}" opacity=".6"/>
<path d="M0 1330 210 1130l160 150 190-160 200 190 240-150v230H0Z" fill="${ridgeMid}" opacity=".85"/>
<path d="M0 1460 120 1360l130 80 150-120 180 140 200-110 220 150v180H0Z" fill="${ridgeNear}"/>
<g fill="${snow}" opacity=".55">
  <path d="M210 1130l72 68-40 16-36-30-30 22Z"/><path d="M560 1160l66 62-42 12-30-26-26 20Z"/><path d="M400 1290l58 46-36 12-24-20Z"/>
</g>

<!-- lake: the ribbon colour again, softened, so the two halves of the frame rhyme -->
<path d="M0 1560h1000v640H0Z" fill="url(#lakeG)"/>
<g opacity=".5" filter="url(#glow)">
  ${ribbon('M-60 1760C170 1880 320 1650 560 1830 760 1980 900 1740 1060 1870', 'rB', 54, .5)}
  ${ribbon('M-60 1990C180 2100 320 1900 560 2050 760 2170 900 1960 1060 2080', 'rC', 44, .4)}
</g>
<g fill="${star}">
  <path d="M120 1602h420v4H120Z" opacity=".16"/><path d="M640 1618h250v3H640Z" opacity=".12"/>
  <path d="M60 1716h300v3H60Z" opacity=".13"/><path d="M470 1730h380v3H470Z" opacity=".1"/>
  <path d="M180 1852h430v3H180Z" opacity=".11"/><path d="M700 1874h220v2H700Z" opacity=".09"/>
  <path d="M90 2004h330v2H90Z" opacity=".09"/>
</g>

<!-- arctic fox cub on the near ridge -->
<g transform="translate(742 1368) scale(.94)">
  <ellipse cx="6" cy="102" rx="104" ry="24" fill="${ink}" opacity=".22"/>
  <path d="M84 62c58-24 104-6 118 42 10 36-14 62-46 52-30-9-44-34-40-62" fill="url(#fur)"/>
  <path d="M104 74c40-16 72-6 82 28" fill="none" stroke="${lakeGlow}" stroke-width="7" stroke-linecap="round" opacity=".55"/>
  <path d="M-94 76c-6-50 22-84 94-84s100 34 94 84c-4 32-40 50-94 50s-90-18-94-50Z" fill="url(#fur)"/>
  <circle cx="0" cy="-30" r="64" fill="url(#fur)"/>
  <path d="M-70 -56-96 -160l68 58Z" fill="url(#fur)"/><path d="M70 -56 96 -160l-68 58Z" fill="url(#fur)"/>
  <path d="M-64 -70-80 -138l42 40Z" fill="${lakeGlow}" opacity=".75"/><path d="M64 -70 80 -138l-42 40Z" fill="${lakeGlow}" opacity=".75"/>
  <path d="M-42 -6c0-26 19-42 42-42s42 16 42 42c0 18-19 28-42 28s-42-10-42-28Z" fill="${snow}"/>
  <circle cx="-26" cy="-40" r="8" fill="${ink}"/><circle cx="26" cy="-40" r="8" fill="${ink}"/>
  <circle cx="-26" cy="-43" r="3" fill="#fff" opacity=".9"/><circle cx="26" cy="-43" r="3" fill="#fff" opacity=".9"/>
  <path d="M0 -14c9 0 14 5 14 10s-6 9-14 9-14-4-14-9 5-10 14-10Z" fill="${ink}"/>
  <path d="M0 5v8m-12 6q12 9 24 0" fill="none" stroke="${ink}" stroke-width="5" stroke-linecap="round"/>
</g>
`;
}

export const dark = () => doc('Aurora over a snow ridge and still lake, with an arctic fox cub', scene({
  sky: ['#040f1d', '#062033', '#08293c', '#04121f'],
  deep: '#00060d', wash: '.1',
  a1: '#4dffc3', a2: '#49c8ff', a3: '#c07bff',
  ridgeFar: '#0d2a3c', ridgeMid: '#0a2130', ridgeNear: '#061826',
  lake: '#03101c', lakeGlow: '#0a3550', star: '#e8f7ff',
  furA: '#eaf6ff', furB: '#b7d2e6', ink: '#0b1c2a', snow: '#ffffff'
}));

export const light = () => doc('Dawn aurora over a snow ridge and still lake, with an arctic fox cub', scene({
  sky: ['#e6f7ff', '#eaf1ff', '#f7ecff', '#fff2f7'],
  deep: '#ffffff', wash: '.2',
  a1: '#43d6a8', a2: '#4bb4e8', a3: '#b07ae8',
  ridgeFar: '#b9d6e8', ridgeMid: '#9dc4dc', ridgeNear: '#7fb0cf',
  lake: '#cfe9f6', lakeGlow: '#a9d8ee', star: '#5d84a8',
  furA: '#ffffff', furB: '#d9e8f3', ink: '#2b4a60', snow: '#ffffff'
}));
