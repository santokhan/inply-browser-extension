# Tenant wallet

Each Firebase tenant has one wallet at `tenantWallets/{tenantUid}`, shared across
their devices and customers. It stores two balances.

- `grantBalance` contains the current week's free credits. Each Monday at 00:00
  UTC, unused grants expire and this balance resets to 50. Missed weeks do not
  accumulate.
- `purchasedBalance` contains purchased credits. These have no expiry date and
  survive weekly grant resets. Only a trusted server or administrator can change
  this balance.

`lastGrantWeek` identifies the grant week. The badge shows the main purchased
credit balance. The profile dropdown shows this balance and a separate weekly
free-credit bucket with its remaining allowance out of 50. Users can use the
bucket throughout the week, including emptying it. Each weekly refill resets
the bucket to 50. The two balances are independent and are never added together.

The extension loads the wallet when it opens and schedules one timer for the
weekly refill. Failed requests can be retried with the Retry button. Reopen the
extension to see balance changes made on another device. An inactive wallet is
updated on its next successful refresh. Previous weeks' grants are excluded
from the displayed free-credit bucket even if a refresh fails. A Firestore
transaction prevents concurrent sessions from refilling the same week twice.

## Existing wallets

The previous `balance` field contained only grants. On the next successful
refresh, the extension replaces it with `grantBalance` and `purchasedBalance`.
For a wallet already credited this week, it retains up to 50 remaining grant
credits. For an older wallet, it replaces expired grants with this week's 50
credits. Purchased credits start at zero for these legacy wallets.

## Firestore rules

The complete combined rules are saved in [`firestore.rules`](../firestore.rules).
Publish the updated rules in the Firebase Console before using the updated
extension. The local rules file has not been deployed from this repository.

The wallet rules validate the current week using Firebase's server clock. They
allow creation with 50 grant credits and zero purchased credits, legacy wallet
migration, and weekly grant resets that preserve purchased credits. Same-week
resets and client changes to purchased credits are rejected. Existing customer
and LTM collection rules are included in the file.

Verify these rules in the Firebase Rules Playground or emulator before
production. Check initial creation, legacy migration, weekly resets with
purchased credits preserved, and denial of same-week resets, purchased-balance
changes, other tenants, unauthenticated requests, listing and deletion. The Node
tests cover wallet calculations and migration. Security rules have not been
executed locally.

The weekly amount is defined in `src/utils/tenantWallet.js` and `firestore.rules`.
Update both when changing the allowance.
