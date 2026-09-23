/* Theme palettes for the care-icon system.
 *
 * `disc`  - the pale plate the character sits on. Deliberately low-chroma: the icon is a
 *           mark on a card, not a second block of color competing with the page artwork.
 * `ink`   - the theme's dark tone. Used for outlines, eyes and the semantic prop, so the
 *           prop always clears contrast against the badge regardless of the coat color.
 * `blush` - cheeks, and any soft accent a cast wants.
 */
export const PALETTES = {
  deepspace:   {disc: ['#EEF1FF', '#D8DDF6'], ink: '#1E2A57', blush: '#8FB6EE', badge: '#FBFCFF'},
  aurora:      {disc: ['#ECF7FF', '#D3E7F4'], ink: '#123C51', blush: '#7FC7DE', badge: '#FAFDFF'},
  neonreef:    {disc: ['#E6FAFB', '#CBEFF1'], ink: '#0F4351', blush: '#F58FA8', badge: '#F7FEFF'},
  crystalcity: {disc: ['#F1EEFF', '#DED8F8'], ink: '#2C2361', blush: '#C79AEA', badge: '#FBFAFF'}
};

export function palette(themeId) {
  const p = PALETTES[themeId];
  if (!p) throw new Error(`Unknown care-icon theme: ${themeId}`);
  return p;
}
