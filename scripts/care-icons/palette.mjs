/* Theme palettes for the care-icon system.
 *
 * `disc`  - the pale plate the character sits on. Deliberately low-chroma: the icon is a
 *           mark on a card, not a second block of colour competing with the page artwork.
 * `ink`   - the theme's dark tone. Used for outlines, eyes and the semantic prop, so the
 *           prop always clears contrast against the badge regardless of the coat colour.
 * `blush` - cheeks, and any soft accent a cast wants.
 */
export const PALETTES = {
  safari:    {disc: ['#FDF3E2', '#F3DCB4'], ink: '#5E3410', blush: '#EE9E86', badge: '#FFFBF2'},
  butterfly: {disc: ['#FBF1F8', '#E9DAF3'], ink: '#542E66', blush: '#E98FB6', badge: '#FEF9FD'},
  princess:  {disc: ['#FDF1F3', '#F6D9E3'], ink: '#7A2B48', blush: '#F09AB0', badge: '#FFF8FA'},
  unicorn:   {disc: ['#F4EFFD', '#E1DBFA'], ink: '#42317A', blush: '#F093C4', badge: '#FAF7FF'}
};

export function palette(themeId) {
  const p = PALETTES[themeId];
  if (!p) throw new Error(`Unknown care-icon theme: ${themeId}`);
  return p;
}
