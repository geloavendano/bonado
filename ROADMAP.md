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
