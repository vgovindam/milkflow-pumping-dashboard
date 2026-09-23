/* Crystal City cast: the city's small residents, one per care action. */
import * as P from '../parts.mjs';

const hoverBot = {
  name: 'hover bot',
  coat: '#EDEFFC', coat2: '#B7BEE2', inner: '#FFFFFF', mark: '#63D9F5',
  render: c => [
    P.antennaPod(c, {color: c.mark}),
    P.path(`M${P.HEAD.cx - 16} ${P.HEAD.cy - 13}h32a5 5 0 0 1 5 5v18a5 5 0 0 1 -5 5h-32a5 5 0 0 1 -5 -5v-18a5 5 0 0 1 5 -5Z`, c.coat),
    P.path(`M${P.HEAD.cx - 11} ${P.HEAD.cy - 7}h22a3.4 3.4 0 0 1 3.4 3.4v10a3.4 3.4 0 0 1 -3.4 3.4h-22a3.4 3.4 0 0 1 -3.4 -3.4v-10a3.4 3.4 0 0 1 3.4 -3.4Z`, '#1B1740'),
    P.circle(P.HEAD.cx - 5, P.HEAD.cy + 0.4, 2.7, c.mark),
    P.circle(P.HEAD.cx + 5, P.HEAD.cy + 0.4, 2.7, c.mark),
    P.stroke(`M${P.HEAD.cx - 2.6} ${P.HEAD.cy + 6.4} q2.6 2.2 5.2 0`, c.mark, 1.6, 'stroke-opacity=".9"'),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 18.4, 9.4, 2.4, c.mark, 'fill-opacity=".45"')
  ].join('')
};

const droneBird = {
  name: 'drone bird',
  coat: '#9FE0F2', coat2: '#5FB2CE', inner: '#EAFAFF', mark: '#FF8FCB',
  render: c => [
    P.wingFan(c, {color: c.coat2, edge: c.coat}),
    P.head(c, {rx: 16, ry: 15.2}),
    P.antennaPod(c, {color: c.mark, top: P.HEAD.cy - 21.4}),
    P.eyes(c, {dx: 5.9, dy: -1.6, rx: 3.2, ry: 3.4}),
    P.beak(c, {color: '#F5A14B', cy: P.HEAD.cy + 4.6, w: 3.2, h: 4.6}),
    P.cheeks(c, {dx: 12.2, dy: 4.6})
  ].join('')
};

const prismCat = {
  name: 'prism cat',
  coat: '#C6A9F5', coat2: '#9873DC', inner: '#F1E9FF', mark: '#6BE8FF',
  render: c => [
    P.earsPointed(c, {dx: 12.2, dy: -12.6, w: 5.8, h: 10.2}),
    P.head(c),
    P.facets(c, {color: c.mark}),
    P.muzzle(c, {rx: 8.4, ry: 6, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const circuitBunny = {
  name: 'circuit bunny',
  coat: '#F2EDFF', coat2: '#C3B8E8', inner: '#FFFFFF', mark: '#57E0C2',
  render: c => [
    P.earsLong(c, {dx: 7.8, dy: -19.4, rx: 3.9, ry: 10.4, tilt: 10}),
    P.head(c),
    P.stroke(`M${P.HEAD.cx - 12.4} ${P.HEAD.cy - 6.4} h5v-4h4`, c.mark, 1.4, 'stroke-opacity=".8"'),
    P.stroke(`M${P.HEAD.cx + 12.4} ${P.HEAD.cy + 3.4} h-5v4h-4`, c.mark, 1.4, 'stroke-opacity=".8"'),
    P.circle(P.HEAD.cx - 12.4, P.HEAD.cy - 6.4, 1.5, c.mark),
    P.circle(P.HEAD.cx + 12.4, P.HEAD.cy + 3.4, 1.5, c.mark),
    P.muzzle(c, {rx: 8.2, ry: 5.8, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const beaconOwl = {
  name: 'beacon owl',
  coat: '#8E9BE0', coat2: '#6472C4', inner: '#E9ECFF', mark: '#FFD166',
  render: c => [
    P.wingFan(c, {color: c.coat2, edge: c.coat}),
    P.head(c, {rx: 16.4, ry: 15.4}),
    P.earsPointed(c, {dx: 10.4, dy: -12.4, w: 5, h: 7.4}),
    P.halo(c, {color: c.mark}),
    P.ellipse(P.HEAD.cx - 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, 'fill-opacity=".95"'),
    P.ellipse(P.HEAD.cx + 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, 'fill-opacity=".95"'),
    P.eyes(c, {dx: 5.9, dy: -1.4, rx: 3.2, ry: 3.4}),
    P.beak(c, {color: c.mark, cy: P.HEAD.cy + 5.2, w: 3, h: 4.2}),
    P.cheeks(c, {dx: 12.6, dy: 5.2})
  ].join('')
};

const crystalFox = {
  name: 'crystal fox',
  coat: '#7FE9E0', coat2: '#43B9B2', inner: '#E4FFFC', mark: '#FF8FCB',
  render: c => [
    P.earsPointed(c, {dx: 12.8, dy: -13, w: 6.2, h: 11}),
    P.head(c),
    P.facets(c, {color: c.mark, at: [[-8.8, -5.2], [8, -6.6], [-4, 6]]}),
    P.muzzle(c, {rx: 8.6, ry: 6.2, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const pixelPup = {
  name: 'pixel pup',
  coat: '#FFB9D8', coat2: '#E087B0', inner: '#FFF0F6', mark: '#5FE0FF',
  render: c => [
    P.earsFloppy(c, {dx: 15.4, dy: -5, rx: 5, ry: 8.4}),
    P.head(c),
    P.path(`M${P.HEAD.cx - 11.4} ${P.HEAD.cy - 4.4}h22.8v4.6h-22.8Z`, c.mark, 'fill-opacity=".3"'),
    P.muzzle(c, {rx: 8.8, ry: 6.4}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

export default {
  id: 'crystalcity',
  label: 'Crystal City friends',
  cast: {milk: hoverBot, nurse: droneBird, formula: prismCat, wet: circuitBunny, poop: beaconOwl, mixed: crystalFox, pump: pixelPup},
  mascot: hoverBot
};
