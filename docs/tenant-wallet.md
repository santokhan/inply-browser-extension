# Tenant wallet

Each Firebase tenant has one wallet at `tenantWallets/{tenantUid}`, shared across
their devices and customers. It stores two balances.

- `grantBalance` contains the current week's free credits. Each Monday at 00:00
  UTC, unused grants expire and this balance resets to 50. Missed weeks do not
  accumulate.
- `purchasedBalance` contains purchased credits. These have no expiry date and
  survive weekly grant resets. Only a trusted server or administrator can change
  this balance.

`lastGrantWeek` identifies the grant week. The badge shows purchased credits plus
current weekly free credits. The profile dropdown always shows both balances
and their total, with the free bucket's remaining allowance out of 50. Until a
wallet loads, the display falls back to zero. Users can use the
bucket throughout the week, including emptying it. Each weekly refill resets
the bucket to 50. The two balances are stored independently.

The extension loads the wallet when it opens and schedules one timer for the
weekly refill. Failed requests can be retried with the Retry button. Reopen the
extension to retry a failed connection. A live listener keeps saved balances
visible independently of refill writes and receives changes from other devices.
An inactive wallet is
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

From the repository root, sign in and deploy the rules to `inply-21d06`:

```powershell
npx firebase-tools login
npx firebase-tools deploy --only firestore:rules --project inply-21d06
```

Review the currently deployed rules before deployment and preserve any additional
collection rules that are not represented in this repository. After publishing,
click Retry in the wallet dropdown.

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
