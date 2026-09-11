# MilkFlow

A polished, local-first pumping and nursing dashboard designed for quick daily logging and useful trend analysis.

## Highlights

- Product-style navigation and responsive dashboard UI
- Pumping sessions and nursing tracked separately
- Daily goal progress, 7/14-day trends, personal bests, average output
- Freezer stash and estimated runway
- Family-friendly editable pumping schedule
- Local-first persistence via `localStorage`
- Optional Supabase cloud sync with Row Level Security
- JSON backup/export
- No personal pumping data is committed to this public repository

## Supabase

`config.js` intentionally contains no credentials. Use only a Supabase **publishable** key in the browser. Never put a secret/service-role key in this repository.

The database schema is in `supabase-schema.sql`. After the target Supabase project is selected and the migration is applied, set the project URL and publishable key in `config.js`, then enable cloud sync.

## Hosting

The app is static and can be served directly by GitHub Pages or any static host. No build step is required.
