import fs from 'node:fs';

const read = (path) => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const files = {
  css: read('styles.css'),
  ui: read('core-ui.js'),
  app: read('app.js'),
  chat: read('family-chat.js'),
  html: read('index.html'),
  sw: read('sw.js'),
};

const failures = [];
const requireText = (name, source, expected) => {
  if (!source.includes(expected)) failures.push(`${name}: missing ${expected}`);
};

requireText('mobile viewport', files.css, 'min-height:100dvh');
requireText('mobile safe area', files.css, 'env(safe-area-inset-bottom)');
requireText('saved parent name', files.ui, "name=s.profile?.momName||'Mom'");
requireText('explicit render lifecycle', files.app, "CustomEvent('milkflow:base-rendered'");
requireText('single experience listener', files.ui, "window.addEventListener('milkflow:base-rendered',afterApp)");
requireText('one-day five pump control', files.ui, 'data-mf-target="5"');
requireText('one-day six pump control', files.ui, 'data-mf-target="6"');
requireText('next time adjustment', files.ui, 'function openPlanDialog()');
requireText('mom task dashboard', files.ui, 'aria-label="Mom dashboard"');
requireText('baby task dashboard', files.ui, 'aria-label="Baby dashboard"');
requireText('mom primary action', files.ui, 'class="mf-x-primary" data-mom="pump"');
requireText('baby care quick actions', files.ui, 'class="mf-x-feed-grid"');
requireText('modern title face', files.ui, 'font:750 21px/1.12 var(--display)');
requireText('editorial profile accent', files.ui, 'font:650 34px/.98 var(--editorial)');
requireText('readable row copy', files.css, '.row-main strong{font-size:15px');
requireText('dark mom hero', files.ui, ':root[data-theme="dark"] .mf-x-hero.mom');
requireText('dark baby hero', files.ui, ':root[data-theme="dark"] .mf-x-hero.baby');
requireText('chat endpoint failover', files.chat, 'for(const url of urls)');
requireText('relevant pump coach', files.chat, '<strong>Pump coach</strong>');

if (files.html.includes('stable34-bridge.js')) failures.push('architecture: legacy DOM interception layer is still loaded');

const buildTags = [...files.html.matchAll(/build=(stable\d+)/g)].map((match) => match[1]);
if (!buildTags.length || new Set(buildTags).size !== 1) failures.push('cache build: asset tags do not share one version');
else requireText('service worker build', files.sw, `milkflow-${buildTags[0]}`);

const rgb = (value) => {
  const clean = value.replace('#', '');
  return [0, 2, 4].map((offset) => Number.parseInt(clean.slice(offset, offset + 2), 16) / 255);
};
const luminance = (value) => {
  const channels = rgb(value).map((channel) => channel <= 0.03928
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
};
const contrast = (foreground, background) => {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
};

const contrastPairs = [
  ['primary text', '#1d2033', '#ffffff'],
  ['secondary text', '#4a5064', '#ffffff'],
  ['muted text', '#5f6679', '#ffffff'],
  ['mom accent', '#5a3fb0', '#f2ecff'],
  ['baby stat', '#15516d', '#b2e3f8'],
  ['baby diaper', '#74451b', '#ffdaa9'],
  ['wet diaper', '#145b86', '#9fd7f4'],
  ['poopy diaper', '#68420d', '#f4ca76'],
  ['mixed diaper', '#46307f', '#bca5f4'],
  ['dark primary text', '#eef1f7', '#1b1c2f'],
  ['dark secondary text', '#b7bfd0', '#1b1c2f'],
  ['dark muted text', '#a8afc1', '#1b1c2f'],
  ['dark mom tile', '#d9c9ff', '#3a315f'],
  ['dark nursing tile', '#ffc2dc', '#532b42'],
  ['dark baby milk', '#d2efff', '#263c64'],
  ['dark wet diaper', '#7ed4ff', '#174a65'],
  ['dark poopy diaper', '#ffd487', '#5a4211'],
  ['dark mixed diaper', '#c9b4ff', '#463169'],
];

for (const [name, foreground, background] of contrastPairs) {
  const ratio = contrast(foreground, background);
  if (ratio < 4.5) failures.push(`${name}: contrast ${ratio.toFixed(2)}:1 is below 4.5:1`);
}

if (failures.length) {
  console.error(`UI audit failed:\n- ${failures.join('\n- ')}`);
  process.exit(1);
}

console.log(`UI audit passed: ${contrastPairs.length} contrast pairs, responsive scrolling, names, hierarchy, and live-data coverage.`);
