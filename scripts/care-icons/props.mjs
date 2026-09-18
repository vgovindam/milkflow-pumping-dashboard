/* The semantic layer: what the button DOES.
 *
 * Each prop is drawn once, in a 32x32 box, and is the single source of truth for that
 * action's shape. It is placed twice at different scales:
 *   - full size, centred, for a theme that wants a plain mark (no cast);
 *   - badge size, bottom-right, next to a character.
 * A bottle is therefore the same bottle in Safari and in Princess, which is what keeps the
 * app learnable when a family switches themes.
 */
export const ACTIONS = ['milk', 'nurse', 'formula', 'wet', 'poop', 'mixed', 'pump'];

const SHEEN = 'fill="#fff" fill-opacity=".58"';

const PROPS = {
  /* baby bottle, nipple up */
  milk: ink => `
    <path d="M13.4 2.2h5.2a2 2 0 0 1 2 2v1.1a2 2 0 0 1-2 2h-5.2a2 2 0 0 1-2-2V4.2a2 2 0 0 1 2-2Z" fill="${ink}"/>
    <path d="M13.9 8.1h4.2v2.1h-4.2z" fill="${ink}"/>
    <path d="M12.6 11.3q3.4-1.6 6.8 0a3.6 3.6 0 0 1 1.9 3.2v11.1a4.3 4.3 0 0 1-4.3 4.3h-2a4.3 4.3 0 0 1-4.3-4.3V14.5a3.6 3.6 0 0 1 1.9-3.2Z" fill="${ink}"/>
    <path d="M11 17.4h10v1.9H11zM13.2 21.6h5.6v1.6h-5.6z" ${SHEEN}/>`,

  /* mother and baby: a large heart cradling a small one */
  nurse: ink => `
    <path d="M16 29.4C7.6 23.7 2.9 19.3 2.9 13.6A6.7 6.7 0 0 1 16 10.2a6.7 6.7 0 0 1 13.1 3.4c0 5.7-4.7 10.1-13.1 15.8Z" fill="${ink}"/>
    <path d="M16 22.6c-4.2-2.9-6.5-5.2-6.5-8a3.4 3.4 0 0 1 6.5-1.7 3.4 3.4 0 0 1 6.5 1.7c0 2.8-2.3 5.1-6.5 8Z" fill="#fff" fill-opacity=".66"/>`,

  /* formula tin with a scoop line */
  formula: ink => `
    <rect x="5.6" y="4.4" width="20.8" height="5.2" rx="1.8" fill="${ink}"/>
    <path d="M7.4 11h17.2v13.8a4.8 4.8 0 0 1-4.8 4.8h-7.6a4.8 4.8 0 0 1-4.8-4.8Z" fill="${ink}"/>
    <path d="M10 15.6h12v4.6H10z" ${SHEEN}/>
    <path d="M12.4 22.8h7.2v1.7h-7.2z" fill="#fff" fill-opacity=".38"/>`,

  /* a single drop */
  wet: ink => `
    <path d="M16 2.4c6.2 8 11.2 13.4 11.2 18.5a11.2 11.2 0 0 1-22.4 0C4.8 15.8 9.8 10.4 16 2.4Z" fill="${ink}"/>
    <path d="M10.5 21.6c0 3.3 1.8 5.8 4.6 6.7" stroke="#fff" stroke-opacity=".6" stroke-width="2.2" fill="none" stroke-linecap="round"/>`,

  /* the friendly swirl */
  poop: ink => `
    <path d="M16 4.1c3.6.8 4.6 3 3.7 5.2h1.4c3.6 0 6 2.1 6 4.6 0 1.2-.5 2.3-1.4 3.1 2.9.8 4.5 2.7 4.5 4.8 0 2.9-3.2 5.2-7.2 5.2H8c-4 0-7.2-2.3-7.2-5.2 0-2.1 1.6-4 4.5-4.8a4.2 4.2 0 0 1-1.4-3.1c0-2.5 2.4-4.6 6-4.6h1.4C10.4 7.1 11.4 4.9 16 4.1Z" fill="${ink}"/>
    <circle cx="11.8" cy="18.2" r="1.7" ${SHEEN}/>
    <circle cx="20.2" cy="18.2" r="1.7" ${SHEEN}/>`,

  /* drop plus swirl: both at once */
  mixed: ink => `
    <path d="M10.6 1.9c4.1 5.3 7.4 8.9 7.4 12.2a7.4 7.4 0 0 1-14.8 0C3.2 10.8 6.5 7.2 10.6 1.9Z" fill="${ink}"/>
    <path d="M21.4 15.1c2.5.5 3.2 2 2.6 3.5h1c2.5 0 4.1 1.5 4.1 3.2 0 .8-.4 1.6-1 2.1 2 .6 3.1 1.9 3.1 3.3 0 2-2.2 3.6-5 3.6h-9.4c-2.8 0-5-1.6-5-3.6 0-1.4 1.1-2.7 3.1-3.3a2.9 2.9 0 0 1-1-2.1c0-1.7 1.6-3.2 4.1-3.2h1c-.6-1.5.1-3 2.4-3.5Z" fill="${ink}"/>`,

  /* pump flange, seen from the side */
  pump: ink => `
    <path d="M3.4 7.6h25.2a2.2 2.2 0 0 1 2 3l-4.6 11a2.8 2.8 0 0 0-.2 1.1v.9H6.2v-.9a2.8 2.8 0 0 0-.2-1.1l-4.6-11a2.2 2.2 0 0 1 2-3Z" fill="${ink}"/>
    <path d="M12.2 24.2h7.6a4.4 4.4 0 0 1 4.4 4.4v1.4H7.8v-1.4a4.4 4.4 0 0 1 4.4-4.4Z" fill="${ink}"/>
    <path d="M16 11.8c1.8 2.3 3.2 4 3.2 5.5a3.2 3.2 0 0 1-6.4 0c0-1.5 1.4-3.2 3.2-5.5Z" fill="#fff" fill-opacity=".7"/>`
};

/** The prop on its own, in its native 32x32 box. */
export function prop(action, ink) {
  const draw = PROPS[action];
  if (!draw) throw new Error(`Unknown care action: ${action}`);
  return draw(ink).trim();
}

/** The prop placed inside a 64x64 icon: `scale` of its native size, centred on cx/cy. */
export function placeProp(action, ink, {cx, cy, scale}) {
  const offset = 16 * scale;
  return `<g transform="translate(${round(cx - offset)} ${round(cy - offset)}) scale(${round(scale)})">${prop(action, ink)}</g>`;
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}
