# Bonado App Store screenshots

Apple allows 1 to 10 screenshots per device display set. Use PNG or JPG/JPEG with no alpha/transparency.

For the first iPhone-only launch, prioritize the largest iPhone display set. If the App Store Connect UI asks for multiple device sets, upload the matching generated sizes below.

## Required first set

| Device display | Portrait size |
| --- | --- |
| 6.9-inch iPhone | 1320 × 2868 px |

Apple also accepts other 6.9-inch portrait sizes such as 1260 × 2736, 1290 × 2796, or 1320 × 2868 depending on the device family. Use 1320 × 2868 for the cleanest current Pro Max-style set.

## Optional fallback sets

| Device display | Portrait size |
| --- | --- |
| 6.5-inch iPhone | 1242 × 2688 px or 1284 × 2778 px |
| 5.5-inch iPhone | 1242 × 2208 px |
| 13-inch iPad | 2064 × 2752 px, only if iPad screenshots are required/enabled |

## Recommended screenshot story

Aim for 6 screenshots for the first release:

1. Dashboard / trips list
   - Message: "All your shared trips in one place"
   - Show: large active trip card plus smaller trip cards with member avatars.

2. Trip transaction history
   - Message: "See every shared expense"
   - Show: trip cover, balance card, grouped transaction history.

3. Add expense
   - Message: "Split expenses your way"
   - Show: amount, category, paid by, split between controls.

4. Itemized split
   - Message: "Handle line items, tax, and tips"
   - Show: line-item mode with members assigned to items.

5. Balances and settlements
   - Message: "Know who owes whom"
   - Show: balances tab with suggested settlements.

6. Reports
   - Message: "Understand spending by category"
   - Show: reports by category with expanded transactions.

## Capture checklist

- Use realistic but non-sensitive sample trip data.
- Prefer dark mode if the current app visuals are strongest there; otherwise use light mode consistently.
- Avoid showing personal emails, real phone numbers, or private receipts.
- Ensure notification badges/unread indicators are intentional.
- Ensure dates/currencies look clean and realistic.
- Do not show browser chrome; capture native app screens from simulator/device.
- Leave enough top/bottom breathing room for App Store cropping.

## Suggested production sample data

Trip: Bohol 2026

Members:

- Gelo
- Serville
- Ariane
- Nikko

Currencies:

- Trip default: PHP
- Sample expense alternate: THB or SGD

Sample transactions:

- Island hopping boat — PHP 12,000 — Transport
- Dinner at Alona — PHP 4,800 — Food & drink
- Hotel deposit — SGD 220 — Lodging
- Snacks and water — PHP 1,250 — Groceries
- Scooter rental — PHP 2,400 — Transport
- Airport transfer — PHP 3,200 — Transport

## File naming convention

Use:

```text
docs/app-store/screenshots/iphone-6-9/01-dashboard.png
docs/app-store/screenshots/iphone-6-9/02-trip-history.png
docs/app-store/screenshots/iphone-6-9/03-add-expense.png
docs/app-store/screenshots/iphone-6-9/04-itemized-split.png
docs/app-store/screenshots/iphone-6-9/05-balances.png
docs/app-store/screenshots/iphone-6-9/06-reports.png
```

## Open item

The actual screenshot capture still needs either:

1. A simulator/device logged into a clean demo account, or
2. A seeded demo mode / fixture route that renders the screens without touching real user data.

Option 2 is better long-term if we expect frequent App Store updates.
