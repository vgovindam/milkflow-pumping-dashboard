/* Butterfly-garden cast: the small winged things a toddler points at in a garden. */
import * as P from '../parts.mjs';

const H = P.HEAD;

/* A ladybird/beetle shell: two domed halves behind the face. */
const shell = (c, {a, b, dots = []}) => [
  P.ellipse(H.cx, H.cy + 1, 17.6, 16.4, a),
  P.path(`M${H.cx - 1.3} ${H.cy - 15.2} h2.6 v31 h-2.6Z`, b, 'fill-opacity=".55"'),
  dots.map(([dx, dy, rad]) => P.circle(H.cx + dx, H.cy + dy, rad, b, 'fill-opacity=".85"')).join('')
].join('');

const monarch = {
  name: 'monarch butterfly',
  coat: '#7A5590', coat2: '#5F3F74', inner: '#F4E7FA', mark: '#E3762F',
  wing1: '#F0A24E', wing2: '#E3762F',
  render: c => [
    P.butterflyWings(c),
    P.antennae(c, {color: c.coat2}),
    P.head(c, {rx: 7.8, ry: 9.4}),
    P.eyes(c, {dx: 3, dy: -2.2, rx: 2.1, ry: 2.5}),
    P.stroke(`M${H.cx} ${H.cy + 2.4} q0 2.4 -2.2 2.4M${H.cx} ${H.cy + 2.4} q0 2.4 2.2 2.4`, c.ink, 1.3, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 5.6, dy: 1.6, rx: 2, ry: 1.5})
  ].join('')
};

const ladybird = {
  name: 'ladybird',
  coat: '#E2586A', coat2: '#BE3A4E', inner: '#FDE8EC', mark: '#4A2230',
  render: c => [
    P.antennae(c, {color: '#4A2230'}),
    shell(c, {a: c.coat, b: c.mark, dots: [[-8.6, -3.4, 2.7], [8.6, -3.4, 2.7], [-6.4, 7.4, 2.3], [6.4, 7.4, 2.3]]}),
    P.ellipse(H.cx, H.cy - 9.6, 11.4, 7.6, c.mark),
    P.eyes({...c, ink: '#FFFFFF'}, {dx: 4.8, dy: -10.4, rx: 2.4, ry: 2.7}),
    P.circle(H.cx - 4.8, H.cy - 10.4, 1.1, c.mark),
    P.circle(H.cx + 4.8, H.cy - 10.4, 1.1, c.mark),
    P.stroke(`M${H.cx - 2.6} ${H.cy - 5.6} q2.6 2.4 5.2 0`, '#FFFFFF', 1.4, 'stroke-opacity=".8"')
  ].join('')
};

const bumblebee = {
  name: 'bumblebee',
  coat: '#F6CB4F', coat2: '#E0AC2A', inner: '#FFF3CF', mark: '#4A3A24',
  wing1: '#EAF4FB', wing2: '#D5E8F6',
  render: c => [
    P.wingsBack(c, {dx: 14.6, rx: 8.4, ry: 11, cy: H.cy - 6}),
    P.antennae(c, {color: c.mark}),
    P.head(c, {rx: 16.4, ry: 15.4}),
    P.path(`M${H.cx - 15.4} ${H.cy + 1.4} h30.8 v3.8 h-30.8Z`, c.mark, 'fill-opacity=".85"'),
    P.path(`M${H.cx - 12.4} ${H.cy + 9} h24.8 v3.6 h-24.8Z`, c.mark, 'fill-opacity=".85"'),
    P.eyes(c, {dx: 6, dy: -5.4}),
    P.stroke(`M${H.cx - 2.8} ${H.cy - 0.6} q2.8 2.6 5.6 0`, c.ink, 1.5, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 11.4, dy: -2.6})
  ].join('')
};

const dragonfly = {
  name: 'dragonfly',
  coat: '#67BFD6', coat2: '#4A9FB8', inner: '#E4F5FA', mark: '#2F7E97',
  wing1: '#E8F6FB', wing2: '#CFE9F4',
  render: c => [
    P.wingsBack(c, {dx: 18.4, rx: 7, ry: 12.4, cy: H.cy - 4}),
    P.antennae(c, {color: c.coat2}),
    P.ellipse(H.cx, H.cy + 9.4, 4.6, 9.6, c.coat2),
    P.stroke(`M${H.cx - 3.4} ${H.cy + 6.4} h6.8M${H.cx - 3} ${H.cy + 11} h6`, c.mark, 1.3, 'stroke-opacity=".55"'),
    P.head(c, {rx: 10.4, ry: 9.6, cy: H.cy - 4.4}),
    P.eyes(c, {dx: 4.4, dy: -5.6, rx: 2.7, ry: 3}),
    P.stroke(`M${H.cx - 2.4} ${H.cy - 0.8} q2.4 2.2 4.8 0`, c.ink, 1.4, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 7.6, dy: -2.4, rx: 2.2, ry: 1.6})
  ].join('')
};

const caterpillar = {
  name: 'caterpillar',
  coat: '#96C96E', coat2: '#75A94F', inner: '#EAF7DF', mark: '#5E8F3C',
  render: c => [
    P.circle(H.cx + 13.4, H.cy + 8.6, 6.4, c.coat2),
    P.circle(H.cx + 5.4, H.cy + 10.4, 7.2, c.coat),
    P.circle(H.cx - 4.4, H.cy + 9.4, 6.6, c.coat2),
    P.antennae(c, {color: c.coat2}),
    P.head(c, {rx: 12.4, ry: 11.8, cy: H.cy - 3.4}),
    P.eyes(c, {dx: 4.8, dy: -5, rx: 2.7, ry: 3.1}),
    P.stroke(`M${H.cx - 2.6} ${H.cy + 0.4} q2.6 2.4 5.2 0`, c.ink, 1.5, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 8.8, dy: -1.6, rx: 2.4, ry: 1.7})
  ].join('')
};

const snail = {
  name: 'snail',
  coat: '#F3DEC2', coat2: '#DCC09B', inner: '#FFF8EC', mark: '#C08F55',
  render: c => [
    /* shell: concentric rings, back-right, so the face stays on the reading side */
    P.circle(H.cx + 7.4, H.cy - 2.6, 14.2, c.mark),
    P.circle(H.cx + 7.4, H.cy - 2.6, 10.6, '#F8E6CA'),
    P.circle(H.cx + 8.6, H.cy - 1.4, 6.6, c.mark, 'fill-opacity=".82"'),
    P.circle(H.cx + 9.4, H.cy - 0.4, 3, '#F8E6CA'),
    /* foot */
    P.path(`M${H.cx - 20.4} ${H.cy + 13.6} q2.4 -6.4 9.4 -6.4 h16 q4 0 4 3.2 t-4 3.2Z`, c.coat2),
    P.antennae(c, {color: c.coat2}),
    P.head(c, {rx: 9.6, ry: 9.8, cx: H.cx - 11.4, cy: H.cy + 1.4}),
    P.eyes(c, {dx: 3.6, dy: 0.4, rx: 2.4, ry: 2.7}),
    P.stroke(`M${H.cx - 13.6} ${H.cy + 5.6} q2.2 2.2 4.4 0`, c.ink, 1.4, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 6.8, dy: 4, rx: 2.1, ry: 1.6})
  ].join('')
};

const hummingbird = {
  name: 'hummingbird',
  coat: '#7FC9AC', coat2: '#5CAC8D', inner: '#FDF1DC', mark: '#3E8B6D',
  wing1: '#CFEDE0', wing2: '#A6DCC6', beak: '#E88F2C',
  render: c => [
    P.wingsBack(c, {dx: 15.4, rx: 6.8, ry: 12.2, cy: H.cy - 5}),
    P.path(`M${H.cx - 1.4} ${H.cy - 17.6} q4.4 -2.4 7 1.4 q-4 .4 -5.4 3Z`, c.mark, 'fill-opacity=".8"'),
    P.head(c, {rx: 14.2, ry: 13.8, cy: H.cy - 1}),
    P.ellipse(H.cx, H.cy + 3.4, 8.8, 7.6, c.inner, 'fill-opacity=".92"'),
    P.path(`M${H.cx - 2.6} ${H.cy - 1.6} h5.2 l-2.6 11.4Z`, c.beak),
    P.eyes(c, {dx: 6.2, dy: -5.4}),
    P.cheeks(c, {dx: 11, dy: -1.4})
  ].join('')
};

export default {
  id: 'butterfly',
  label: 'Butterfly garden',
  cast: {milk: monarch, nurse: ladybird, formula: bumblebee, wet: dragonfly, poop: caterpillar, mixed: snail, pump: hummingbird},
  mascot: monarch
};
