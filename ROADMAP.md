# Bonado build phases

Phased build plan, following the design handoff (`Bonado Wireframes.dc.html`,
screens `3a`/`3b`/`4a`–`4i`). Each phase is meant to be shippable on its own.

## Phase 1 — Foundation ✅ done

Project scaffold (Vite + React + TS + Tailwind), design tokens, UI
primitives, Supabase (schema, RLS, auth, storage), Google SSO, Dashboard
(`3a`).

## Phase 2 — Trip creation ✅ done

Create trip screen (`4a`): name, currency selection, cover photo. Location
uses real Google Places (New) autocomplete, resolving place_id/lat/lng.
Cover photo auto-suggests real Unsplash photos for the resolved location
(with attribution + required download tracking), with shuffle and
alternates; "Own" upload remains available (Supabase Storage).

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

## Phase 5 — Expense entry (simple) ✅ done

Add expense screen (`3b`): amount, description, payee/date, category,
multiple payers, equal-split toggle per person. Creation is atomic through
a SECURITY DEFINER RPC, and saved expenses appear in Trip Home's recent
entries feed.

## Phase 6 — Expense entry (itemized) ✅ done

Itemized screen (`4c`) + add-item sheet (`4d`): line items, per-item
avatar include/exclude, exact/%/shares splits, tax & tip (proportional or
own-item), reconciliation footer. Simple and itemized expenses share the
same currency, payer, payment-method, date, and category controls.

## Phase 7 — Expense detail ✅ done

Expense detail screen (`4e`): summary, your-share highlight, per-person
breakdown, private receipt photo, full expense editing (amount, currency,
payers, payment accounts, and splits), and confirmed soft deletion
(online only).

## Phase 8 — Balances / settle up ✅ done

Balances screen (`4f`): net position per person, record-settlement bottom
sheet, suggested transfers, optional payment account, and "trip settled"
celebration state. Real balances are also wired into Trip Home and Dashboard.

## Phase 9 — Reports ✅ done

Reports screen (`4g`): by-category donut chart, by-account view (money in/
out, expense vs transfer).

## Phase 10 — Currency conversion ✅ done

Per-entry currency with rate snapshot, Frankfurter API integration,
per-user display currency, daily rate caching (`exchange_rate_cache`).
Editable display-currency switcher on Balances, Entries (defaults to each
transaction's own currency, converts with a "≈" indicator when switched),
and Reports (applies to both totals and the per-transaction drill-down).

## Phase 11 — Offline sync

Local sync queue for mobile: create-only while offline (new entries +
photos), edits/deletes disabled offline, estimated-rate resolution on
reconnect.

## Phase 12 — Desktop layout ✅ done

Three-column desktop view (`4i`), active at `lg:` (1024px+) widths on the
three trip tabs (Entries/Balances/Reports): left trips rail (switch trips,
`+ New trip`), center column with the existing tab content widened to fill
the column, right balance rail (your position + per-person net + "Settle
up") that stays visible regardless of which tab is active. Below `lg:` the
phone layout is unchanged.

Follow-up: the remaining pages also got `lg:` treatments — Dashboard is a
two-column 880px layout (current-trip hero left, all-trips list right);
Create trip, Trip settings, and Add expense are two-column 880px forms
(primary fields left; cover photo / members+danger zone / paid-by+split
right). Expense detail is two-column too (receipt hero, your share,
paid-by, and breakdown left; items, timestamps, receipt photo, and delete
right). Settlement detail, Login, and guest join stay at the focused
phone-width center column.

## Phase 13 — Dark mode ✅ done

Dark theme covering the full design token set (surfaces, text, teal accent,
money colors, shadows, hairline dividers), implemented as CSS-variable
overrides scoped to `prefers-color-scheme: dark` / an explicit `.dark`
class, so no component markup needed a `dark:` variant. Defaults to
following the device's setting; overridable to System/Light/Dark from the
Dashboard account menu (next to display currency), persisted to
`bonado.users.theme_preference` for signed-in users (synced across
devices) and cached in `localStorage` otherwise, applied via a blocking
inline script in `index.html` to avoid a flash of the wrong theme.

## Phase 14 — Hardening & completeness (in progress, 2026-07-05)

Approved work program, implemented one item at a time, each committed and
pushed separately. **If you are an agent picking this up mid-stream: check
the checkboxes below and `git log` to see where work stopped; each item is
independent unless noted.** Notifications/comments (Phase 11.5, migration
0023) shipped 2026-07-05; deletion confirm modals (`ConfirmDialog`) too.

- [ ] 1. Owner-only trip edits — replace `trips_update` RLS policy
      (any-member, 0001_init.sql:313) with owner-only (memberships
      role='owner'). `update_trip_settings` RPC is security definer and
      unaffected. Check no client code PATCHes `trips` directly first.
- [ ] 2. Settlement deletion — `delete_settlement` RPC + Delete button with
      `ConfirmDialog` on SettlementDetail. Notify involved users
      (`settlement_deleted` kind); note notifications.settlement_id FK is
      on-delete-cascade, so a hard delete wipes its own notification —
      either notify with a trip-level reference or keep a tombstone.
- [ ] 3. Member removal / leave trip — `remove_trip_member` RPC reassigns
      the member's payments, line_item_shares, adjustment_shares,
      settlement from/to/created_by, and entries.created_by (per-trip) to
      an unregistered placeholder user ("temporary member" equivalent),
      then deletes the membership. Owner can remove anyone; anyone can
      remove self (leave). UI in TripSettings members list.
- [ ] 4. Pagination — trips list, TripHome entries feed, comments,
      notifications (range + "load more").
- [ ] 5. Notification bell on trip pages (currently Dashboard-only).
- [ ] 6. Offline sync (create-only PWA queue) — PENDING USER DECISION,
      feasible per assessment; not started.
- [ ] 7. Unify unread systems — drop localStorage entryReadState; derive
      TripHome unread dots from the DB notifications table (cross-device).
- [ ] 8. Mention tokens — store `@[user_id]` in comment bodies, resolve to
      current member names at render (renames reflect everywhere).
- [ ] 9. Automated tests + CI — Vitest for money math (split rounding,
      conversions, balances), GitHub Actions running tsc + oxlint + tests.
- [ ] 10. Overlay a11y — focus trap, Escape, focus restore (ConfirmDialog,
      notification panel, sheets); arrow-key nav in mention dropdown.
- [ ] 11. Client cache consolidation (TanStack Query or similar) —
      DEFERRED by user ("let's fix it later").
- [ ] 12. Lazy-load all routes (>500 kB chunk warning).
- [ ] 13. Notification retention — purge rows older than 6 months.
- [ ] 14. Privacy policy + terms & conditions section in settings.
