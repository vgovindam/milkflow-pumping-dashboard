# MilkFlow immersive theme implementation contract

This file records the design contract for the 2.0.1 theme pass. It is not a runtime stylesheet.

- The existing generated theme artwork under `assets/themes/` is the visual source of truth.
- Baby front-facing pages use the selected world artwork directly.
- Mom remains a calmer Cloud Island experience, with the selected world presented as a distinct visual portal/accent so Mom and Baby never look like recolors of the same screen.
- `theme.css` remains the only theme entrypoint. No patch stylesheets or numbered `v2/v3/v4` replacements.
- `experience-system.css` owns experience tokens/composition. `experience-theme.js` owns theme selection/manifest only.
- Theme code does not own data, routing, Firestore, notifications, forms, or record IDs.
- Princess Palace and Unicorn Dreams must be clearly recognizable on Home and secondary page headers in both light and dark mode.
- Functional care icons remain semantic; theme art supports the scene and must never hide navigation or data-entry controls.
- Existing `milkflow-family-v4-state`, `users/{uid}/entries`, `users/{uid}/familyEvents`, and device notification records remain unchanged.
