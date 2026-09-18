/* Unicorn-dream cast: the storybook creatures, kept pastel so the icons stay quiet next to
   a card's own colour. */
import * as P from '../parts.mjs';

const H = P.HEAD;

const forelock = (a, b) => [
  P.path(`M${H.cx - 10.4} ${H.cy - 12.4} q3.4 -7.4 10.4 -6.4 q-4.4 3 -4 8.4Z`, a),
  P.path(`M${H.cx - 2.4} ${H.cy - 15.4} q6.4 -5.4 11.6 -1.4 q-5.4 1 -7.4 5.4Z`, b),
  P.path(`M${H.cx + 5.4} ${H.cy - 12.6} q6 -2.6 9 1.4 q-4.6 0 -6.6 3.4Z`, a)
].join('');

const unicorn = {
  name: 'unicorn',
  coat: '#FCF8FF', coat2: '#EBE3F8', inner: '#FFFFFF', mark: '#E9D5F2',
  render: c => [
    P.earsPointed(c, {dx: 12.8, dy: -11.4, w: 6, h: 9.4}),
    P.head(c),
    P.spiralHorn(c),
    forelock('#F7B9D6', '#B7A6F2'),
    P.muzzle(c, {rx: 8.6, ry: 6.2}),
    P.eyes(c, {style: 'happy'}),
    P.cheeks(c)
  ].join('')
};

const pony = {
  name: 'pastel pony',
  coat: '#F9D3E6', coat2: '#EEB4D2', inner: '#FFF1F7', mark: '#E39BC2',
  render: c => [
    P.earsPointed(c, {dx: 12.8, dy: -11.4, w: 6, h: 9.4}),
    P.head(c),
    forelock('#FFF0B8', '#A7D9F0'),
    P.muzzle(c, {rx: 8.8, ry: 6.4}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const pegasus = {
  name: 'pegasus',
  coat: '#E2DAFB', coat2: '#C6BBF0', inner: '#F7F4FF', mark: '#A392E2',
  wing1: '#FFFFFF', wing2: '#C3B5F0',
  render: c => [
    P.wingFan(c, {ax: P.HEAD.cx + 12.6, ay: P.HEAD.cy + 5.4, len: 15.4, lift: 12.4}),
    P.earsPointed(c, {dx: 11.8, dy: -11.4, w: 5.6, h: 9}),
    P.head(c, {rx: 14.8, ry: 14.2}),
    forelock('#B7A6F2', '#F7C6E2'),
    P.muzzle(c, {rx: 8, ry: 5.8}),
    P.eyes(c, {dx: 5.8, dy: -1.2}),
    P.cheeks(c, {dx: 11, dy: 4.4})
  ].join('')
};

const narwhal = {
  name: 'narwhal',
  coat: '#A9D8F2', coat2: '#83BFE3', inner: '#E8F6FD', mark: '#6AAAD4',
  render: c => [
    P.path(`M${H.cx - 15.4} ${H.cy + 8.4} q-8.4 1.4 -11.4 -5.4 q7.4 1 9.4 -2.4Z`, c.coat2),
    P.head(c, {rx: 16.4, ry: 14.8}),
    P.spiralHorn(c, {colour: '#F2F7FB', cy: H.cy - 14.6}),
    P.ellipse(H.cx, H.cy + 6.4, 10.4, 7, c.inner, 'fill-opacity=".85"'),
    P.stroke(`M${H.cx - 3.4} ${H.cy + 5.4} q3.4 3 6.8 0`, c.ink, 1.6, 'stroke-opacity=".8"'),
    P.eyes(c, {dx: 6.6, dy: -3.4}),
    P.cheeks(c, {dx: 12, dy: 1.4})
  ].join('')
};

const dragon = {
  name: 'baby dragon',
  coat: '#AEDFC4', coat2: '#88C7A4', inner: '#EDF9F2', mark: '#F5C86A',
  render: c => [
    P.path(`M${H.cx - 17.4} ${H.cy - 2.4} q-8 -3.4 -9.4 3.4 q6.4 -.6 8.4 3.4Z`, c.coat2),
    P.head(c),
    P.hornsSmall(c, {colour: c.mark}),
    P.path(`M${H.cx} ${H.cy - 16.4} l2.4 4.4 -4.8 0Z`, c.mark, 'fill-opacity=".9"'),
    P.ellipse(H.cx, H.cy + 8, 9.4, 6.6, c.inner, 'fill-opacity=".9"'),
    P.stroke(`M${H.cx - 3.2} ${H.cy + 4.8} v1.4M${H.cx + 3.2} ${H.cy + 4.8} v1.4`, c.ink, 1.8, 'stroke-opacity=".7"'),
    P.stroke(`M${H.cx - 3.4} ${H.cy + 9.4} q3.4 2.8 6.8 0`, c.ink, 1.5, 'stroke-opacity=".8"'),
    P.eyes(c, {dx: 6.6, dy: -2.6}),
    P.cheeks(c, {dx: 12.4, dy: 2.4})
  ].join('')
};

const axolotl = {
  name: 'axolotl',
  coat: '#FAC6D3', coat2: '#EEA3B7', inner: '#FFF0F4', mark: '#F386A6',
  render: c => [
    /* gill frills: three soft fronds a side */
    [-1, 1].map(side => [[-5.4, -7.4, 4.2], [0.6, -9.4, 4.6], [6.4, -7, 4]].map(([dy, dx, rad]) =>
      P.circle(P.HEAD.cx + side * (12.4 - dx), P.HEAD.cy + dy, rad, c.mark, 'fill-opacity=".9"')).join('')).join(''),
    P.head(c, {rx: 15.2, ry: 13.8}),
    P.eyes(c, {dx: 6.4, dy: -2.4, rx: 2.9, ry: 3.3}),
    P.stroke(`M${H.cx - 4.4} ${H.cy + 5.4} q4.4 3.6 8.8 0`, c.ink, 1.6, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 11.4, dy: 3.4})
  ].join('')
};

const starUnicorn = {
  name: 'star unicorn',
  coat: '#D3CCF7', coat2: '#B8AEEF', inner: '#F4F1FF', mark: '#F6D06A',
  render: c => [
    P.earsPointed(c, {dx: 12.8, dy: -11.4, w: 6, h: 9.4}),
    P.head(c),
    P.spiralHorn(c),
    forelock('#9FD8F4', '#F7B9D6'),
    P.path(`M${H.cx - 11.6} ${H.cy + 1.4} l1.5 3 3.3.5-2.4 2.3.6 3.3-3-1.6-3 1.6.6-3.3-2.4-2.3 3.3-.5Z`, c.mark, 'fill-opacity=".9"'),
    P.muzzle(c, {rx: 8.4, ry: 6}),
    P.eyes(c, {dx: 6.2, dy: -1}),
    P.cheeks(c, {dx: 12.6, dy: 5.6, rx: 2.6, ry: 1.9})
  ].join('')
};

export default {
  id: 'unicorn',
  label: 'Unicorn dream',
  cast: {milk: unicorn, nurse: pony, formula: pegasus, wet: narwhal, poop: dragon, mixed: axolotl, pump: starUnicorn},
  mascot: unicorn
};
