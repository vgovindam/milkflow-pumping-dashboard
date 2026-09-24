/* Theme palettes for the care-icon system.
 *
 * `disc`  - the pale plate the character sits on. Deliberately low-chroma: the icon is a
 *           mark on a card, not a second block of color competing with the page artwork.
 * `ink`   - the theme's dark tone. Used for outlines, eyes and the semantic prop, so the
 *           prop always clears contrast against the badge regardless of the coat color.
 * `blush` - cheeks, and any soft accent a cast wants.
 */
export const PALETTES = {
  safari:    {disc: ['#FDF3E2', '#F3DCB4'], ink: '#5E3410', blush: '#EE9E86', badge: '#FFFBF2'},
  butterfly: {disc: ['#FBF1F8', '#E9DAF3'], ink: '#542E66', blush: '#E98FB6', badge: '#FEF9FD'},
  princess:  {disc: ['#FDF1F3', '#F6D9E3'], ink: '#7A2B48', blush: '#F09AB0', badge: '#FFF8FA'},
  ocean: {disc: ['#E5FBF8','#B9E7EB'],ink:'#315978',blush:'#F4BFA8',badge:'#F7FEFC'},
  celestial: {disc:['#F1F0FF','#DBDEFA'],ink:'#454679',blush:'#E6B6D2',badge:'#FBFAFF'},
  woodland: {disc:['#F4F3E5','#D9E8C5'],ink:'#534A34',blush:'#DEA998',badge:'#FFFCF4'},
  'safari-sunset': {disc:['#FFF1D4','#F3CE9D'],ink:'#644A34',blush:'#F3B299',badge:'#FFFAF0'},
  'floral-meadow': {disc:['#F7FBE8','#DCEFCB'],ink:'#475B47',blush:'#E8A4B1',badge:'#FFFCF4'},
  'cozy-clouds': {disc:['#EDF8FF','#DDE8FC'],ink:'#5A6886',blush:'#E8B5B9',badge:'#FFFDFC'}
};

export function palette(themeId) {
  const p = PALETTES[themeId];
  if (!p) throw new Error(`Unknown care-icon theme: ${themeId}`);
  return p;
}
