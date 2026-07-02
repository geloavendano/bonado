# Bonado build phases

Phased build plan, following the design handoff (`Bonado Wireframes.dc.html`,
screens `3a`/`3b`/`4a`–`4i`). Each phase is meant to be shippable on its own.

## Phase 1 — Foundation ✅ done

Project scaffold (Vite + React + TS + Tailwind), design tokens, UI
primitives, Supabase (schema, RLS, auth, storage), Google SSO, Dashboard
(`3a`).

## Phase 2 — Trip creation ✅ done

Create trip screen (`4a`): name, location, currency selection, cover photo.
Location autocomplete and Unsplash-suggested photos are stubbed (manual
entry / placeholder); "Own" cover upload is real (Supabase Storage).

## Phase 3 — Trip home / invite ✅ done

Trip home screen (`4b`): cover, balance summary (0 until Phase 8 lands),
empty-state recent entries, invite link generation/sharing. Shared floating
nav (Entries / Balances / Reports + FAB) used across all three trip tabs;
Balances/Reports have the real nav shell with placeholder bodies until
Phases 8/9.

## Phase 4 — Membership / guest join ✅ done

Guest join landing page (`4h`): trip preview by invite token (via a
SECURITY DEFINER RPC, works signed-out), join via anonymous auth or
Google, auto-join once authenticated. Guest → registered claiming via
Supabase identity linking (banner shown on Dashboard/Trip home).

## Phase 5 — Expense entry (simple)

Add expense screen (`3b`): amount, description, payee/date, category,
multiple payers, equal-split toggle per person.

## Phase 6 — Expense entry (itemized)

Itemized screen (`4c`) + add-item sheet (`4d`): line items, per-item
avatar include/exclude, exact/%/shares splits, tax & tip (proportional or
own-item), reconciliation footer.

## Phase 7 — Expense detail

Expense detail screen (`4e`): summary, your-share highlight, per-person
breakdown, receipt photo, edit/delete (soft delete, online only).

## Phase 8 — Balances / settle up

Balances screen (`4f`): net position per person, record-settlement bottom
sheet, "trip settled" celebration state.

## Phase 9 — Reports

Reports screen (`4g`): by-category donut chart, by-account view (money in/
out, expense vs transfer).

## Phase 10 — Currency conversion

Per-entry currency with rate snapshot, Frankfurter API integration,
per-user display currency, daily rate caching (`exchange_rate_cache`).

## Phase 11 — Offline sync

Local sync queue for mobile: create-only while offline (new entries +
photos), edits/deletes disabled offline, estimated-rate resolution on
reconnect.

## Phase 12 — Desktop layout

Three-column desktop view (`4i`): trip list rail, wide entries view,
balance rail.

