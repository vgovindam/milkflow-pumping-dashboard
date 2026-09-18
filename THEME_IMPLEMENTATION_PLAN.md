# MilkFlow immersive theme implementation contract

This file records the design contract for the 2.1 theme architecture. It is not a runtime stylesheet.

- `assets/themes-v2/<theme>/<mode>/` is the visual source of truth: Baby background,
  Baby hero, Mom background, Mom hero and Settings preview are independently addressable.
- Light and dark modes use separate self-contained artwork files, not a dark veil over light art.
- Baby uses the playful composition; Mom uses the calmer crop/composition from the same world.
- `theme.css` remains the only theme entrypoint. No patch stylesheets or numbered `v2/v3/v4` replacements.
- `experience-system.css` owns experience tokens/composition. `experience-theme.js` owns the
  explicit asset manifest and selects one owner for each visual job.
- Theme code does not own data, routing, Firestore, notifications, forms, or record IDs.
- Functional cards use solid surfaces. Page scenery never renders inside feed or diaper zones.
- Princess Palace and Unicorn Dreams must be clearly recognizable on Home and secondary page headers in both light and dark mode.
- Functional care icons remain semantic; theme art supports the scene and must never hide navigation or data-entry controls.
- Existing `milkflow-family-v4-state`, `users/{uid}/entries`, `users/{uid}/familyEvents`, and device notification records remain unchanged.

## Painted plates (2.2.0)

Safari, Butterfly and Princess now ship illustrated raster plates alongside the generated
SVG scenes, in the same `assets/themes-v2/<theme>/<mode>/` layout and under the same slot
names. `experience-theme.js` selects `<slot>@<width>.webp` for a painted theme and falls
back to `<slot>.svg` otherwise, so a theme without painted art stays a first-class state.

- Widths: backgrounds 480/720/941, heroes 640/941, preview single. The plates are natively
  941px wide, so denser screens are served the widest file rather than an upscale.
- WebP only, not AVIF: these are consumed as CSS `background-image` through custom
  properties, and `url()` cannot negotiate formats the way `<picture>` can.
- Theme art stays out of the install shell (`scripts/build.mjs`) and is runtime-cached.
- Unicorn has no painted plates and keeps its SVG world.

Text sitting over a plate must clear a surface-alpha floor of 0.62 — measured from the
plate pixels, the painted worlds carry far more local contrast than the SVG scenes the
original alphas were tuned against. Both home screens measure clean in both modes for every
painted theme. Unicorn's Mom home still fails on its SVG art (greeting 3.4:1, kicker 2.0:1
light; headline 1.1:1 dark) and needs a carrier or real art.
