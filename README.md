# MilkFlow Family

MilkFlow is a mobile-first Mom + Baby care tracker with private Firebase synchronization.

## Current architecture

Production intentionally uses one UI/runtime layer:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`
- `sw.js` (offline cache)
- `icon.svg`, `icon-*.png`, `favicon.ico` (install icons)

Older app versions, standalone migration scripts and competing CSS layers are not loaded in production. Baby Tracker compatibility and diaper normalization are handled directly in `app.js` so there is one source of truth.

## Mom

- Pump logging in mL
- Nursing kept separate from pumped output
- Pump schedule and reminders
- Pump history and trends
- Freezer stash
- Private import/export

## Baby

Baby Home is optimized for repeated one-handed use: a wide **Log a feed** action, three large
circular diaper orbs (Wet / Poopy / Mixed), pill shortcuts for Sleep, Growth and Trends, a
24-hour **Today's rhythm** track where each logged entry is a tappable dot, and dial rings that
compare today against this baby's own 7-day average rather than any invented clinical target.

- Nursing, expressed-breast-milk bottles, and formula bottles
- Wet-only, poopy-only, and mixed diapers
- Sleep
- Growth: weight, length, head circumference
- Filterable history
- Daily care trends with clear Bottle milk (oz) labeling
- Doctor summary in the More/hamburger menu

Legacy Baby Tracker values are normalized in the data layer: `dirty` becomes `poop`, and `mixed` becomes `both`. The same record IDs are retained. Existing Firestore diaper records are repaired in place after sign-in rather than duplicated or deleted.

Imported source duplicates are preserved for data safety but flagged exact-source duplicates are excluded from Baby trend calculations.

## Editing and removing entries

Any row in Mom history, Baby history or Growth opens an entry sheet with **Edit** and **Remove**.

Remove is a soft-void: the record keeps its id, stays in local storage and in Firestore with a
`voidedAt` timestamp, and simply stops counting toward history and totals. A toast offers **Undo**,
and the entry is still present in any export. Nothing in the app hard-deletes a record.

## Trends

Both Trends views and the Doctor summary offer 7 / 14 / 30 / 90 days and **All**, where All spans
from the first recorded entry. Ranges longer than 45 days are aggregated into even buckets so the
charts stay readable.

Mom: daily output, a 7-day rolling average with a direction badge, and an output-by-time-of-day
breakdown (morning / midday / evening / night). Baby: stacked diaper composition, feeds per day,
bottle volume, a feeding-mix donut, and sleep when logged. Charts are inline SVG/CSS with no
third-party library.

A confirmed daily total (`dailyOverrides`) acts as a **floor**, not a replacement: the day shows
`max(confirmed, logged)`, so sessions logged after the total was confirmed are never hidden.

## Navigation

Screens are real history entries, so the phone/browser Back button walks back through the screens
you visited instead of leaving the app. Refreshing keeps you on the current screen.

## Offline

`sw.js` caches the app shell with a network-first strategy: the newest deploy always wins when
online, and the cache is only used as a fallback. The app opens and logs entries with no network;
those entries sync when the connection returns. The cache version is bumped with the `build` query
string in `index.html`.

## Data safety and sync

The app keeps the existing `milkflow-family-v4-state` localStorage key for backward compatibility, so UI upgrades do not reset local history.

If the app is open in more than one tab, each tab listens for the other's writes and merges both
sides by record id rather than overwriting with its own older in-memory copy. Records carry
`createdAt` / `editedAt` / `voidedAt` so the newer version of a record wins and no entry is lost.

When signed in, Mom records use `users/{uid}/entries` and Baby records use `users/{uid}/familyEvents`. The app reconciles local and cloud records by stable ID, uploads missing local records, normalizes legacy Baby records, and listens for Firestore changes so devices using the same account stay current.

Import is merge-only and creates a pre-import local snapshot. The UI exposes no hard delete; removing an entry only sets `voidedAt` and can be undone.

Use **Settings → Check cloud** to compare cloud record counts with the current device. Use **Export** for a private JSON backup.

## Clinical design references

The tracker layout is informed by current infant-care guidance: feeding history, diaper output, and growth over time are useful context for pediatric follow-up. For children from birth to age 2, U.S. clinicians commonly use WHO growth standards. Doctor Summary is a log summary, not a diagnosis.

The mobile UI uses persistent top-level navigation, large labeled controls, and generous touch targets for frequent handheld use.

Interface icons are hand-written SVG paths rendered from one `icon()` map in `app.js`, so the
sidebar, bottom bar, tiles and rows always use the same symbol for the same action. Wet, poopy and
mixed diapers each have their own icon and colour. The Baby hero illustration and the app install
icons are embedded/generated SVG so the app does not depend on third-party image hosting at runtime.

## Firebase

Firebase browser configuration in `config.js` is public client configuration. Private data access is protected by Firebase Authentication and `firestore.rules`; user data stays under the authenticated UID.
