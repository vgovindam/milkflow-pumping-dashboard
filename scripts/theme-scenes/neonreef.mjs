import {motes, sparkles, commonDefs, doc} from './lib.mjs';

/* Neon Reef. Light shafts from the surface give the top crop its structure, the jellyfish
   carry the glow down the middle edges, and the coral sits along the bottom where the page
   background runs long. */

function jelly(x, y, s, bell, trail, rot = 0){
  return `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})">
  <g filter="url(#glow)" opacity=".55"><ellipse cx="0" cy="0" rx="96" ry="78" fill="${bell}"/></g>
  <path d="M-86 6c0-56 38-94 86-94s86 38 86 94c0 18-10 26-24 20-16-7-30-7-44 2-14-9-28-9-44-2-14 6-24-2-24-20Z" fill="${bell}" opacity=".92"/>
  <path d="M-58 -46q26-26 58-18" fill="none" stroke="#fff" stroke-width="10" stroke-linecap="round" opacity=".45"/>
  <g fill="none" stroke="${trail}" stroke-width="7" stroke-linecap="round" opacity=".8">
    <path d="M-52 26c-8 52 12 78 2 126"/><path d="M-18 32c-6 58 10 86-2 132"/>
    <path d="M18 32c6 58-10 86 2 132"/><path d="M52 26c8 52-12 78-2 126"/>
  </g></g>`;
}

function scene({water, deep, wash, shaft, bellA, bellB, trailA, trailB,
                coralA, coralB, coralC, rimA, rimB, sand, fishA, fishB, ink, spark}){
  return `<defs>
<linearGradient id="water" x1="0" y1="0" x2="0" y2="1">
  <stop stop-color="${water[0]}"/><stop offset=".32" stop-color="${water[1]}"/>
  <stop offset=".7" stop-color="${water[2]}"/><stop offset="1" stop-color="${water[3]}"/>
</linearGradient>
<linearGradient id="shaftG" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${shaft}" stop-opacity=".5"/><stop offset="1" stop-color="${shaft}" stop-opacity="0"/></linearGradient>
<linearGradient id="fishG" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${fishA}"/><stop offset="1" stop-color="${fishB}"/></linearGradient>
${commonDefs({glow: 30, bloom: 70})}
</defs>
<rect width="1000" height="2200" fill="url(#water)"/>
<rect width="1000" height="2200" fill="${deep}" opacity="${wash}"/>

<!-- surface light -->
<g opacity=".8">
  <path d="M120 0 220 0 60 980 -20 940Z" fill="url(#shaftG)"/>
  <path d="M420 0 560 0 430 1120 330 1060Z" fill="url(#shaftG)"/>
  <path d="M760 0 900 0 880 900 780 860Z" fill="url(#shaftG)"/>
</g>
<g filter="url(#bloom)" opacity=".4"><ellipse cx="500" cy="-60" rx="620" ry="280" fill="${shaft}"/></g>

${motes(5150, {count: 70, from: 120, to: 2100, fill: shaft, max: 8})}
${sparkles(3, [[196, 380, 11, .8], [812, 560, 10, .7], [560, 1240, 9, .65], [140, 1520, 10, .7]], spark)}

${jelly(816, 470, 1, bellA, trailA, 6)}
${jelly(150, 1180, .74, bellB, trailB, -8)}
${jelly(902, 1520, .58, bellA, trailA, 10)}

<!-- neon fish -->
<g transform="translate(300 880) rotate(-8)">
  <g filter="url(#glow)" opacity=".5"><ellipse rx="86" ry="44" fill="${fishA}"/></g>
  <path d="M-72 0c0-34 32-58 72-58s72 24 72 58-32 58-72 58-72-24-72-58Z" fill="url(#fishG)"/>
  <path d="M-70 0-128-42v84Z" fill="${fishB}"/>
  <path d="M16 -50q34-30 52-4" fill="none" stroke="${rimA}" stroke-width="8" stroke-linecap="round"/>
  <circle cx="44" cy="-12" r="9" fill="#fff"/><circle cx="46" cy="-12" r="5" fill="${ink}"/>
  <g fill="none" stroke="${rimA}" stroke-width="5" opacity=".85"><path d="M-22 -34v68"/><path d="M6 -42v84"/></g>
</g>

<!-- coral shelf -->
<path d="M0 1980q160-90 330-30t340-20 330 40v230H0Z" fill="${sand}" opacity=".85"/>
<g>
  <path d="M60 2200c-4-150 26-200 10-268 40 22 58 76 54 150 26-70 12-124 58-176 22 78 4 140-14 196 34-40 34-96 82-118-6 86-40 130-44 216Z" fill="${coralA}"/>
  <path d="M60 2200c-4-150 26-200 10-268 40 22 58 76 54 150 26-70 12-124 58-176 22 78 4 140-14 196 34-40 34-96 82-118-6 86-40 130-44 216Z" fill="none" stroke="${rimA}" stroke-width="5" opacity=".75"/>
  <path d="M760 2200c10-160-24-206-2-288 44 30 60 92 50 168 32-74 16-134 68-186 18 86-6 150-28 210 38-44 40-104 92-126-12 92-52 138-58 222Z" fill="${coralB}"/>
  <path d="M760 2200c10-160-24-206-2-288 44 30 60 92 50 168 32-74 16-134 68-186 18 86-6 150-28 210 38-44 40-104 92-126-12 92-52 138-58 222Z" fill="none" stroke="${rimB}" stroke-width="5" opacity=".75"/>
  <g fill="${coralC}">
    <ellipse cx="430" cy="2150" rx="66" ry="46"/><ellipse cx="530" cy="2176" rx="48" ry="34"/><ellipse cx="352" cy="2180" rx="42" ry="30"/>
  </g>
  <g fill="none" stroke="${rimA}" stroke-width="4" opacity=".6">
    <ellipse cx="430" cy="2150" rx="66" ry="46"/><ellipse cx="530" cy="2176" rx="48" ry="34"/>
  </g>
  <g stroke="${rimB}" stroke-width="9" stroke-linecap="round" fill="none" opacity=".85">
    <path d="M250 2200c-6-90 18-120 8-170"/><path d="M300 2200c-2-70 14-96 8-134"/>
    <path d="M640 2200c8-96-16-126-6-178"/>
  </g>
</g>`;
}

export const dark = () => doc('Bioluminescent reef at depth with jellyfish, neon coral and a glowing fish', scene({
  water: ['#02202f', '#032b41', '#053248', '#02202f'],
  deep: '#000a12', wash: '.14', shaft: '#6ff0ff',
  bellA: '#ff7ad9', bellB: '#7af2d0', trailA: '#ffb3e8', trailB: '#a8ffe8',
  coralA: '#1d5a6e', coralB: '#26406b', coralC: '#14495c',
  rimA: '#5ef2ff', rimB: '#ff86dc', sand: '#062634',
  fishA: '#ffca5e', fishB: '#ff7a5e', ink: '#08202c', spark: '#d6feff'
}));

export const light = () => doc('Sunlit reef with jellyfish, coral and a bright fish', scene({
  water: ['#dff8ff', '#bfeefb', '#a6e4f2', '#cdf1fa'],
  deep: '#ffffff', wash: '.2', shaft: '#ffffff',
  bellA: '#ff9ed8', bellB: '#63d8b6', trailA: '#ff7fc8', trailB: '#43c3a2',
  coralA: '#6fd0c8', coralB: '#8fb6ea', coralC: '#63c6d8',
  rimA: '#1b9fc0', rimB: '#e05fa8', sand: '#eaf7fb',
  fishA: '#ffb347', fishB: '#ff7a5e', ink: '#154456', spark: '#7fd3e8'
}));
