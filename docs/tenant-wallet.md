# Tenant wallet

Each Firebase tenant has one wallet at `tenantWallets/{tenantUid}`, shared across
their devices and customers. New wallets receive 50 credits. Each following week
starts Monday at 00:00 UTC and adds 50 credits. Credits carry over. When a tenant
returns after several weeks, all weeks since the last grant are credited.

Grants are applied in a Firestore transaction when the extension opens, returns
to the foreground, reconnects, or remains open across the weekly boundary. No
background server job is required; inactive wallets receive their accumulated
grants on their next successful refresh. Concurrent sessions and transaction
retries cannot grant the same week twice. Offline failures show a retry action.
There are no purchases, transfers, spending, or automation charges in this change.

## Required Firestore rules

The complete combined rules, including the existing customer and LTM rules
provided by the user, are saved in [`../firestore.rules`](../firestore.rules).
This local file has not been published to Firebase.

Add this block **inside the existing `match /databases/{database}/documents`
block** in the Firebase Console and publish it. Preserve the existing rules for
other collections. Do not deploy this block as a replacement for the whole rules
file. No rule deployment is configured in this repository.

```text
match /tenantWallets/{uid} {
  function ownsWallet() {
    return request.auth != null && request.auth.uid == uid;
  }
  function currentWeek() {
    return int((request.time.toMillis() - 345600000) / 604800000);
  }
  function validWallet() {
    let data = request.resource.data;
    return data.keys().hasOnly(['balance', 'lastGrantWeek', 'createdAt', 'updatedAt'])
      && data.balance is int
      && data.balance >= 0
      && data.balance <= 9007199254740991
      && data.lastGrantWeek is int
      && data.lastGrantWeek == currentWeek()
      && data.updatedAt == request.time;
  }

  allow get: if ownsWallet();
  allow create: if ownsWallet()
    && validWallet()
    && request.resource.data.balance == 50
    && request.resource.data.createdAt == request.time;
  allow update: if ownsWallet()
    && validWallet()
    && request.resource.data.createdAt == resource.data.createdAt
    && resource.data.lastGrantWeek < currentWeek()
    && request.resource.data.balance == resource.data.balance
      + (currentWeek() - resource.data.lastGrantWeek) * 50;
}
```

The server clock validates the grant week and exact credit increase. An incorrect
device clock cannot claim future grants; correct the clock and retry if needed.
Ensure no broader overlapping rule permits wallet writes: Firestore allows an
operation when **any** matching allow rule grants it.

Before production, verify these rules in the Firebase Rules Playground or
Firestore emulator: allow owner reads and initial 50-credit creation; allow an
exact 50-credit increase per elapsed week; reject another tenant, unauthenticated
access, same-week grants, arbitrary balances, future weeks, changed creation
timestamps, added fields, listing and deletion. The Node unit tests exercise the
grant calculations; they do not execute Firebase security rules.

The amount is defined in `src/utils/tenantWallet.js` and in the rules above.
Change both together when changing the weekly allowance.

References: [field validation](https://firebase.google.com/docs/firestore/security/rules-fields),
[server request time](https://firebase.google.com/docs/reference/rules/rules.firestore.Request).
