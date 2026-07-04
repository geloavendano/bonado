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

- [x] 1. Owner-only trip edits — DONE (0024 policy + 0025 grant fix;
      policy helpers used in RLS must stay executable by the API roles).
      Verified: owner direct update OK, member direct update blocked,
      member RPC rejected.
- [x] 2. Settlement deletion — DONE (migration 0026 +
      `useSettlementMutations` + `ConfirmDialog` on SettlementDetail).
      Uses a hard delete and then creates a retained trip-level
      `settlement_deleted` notification for the payer, recipient, and creator;
      balances and transaction-history caches are invalidated. Migration 0026
      is applied to production; the API schema recognizes the RPC and rejects
      anonymous execution as intended. Build/lint pass. Follow-up manual check:
      delete a real settlement with two signed-in members and confirm the trip
      toast, history removal, recalculated balances, and recipient notification.
- [x] 3. Member removal / leave trip — DONE (migration 0027 +
      `useManageTripMembers` + confirmation UI in TripSettings). Removing a
      registered non-owner reassigns trip-scoped payments, shares,
      settlements, entry creator/editor, and attachment uploader references
      to a claimable unregistered placeholder with the same name, then removes
      the account's membership. Owners can remove non-owners; non-owners can
      leave. Owners must transfer ownership before leaving. Migration is
      applied; API exposure/auth denial and build/lint verified. Follow-up
      manual check: remove a member with expenses and settlements, verify
      balances remain unchanged, then claim the resulting temporary member.
- [x] 4. Pagination — DONE. Trips load 10 at a time; the merged TripHome
      expense/settlement chronology independently pages each source in
      batches of 20 and re-sorts the combined feed; comments and unread
      notifications load 20 at a time. Dashboard, desktop TripsRail,
      transaction history, comments, and notification panel expose explicit
      loading/disabled "Load more" controls. Notification badge uses the
      exact unread count rather than the loaded-page length. Build/lint pass.
      Follow-up manual check with >20 records of each transaction type to
      confirm no gaps at interleaved date/timestamp page boundaries.
- [x] 5. Notification bell on trip pages — DONE. Entries exposes the bell
      beside trip settings over the cover; the shared sticky tab header puts
      the same notification panel on Balances and Reports. It retains exact
      unread counts and paginated loading from item 4. Build/lint pass.
- [ ] 6. Offline sync (create-only PWA queue) — PENDING USER DECISION,
      feasible per assessment; not started.
- [x] 7. Unify unread systems — DONE. Removed localStorage
      `entryReadState`; `useUnreadTransactions` derives expense and settlement
      dots from the signed-in viewer's unread database notifications. Viewing
      a transaction, opening a notification, or marking all read broadcasts a
      shared refresh event so feed dots update without a reload. State now
      follows the user across devices. Build/lint pass.
- [x] 8. Mention tokens — DONE. Composer text remains human-readable, but
      selected mentions are stored as stable `@[user_id]` tokens and resolved
      against current member names in comments and notification previews.
      Migration 0028 backfills legacy `@Display Name` bodies using the
      authoritative comment_mentions rows, longest names first. Missing former
      members render safely as `@Former member`. Migration applied; build/lint
      pass.
- [x] 9. Automated tests + CI — DONE. Added Vitest and extracted pure,
      integer-cent equal-split and settlement-suggestion utilities used by
      production flows. Tests cover remainder allocation, empty participants,
      saved-rate currency conversion/fallback, and multi-party settlement
      balancing. GitHub Actions runs clean install, build/typecheck, oxlint,
      and tests on pushes to main and pull requests. Five tests pass.
- [x] 10. Overlay a11y — DONE. Shared `useOverlayA11y` traps Tab/Shift+Tab,
      closes on Escape, focuses the first interactive control, and restores
      the trigger for ConfirmDialog, notifications, item editor, and settlement
      sheet. Sheets have dialog semantics and outside-click close. Mention
      suggestions expose listbox state with Arrow Up/Down, Enter, and Escape
      keyboard control. Tests/build/lint pass.
- [ ] 11. Client cache consolidation (TanStack Query or similar) —
      DEFERRED by user ("let's fix it later").
- [x] 12. Lazy-load all routes — DONE. Every page route now loads through
      React.lazy while auth, routing, and shared trip layout remain eager.
      The former 569 kB application chunk is split into page chunks (largest
      page ≈25 kB) plus shared vendor chunks below 254 kB; the >500 kB build
      warning is eliminated. Tests/build/lint pass.
- [x] 13. Notification retention — DONE (migration 0029). A locked-down
      `purge_expired_notifications` function deletes delivery/read-state rows
      older than six months, and pg_cron runs it daily at 03:15 UTC. Existing
      jobs with the same name are replaced idempotently. Migration applied.
- [ ] 14. Privacy policy + terms & conditions section in settings.
