# MilkFlow

A polished, local-first pumping and nursing dashboard with private Firebase cloud synchronization.

## Highlights

- Product-style navigation and responsive dashboard UI
- Pumping sessions and nursing tracked separately
- Daily goal progress, 7/14-day trends, personal bests, average output
- Freezer stash and estimated runway
- Family-friendly editable pumping schedule
- Immediate offline persistence via `localStorage`
- Firebase Authentication + Firestore cloud sync
- JSON backup/export
- No personal pumping data is committed to this public repository

## Firebase

The browser configuration lives in `config.js`. Firebase web configuration is public client configuration; access control is enforced with Firebase Authentication and `firestore.rules`.

Deploy the included Firestore rules before relying on cloud sync. Each user's data is stored beneath `users/{uid}` and is readable/writable only by that authenticated UID.

The app keeps local storage enabled even when signed in, so a temporary network interruption does not block logging. When signed in, local entries are synchronized to Firestore.

## Hosting

The app is static and can be served directly by GitHub Pages. No build step is required.
