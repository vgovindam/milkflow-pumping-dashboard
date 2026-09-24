import fs from 'node:fs';

const read=(p)=>fs.readFileSync(new URL(`../${p}`,import.meta.url),'utf8');
const files={css:read('styles.css'),ui:read('core-ui.js'),html:read('index.html'),sw:read('sw.template.js'),version:JSON.parse(read('version.json'))};
const failures=[];
const requireText=(name,source,expected)=>{if(!source.includes(expected))failures.push(`${name}: missing ${expected}`);};

requireText('mobile viewport',files.css,'min-height:100dvh');
requireText('mobile safe area',files.css,'env(safe-area-inset-bottom)');
requireText('saved parent name',files.ui,"name=s.profile?.momName||'Mom'");
requireText('smart Baby wish',files.ui,'function babyWishLine(');
if(files.ui.includes('Keeping tonight calm and simple'))failures.push('Baby hero must not restore the wordy late-night wish line');
requireText('last feed includes clock time',files.ui,'mf-last-feed-value');
requireText('last feed uses compact elapsed value',files.ui,"replace(/ ago$/,'')");
requireText('last feed has spaced time',files.ui,'mf-last-feed-value{display:flex');
requireText('compact Baby timing',files.ui,'mf-baby-timing');
requireText('compact Baby today line',files.ui,'mf-baby-todayline');
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

/* Nudges speak first, so the budget matters more than the copy: a card (never a dialog),
   at most three appearances per period, at most one a day, and acting on it ends it.
   Dismissing has to hold for the rest of the day - without the snooze the card came straight
   back on the re-render that the dismissal itself triggered. */
{
  const app=read('app.js'), ui=read('core-ui.js');
  requireText('nudge budget',app,'const NUDGE_LIMIT = 3;');
  requireText('weekly period',app,'function isoWeekKey(');
  requireText('two-day stash period',app,'Math.floor(Date.now() / STASH_PERIOD_MS)');
  requireText('two days is two days',app,'const STASH_PERIOD_MS = 172800000;');
  requireText('one appearance a day',app,"if(rec.lastShown === stamp) return;");
  requireText('dismiss holds for the day',app,'if(rec.snoozedOn === stamp) return false;');
  requireText('dismiss records the snooze',app,'rec.snoozedOn = stamp;');
  requireText('ignoring spends the budget',app,'rec.lastShown = stamp; rec.shown = (rec.shown || 0) + 1;');
  requireText('acting ends it',app,'function completeNudge(');
  requireText('nudge is a card',ui,'function nudgeCard(');
  /* The card's own button carries a data-view, so the generic route must not claim the click
     first - that is what left the card unanswered after you acted on it. */
  const order=app.indexOf("closest('[data-nudge-go]')"), route=app.indexOf("const route=e.target.closest('[data-view]')");
  if(order<0||route<0||order>route)failures.push('nudge clicks must be handled before the generic [data-view] route');
  if(/showModal\(\)[^;]*nudge/i.test(app))failures.push('nudges must be a dismissible card, not a dialog');
}
/* The freezer figure is typed by hand, so the screen that asks for it needs somewhere to say
   "done" - and nothing is written to the record until that button is pressed. */
{
  const app=read('app.js');
  requireText('stash has a save button',app,'data-stash-save');
  requireText('stash save commits the field',app,"S.profile.stashMl=Math.max(0,Math.round(+(el?.value)||0))");
  requireText('stash edits stay pending',app,'const hint=$(\'stashDirty\');');
  requireText('saving the stash answers the card',app,"completeNudge('stash')");
}
/* Back goes where you came from, not where the menu says this screen lives. */
requireText('back follows real history',read('app.js'),'const from = history.state?.from;');
requireText('back label names the real destination',read('app.js'),'const cameFrom=history.state?.from;');
/* Every list of what happened reads newest first, the day view included. */
requireText('day view is newest first',read('app.js'),"sort((a,b) => (b.time||'').localeCompare(a.time||''))");
/* Un-voiding has to WRITE the field. pushBabies merges, and a key that is absent from the
   payload leaves the cloud copy voided - so the record came back cleared on the next
   snapshot and a milestone could never be re-ticked. */
{
  const app=read('app.js');
  if(/delete\s+\w+\.voidedAt/.test(app))failures.push('un-void must set voidedAt=null, not delete it (Firestore merge ignores absent keys)');
  requireText('snapshot cannot undo a newer local edit',app,'if(old && stampOf(old) > stampOf(r)) return;');
}
/* A field with no Save button has to say that it saved, or the screen looks like it ate the
   number. */
{
  const app=read('app.js');
  requireText('silent saves are confirmed',app,'function fieldSaved(');
  for(const id of ['goalMl','stashMl'])
    if(!new RegExp(`\\$\\('${id}'\\)[^\n]*fieldSaved`).test(app))failures.push(`${id} saves silently with no confirmation`);
  for(const id of ['babyName','babyBirth','momName'])
    if(!new RegExp(`\\$\\('${id}'\\)[^\n]*toast\\(`).test(app))failures.push(`${id} saves silently with no confirmation`);
}
/* The update banner is driven by the version, not by worker events: events fired it twice per
   deploy and there was no way to put it away. */
{
  const notice=read('app-update-notice.js');
  requireText('update banner compares versions',notice,'async function updateIsReady()');
  requireText('update banner reads this build',notice,'window.MILKFLOW_BUILD?.version');
  requireText('update banner can be dismissed',notice,'aun-later');
  if(/addEventListener\('controllerchange',\s*\(\)\s*=>\s*\{[^}]*show\(\)/.test(notice))
    failures.push('controllerchange must not show the banner unconditionally');
}
/* The scene must be chosen by the same attribute as every other colour, or light mode keeps
   showing the dark plate until something happens to re-run the theme controller. */
requireText('scene resolves in CSS',read('experience-system.css'),':root[data-theme="dark"]{\n  --mf-theme-baby-scene:var(--mf-theme-baby-scene-dark,none);');
requireText('Baby world paints safe area',read('experience-system.css'),'body[data-realm="baby"]{background-image:var(--mf-theme-baby-scene)}');
requireText('Mom world paints safe area',read('experience-system.css'),'body[data-realm="mom"]{background-image:var(--mf-theme-mom-scene)}');
requireText('Mom tab has explicit contrast',read('experience-system.css'),'#personaTabs button:first-child.active{background:#76538c;color:#fff}');
requireText('Baby tab has explicit contrast',read('experience-system.css'),'#personaTabs button:last-child.active{background:#176d78;color:#fff}');
/* Six requested worlds are complete/selectable; Unicorn remains intentionally gated until
   it receives its own art package. */
{
  const exp=read('experience-theme.js');
  for(const id of ['ocean','celestial','woodland','safari-sunset','floral-meadow','cozy-clouds']){
    requireText(`ready theme ${id}`,exp,`id:'${id}',status:'ready'`);
    requireText(`painted asset package ${id}`,exp,`assets:assetSet('${id}')`);
  }
  requireText('Unicorn remains gated',exp,"id:'unicorn-dream',status:'artwork-needed'");
  requireText('themes are gated by readiness',exp,"filter(([,t])=>t.status==='ready')");
  requireText('theme library is public to the app',exp,'library:THEME_LIBRARY');
}
/* The Sounds switch shipped wired to nothing: it stored a preference that no code ever read.
   A control that does not control anything is worse than no control. */
{
  const app=read('app.js'), exp=read('experience-theme.js');
  requireText('save confirmation exists',app,'function confirmed(');
  requireText('confirmation respects the setting',app,"localStorage.getItem(FEEDBACK_KEY) !== 'off'");
  requireText('haptics are attempted',app,'navigator.vibrate?.(pattern)');
  if((app.match(/confirmed\((?!kind)/g)||[]).length<7)failures.push('every save point should confirm itself');
  requireText('the switch says what it does',exp,'Sound and vibration');
}
/* The phone owns one line of a notification whatever we do, so the line we own must not be
   the word "reminder" - it has to be the thing you would have opened the app to find out. */
{
  const app=read('app.js');
  requireText('notification carries the news',app,'notify(`Pump ${i+1} at ${to12(t)}`');
  requireText('feed notification names the baby',app,'notify(`${S.baby.name} is due for a feed`');
  requireText('notifications look like this app',app,"icon:'./milkflow-family-icon-192.png'");
  if(/notify\('(Pump|Feed) reminder'/.test(app))failures.push('a notification title should say what happened, not that it is a reminder');
  for(const token of ['function sleepPrediction(','function sleepStart(','async function sleepEnd(','function sleepReminderTick(','data-sleep-start','data-sleep-end']) requireText(`sleep workflow ${token}`,app,token);
}
/* One drawing, one container. The icon used to supply a disc AND sit on a plate AND sit in a
   tile. */
{
  const icons=read('scripts/care-icons/index.mjs'), ui=read('core-ui.js');
  if(/<circle cx="32" cy="32" r="31"/.test(icons))failures.push('care icons must not draw their own disc: the tile is the container');
  requireText('illustrated marks have no plate',ui,'.mf-care-mark.is-art{background:none;box-shadow:none}');
  requireText('feed SVG positioning is direct-child only',ui,'.mf-feed-card>svg{position:absolute');
  requireText('diaper SVG positioning is direct-child only',ui,'.mf-diaper-blob>svg{position:absolute');
  requireText('fallback glyph position is reset',ui,'.mf-care-mark>svg{position:static;inset:auto;');
  requireText('diaper icon clears count badge',ui,'.mf-diaper-blob>span.mf-care-mark{position:absolute;left:11px;');
  const expComponents=read('experience-components.css');
  requireText('decorative care sprite retired',expComponents,'content:none!important;display:none!important;background:none!important');
}
/* The next feed stays in the hero, but it is now a compact timing fact beside Last feed rather
   than one of three full-width dashboard boxes. */
requireText('next feed stays in compact Baby timing',read('core-ui.js'),'aria-label="Baby feeding timing"');
requireText('Last feed receives more width',read('component-theme-core.css'),'grid-template-columns:minmax(0,1.5fr) minmax(72px,.78fr)');
requireText('Last feed stays on one line',read('component-theme-core.css'),'flex-wrap:nowrap;min-width:0;white-space:nowrap');
if(/mf-hero-facts three/.test(read('core-ui.js')))failures.push('Baby Home must not restore the three full-width hero fact boxes');
/* A surface the dark layer forgets is a white card with white text on it. */
requireText('stash hero has a dark surface',read('core-ui.js'),':root[data-theme="dark"] body[data-realm] .stash-hero');
/* Mom and Baby now optimize for different jobs: Mom emphasizes the pump plan, while Baby
   emphasizes identity, a generous photo and time-sensitive feeding context. Both remain compact. */
requireText('mom hero composition',files.ui,'grid-template-areas:"greeting photo" "title photo" "facts facts" "next next"');
requireText('narrow phone step',files.ui,'.mf-dream-photo{width:108px;height:108px}');
requireText('relative time, not a clock',files.ui,'relativeAgo(x.last.date||today(),x.last.time)');
if(files.ui.includes('Your day, beautifully paced'))failures.push('mom hero: the headline must summarize the day, not repeat a slogan');
requireText('Mom keeps its fact component',files.ui,'.mf-hero-fact strong');
requireText('Baby has a generous photo',read('component-theme-core.css'),'width:136px;height:136px');
requireText('modern title face',files.ui,'.mf-journey-head strong,.mf-dream-actions .quick-tile strong{font-family:var(--display)');
requireText('editorial accent face',files.ui,'.mf-dream-hero .mf-dream-main h2,.mf-animal-copy h2{font-family:var(--editorial)');
requireText('mobile hero title scale',files.ui,'.mf-dream-main h2{grid-area:title;max-width:none;font-size:26px');
requireText('readable row copy',files.css,'.row-main strong{font-size:15px');
requireText('dark baby name',files.ui,':root[data-theme="dark"] .mf-animal-copy h2{color:#f7f3ff}');
requireText('dark baby wish',read('component-theme-core.css'),'.mf-baby-wish,');
requireText('dark baby timing',read('component-theme-core.css'),'.mf-baby-timing strong{color:#f0fbfc}');
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
requireText('print waits for document paint',read('doctor-summary.js'),'await nextPaint();');
requireText('app delegates print flow',read('app.js'),'printer?.print');
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
