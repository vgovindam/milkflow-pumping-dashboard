/* Neon Reef cast: reef babies, one per care action. */
import * as P from '../parts.mjs';

const clownfish = {
  name: 'clownfish',
  coat: '#FFA94D', coat2: '#E8802B', inner: '#FFF3E2', mark: '#FFFFFF',
  render: c => [
    P.fins(c, {color: c.coat2, dx: 16.2, dy: 4.4}),
    P.finTop(c, {color: c.coat2}),
    P.head(c, {rx: 16.4, ry: 15.4}),
    P.path(`M${P.HEAD.cx - 12.4} ${P.HEAD.cy - 6.6}q3.4 8.6 0 17.2 4.6 1.6 7 0 -3.4-9 0-18.4Z`, c.mark, 'fill-opacity=".9"'),
    P.path(`M${P.HEAD.cx + 6.4} ${P.HEAD.cy - 9.4}q3.6 9.8 0 19.6 4 .6 6.2-1.4 -3-8.6 0-16.8Z`, c.mark, 'fill-opacity=".9"'),
    P.eyes(c, {dx: 6, dy: -2.4}),
    P.stroke(`M${P.HEAD.cx - 3} ${P.HEAD.cy + 6.4} q3 2.8 6 0`, c.ink, 1.6),
    P.cheeks(c, {dx: 11.8, dy: 3.4})
  ].join('')
};

const jellyfish = {
  name: 'jellyfish',
  coat: '#F79AD8', coat2: '#D96FBB', inner: '#FFE8F7', mark: '#FFC9EC',
  render: c => [
    P.tentacles(c, {color: c.coat2, count: 5, spread: 10.4, len: 8.4}),
    P.path(`M${P.HEAD.cx - 16.6} ${P.HEAD.cy + 5.4}c0-11.4 7.4-19.4 16.6-19.4s16.6 8 16.6 19.4c0 3.6-2 5.2-4.6 4-3.1-1.4-5.8-1.4-8.5.4-2.7-1.8-5.4-1.8-8.5-.4-2.6 1.2-4.6-.4-4.6-4Z`, c.coat),
    P.path(`M${P.HEAD.cx - 10.4} ${P.HEAD.cy - 5.4}q5-5.2 11.2-3.4`, 'none', `stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-opacity=".6"`),
    P.eyes(c, {dx: 5.4, dy: 0.6, rx: 2.9, ry: 3.2}),
    P.stroke(`M${P.HEAD.cx - 2.8} ${P.HEAD.cy + 6.6} q2.8 2.4 5.6 0`, c.ink, 1.6),
    P.cheeks(c, {dx: 10.6, dy: 4.4, rx: 2.6, ry: 1.8})
  ].join('')
};

const seahorse = {
  name: 'seahorse',
  coat: '#7BE3C8', coat2: '#46B79C', inner: '#E4FFF7', mark: '#FFD98A',
  render: c => [
    P.forelockBrush(c, {color: c.coat2, count: 4, spread: 7.4, height: 3.6, width: 2.4}),
    P.head(c, {rx: 15.6, ry: 15.4}),
    P.path(`M${P.HEAD.cx + 9.4} ${P.HEAD.cy + 1.4}q8.6 1.6 8.6 7.4 0 3.4-3.4 3.8-1.6-6-5.2-7.4Z`, c.coat),
    P.eyes(c, {dx: 5.4, dy: -2.4}),
    P.circle(P.HEAD.cx + 16.4, P.HEAD.cy + 9.4, 1.6, c.ink, 'fill-opacity=".5"'),
    P.cheeks(c, {dx: 11.2, dy: 3.6}),
    P.stroke(`M${P.HEAD.cx - 12.4} ${P.HEAD.cy + 8.4} q4 3.4 8 1.4`, c.coat2, 1.6, 'stroke-opacity=".6"')
  ].join('')
};

const turtle = {
  name: 'turtle',
  coat: '#8FD96F', coat2: '#5FAE46', inner: '#EEFBE4', mark: '#3E7C35',
  render: c => [
    P.fins(c, {color: c.coat2, dx: 16.6, dy: 6.4, rx: 5, ry: 6}),
    P.head(c, {rx: 16, ry: 15.2}),
    P.path(`M${P.HEAD.cx - 13.4} ${P.HEAD.cy - 3.4}a13.4 11.4 0 0 1 26.8 0Z`, c.mark, 'fill-opacity=".38"'),
    P.stroke(`M${P.HEAD.cx} ${P.HEAD.cy - 14.4} v11M${P.HEAD.cx - 9} ${P.HEAD.cy - 9.4} l4 6M${P.HEAD.cx + 9} ${P.HEAD.cy - 9.4} l-4 6`, c.mark, 1.4, 'stroke-opacity=".55"'),
    P.eyes(c, {dx: 6.2, dy: 1.6}),
    P.stroke(`M${P.HEAD.cx - 3.4} ${P.HEAD.cy + 8.4} q3.4 2.8 6.8 0`, c.ink, 1.6),
    P.cheeks(c, {dx: 12.4, dy: 6.2})
  ].join('')
};

const octopus = {
  name: 'octopus',
  coat: '#B79BF5', coat2: '#8E6FD4', inner: '#F0E9FF', mark: '#6B4FB0',
  render: c => [
    P.tentacles(c, {color: c.coat2, count: 6, spread: 12.4, len: 7}),
    P.head(c, {rx: 16.6, ry: 15.6}),
    P.circle(P.HEAD.cx - 9.4, P.HEAD.cy + 8.4, 1.5, c.mark, 'fill-opacity=".45"'),
    P.circle(P.HEAD.cx + 9.4, P.HEAD.cy + 8.4, 1.5, c.mark, 'fill-opacity=".45"'),
    P.eyes(c, {dx: 6.4, dy: -1.6, rx: 3.3, ry: 3.6}),
    P.stroke(`M${P.HEAD.cx - 3} ${P.HEAD.cy + 5.6} q3 2.8 6 0`, c.ink, 1.6),
    P.cheeks(c, {dx: 12.4, dy: 3.4})
  ].join('')
};

const starfish = {
  name: 'starfish',
  coat: '#FF9F8A', coat2: '#E2705C', inner: '#FFEDE7', mark: '#C2503E',
  render: c => {
    const R = 17.4, r2 = 7.8, pts = [];
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5, rad = i % 2 ? r2 : R;
      pts.push(`${(P.HEAD.cx + Math.cos(a) * rad).toFixed(2)} ${(P.HEAD.cy + Math.sin(a) * rad).toFixed(2)}`);
    }
    return [
      P.path(`M${pts.join('L')}Z`, c.coat, 'stroke-linejoin="round"'),
      P.path(`M${pts.join('L')}Z`, 'none', `stroke="${c.coat2}" stroke-width="1.4" stroke-linejoin="round"`),
      P.circle(P.HEAD.cx - 4.4, P.HEAD.cy + 5.4, 1.2, c.mark, 'fill-opacity=".4"'),
      P.circle(P.HEAD.cx + 4.4, P.HEAD.cy + 5.4, 1.2, c.mark, 'fill-opacity=".4"'),
      P.eyes(c, {dx: 4.9, dy: -1.4, rx: 2.8, ry: 3.1}),
      P.stroke(`M${P.HEAD.cx - 2.6} ${P.HEAD.cy + 3.4} q2.6 2.4 5.2 0`, c.ink, 1.5),
      P.cheeks(c, {dx: 9.4, dy: 1.4, rx: 2.4, ry: 1.7})
    ].join('');
  }
};

const whaleCalf = {
  name: 'whale calf',
  coat: '#6FC3F0', coat2: '#3E95C8', inner: '#E2F5FF', mark: '#BFEBFF',
  render: c => [
    P.fins(c, {color: c.coat2, dx: 16.8, dy: 6.4, rx: 5.2, ry: 6.2}),
    P.head(c, {rx: 17, ry: 15.2}),
    P.stroke(`M${P.HEAD.cx} ${P.HEAD.cy - 15.4} v-4.4M${P.HEAD.cx - 3.4} ${P.HEAD.cy - 18.4} l-1.6-3.6M${P.HEAD.cx + 3.4} ${P.HEAD.cy - 18.4} l1.6-3.6`, c.mark, 2, 'stroke-opacity=".9"'),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 7.8, 11.4, 6.2, c.inner, 'fill-opacity=".92"'),
    P.stroke(`M${P.HEAD.cx - 4.4} ${P.HEAD.cy + 7} q4.4 3.6 8.8 0`, c.ink, 1.8),
    P.eyes(c, {dx: 7.4, dy: -2.4}),
    P.cheeks(c, {dx: 13, dy: 2.6})
  ].join('')
};

export default {
  id: 'neonreef',
  label: 'Neon Reef friends',
  cast: {milk: clownfish, nurse: jellyfish, formula: seahorse, wet: turtle, poop: octopus, mixed: starfish, pump: whaleCalf},
  mascot: clownfish
};
