import {field} from './lib.mjs';

/* Four palettes on one composition.
 *
 * Each world is a base ramp, three or four wide light sources, two slow sweeps and a set of
 * hairline contours. The geometry is identical everywhere; only the colour changes. That is
 * what keeps them a family rather than four unrelated wallpapers, and it is why adding a
 * fifth is a palette rather than a drawing.
 *
 * Dark is not the light ramp darkened. Each mode has its own ramp, its own lamp opacities and
 * its own vignette, because a dark surface needs MORE light in it to avoid reading as grey,
 * and a light surface needs less or it turns to milk.
 */

const geometry = {
  lamps: [
    {x: 150, y: 260, rx: 520, ry: 430},
    {x: 900, y: 760, rx: 430, ry: 520},
    {x: 260, y: 1520, rx: 480, ry: 440},
    {x: 860, y: 2060, rx: 460, ry: 400}
  ],
  sweeps: [
    {d: 'M-120 620C220 430 520 760 1120 470', line: [-120, 0, 1120, 0], width: 150, opacity: 0.32},
    {d: 'M-120 1560C260 1380 560 1720 1120 1430', line: [-120, 0, 1120, 0], width: 120, opacity: 0.24}
  ],
  contour: {cx: 880, cy: 300, from: 150, count: 9, step: 78}
};

function world({label, base, lampColors, sweepColors, contourColor, contourOpacity, vignette, lampOpacity, grainAmount}){
  return field({
    label,
    base,
    lamps: geometry.lamps.map((l, i) => ({...l, color: lampColors[i % lampColors.length], opacity: lampOpacity})),
    sweeps: geometry.sweeps.map((s, i) => ({...s, color: sweepColors[i % sweepColors.length]})),
    contour: {...geometry.contour, color: contourColor, opacity: contourOpacity},
    vignette,
    grainAmount
  });
}

export const WORLDS = {
  nocturne: {
    title: 'Nocturne', subtitle: 'Deep indigo, quiet hours',
    dark: () => world({
      label: 'Nocturne dark: deep indigo field with violet light',
      base: ['#0A0B18', '#111126', '#171432', '#0D0C1E'],
      lampColors: ['#5B4BD6', '#8A5BD8', '#3D5FC4', '#6E4FC8'],
      sweepColors: ['#7C6BF0', '#A874E8'],
      contourColor: '#A9A0F0', contourOpacity: 0.12,
      vignette: '#04040C', lampOpacity: 0.62, grainAmount: 0.06
    }),
    light: () => world({
      label: 'Nocturne light: pale indigo field with violet light',
      base: ['#F4F4FB', '#EEEDF8', '#F1ECFA', '#F6F5FC'],
      lampColors: ['#B9B2EE', '#CBB2EC', '#AEBCEA', '#C0B0EF'],
      sweepColors: ['#A99BE8', '#C4A5E6'],
      contourColor: '#6A5FB0', contourOpacity: 0.1,
      vignette: '#8F89C0', lampOpacity: 0.5, grainAmount: 0.04
    })
  },
  ember: {
    title: 'Ember', subtitle: 'Warm charcoal, low light',
    dark: () => world({
      label: 'Ember dark: warm charcoal field with amber light',
      base: ['#120D0C', '#1C1210', '#241511', '#150F0D'],
      lampColors: ['#C2612C', '#D98A34', '#9E3F3A', '#B9552E'],
      sweepColors: ['#E8904A', '#D9644E'],
      contourColor: '#F0BE8E', contourOpacity: 0.11,
      vignette: '#0A0605', lampOpacity: 0.55, grainAmount: 0.06
    }),
    light: () => world({
      label: 'Ember light: warm sand field with amber light',
      base: ['#FBF6F1', '#F8EFE7', '#FAF0E8', '#FCF8F4'],
      lampColors: ['#EFC59C', '#F0CFA2', '#E8B394', '#F2CBA6'],
      sweepColors: ['#E9B583', '#E5A187'],
      contourColor: '#B07A4E', contourOpacity: 0.1,
      vignette: '#C9A183', lampOpacity: 0.52, grainAmount: 0.04
    })
  },
  tide: {
    title: 'Tide', subtitle: 'Cool slate, clear water',
    dark: () => world({
      label: 'Tide dark: deep slate field with teal light',
      base: ['#06121A', '#0A1D26', '#0C2630', '#07141C'],
      lampColors: ['#1E7F8C', '#2C9AA0', '#2A6AA0', '#1F8898'],
      sweepColors: ['#3FBDC4', '#4FA6E0'],
      contourColor: '#8FD9E0', contourOpacity: 0.12,
      vignette: '#030B10', lampOpacity: 0.58, grainAmount: 0.06
    }),
    light: () => world({
      label: 'Tide light: pale slate field with teal light',
      base: ['#F2F8FA', '#E9F3F6', '#EDF5F7', '#F5FAFB'],
      lampColors: ['#A9D6DE', '#B3DDE0', '#A8C8E2', '#AFDAE1'],
      sweepColors: ['#93CBD4', '#9CC2E0'],
      contourColor: '#3F7D8A', contourOpacity: 0.1,
      vignette: '#7FA8B4', lampOpacity: 0.5, grainAmount: 0.04
    })
  },
  meadow: {
    title: 'Meadow', subtitle: 'Soft stone, green shade',
    dark: () => world({
      label: 'Meadow dark: deep green field with sage light',
      base: ['#0A1210', '#0F1C17', '#12241C', '#0B1512'],
      lampColors: ['#2F7A55', '#4A8F5C', '#27705F', '#3C8350'],
      sweepColors: ['#5CB07A', '#7FBE72'],
      contourColor: '#A5D9B4', contourOpacity: 0.11,
      vignette: '#040A08', lampOpacity: 0.55, grainAmount: 0.06
    }),
    light: () => world({
      label: 'Meadow light: pale stone field with sage light',
      base: ['#F5F8F3', '#EDF3EA', '#F0F5ED', '#F7FAF5'],
      lampColors: ['#BCD9C0', '#C6DFC2', '#B4D2C4', '#C2DCBC'],
      sweepColors: ['#A6CCA8', '#B4D3A2'],
      contourColor: '#4C7A59', contourOpacity: 0.1,
      vignette: '#8AAE90', lampOpacity: 0.5, grainAmount: 0.04
    })
  }
};

export const WORLD_IDS = Object.keys(WORLDS);
