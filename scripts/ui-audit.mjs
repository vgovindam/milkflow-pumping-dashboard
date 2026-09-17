import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const files={css:read('styles.css'),ui:read('core-ui.js'),html:read('index.html'),sw:read('sw.template.js'),version:JSON.parse(read('version.json'))};
const failures=[];
const requireText=(name,source,expected)=>{if(!source.includes(expected))failures.push(`${name}: missing ${expected}`);};

requireText('mobile viewport',files.css,'min-height:100dvh');
requireText('mobile safe area',files.css,'env(safe-area-inset-bottom)');
requireText('saved parent name',files.ui,"name=s.profile?.momName||'Mom'");
requireText('hero data coverage',files.ui,'mf-dream-side-note');
requireText('modern title face',files.ui,'.mf-journey-head strong,.mf-dream-actions .quick-tile strong{font-family:var(--display)');
requireText('editorial accent face',files.ui,'.mf-dream-hero .mf-dream-main h2,.mf-animal-copy h2{font-family:var(--editorial)');
requireText('mobile hero title scale',files.ui,'.mf-dream-main h2{font-size:32px');
requireText('readable row copy',files.css,'.row-main strong{font-size:15px');
requireText('dark baby name',files.ui,':root[data-theme="dark"] .mf-animal-copy h2{color:#f7f3ff}');
requireText('dark baby details',files.ui,':root[data-theme="dark"] .mf-animal-copy small{color:#d7e7ef}');
requireText('dark journey details',files.ui,'.mf-dream-journey>p,:root[data-theme="dark"] .mf-journey-stop small{color:#c0c7d8!important}');

if(!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(files.version.version||''))failures.push('version.json: invalid semantic version');
for(const asset of ['manifest.webmanifest','styles.css','theme.css','doctor-summary.css','app.js','experience-theme.js','sw.js']){
  requireText(`version placeholder ${asset}`,files.html,asset==='sw.js'?`sw.js?v=__MILKFLOW_VERSION__`:`${asset}?v=__MILKFLOW_VERSION__`);
}
requireText('service worker version source',files.sw,"milkflow-v__MILKFLOW_VERSION__");
requireText('service worker generated shell',files.sw,'__MILKFLOW_SHELL__');

const rgb=value=>{const clean=value.replace('#','');return[0,2,4].map(o=>Number.parseInt(clean.slice(o,o+2),16)/255);};
const luminance=value=>{const c=rgb(value).map(x=>x<=0.03928?x/12.92:((x+0.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
const contrast=(fg,bg)=>{const [light,dark]=[luminance(fg),luminance(bg)].sort((a,b)=>b-a);return(light+.05)/(dark+.05);};
const contrastPairs=[
  ['primary text','#1d2033','#ffffff'],['secondary text','#4a5064','#ffffff'],['muted text','#5f6679','#ffffff'],['mom accent','#5a3fb0','#f2ecff'],['baby stat','#15516d','#b2e3f8'],['baby diaper','#74451b','#ffdaa9'],['wet diaper','#145b86','#9fd7f4'],['poopy diaper','#68420d','#f4ca76'],['mixed diaper','#46307f','#bca5f4'],['dark primary text','#eef1f7','#1b1c2f'],['dark secondary text','#b7bfd0','#1b1c2f'],['dark muted text','#a8afc1','#1b1c2f'],['dark baby name','#f7f3ff','#51355e'],['dark baby details','#d7e7ef','#51355e'],['dark wet diaper','#7ed4ff','#174a65'],['dark poopy diaper','#ffd487','#5a4211'],['dark mixed diaper','#c9b4ff','#463169']
];
for(const [name,fg,bg] of contrastPairs){const ratio=contrast(fg,bg);if(ratio<4.5)failures.push(`${name}: contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);}
if(failures.length){console.error(`UI audit failed:\n- ${failures.join('\n- ')}`);process.exit(1);}
console.log(`UI audit passed: ${contrastPairs.length} contrast pairs, semantic version contract, responsive scrolling, names, hierarchy, and live-data coverage.`);
