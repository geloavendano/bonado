# Bonado build phases

Phased build plan, following the design handoff (`Bonado Wireframes.dc.html`,
screens `3a`/`3b`/`4a`–`4i`). Each phase is meant to be shippable on its own.

## Phase 1 — Foundation ✅ done

Project scaffold (Vite + React + TS + Tailwind), design tokens, UI
primitives, Supabase (schema, RLS, auth, storage), Google SSO, Dashboard
(`3a`).

## Phase 2 — Trip creation

Create trip screen (`4a`): name, location, currency selection, cover photo.
Location autocomplete and cover photo search are stubbed (manual entry /
placeholder) until Google Places and Unsplash API keys are wired in.

## Phase 3 — Trip home / invite

Trip home screen (`4b`): cover, balance summary, recent entries list,
invite link generation/sharing, floating nav pattern (Entries / Balances /
Reports + FAB).

## Phase 4 — Membership / guest join

Guest join landing page (`4h`): join via invite link, guest session
(Supabase anonymous auth), name-only join, later account claiming
(guest → registered merge).

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

---

Open ordering question: Phase 3 (Trip home / invite) surfaces the invite
flow before Phase 4 (Membership / guest join) implements what happens when
someone taps that link. May want to swap or merge 3 & 4 depending on how we
want to demo progress.
