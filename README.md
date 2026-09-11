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

## Activity timeline

Baby Home leads with three live activity rows — Feed, Diaper, Sleep — each showing how long since
the last one, what it was, and the day's roll-up, with a one-tap add button. Tapping a row opens
that entry.

**Day review** (`#baby-day`, in the Baby nav and linked from Daily trends) is the per-day timeline:
a scrollable date strip, a statistics block for the selected day (nursing minutes and count, bottle
volume split into breast milk and formula, diapers broken down by type, sleep total and count),
filter tabs, and the day's entries in chronological order. Every row opens the record sheet.

## Feed reminders

**Settings → Feed reminders** nudges you when the baby is due, based on the last feed plus a chosen
gap (2–5 hours). A due chip appears on the feed row, and an in-app toast with a **Log** shortcut
fires once per due feed, plus a system notification when permission is granted.

This is a **nudge, not an alarm clock**. A browser cannot wake a closed page, so reminders only
arrive while MilkFlow is open or installed and running. Genuine background alarms would need
Firebase Cloud Messaging with a push handler and server-side scheduling.

## Entering data

Every log sheet is built around one big, typable number with thumb-sized +/− keys either side,
plus preset chips **generated from what this family has actually logged** rather than invented
defaults, and a Now / 15m / 30m / 1h row instead of a time picker (the exact date and time stay one
tap away). The app remembers the last bottle, pump, nursing, side and sleep values and offers them
as the starting point.

## Development

A visual milestone journey across the first two years. The track shows every checklist band,
where the baby is now, and how much of each band has been noted. Tapping an item records it as a
normal baby event (`eventType: "milestone"`), so it appears in History, syncs, exports, and can be
un-marked with undo.

Content is the CDC **"Learn the Signs. Act Early."** checklists (2022 revision), which are US
federal government work in the public domain. They describe what about 75% of children can do by
each age — a conversation starter for pediatric visits, not a test or a diagnosis.

This is deliberately **not** the Wonder Weeks "leap" schedule: that schedule, its numbering and its
artwork are proprietary, and its developmental claims are not clinically established.

The journey needs a date of birth, set in **Settings → Baby profile** along with the baby's name
and a photo. Photos are centre-cropped and downscaled to 320px JPEG before storage so the synced
profile document stays small.

## Appearance

Three themes — **Automatic**, Light and Dark, in Settings → Appearance. Automatic follows the
clock: the app turns dark for the night period, which is when most feeds get logged, and also
follows the device's own dark setting.

Every surface, tint and tile gradient is a token, so the two themes stay in step rather than
drifting. Buttons that carry white labels use fixed dark gradients in both themes, because the
accent colours lighten for dark mode and would wash the label out.

Both themes are checked against WCAG AA (4.5:1 for small text, 3:1 for large) across every view.

## Time of day

The app tints itself across four day parts (morning, afternoon, evening, night) and greets you on
every load. Only ambient surfaces change — ink, lines and accent colours are fixed, so text
contrast is identical at every hour.

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

One hierarchy, one Back button. Five tabs — Home, History, Add, Trends, More — and everything
else is *pushed* from a single parent, so there is exactly one route to each screen:

```
Home  History  (+)  Trends  More
                              ├── Growth / Development / Doctor summary   (baby)
                              ├── Freezer stash                           (mom)
                              └── Settings
                                    ├── Family account
                                    ├── Baby profile
                                    ├── Pumping
                                    ├── Reminders
                                    ├── Backup & data
                                    └── About
```

Going deeper slides in from the trailing edge, Back slides the other way, switching tabs
cross-fades; `prefers-reduced-motion` turns all of it off. The in-app Back is a real history pop,
so the device Back button never walks forward through screens you already left.

The nav bar carries Back and sync status; the page carries its own large title. Sub-pages hide the
Mom/Baby switch, because a sub-page belongs to one side of the app.



Refreshing keeps you on the current screen.

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

Type is **Bricolage Grotesque** (variable, optical-sized) for headlines and figures against **Plus
Jakarta Sans** for dense UI text. Control labels stay in the sans so they read as things to tap;
counts and volumes use tabular figures so columns line up.

Care actions use two-tone **glyphs** on the large surfaces — a soft wash of the action's colour
plus a crisp outline of the same colour — so Wet, Poopy, Mixed, Bottle, Nursing, Pump, Sleep and
Growth each read as their own picture while staying one family. Small chrome (nav bar, chips,
chevrons) keeps the lighter line icons.

Interface icons are hand-written SVG paths rendered from one `icon()` map in `app.js`, so the
sidebar, bottom bar, tiles and rows always use the same symbol for the same action. Wet, poopy and
mixed diapers each have their own icon and colour. The Baby hero illustration and the app install
icons are embedded/generated SVG so the app does not depend on third-party image hosting at runtime.

## Firebase

Firebase browser configuration in `config.js` is public client configuration. Private data access is protected by Firebase Authentication and `firestore.rules`; user data stays under the authenticated UID.
