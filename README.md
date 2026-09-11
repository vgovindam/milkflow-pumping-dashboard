# MilkFlow Family

MilkFlow is a mobile-first Mom + Baby care tracker with private Firebase synchronization.

## Current architecture

Production intentionally uses one UI/runtime layer:

- `index.html`
- `styles.css`
- `app.js`
- `config.js`

Older app versions, standalone migration scripts, competing CSS layers, and the stale service worker are not loaded in production. Baby Tracker compatibility and diaper normalization are handled directly in `app.js` so there is one source of truth.

## Mom

- Pump logging in mL
- Nursing kept separate from pumped output
- Pump schedule and reminders
- Pump history and trends
- Freezer stash
- Private import/export

## Baby

Baby Home is optimized for repeated one-handed use with four large actions: Feed, Wet, Poopy, and Mixed.

- Nursing, expressed-breast-milk bottles, and formula bottles
- Wet-only, poopy-only, and mixed diapers
- Sleep
- Growth: weight, length, head circumference
- Filterable history
- Daily care trends with clear Bottle milk (oz) labeling
- Doctor summary in the More/hamburger menu

Legacy Baby Tracker values are normalized in the data layer: `dirty` becomes `poop`, and `mixed` becomes `both`. The same record IDs are retained. Existing Firestore diaper records are repaired in place after sign-in rather than duplicated or deleted.

Imported source duplicates are preserved for data safety but flagged exact-source duplicates are excluded from Baby trend calculations.

## Data safety and sync

The app keeps the existing `milkflow-family-v4-state` localStorage key for backward compatibility, so UI upgrades do not reset local history.

When signed in, Mom records use `users/{uid}/entries` and Baby records use `users/{uid}/familyEvents`. The app reconciles local and cloud records by stable ID, uploads missing local records, normalizes legacy Baby records, and listens for Firestore changes so devices using the same account stay current.

Import is merge-only and creates a pre-import local snapshot. The stable UI intentionally exposes no delete action.

Use **Settings → Check cloud** to compare cloud record counts with the current device. Use **Export** for a private JSON backup.

## Clinical design references

The tracker layout is informed by current infant-care guidance: feeding history, diaper output, and growth over time are useful context for pediatric follow-up. For children from birth to age 2, U.S. clinicians commonly use WHO growth standards. Doctor Summary is a log summary, not a diagnosis.

The mobile UI uses persistent top-level navigation, large labeled controls, and generous touch targets for frequent handheld use.

Selected interface icons use Lucide-style SVG paths under the ISC License. Larger Mom and Baby hero illustrations are embedded SVG artwork so the app does not depend on third-party image hosting at runtime.

## Firebase

Firebase browser configuration in `config.js` is public client configuration. Private data access is protected by Firebase Authentication and `firestore.rules`; user data stays under the authenticated UID.
