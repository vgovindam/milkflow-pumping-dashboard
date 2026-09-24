# Theme Integration Contract — Next Iteration

## Non-negotiable architecture

The future implementation must extend the current separation of concerns:

```
care data / Firebase / calculations
          ↓
page components
          ↓
design tokens
          ↓
theme registry
          ↓
theme assets + light/dark resolver
```

No page should contain hard-coded checks such as `if (theme === 'animal')` for visual choices.

## Atomic completeness

A theme cannot appear in the selector until all required slots are present and verified:

- Baby background: light + dark
- Baby hero: light + dark
- Mom background: light + dark
- Mom hero: light + dark
- selector preview
- motif/icon treatment
- care/tile artwork
- chart palette
- empty/loading/error compatibility
- fallback assets
- mobile QA
- dark-mode contrast QA

## Page coverage

Themes apply to the complete app mechanism, not only Home:

- Mom Home
- Baby Home
- History
- Day Review
- Trends
- Growth
- Development
- Stash
- Doctor Summary
- Settings
- Appearance
- Family Account
- Profile
- Pumping/Reminder settings
- entry sheets/modals
- empty/loading/error states

Secondary pages should use a restrained version of the selected world rather than becoming generic white screens.

## Realm distinction

Baby and Mom use the same theme family but distinct art direction.

Baby = warmer/playful/more expressive.
Mom = calmer/editorial/more sophisticated.

Never duplicate the exact same composition merely with a tint.

## Dark mode

Dark artwork must be separately authored. Do not apply a black overlay to light art and call it dark mode.

## Tile system

Tile semantics remain constant. The visual motif changes by theme.

Example:

```
tile.feeding → Animal Kingdom giraffe
tile.feeding → Ocean whale/turtle motif
tile.feeding → Celestial moon/cloud motif
```

The component still receives one semantic key: `feeding`.

## Performance

Only load assets for the active theme and current/likely next realm. Theme switching may preload the incoming preview/hero/background but must not eagerly fetch every theme package.

## Migration

Do not remove current runtime themes during development. The next theme system should first run behind a feature flag or development-only registry, then be validated before replacing or aliasing existing theme IDs.
