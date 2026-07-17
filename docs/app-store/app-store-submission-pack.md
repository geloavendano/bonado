# Bonado App Store submission pack

Last updated: 2026-07-17

This pack is intended to be pasted into App Store Connect for the first iOS release.

## App information

| Field | Recommended value |
| --- | --- |
| App name | Bonado |
| Subtitle | Split trip expenses easily |
| Primary category | Finance |
| Secondary category | Travel |
| SKU | bonado-ios |
| Bundle ID | com.bonado.app |
| Content rights | Bonado does not contain, show, or access third-party copyrighted content as a primary app feature. |
| Age rating notes | No user-generated public content, no gambling, no mature content. Users can upload receipt and trip cover photos visible only to trip members. |

## Pricing

Recommended first release: Free.

There are no in-app purchases or subscriptions in the current build.

## URLs

| Field | URL |
| --- | --- |
| Support URL | https://bonado-sage.vercel.app/legal/support |
| Privacy Policy URL | https://bonado-sage.vercel.app/legal/privacy |
| Terms URL | https://bonado-sage.vercel.app/legal/terms |
| Account deletion info | https://bonado-sage.vercel.app/legal/delete-account |
| Marketing URL | Optional for now. Leave blank unless a public marketing page is created. |

Before submission, confirm the support mailbox shown on the support page is active.

## Promotional text

Split trip expenses with friends, track who paid, and settle up without spreadsheet chaos.

Character count: 91 / 170

## Description

Bonado helps friends and groups keep shared trip expenses clear from the first taxi ride to the final settlement.

Create a trip, invite members, add expenses in different currencies, and see each person’s share without rebuilding a spreadsheet every night. Bonado supports temporary members, shared trip links, itemized splits, payment methods, settlements, comments, and spending reports so the group can stay aligned while the trip is still happening.

Key features:

• Create shared trips and invite friends with a link
• Add expenses in the trip currency or another currency
• Split expenses equally, by percentage, by shares, by exact amounts, or by line item
• Add temporary members before everyone has joined
• Record settlements and view transaction history
• Track balances across members
• See spending by category
• Attach receipt photos and trip cover photos
• Use Google sign-in or guest joining flows

Bonado is built for group trips where “I’ll pay now, you get the next one” becomes hard to remember. It keeps the ledger visible, editable, and shared so everyone can focus more on the trip and less on chasing receipts.

## Keywords

trip,expense,split,bill,travel,friends,budget,settle,currency,receipt,group,share

Character count: 78 / 100

## What’s New

Initial iOS release.

## Review notes

Bonado is a shared trip expense-splitting app.

Suggested review path:

1. Sign in with Google or use a test account if one is provided.
2. Create a trip.
3. Add members or temporary members.
4. Add an expense with a split.
5. View transaction details, balances, reports, and settlement flow.

The app uses standard HTTPS/TLS networking, Supabase authentication/database/storage, Google sign-in, Google Places for location search, and optional image upload for receipts and trip covers. It does not include payments, banking, investment advice, gambling, ads, or in-app purchases.

If reviewer credentials are required, create a dedicated test user before submission and paste the account details into App Review Information rather than this file.

## Export compliance

Recommended answer based on the current iOS plist:

| Question | Suggested answer |
| --- | --- |
| Does the app use encryption? | Yes, because it uses standard HTTPS/TLS and platform security. |
| Is the encryption exempt? | Yes. |
| Uses non-exempt encryption? | No. `ITSAppUsesNonExemptEncryption` is set to `false` in `ios/App/App/Info.plist`. |

## App Privacy questionnaire draft

Use this as a draft only; App Store Connect wording can vary.

### Data collected and linked to user

| Data type | Why it is collected | Notes |
| --- | --- | --- |
| Name | App functionality | Profile display and trip member identity. |
| Email address | App functionality, account management | Google sign-in/account identity. |
| User ID | App functionality, security | Supabase auth/app user ID. |
| Photos or videos | App functionality | Optional receipt photos and trip cover images. |
| Other user content | App functionality | Trips, expenses, comments, settlements, invites, payment-method labels. |
| Purchase history | Not collected | No in-app purchases or payments in current release. |
| Financial info | Not collected as bank/payment data | The app stores expense records and payment-method labels, not bank/card numbers or payment processing data. |
| Location | App functionality, if used | Place/location text chosen for trips via Google Places. Avoid marking precise background location; the app does not continuously track the user. |
| Diagnostics | App functionality, crash/error diagnostics | Sentry is present in dependencies; confirm whether production DSN is enabled before final privacy answers. |

### Tracking

Recommended answer: No, Bonado does not track users across apps/websites for advertising.

### Ads

Recommended answer: No ads in the current build.

## Contacts to prepare

| Need | Status |
| --- | --- |
| Support email | Confirm active mailbox before submission. |
| Reviewer test account | Needed if Google sign-in blocks review or if you want Apple to test without using personal Google auth. |
| Privacy policy URL | Ready once production route is deployed. |
| Support URL | Ready once production route is deployed. |
