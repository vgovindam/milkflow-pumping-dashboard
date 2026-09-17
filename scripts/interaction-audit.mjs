import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const core = read('core-ui.js');
const css = read('component-theme.css');
const experienceCss = read('experience-system-v3.css');
const experienceJs = read('experience-theme-v3.js');
const doctorJs = read('doctor-summary.js');
const doctorCss = read('doctor-summary.css');
const html = read('index.html');
const lifecycle = read('render-lifecycle.js');

const failures = [];
const need = (scope, source, text) => {
  if (!source.includes(text)) failures.push(`${scope}: missing ${text}`);
};

const routes = [
  'mom-home','mom-history','mom-trends','mom-stash',
  'baby-home','baby-history','baby-trends','baby-growth',
  'development','doctor','more','settings',
  'set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about',
];
const rendererBlock = app.slice(app.indexOf('const renderers={'), app.indexOf('const titles='));
for (const route of routes) if (!rendererBlock.includes(route)) failures.push(`route renderer: ${route} is not wired`);

for (const text of [
  "const home=baby?'baby-home':'mom-home'",
  "hist=baby?'baby-history':'mom-history'",
  "trend=baby?'baby-trends':'mom-trends'",
  "tab(home,'Home'", "tab(hist,'History'", 'class="add-tab" data-add',
  "tab(trend,'Trends'", "tab('more','More'",
]) need('bottom navigation', app, text);

for (const text of [
  'display:grid!important;position:fixed!important;z-index:70!important',
  'grid-template-columns:repeat(5,minmax(0,1fr))!important',
  '.bottom-nav svg.ico,.bottom-nav svg.gly,.topbar svg.ico,.back-btn svg.ico{display:block!important}',
]) need('mobile shell contract', css, text);

const clickBlock = app.slice(app.indexOf('function handleClick(e){'), app.indexOf("document.addEventListener('click',handleClick)"));
const selectors = [
  '[data-close]','[data-workspace]','[data-view]','[data-back]','[data-add]',
  '[data-history-mode]','[data-review-date]','[data-stage]','[data-milestone]',
  '[data-pick]','[data-dismiss]','[data-theme-pick]','[data-bump]','[data-preset]','[data-when]',
  '[data-record]','[data-edit-record]','[data-void-record]',
  '[data-mom]','[data-feed]','[data-feed-type]','[data-diaper]','[data-growth]','[data-sleep]',
  '[data-import]','[data-export]','[data-cloud-check]','[data-reminders]','[data-feed-reminders]',
  '[data-auth]','[data-signout]','[data-print]','[data-mom-range]','[data-baby-range]',
  '[data-baby-filter]','[data-trend-range]','[data-doctor-range]','[data-stash]',
];
for (const selector of selectors) if (!clickBlock.includes(selector)) failures.push(`click contract: no handler for ${selector}`);

for (const [dialog, form] of [
  ['momDialog','momForm'],['diaperDialog','diaperForm'],['feedDialog','feedForm'],
  ['growthDialog','growthForm'],['sleepDialog','sleepForm'],
]) {
  need('dialog markup', html, `<dialog id="${dialog}"`);
  need('form submit', app, `$('${form}').addEventListener('submit'`);
}

for (const text of [
  'data-mom="pump"','data-mom="nursing"',
  'data-feed-type="nursing"','data-feed-type="expressed_milk"','data-feed-type="formula"',
  'data-diaper="wet"','data-diaper="poop"','data-diaper="both"','data-sleep','data-growth',
]) need('home quick action', core + app, text);

need('mixed diaper normalization', app, "if(s === 'mixed') return 'both'");
need('mixed diaper direct action', core, 'data-diaper="both"');
need('diaper selected value', app, "setWhen('diaperTime',0); pickChoice('diaperKind',k)");
need('no duplicate diaper question', css, '#diaperDialog:not(.is-edit) .form-section:has([data-choice="diaperKind"])');

need('cascade layer order', css, '@layer milkflow-core, milkflow-experience, milkflow-controls, milkflow-selection;');
for (const text of [
  '.choice-row button.on{', '.choice-row button.on::after{', '.when-quick button.on,',
  '.segmented button.on,', '.pills button.active,', '.day-chip.sel,', '.theme-opt.on{',
  ':root[data-theme="dark"] .choice-row button.on{',
]) need('selection visibility', css, text);

for (const text of [
  "const KEY='milkflow-experience-theme-v1'",
  "new Set(['safari','butterfly','princess','unicorn','clean'])",
  "value==='jungle'||value==='storybook'",
  "themeCard('safari','Safari Adventure'",
  "themeCard('butterfly','Butterfly Garden'",
  "themeCard('princess','Princess Palace'",
  "themeCard('unicorn','Unicorn Dreams'",
  'data-experience-theme-pick="clean"',
  'Mom + Baby',
]) need('experience theme controller', experienceJs, text);
if (experienceJs.includes('MutationObserver')) failures.push('experience theme controller: observer loop is not allowed');
if (experienceJs.includes('mf-theme-animal') || experienceJs.includes('decorateThemeArtwork')) failures.push('experience theme controller must not replace semantic care icons with animal artwork');

for (const text of [
  'assets/themes/safari-world-v2.svg','assets/themes/butterfly-garden.svg','assets/themes/princess-palace.svg','assets/themes/unicorn-dreams.svg',
  'body:is([data-realm="mom"],[data-realm="baby"]) .main',
  'body[data-screen="mom-home"] .mf-dream-hero',
  'body[data-screen="baby-home"] .mf-animal-checkin:before',
  'assets/themes/care-milk.svg','assets/themes/care-nurse.svg','assets/themes/care-formula.svg',
  'assets/themes/care-wet.svg','assets/themes/care-poop.svg','assets/themes/care-mixed.svg',
  'body[data-screen="baby-home"] .mf-feed-card:before','body[data-screen="baby-home"] .mf-diaper-blob:before',
  'padding-bottom:calc(164px + env(safe-area-inset-bottom))',
]) need('realm-wide experience surface', experienceCss, text);
need('canonical composition stylesheet loaded', html, 'component-theme-v3.css?build=stable45-human15');
need('realm-wide controller loaded', html, 'experience-theme-v3.js?build=stable45-human15');
if (html.includes('experience-system-v3.css?build=')) failures.push('experience stylesheet must be composed through component-theme-v3.css, not loaded as a late patch link');
if (html.includes('experience-art-v2.css?build=')) failures.push('legacy home-only experience stylesheet must not be loaded');
if (html.includes('experience-theme-v2.js?build=')) failures.push('legacy theme controller must not be loaded');
if (experienceCss.includes('.bottom-nav svg{display:none')) failures.push('experience themes must not hide functional navigation icons');

for (const text of [
  ':root[data-theme="dark"]:not([data-experience-theme="clean"])',
  'body[data-screen="baby-home"] .mf-animal-copy h2',
  'body[data-screen="baby-home"] .mf-animal-stat',
]) need('theme dark contrast', experienceCss, text);

for (const text of ['mf-doctor-print','mf-print-table','Clinical snapshot','Daily care log','prepareDoctorPrint']) need('clinician doctor report', doctorJs + doctorCss, text);
need('doctor component loaded', html, 'doctor-summary.js?build=stable45-human15');
need('doctor stylesheet loaded', html, 'doctor-summary.css?build=stable45-human15');

for (const text of ['function resetRouteScroll', 'function exactRouteControl', 'mf-render-recovery']) need('navigation recovery', lifecycle, text);
for (const text of ["STATE_KEY = 'milkflow-family-v4-state'", 'function unionById', 'function commitRecord']) need('data preservation', app, text);

if (failures.length) {
  console.error(`Interaction audit failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Interaction audit passed: ${routes.length} routes, ${selectors.length} delegated action families, protected navigation/icons, five entry forms, realm-wide Mom/Baby worlds, semantic care artwork, dark contrast, clinician reports, navigation recovery, and data-preservation contracts.`);
