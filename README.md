# Bonado

Mobile-first web app for splitting shared trip expenses among friends.

## Stack

- Vite + React + TypeScript (SPA, client-side routing via `react-router-dom`)
- Tailwind CSS v4 (design tokens in `src/index.css`)
- Supabase (Postgres + Auth + Storage) — see `supabase/README.md` for setup

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in your Supabase project URL + anon key
npm run dev
```

Without Supabase credentials the app still runs but shows a console warning
and all data calls will fail — you need a Supabase project (see
`supabase/README.md`) to sign in and see real data.

## Project structure

```
src/
  components/
    ui/          reusable primitives (Avatar, Button, Card, Pill, ...)
    layout/       page-level layout wrappers
  context/         AuthContext (Supabase auth + app user row)
  hooks/           data-fetching hooks
  lib/             Supabase client, formatting helpers
  pages/           route-level screens
  types/           schema.ts mirrors the Supabase schema
supabase/
  migrations/      SQL schema + RLS policies
```

## Progress

- [x] Project scaffold, design tokens, UI primitives
- [x] Auth (Google SSO via Supabase)
- [x] Dashboard (current trip + all trips)
- [ ] Trip creation
- [ ] Trip home / invite
- [ ] Membership / guest join
- [ ] Expense entry (simple + itemized)
- [ ] Expense detail
- [ ] Balances / settle up
- [ ] Reports
- [ ] Currency conversion
- [ ] Offline sync
- [ ] Desktop layout
