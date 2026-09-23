/* Aurora cast: the cold-weather crew, one per care action. */
import * as P from '../parts.mjs';

const polarBear = {
  name: 'polar bear cub',
  coat: '#F4FAFF', coat2: '#CBDDEB', inner: '#FFFFFF', mark: '#A8C6DA',
  render: c => [
    P.earsRound(c, {dx: 13.4, dy: -11.8, rad: 5.4, inner: 3}),
    P.head(c),
    P.muzzle(c, {rx: 9.4, ry: 6.8}),
    P.eyes(c),
    P.cheeks(c, {dx: 12.2, dy: 4.6})
  ].join('')
};

const arcticFox = {
  name: 'arctic fox',
  coat: '#EAF4FF', coat2: '#B9D2E6', inner: '#FFFFFF', mark: '#7FB4D6',
  render: c => [
    P.earsPointed(c, {dx: 12.6, dy: -13.2, w: 6.4, h: 11.2}),
    P.head(c),
    P.muzzle(c, {rx: 8.6, ry: 6.2, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const snowOwl = {
  name: 'snow owl',
  coat: '#FBFDFF', coat2: '#C6D8E6', inner: '#FFFFFF', mark: '#F0B45E',
  render: c => [
    P.wingFan(c, {color: c.coat2, edge: c.coat}),
    P.head(c, {rx: 16.4, ry: 15.4}),
    P.ellipse(P.HEAD.cx - 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, `stroke="${'#C6D8E6'}" stroke-width="1.1"`),
    P.ellipse(P.HEAD.cx + 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, `stroke="${'#C6D8E6'}" stroke-width="1.1"`),
    P.eyes(c, {dx: 5.9, dy: -1.4, rx: 3.2, ry: 3.4}),
    P.beak(c, {color: c.mark, cy: P.HEAD.cy + 5.2, w: 3, h: 4.4}),
    P.cheeks(c, {dx: 12.6, dy: 5.4})
  ].join('')
};

const sealPup = {
  name: 'seal pup',
  coat: '#C8D9E8', coat2: '#9FB6CB', inner: '#EFF6FC', mark: '#7C95AE',
  render: c => [
    P.head(c, {rx: 16.4, ry: 15.2}),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 7.4, 10.2, 6.8, c.inner, 'fill-opacity=".95"'),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 4.8, 2.9, 2.2, c.ink),
    P.stroke(`M${P.HEAD.cx - 3.2} ${P.HEAD.cy + 9.8} q3.2 2.6 6.4 0`, c.ink, 1.5, 'stroke-opacity=".8"'),
    P.stroke(`M${P.HEAD.cx - 8.6} ${P.HEAD.cy + 6.4} h-5M${P.HEAD.cx - 8.6} ${P.HEAD.cy + 9} h-4.4M${P.HEAD.cx + 8.6} ${P.HEAD.cy + 6.4} h5M${P.HEAD.cx + 8.6} ${P.HEAD.cy + 9} h4.4`, c.mark, 1.1, 'stroke-opacity=".75"'),
    P.eyes(c, {dx: 6.6, dy: -3.4, rx: 3, ry: 3.4}),
    P.cheeks(c, {dx: 12.8, dy: 1.8})
  ].join('')
};

const reindeerFawn = {
  name: 'reindeer fawn',
  coat: '#C79B74', coat2: '#A57B56', inner: '#F0DCC7', mark: '#6F4E34',
  render: c => [
    P.hornsSmall(c, {color: '#8C6844'}),
    P.earsLeaf(c, {dx: 14.2, dy: -9.4, rx: 4.4, ry: 5.6, tilt: 50}),
    P.head(c),
    P.muzzle(c, {rx: 9, ry: 6.6}),
    P.eyes(c),
    P.cheeks(c, {dx: 12.2, dy: 4.8})
  ].join('')
};

const puffin = {
  name: 'puffin',
  coat: '#2F3A50', coat2: '#1D2536', inner: '#FFFFFF', mark: '#F5813F',
  render: c => [
    P.wingsBack(c, {c1: c.coat2, c2: c.coat}),
    P.head(c, {rx: 16.2, ry: 15.4}),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 1.4, 11.8, 12, c.inner),
    P.eyes({...c, ink: '#1B2231'}, {dx: 5.4, dy: -2.4, rx: 2.9, ry: 3.2}),
    P.path(`M${P.HEAD.cx - 5} ${P.HEAD.cy + 3.6}h10L${P.HEAD.cx} ${P.HEAD.cy + 11.4}Z`, c.mark),
    P.stroke(`M${P.HEAD.cx - 2.4} ${P.HEAD.cy + 6.2} h4.8`, '#C75C24', 1.1, 'stroke-opacity=".8"'),
    P.cheeks({...c, blush: '#F19AA8'}, {dx: 11.4, dy: 3.4, rx: 2.6, ry: 1.8})
  ].join('')
};

const narwhal = {
  name: 'narwhal',
  coat: '#A9B8E0', coat2: '#8494C4', inner: '#E8EDFA', mark: '#F2E2B4',
  render: c => [
    P.fins(c, {color: c.coat2, dx: 16.4, dy: 5.4, rx: 4.8, ry: 6.4}),
    P.head(c, {rx: 16.6, ry: 15.2}),
    P.spiralHorn(c, {color: c.mark}),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 7.6, 10.6, 6.4, c.inner, 'fill-opacity=".9"'),
    P.stroke(`M${P.HEAD.cx - 3.4} ${P.HEAD.cy + 7.4} q3.4 3 6.8 0`, c.ink, 1.6),
    P.eyes(c, {dx: 7, dy: -2.4}),
    P.cheeks(c, {dx: 12.8, dy: 2.8})
  ].join('')
};

export default {
  id: 'aurora',
  label: 'Aurora friends',
  cast: {milk: polarBear, nurse: arcticFox, formula: snowOwl, wet: sealPup, poop: reindeerFawn, mixed: puffin, pump: narwhal},
  mascot: arcticFox
};
