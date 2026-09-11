# MilkFlow Family

MilkFlow is a mobile-first Mom + Baby care tracker with private Firebase synchronization.

## Current architecture

The production app intentionally has one UI/runtime layer:

- `index.html`
- `app-v7.css`
- `app-v7.js`
- `config.js`

Legacy JavaScript/CSS layers and the stale service worker were removed so there are no competing “last rule wins” overrides in production.

## Mom

- Pump logging in mL
- Nursing logging kept separate from pumped output
- Daily schedule and reminders
- Pump history and 7/14/30-day trends
- Freezer stash
- Private import/export

## Baby

The home screen is optimized for repeated one-handed use with four large actions: Feed, Wet, Poopy, and Mixed.

- Nursing, expressed-breast-milk bottles, and formula bottles
- Wet / poopy / mixed diapers
- Sleep
- Growth measurements: weight, length, head circumference
- Filterable history
- Feeding + diaper trends
- Doctor summary available from the More/hamburger menu

Imported source duplicates are preserved for audit/data safety but flagged duplicate rows are excluded from Baby trend counts.

## Data safety and sync

The app keeps the existing `milkflow-family-v4-state` localStorage key for backward compatibility, so UI upgrades do not reset local history.

When signed in, Mom records use `users/{uid}/entries` and Baby records use `users/{uid}/familyEvents`. The app reconciles local and cloud IDs, uploads missing local records, and listens for Firestore changes so devices using the same account stay current.

Import is merge-only. It creates a pre-import local snapshot and does not delete existing records. The UI intentionally exposes no delete action in this stable version.

Use **Settings → Check cloud** to compare the current cloud record counts with the device. Use **Export** for a private JSON backup.

## Clinical design references

The tracker layout is informed by current CDC/AAP-aligned infant care guidance: feeding frequency, wet/dirty diaper history, and growth-over-time are useful context for infant follow-up. U.S. clinicians use WHO growth standards from birth to age 2. Doctor Summary is a logging summary, not a diagnosis.

The interface follows Apple mobile usability guidance: persistent top-level navigation, large labeled controls, and touch targets designed for frequent handheld use.

Icons are based on selected Lucide SVG paths, released under the ISC License.

## Firebase

Firebase browser configuration in `config.js` is public client configuration. Private data access is protected by Firebase Authentication and `firestore.rules`; user data stays under the authenticated UID.
