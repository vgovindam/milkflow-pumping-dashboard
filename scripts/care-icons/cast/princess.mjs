/* Princess-palace cast: the royal pets. Crowns and ribbons carry the theme; the animals
   keep it warm rather than precious. */
import * as P from '../parts.mjs';

const H = P.HEAD;

const whiskers = c => P.stroke(
  `M${H.cx - 8} ${H.cy + 7.4} l-6.4 -1.6M${H.cx - 8} ${H.cy + 9.6} l-6.6 1.4M${H.cx + 8} ${H.cy + 7.4} l6.4 -1.6M${H.cx + 8} ${H.cy + 9.6} l6.6 1.4`,
  c.ink, 1.1, 'stroke-opacity=".38"');

const kitten = {
  name: 'crowned kitten',
  coat: '#F7E3C8', coat2: '#E6CBA6', inner: '#FFF6E9', mark: '#D9B78A',
  render: c => [
    P.earsPointed(c, {dx: 11.8, dy: -12.4, w: 7, h: 10.2}),
    P.head(c),
    P.crown(c, {cy: H.cy - 18.6, w: 12.4}),
    P.muzzle(c, {rx: 8.4, ry: 6, nose: 'triangle'}),
    whiskers(c),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const bunny = {
  name: 'mama bunny',
  coat: '#FBEDF2', coat2: '#EED6E0', inner: '#FFFFFF', mark: '#E4BFD1',
  render: c => [
    P.earsLong(c, {dx: 7.8, dy: -19.4, rx: 4, ry: 10.4, tilt: 13}),
    P.head(c),
    P.bow(c, {cx: H.cx + 12.6, cy: H.cy - 11.8, s: 0.82}),
    P.muzzle(c, {rx: 8.6, ry: 6.2}),
    P.stroke(`M${H.cx - 2.4} ${H.cy + 12.2} h4.8`, '#FFFFFF', 1.8, 'stroke-opacity=".9"'),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const puppy = {
  name: 'royal puppy',
  coat: '#EDC895', coat2: '#D8AC72', inner: '#FDF0DC', mark: '#C08F55',
  render: c => [
    P.earsFloppy(c, {dx: 15.8, dy: -2.4, rx: 5.4, ry: 9}),
    P.head(c),
    P.crown(c, {cy: H.cy - 17.8, w: 11.6, color: '#F3D89A'}),
    P.ellipse(H.cx - 9.4, H.cy - 5.4, 5.4, 4.6, c.mark, 'fill-opacity=".45"'),
    P.muzzle(c, {rx: 9, ry: 6.4}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const swan = {
  name: 'swan',
  coat: '#FFFFFF', coat2: '#EFE2EB', inner: '#FAF0F6', mark: '#D9C2D3', beak: '#EE9A2E',
  render: c => [
    /* body, then the S of the neck, both behind the head */
    P.ellipse(H.cx - 3.4, H.cy + 15.4, 15.6, 8.4, c.coat2),
    P.ellipse(H.cx - 3.4, H.cy + 15.4, 15.6, 8.4, 'none', `stroke="${c.mark}" stroke-opacity=".95" stroke-width="1.3"`),
    P.path(`M${H.cx - 14.4} ${H.cy + 12.4} q-2.4 -7.4 4.4 -10.4 q6.4 -2.6 7.4 -6.4 q3 6.4 -3.4 10.4 q-5.4 3.4 -4.4 7.4Z`, c.coat),
    P.stroke(`M${H.cx - 13.8} ${H.cy + 12.4} q-2 -7 4.2 -9.9 q6.2 -2.7 7.2 -6.3`, c.mark, 1.3, 'stroke-opacity=".9"'),
    P.head({...c, ink: c.mark}, {rx: 11.6, ry: 11, cx: H.cx - 1.4, cy: H.cy - 5.4}),
    P.tiara(c, {cy: H.cy - 13.4}),
    P.path(`M${H.cx - 5.4} ${H.cy - 2.4} h7.4 l-3.7 5.4Z`, c.beak),
    P.eyes({...c, ink: c.ink}, {dx: 5, dy: -6.8, rx: 2.5, ry: 2.9}),
    P.cheeks(c, {dx: 8.4, dy: -3, rx: 2.5, ry: 1.8})
  ].join('')
};

const mouse = {
  name: 'little mouse',
  coat: '#DDCADF', coat2: '#C3ACC7', inner: '#F6EEF8', mark: '#B295B8',
  render: c => [
    P.earsRound(c, {dx: 15.4, dy: -10.6, rad: 7.6, inner: 4.6}),
    P.head(c, {rx: 15.4, ry: 14.8}),
    P.tiara(c, {cy: H.cy - 15.4}),
    P.path(`M${H.cx - 6.4} ${H.cy + 4.4} q6.4 10.4 12.8 0Z`, c.inner, 'fill-opacity=".9"'),
    P.ellipse(H.cx, H.cy + 5.6, 2.6, 2, c.ink),
    whiskers(c),
    P.eyes(c, {dx: 5.6, dy: -1.6}),
    P.cheeks(c, {dx: 11, dy: 4})
  ].join('')
};

const poodle = {
  name: 'poodle',
  coat: '#FBF0F5', coat2: '#F0DCE7', inner: '#FFFFFF', mark: '#F4E2EC',
  render: c => [
    P.mane(c, {color: '#F6E4EE'}),
    P.earsFloppy(c, {dx: 15.4, dy: -1.4, rx: 5.6, ry: 8.4}),
    P.head(c, {rx: 14.8, ry: 14}),
    P.bow(c, {cx: H.cx, cy: H.cy - 14.6, s: 0.78}),
    P.muzzle(c, {rx: 8, ry: 5.8}),
    P.eyes(c, {dx: 5.8, dy: -1.4}),
    P.cheeks(c, {dx: 10.8, dy: 4})
  ].join('')
};

const fawn = {
  name: 'fawn',
  coat: '#E8BC8E', coat2: '#D19E69', inner: '#FCEEDB', mark: '#FFF4E4',
  render: c => [
    P.earsLeaf(c, {dx: 14.6, dy: -10.4, rx: 5, ry: 5.6, tilt: 62}),
    P.head(c),
    P.spots(c, {color: c.mark, at: [[-9.6, -6, 2.5], [8.6, -6.6, 2.3], [-11.4, 1.4, 2], [11, 0.6, 2.1]]}),
    P.tiara(c, {cy: H.cy - 14.6}),
    P.muzzle(c, {rx: 8.6, ry: 6.2}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

export default {
  id: 'princess',
  label: 'Princess palace',
  cast: {milk: kitten, nurse: bunny, formula: puppy, wet: swan, poop: mouse, mixed: poodle, pump: fawn},
  mascot: kitten
};
