/* Deep Space cast: the crew, one per care action. */
import * as P from '../parts.mjs';

const astronaut = {
  name: 'astronaut cub',
  coat: '#F1F4FF', coat2: '#BFC8E8', inner: '#FFFFFF', mark: '#6FE3FF',
  render: c => [
    P.halo(c, {color: c.mark}),
    P.head(c),
    P.visor(c, {tint: '#7FD9FF'}),
    P.eyes({...c, ink: '#12294A'}, {dx: 4.9, dy: -0.4}),
    P.stroke(`M${P.HEAD.cx - 3.2} ${P.HEAD.cy + 5} q3.2 2.8 6.4 0`, '#12294A', 1.6),
    P.cheeks({...c, blush: '#8FD4F0'}, {dx: 9.4, dy: 3.6, rx: 2.4, ry: 1.7})
  ].join('')
};

const rocketPup = {
  name: 'rocket pup',
  coat: '#9FB4F2', coat2: '#7089D6', inner: '#E7EDFF', mark: '#FF9CC8',
  render: c => [
    P.earsFloppy(c, {dx: 15.6, dy: -5.2, rx: 5, ry: 8.2}),
    P.head(c),
    P.antennaPod(c, {color: c.mark}),
    P.muzzle(c, {rx: 8.8, ry: 6.4}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const moonOwl = {
  name: 'moon owl',
  coat: '#C9C2F5', coat2: '#9A90DC', inner: '#F1EEFF', mark: '#FFD38A',
  render: c => [
    P.wingFan(c, {color: c.coat2, edge: c.coat}),
    P.head(c, {rx: 16.4, ry: 15.4}),
    P.earsPointed(c, {dx: 10.4, dy: -12.6, w: 5.2, h: 7.8}),
    P.ellipse(P.HEAD.cx - 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, 'fill-opacity=".95"'),
    P.ellipse(P.HEAD.cx + 5.9, P.HEAD.cy - 1.4, 6.2, 6.6, c.inner, 'fill-opacity=".95"'),
    P.eyes(c, {dx: 5.9, dy: -1.4, rx: 3.2, ry: 3.4}),
    P.beak(c, {color: c.mark, cy: P.HEAD.cy + 5.2, w: 3, h: 4.2}),
    P.cheeks(c, {dx: 12.6, dy: 5.2})
  ].join('')
};

const cometCat = {
  name: 'comet cat',
  coat: '#8FD8F2', coat2: '#57AACB', inner: '#E4F7FF', mark: '#FFE082',
  render: c => [
    P.earsPointed(c, {dx: 12, dy: -12.4, w: 5.8, h: 10}),
    P.head(c),
    P.path(`M${P.HEAD.cx + 9.4} ${P.HEAD.cy - 9.4}l1.1 2.9 2.9 1.1-2.9 1.1-1.1 2.9-1.1-2.9-2.9-1.1 2.9-1.1Z`, c.mark),
    P.muzzle(c, {rx: 8.4, ry: 6, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const starFox = {
  name: 'star fox',
  coat: '#FFB27A', coat2: '#E4854A', inner: '#FFF0E0', mark: '#5B3A8E',
  render: c => [
    P.earsPointed(c, {dx: 12.8, dy: -13, w: 6.2, h: 11}),
    P.head(c),
    P.path(`M${P.HEAD.cx} ${P.HEAD.cy - 12.4}l1.5 3.6 3.9 .3-3 2.6.9 3.8-3.3-2.1-3.3 2.1.9-3.8-3-2.6 3.9-.3Z`, c.mark, 'fill-opacity=".55"'),
    P.muzzle(c, {rx: 8.8, ry: 6.4, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const roverBot = {
  name: 'rover bot',
  coat: '#D8DEF0', coat2: '#9AA4C6', inner: '#FFFFFF', mark: '#63E6C8',
  render: c => [
    P.antennae(c, {color: c.mark}),
    P.path(`M${P.HEAD.cx - 16} ${P.HEAD.cy - 12.4}h32a4 4 0 0 1 4 4v17a4 4 0 0 1 -4 4h-32a4 4 0 0 1 -4 -4v-17a4 4 0 0 1 4 -4Z`, c.coat),
    P.path(`M${P.HEAD.cx - 11.4} ${P.HEAD.cy - 6.4}h22.8a3 3 0 0 1 3 3v9a3 3 0 0 1 -3 3h-22.8a3 3 0 0 1 -3 -3v-9a3 3 0 0 1 3 -3Z`, '#17304F'),
    P.circle(P.HEAD.cx - 5.4, P.HEAD.cy + 1, 2.6, c.mark),
    P.circle(P.HEAD.cx + 5.4, P.HEAD.cy + 1, 2.6, c.mark),
    P.stroke(`M${P.HEAD.cx - 2.6} ${P.HEAD.cy + 6.6} q2.6 2 5.2 0`, c.mark, 1.6, 'stroke-opacity=".85"')
  ].join('')
};

const alienSprout = {
  name: 'alien sprout',
  coat: '#9DE8B4', coat2: '#6BC78C', inner: '#EAFBEF', mark: '#3F8F63',
  render: c => [
    P.antennae(c, {color: c.mark}),
    P.head(c, {rx: 16.2, ry: 16.8}),
    P.ellipse(P.HEAD.cx - 6.2, P.HEAD.cy - 0.8, 4.6, 5.8, '#1F3B2E'),
    P.ellipse(P.HEAD.cx + 6.2, P.HEAD.cy - 0.8, 4.6, 5.8, '#1F3B2E'),
    P.circle(P.HEAD.cx - 7.4, P.HEAD.cy - 2.6, 1.5, '#FFFFFF', 'fill-opacity=".9"'),
    P.circle(P.HEAD.cx + 5, P.HEAD.cy - 2.6, 1.5, '#FFFFFF', 'fill-opacity=".9"'),
    P.stroke(`M${P.HEAD.cx - 3} ${P.HEAD.cy + 8} q3 2.6 6 0`, c.ink, 1.6),
    P.cheeks(c, {dx: 12.2, dy: 5.4})
  ].join('')
};

export default {
  id: 'deepspace',
  label: 'Deep Space crew',
  cast: {milk: astronaut, nurse: rocketPup, formula: moonOwl, wet: cometCat, poop: starFox, mixed: roverBot, pump: alienSprout},
  mascot: astronaut
};
