/* Safari cast: savannah babies, one per care action. */
import * as P from '../parts.mjs';

const giraffe = {
  name: 'giraffe',
  coat: '#F4C878', coat2: '#E3A94C', inner: '#FCEACB', mark: '#C9832F',
  render: c => [
    P.earsLeaf(c, {dx: 15, dy: -10.2, rx: 4.6, ry: 5.2, tilt: 58}),
    P.ossicones(c),
    P.head(c),
    P.spots(c, {at: [[-9.6, -5.4, 3], [8, -7, 2.6], [-5, 4.6, 2.3], [10, 1.6, 2.8], [-12.6, 3.2, 2.2]]}),
    P.muzzle(c, {rx: 9.4, ry: 6.8}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const elephant = {
  name: 'elephant',
  coat: '#C3CCE0', coat2: '#A2B0CB', inner: '#E8EEF8', mark: '#93A3C1',
  render: c => [
    P.earsRound(c, {dx: 17.2, dy: -6.4, rad: 8.8, inner: 5.4}),
    P.head(c),
    P.trunk(c),
    P.eyes(c, {dx: 7.4, dy: -2.6}),
    P.cheeks(c, {dx: 12.8, dy: 3.4})
  ].join('')
};

const lion = {
  name: 'lion',
  coat: '#F7CE8C', coat2: '#E6AE5E', inner: '#FDEDD4', mark: '#E09A3C',
  render: c => [
    P.mane(c),
    P.earsRound(c, {dx: 13.6, dy: -11.4, rad: 4.6, inner: 2.4}),
    P.head(c, {rx: 15.4, ry: 14.6}),
    P.muzzle(c, {rx: 8.8, ry: 6.4, nose: 'triangle'}),
    P.eyes(c, {dx: 6, dy: -1.4}),
    P.cheeks(c, {dx: 11.4, dy: 4.4})
  ].join('')
};

const hippo = {
  name: 'hippo',
  coat: '#BBA7CC', coat2: '#9C86B2', inner: '#EADFF3', mark: '#A691BC',
  render: c => [
    P.earsRound(c, {dx: 14.2, dy: -12.4, rad: 4.2, inner: 2.2}),
    P.head(c, {rx: 17.2, ry: 15.2}),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 8.6, 11.2, 7, c.inner, 'fill-opacity=".92"'),
    P.stroke(`M${P.HEAD.cx - 3.6} ${P.HEAD.cy + 6.4} v1.6M${P.HEAD.cx + 3.6} ${P.HEAD.cy + 6.4} v1.6`, c.ink, 2, 'stroke-opacity=".75"'),
    P.stroke(`M${P.HEAD.cx - 3.4} ${P.HEAD.cy + 11.2} q3.4 2.6 6.8 0`, c.ink, 1.5, 'stroke-opacity=".7"'),
    P.eyes(c, {dx: 7.6, dy: -4.4, rx: 2.9, ry: 3.3}),
    P.cheeks(c, {dx: 13.4, dy: 2.4})
  ].join('')
};

const monkey = {
  name: 'monkey',
  coat: '#C78E55', coat2: '#A9713D', inner: '#F5DCB9', mark: '#B07C42',
  render: c => [
    P.earsRound(c, {dx: 17.4, dy: -1.4, rad: 6.2, inner: 3.4}),
    P.head(c),
    P.ellipse(P.HEAD.cx, P.HEAD.cy + 3.4, 12.6, 11.4, c.inner, 'fill-opacity=".95"'),
    P.ellipse(P.HEAD.cx, P.HEAD.cy - 9.4, 10.6, 5.4, c.coat2, 'fill-opacity=".45"'),
    P.eyes(c, {dx: 5.6, dy: -0.6}),
    P.stroke(`M${P.HEAD.cx - 2.6} ${P.HEAD.cy + 6.2} h5.2`, c.ink, 1.4, 'stroke-opacity=".5"'),
    P.stroke(`M${P.HEAD.cx - 3.2} ${P.HEAD.cy + 9.4} q3.2 3 6.4 0`, c.ink, 1.6, 'stroke-opacity=".8"'),
    P.cheeks(c, {dx: 11.6, dy: 6.4})
  ].join('')
};

const zebra = {
  name: 'zebra',
  coat: '#F8F5EE', coat2: '#E2DCD0', inner: '#FFFFFF', mark: '#3E3931',
  render: c => [
    P.earsLeaf(c, {dx: 13.2, dy: -12.6, rx: 4.2, ry: 6, tilt: 26}),
    P.head(c),
    P.stripes(c, {opacity: '.82', width: 2.8}),
    P.forelockBrush(c, {color: c.mark, count: 5, spread: 7.2, height: 2.8, width: 2}),
    P.muzzle(c, {rx: 9, ry: 6.6}),
    P.path(`M${P.HEAD.cx - 9} ${P.HEAD.cy + 8.4} a9 6.6 0 0 1 18 0Z`, c.mark, 'fill-opacity=".18"'),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

const tiger = {
  name: 'tiger cub',
  coat: '#F5AC50', coat2: '#DD8A28', inner: '#FFF2DE', mark: '#4E2C0F',
  render: c => [
    P.earsRound(c, {dx: 14.4, dy: -11.6, rad: 5.2, inner: 2.9}),
    P.head(c),
    P.stripes(c, {opacity: '.88', width: 2.9}),
    P.forelockBrush(c, {color: c.mark, count: 3, spread: 4.2, height: 2.6, width: 2}),
    P.muzzle(c, {rx: 9.2, ry: 6.6, nose: 'triangle'}),
    P.eyes(c),
    P.cheeks(c)
  ].join('')
};

export default {
  id: 'safari',
  label: 'Safari friends',
  cast: {milk: giraffe, nurse: elephant, formula: lion, wet: hippo, poop: monkey, mixed: zebra, pump: tiger},
  mascot: giraffe
};
