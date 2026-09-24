# MilkFlow releases

## v2.16.0 — Smart Baby Home and expandable theme library

This release makes Baby Home more useful per pixel while preserving a generous identity/photo area.

- Replaces the three full-width Baby hero summary boxes with a compact identity-first layout.
- Keeps a 128px mobile Baby portrait while reducing the themed hero to roughly 196–198px at the 390px QA viewport.
- Adds time-aware, non-medical parent wishes plus a compact today line for feeds, logged bottle volume, and diapers.
- Keeps only the two time-sensitive hero facts: Last feed and the conservatively learned Next feed window.
- Uses compact relative timing with real history so logged data does not make the hero expand unexpectedly.
- Moves hero height ownership back to the screen component instead of the theme layer.
- Registers Unicorn Dream, Ocean, Moon & Stars, Woodland Forest, Safari Sunset, Floral Meadow, and Cozy Clouds in the central theme library.
- Keeps incomplete future themes out of the selector until Baby/Mom, light/dark, preview, motif, and care artwork are complete.
- Brings the high-end theme catalog, integration contract, art direction, and existing-asset inventory into the active repository.
- Adds regression gates for Baby hero height, portrait size, timing structure, and atomic theme readiness.

No MilkFlow care record, state-key, Firestore collection, or record-ID migration is introduced.

## v2.15.0 — Product foundation

This release strengthens the product underneath the visual redesign rather than adding another isolated screen patch.

- Adds a pure `insights-engine.js` that turns existing Mom/Baby logs into observations and recent-vs-earlier comparisons without diagnosing or inventing clinical thresholds.
- Mom Trends now explains pumping direction, typical session output, same-day spacing and strongest logged time window.
- Baby Trends now leads with data coverage and changes in feeding frequency, bottle volume, wet diapers and logged sleep when available.
- Parent education is visually separated from observations and links to reviewed CDC, American Academy of Pediatrics/HealthyChildren, and WHO public guidance.
- Doctor Summary and its printable report reuse the same interpretation model, so on-screen and clinician-facing summaries cannot drift into separate calculations.
- Corrects duplicate/stale active-theme token definitions, including a Princess palette override that was silently winning the cascade.
- Removes the retired Storybook stylesheet from the production cascade and build output.
- Adds branch-safe product CI plus stronger CSS/theme/build artifact checks, including independently authored light/dark painted plate verification and a no-regression baseline for runtime `!important` debt.
- Preserves the existing local/Firestore data contracts; no migration or record-ID changes are introduced.

The release remains intentionally conservative about health interpretation: logged patterns are descriptive, education is source-backed, and clinician-specific advice remains with the family's healthcare professionals.

MilkFlow now has one application-version source: `version.json`.

## Daily development

```bash
npm ci
npm run dev
```

`npm run dev` rebuilds `dist/` and serves the exact production shape locally.

## Verify before a release

```bash
npm run verify
```

That runs the CSS architecture audit, JavaScript/data-contract tests, a fresh `dist/` build, rendered browser QA with retries, and a production-artifact audit.

## Release website

Feature work should already be committed on `main`. Then run:

```bash
npm run release -- 2.1.0
```

or:

```bash
npm run release -- patch
npm run release -- minor
npm run release -- major
```

The release command requires a clean `main` that exactly matches `origin/main`, updates `version.json`, verifies the app, commits `Release vX.Y.Z`, creates an annotated `vX.Y.Z` tag, pushes both, and watches the GitHub Pages run when the `gh` CLI is installed.

## Release website + Firebase Functions

When server-side notification/chat/function code changed:

```bash
npm run release:full -- 2.1.0
```

This requires an authenticated Firebase CLI and explicitly targets `milkflow-pumping-dashboard` before the website release is pushed.

## Roll back

```bash
npm run rollback -- 2.0.0
```

Rollback creates a new commit on `main` whose tracked source tree matches the selected release tag. It does not rewrite Git history.

## Production rules

- GitHub Pages deploys **only `dist/`**, never the repository root.
- `sw.js` is generated from `sw.template.js`; never hand-edit a production cache version.
- `theme.css` is the canonical theme entry. Do not add `*-v2.css`, `*-v3.css`, `*-final.css`, `*-fixed.css`, or patch stylesheets to `index.html`.
- Existing MilkFlow data remains under `milkflow-family-v4-state`, `users/{uid}/entries`, and `users/{uid}/familyEvents`.
- `build-manifest.json` records the deployed semantic version, commit SHA, timestamp, and artifact list.
- Settings → About MilkFlow shows the running release version/build so an installed PWA can be identified without guessing from cache names.
