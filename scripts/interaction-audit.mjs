import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const app = read('app.js');
const core = read('core-ui.js');
const css = read('component-theme.css');
const experienceCss = read('experience-themes.css');
const experienceJs = read('experience-theme.js');
const html = read('index.html');
const lifecycle = read('render-lifecycle.js');

const failures = [];
const need = (scope, source, text) => {
  if (!source.includes(text)) failures.push(`${scope}: missing ${text}`);
};

// Every route a Mom/Baby user can reach must still exist in the renderer contract.
const routes = [
  'mom-home','mom-history','mom-trends','mom-stash',
  'baby-home','baby-history','baby-trends','baby-growth',
  'development','doctor','more','settings',
  'set-account','set-baby','set-pumping','set-reminders','set-data','set-appearance','set-about',
];
const rendererBlock = app.slice(app.indexOf('const renderers={'), app.indexOf('const titles='));
for (const route of routes) {
  if (!rendererBlock.includes(route)) failures.push(`route renderer: ${route} is not wired`);
}

// Primary mobile navigation: same five targets in both workspaces, with Add in the middle.
for (const text of [
  "const home=baby?'baby-home':'mom-home'",
  "hist=baby?'baby-history':'mom-history'",
  "trend=baby?'baby-trends':'mom-trends'",
  "tab(home,'Home'",
  "tab(hist,'History'",
  'class="add-tab" data-add',
  "tab(trend,'Trends'",
  "tab('more','More'",
]) need('bottom navigation', app, text);

// All interaction families rendered by Mom/Baby screens must have one delegated owner.
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
for (const selector of selectors) {
  if (!clickBlock.includes(selector)) failures.push(`click contract: no handler for ${selector}`);
}

// The five data-entry dialogs must exist and submit through the canonical app owner.
for (const [dialog, form] of [
  ['momDialog','momForm'],['diaperDialog','diaperForm'],['feedDialog','feedForm'],
  ['growthDialog','growthForm'],['sleepDialog','sleepForm'],
]) {
  need('dialog markup', html, `<dialog id="${dialog}"`);
  need('form submit', app, `$('${form}').addEventListener('submit'`);
}

// Direct care actions used by the reimagined Mom/Baby homes.
for (const text of [
  'data-mom="pump"','data-mom="nursing"',
  'data-feed-type="nursing"','data-feed-type="expressed_milk"','data-feed-type="formula"',
  'data-diaper="wet"','data-diaper="poop"','data-diaper="both"','data-sleep','data-growth',
]) need('home quick action', core + app, text);

// Diaper normalization is a data invariant: UI says Mixed; storage uses `both`.
need('mixed diaper normalization', app, "if(s === 'mixed') return 'both'");
need('mixed diaper direct action', core, 'data-diaper="both"');
need('diaper selected value', app, "setWhen('diaperTime',0); pickChoice('diaperKind',k)");

// A direct Wet/Poopy/Mixed tap already chose the kind; only editing may ask again.
need('no duplicate diaper question', css, '#diaperDialog:not(.is-edit) .form-section:has([data-choice="diaperKind"])');

// Selected state is functional *and* visible. The controls layer may define dark surfaces,
// but the later named selection layer owns .on/.active/.sel so specificity cannot erase it.
need('cascade layer order', css, '@layer milkflow-core, milkflow-controls, milkflow-selection, milkflow-experience;');
for (const text of [
  '.choice-row button.on{', '.choice-row button.on::after{', '.when-quick button.on,',
  '.segmented button.on,', '.pills button.active,', '.day-chip.sel,', '.theme-opt.on{',
  ':root[data-theme="dark"] .choice-row button.on{',
]) need('selection visibility', css, text);

// Experience theme is a first-class switch, not a record-state patch or observer loop.
for (const text of [
  "const KEY='milkflow-experience-theme-v1'",
  "new Set(['storybook','clean'])",
  'data-experience-theme-pick="storybook"',
  'data-experience-theme-pick="clean"',
]) need('experience theme controller', experienceJs, text);
if (experienceJs.includes('MutationObserver')) failures.push('experience theme controller: MutationObserver is not allowed');
for (const text of [
  'assets/themes/cloud-island.svg','assets/themes/forest-clearing.svg',
  'mf-last-feed-band + .mf-care-label','mf-feed-zone + .mf-care-label',
  'content:"PUMPING"','content:"NURSING"',
  'assets/animals/bear.svg','assets/animals/rabbit.svg','assets/animals/fox.svg','assets/animals/owl.svg','assets/animals/beaver.svg',
]) need('experience theme surface', experienceCss, text);

// Navigation can never intentionally land on an empty viewport.
for (const text of ['function resetRouteScroll', 'function exactRouteControl', 'mf-render-recovery']) {
  need('navigation recovery', lifecycle, text);
}

// Data preservation contract stays intact while UI behavior changes.
for (const text of ["STATE_KEY = 'milkflow-family-v4-state'", 'function unionById', 'function commitRecord']) {
  need('data preservation', app, text);
}

if (failures.length) {
  console.error(`Interaction audit failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`Interaction audit passed: ${routes.length} routes, ${selectors.length} delegated action families, 5 entry forms, Mom/Baby quick actions, selected-state visibility, switchable experience themes, diaper flow, navigation recovery, and data-preservation contracts.`);
