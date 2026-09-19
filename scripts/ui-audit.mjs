import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const files={css:read('styles.css'),ui:read('core-ui.js'),html:read('index.html'),sw:read('sw.template.js'),version:JSON.parse(read('version.json'))};
const failures=[];
const requireText=(name,source,expected)=>{if(!source.includes(expected))failures.push(`${name}: missing ${expected}`);};

requireText('mobile viewport',files.css,'min-height:100dvh');
requireText('mobile safe area',files.css,'env(safe-area-inset-bottom)');
requireText('saved parent name',files.ui,"name=s.profile?.momName||'Mom'");
requireText('hero fact boxes',files.ui,'mf-hero-facts');
/* Development kept the component layer's pale card in dark mode and printed light ink on it -
   96 failures at 1.01-1.31:1 - because .journey/.stage-card/.ms-group were never added to the
   surface contract. Any screen-level surface has to be in that list. */
{
  const exp=read('experience-system.css');
  for(const surface of ['.journey','.stage-card','.ms-group'])
    if(!exp.includes(surface+',')&&!exp.includes(surface+')'))
      failures.push(`experience-system.css: ${surface} is missing from the surface contract`);
}
/* The two heroes are one card seen from two sides: the portrait must not change shape when
   the persona switches. */
if(/\.mf-profile-photo\{[^}]*border-radius:(?!50%)/.test(files.ui))
  failures.push('the Baby portrait must be a circle, like the Mom portrait');
/* The app has to be able to render what is already on the device without waiting for a
   third-party CDN. */
if(/<script[^>]+gstatic\.com\/firebasejs/.test(files.html))
  failures.push('index.html: the Firebase SDKs must load on demand, not as script tags ahead of app.js');
requireText('firebase loads on demand',read('app.js'),'function loadFirebase()');
/* Both heroes answer the same two questions in the same place. The hero is reviewed at phone
   width, so the composition has a 393pt step and a 375pt step - a Pro-sized photo beside a
   column that still fits a greeting with a name in it. */
requireText('mom hero composition',files.ui,'grid-template-areas:"greeting photo" "title photo" "facts facts" "next next"');
requireText('narrow phone step',files.ui,'.mf-dream-photo{width:108px;height:108px}');
requireText('relative time, not a clock',files.ui,'relativeAgo(x.last.date||today(),x.last.time)');
if(files.ui.includes('Your day, beautifully paced'))failures.push('mom hero: the headline must summarize the day, not repeat a slogan');
requireText('both heroes share the fact component',files.ui,'.mf-hero-fact strong');
requireText('modern title face',files.ui,'.mf-journey-head strong,.mf-dream-actions .quick-tile strong{font-family:var(--display)');
requireText('editorial accent face',files.ui,'.mf-dream-hero .mf-dream-main h2,.mf-animal-copy h2{font-family:var(--editorial)');
requireText('mobile hero title scale',files.ui,'.mf-dream-main h2{grid-area:title;max-width:none;font-size:26px');
requireText('readable row copy',files.css,'.row-main strong{font-size:15px');
requireText('dark baby name',files.ui,':root[data-theme="dark"] .mf-animal-copy h2{color:#f7f3ff}');
requireText('dark baby details',files.ui,':root[data-theme="dark"] .mf-animal-copy small{color:#d7e7ef}');
requireText('dark journey details',files.ui,'.mf-dream-journey>p,:root[data-theme="dark"] .mf-journey-stop small{color:#c0c7d8}');

/* ------------------------------------------------------------------ cascade contract --
 * Layer order is the only thing deciding who wins, so it is a contract, not a convention.
 * These checks exist because the alternative - a new rule added at the bottom with
 * !important - is exactly how this stylesheet got to ~930 forced declarations. */
const layers=read('styles.css');
requireText('layer order declared once',layers,'@layer milkflow-base, milkflow-core, milkflow-components, milkflow-screens, milkflow-dark, milkflow-experience, milkflow-controls, milkflow-selection;');
requireText('dark corrections are a layer',read('component-theme-core.css'),'@layer milkflow-dark {');
requireText('base sheet is a layer',layers,'@layer milkflow-base {');
requireText('component css is a layer',files.ui,'@layer milkflow-components {');
{
  /* Comments in these files explain what !important used to do here, so strip them first. */
  const declarationsOnly=css=>css.replace(/\/\*[\s\S]*?\*\//g,'');
  const componentCss=declarationsOnly(files.ui.slice(files.ui.indexOf('@layer milkflow-components {'),files.ui.indexOf('\n}\n`;')));
  if(componentCss.includes('!important'))failures.push('component layer: !important is not allowed - move the rule to a later layer instead');
  const core=read('component-theme-core.css');
  if(declarationsOnly(core).includes('!important'))failures.push('component-theme-core.css: !important is not allowed - layer order decides');
  if(!core.includes('@layer milkflow-screens {'))failures.push('component-theme-core.css: the Baby home composition must sit in milkflow-screens');
  const doctor=read('doctor-summary.css');
  if(!doctor.includes('@layer milkflow-screens {'))failures.push('doctor-summary.css: the on-screen block must sit in milkflow-screens');
  if(doctor.indexOf('@media print{')<doctor.indexOf('@layer milkflow-screens {'))failures.push('doctor-summary.css: the print document must stay outside the layer system');
}

/* -------------------------------------------------------------- doctor report model --
 * The screen and the printed summary read one model. Scraping the DOM back into a report is
 * what made the print-out drift from what the app actually showed. */
requireText('doctor report model',read('app.js'),'window.MilkFlowReports={doctorSummary:doctorReport}');
requireText('doctor screen reads the model',read('app.js'),'const r=doctorReport();');
requireText('print document reads the model',read('doctor-summary.js'),'window.MilkFlowReports?.doctorSummary?.()');
if(read('doctor-summary.js').includes('.qa-grid > div'))failures.push('doctor-summary.js: the print document must not scrape the rendered screen');

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
