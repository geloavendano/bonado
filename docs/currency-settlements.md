# Settlements in original currencies

Balances are netted in each expense's original currency before display conversion. Record and edit settlement accept the actual payment currency and amount. Allocation first clears matching debts in that currency, then the remaining currencies in alphabetical order at the payment's quoted rates. An overpayment becomes a credit in the payment currency.

Each settlement saves the original-currency amounts applied, plus their conversion rates to the payment currency. Subsequent FX updates and metadata-only edits do not change those allocations. Editing participants, amount, or currency recalculates allocations with the old settlement excluded; deleting removes its allocations. Changing the trip currency changes display snapshots, not payment amounts or allocated amounts.

The balances screen shows native balances and a **Settle all** quote. It rounds the combined quote once to two decimal places, matching the app's existing monetary precision. The database allows at most half a payment-currency cent of conversion rounding on the final cleared allocation. Missing exchange rates reject a cross-currency payment without saving a partial record. Settlement writes are serialized by trip.

## Migration and release

Apply migrations in order through `0048_currency_settlements.sql` before deploying the frontend. The new frontend uses `get_trip_balances_v2`, `record_settlement_in_currency`, and `update_settlement_in_currency`. The old RPC signatures remain available for older clients and default to the trip currency. Older clients are blocked from editing payments recorded in another currency, preventing an accidental currency rewrite.

Existing settlements keep their stored amount and trip currency. Migration 0048 reconstructs their allocations in date/creation order using remaining expense book valuations; it does not invent the currency originally tendered or reprice old payments at today's rate. An old payment originally made in PHP but saved as JPY remains recorded as JPY until corrected from the actual payment record. Review representative existing trips before production rollout, particularly trips with edited/deleted historical expenses.

History, settlement details, and CSV export retain the payment currency. Settlement details also show original amounts applied.

## Verification

- `npm test`: quote generation, currency separation, missing rates, and rounding.
- `npm run test:currency-settlements`: runs the SQL migration and RPCs in an isolated PostgreSQL WASM database using PGlite; no production connection. Covers historical backfill at differing expense rates, PHP-first partial payment, cross-currency overflow, settle all, rounding, editing currency/metadata, FX changes, trip rebasing, deletion, overpayment, exports, and access checks. Auth and notification integrations are stubbed; these checks do not validate production notification delivery.
- `npm run build` and `npm run lint`.

The PHP 1,000 + JPY 10,000 example leaves PHP 100 + JPY 10,000 after PHP 900 is paid. At PHP 1 = JPY 3, a subsequent JPY 10,300 payment clears both native balances permanently.
