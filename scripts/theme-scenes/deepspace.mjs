import {stars, sparkles, commonDefs, doc} from './lib.mjs';

/* Deep Space. The signature is the ringed planet in the upper right, which is inside every
   crop the app takes, and a comet that leads the eye back towards the middle. The little
   astronaut sits low, where the page background shows but the hero does not. */

function scene({sky, deep, nebulaA, nebulaB, planetA, planetB, ring, ringDark, moon, star,
                suitA, suitB, visor, line, comet, dust, wash}){
  return `<defs>
<linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
  <stop stop-color="${sky[0]}"/><stop offset=".3" stop-color="${sky[1]}"/>
  <stop offset=".62" stop-color="${sky[2]}"/><stop offset="1" stop-color="${sky[3]}"/>
</linearGradient>
<radialGradient id="nebA"><stop stop-color="${nebulaA}" stop-opacity=".85"/><stop offset="1" stop-color="${nebulaA}" stop-opacity="0"/></radialGradient>
<radialGradient id="nebB"><stop stop-color="${nebulaB}" stop-opacity=".8"/><stop offset="1" stop-color="${nebulaB}" stop-opacity="0"/></radialGradient>
<linearGradient id="planet" x1=".2" y1="0" x2=".85" y2="1"><stop stop-color="${planetA}"/><stop offset="1" stop-color="${planetB}"/></linearGradient>
<linearGradient id="ringG" x1="0" y1="0" x2="1" y2="0"><stop stop-color="${ring}" stop-opacity=".25"/><stop offset=".5" stop-color="${ring}"/><stop offset="1" stop-color="${ring}" stop-opacity=".25"/></linearGradient>
<linearGradient id="cometG" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="430" y2="0"><stop stop-color="${comet}" stop-opacity="0"/><stop offset="1" stop-color="${comet}"/></linearGradient>
<linearGradient id="suit" x1=".2" y1="0" x2=".8" y2="1"><stop stop-color="${suitA}"/><stop offset="1" stop-color="${suitB}"/></linearGradient>
<radialGradient id="visorG" cx=".38" cy=".3"><stop stop-color="${visor[0]}"/><stop offset="1" stop-color="${visor[1]}"/></radialGradient>
${commonDefs()}
</defs>
<rect width="1000" height="2200" fill="url(#sky)"/>
<rect width="1000" height="2200" fill="${deep}" opacity="${wash}"/>

<!-- nebula haze: the colour in the sky, kept far from the middle band -->
<g filter="url(#bloom)" opacity=".85">
  <ellipse cx="180" cy="430" rx="360" ry="300" fill="url(#nebA)"/>
  <ellipse cx="880" cy="1180" rx="330" ry="420" fill="url(#nebB)"/>
  <ellipse cx="120" cy="1880" rx="300" ry="280" fill="url(#nebA)"/>
</g>

${stars(20260922, {count: 190, to: 2200, fill: star, max: 2.4})}
${sparkles(1, [[214, 232, 15], [126, 700, 10, .8], [864, 640, 12, .9], [742, 1512, 11, .85], [268, 1330, 9, .7], [906, 2004, 13, .8], [352, 1960, 9, .65]], star)}

<!-- ringed planet -->
<g transform="translate(772 292)">
  <ellipse cx="0" cy="0" rx="330" ry="86" transform="rotate(-18)" fill="none" stroke="${ringDark}" stroke-width="34" opacity=".55"/>
  <circle cx="0" cy="0" r="168" fill="url(#planet)"/>
  <path d="M-168 0a168 168 0 0 0 336 0Z" fill="${ringDark}" opacity=".18"/>
  <ellipse cx="-52" cy="-58" rx="74" ry="34" fill="#fff" opacity=".10"/>
  <ellipse cx="34" cy="52" rx="96" ry="30" fill="${ringDark}" opacity=".16"/>
  <ellipse cx="0" cy="0" rx="330" ry="86" transform="rotate(-18)" fill="none" stroke="url(#ringG)" stroke-width="20"/>
  <ellipse cx="0" cy="0" rx="272" ry="70" transform="rotate(-18)" fill="none" stroke="${ring}" stroke-width="6" opacity=".5"/>
</g>

<!-- small moon -->
<g transform="translate(150 1020)">
  <circle r="62" fill="url(#planet)" opacity=".92"/>
  <circle cx="-18" cy="-14" r="13" fill="${ringDark}" opacity=".22"/>
  <circle cx="20" cy="18" r="9" fill="${ringDark}" opacity=".18"/>
  <circle cx="8" cy="-28" r="7" fill="${ringDark}" opacity=".15"/>
</g>

<!-- comet: the trail gradient is in user space because a flat horizontal stroke has a
     zero-height bounding box, and an objectBoundingBox gradient across one paints nothing -->
<g transform="translate(180 1520) rotate(-24)">
  <path d="M0 0h420" stroke="url(#cometG)" stroke-width="12" stroke-linecap="round" opacity=".75" filter="url(#soft)"/>
  <circle cx="430" cy="0" r="15" fill="${comet}"/>
  <circle cx="430" cy="0" r="34" fill="${comet}" opacity=".35" filter="url(#glow)"/>
</g>

<!-- astronaut cub, tethered and drifting -->
<g transform="translate(610 1800) rotate(9)">
  <path d="M-250 120C-160 40-60 26 20 62" fill="none" stroke="${line}" stroke-width="5" stroke-linecap="round" opacity=".55" stroke-dasharray="3 14"/>
  <g filter="url(#glow)" opacity=".5"><circle cx="0" cy="0" r="118" fill="${comet}"/></g>
  <rect x="-74" y="34" width="148" height="132" rx="56" fill="url(#suit)"/>
  <rect x="-116" y="52" width="58" height="104" rx="29" fill="url(#suit)"/>
  <rect x="58" y="52" width="58" height="104" rx="29" fill="url(#suit)"/>
  <rect x="-56" y="152" width="50" height="96" rx="25" fill="url(#suit)"/>
  <rect x="6" y="152" width="50" height="96" rx="25" fill="url(#suit)"/>
  <circle cx="0" cy="-26" r="86" fill="url(#suit)"/>
  <circle cx="0" cy="-26" r="66" fill="url(#visorG)"/>
  <path d="M-44 -54q26-22 62-10" fill="none" stroke="#fff" stroke-width="9" stroke-linecap="round" opacity=".55"/>
  <circle cx="-22" cy="-20" r="7" fill="${visor[2]}"/><circle cx="22" cy="-20" r="7" fill="${visor[2]}"/>
  <path d="M-16 6q16 14 32 0" fill="none" stroke="${visor[2]}" stroke-width="6" stroke-linecap="round"/>
  <rect x="-30" y="58" width="60" height="30" rx="15" fill="${visor[1]}" opacity=".6"/>
</g>

<!-- far dust band, keeps the very bottom from going flat -->
<path d="M0 2080q250-110 500-40t500-52v212H0Z" fill="${dust}" opacity=".5"/>
<path d="M0 2148q250-72 500-24t500-34v110H0Z" fill="${dust}" opacity=".7"/>`;
}

export const dark = () => doc('Deep space night with a ringed planet, comet and drifting astronaut', scene({
  sky: ['#05060f', '#100b28', '#1d1038', '#0b0a20'],
  deep: '#02030a', wash: '.12',
  nebulaA: '#5b3bd6', nebulaB: '#1f7fa8',
  planetA: '#b8a7ff', planetB: '#6f5ac6', ring: '#8ee6ff', ringDark: '#2a1f52',
  moon: '#cfc6ff', star: '#ffffff',
  suitA: '#f2f5ff', suitB: '#c3caea', visor: ['#5de0ff', '#173a63', '#0b2038'],
  line: '#9fb4d8', comet: '#7ef0ff', dust: '#160f33'
}));

export const light = () => doc('Pale dawn sky with a ringed planet, comet and drifting astronaut', scene({
  sky: ['#eaf1ff', '#e6e6ff', '#f2e9ff', '#e9f3ff'],
  deep: '#ffffff', wash: '.16',
  nebulaA: '#b9a6ff', nebulaB: '#8fd6f2',
  planetA: '#fff3ff', planetB: '#b9a3ef', ring: '#4fc3e8', ringDark: '#9a8ad0',
  moon: '#ffffff', star: '#7d86c4',
  suitA: '#ffffff', suitB: '#dfe5f8', visor: ['#9ae9ff', '#4a7fae', '#22456b'],
  line: '#8b97bd', comet: '#35bcd8', dust: '#d7deff'
}));
