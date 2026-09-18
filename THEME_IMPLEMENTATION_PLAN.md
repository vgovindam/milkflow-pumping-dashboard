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
