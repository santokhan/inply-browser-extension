# Tenant access

Tenant access is controlled by the Boolean `disabled` field in the Firestore
document `tenants/{uid}`. The document ID is the user's Firebase Authentication
UID. On the next sign-in or extension open, the extension creates a missing
document with `disabled: false`. Initialization uses a transaction to preserve
concurrent administrator changes. An absent field allows access, so existing
accounts work without a migration.

## Disable or enable an account

1. Open Firebase project `inply-21d06` and find the user in Authentication.
2. Copy their UID.
3. In Firestore Database, create or open `tenants/{uid}` using that UID as the
   document ID.
4. Set the Boolean field `disabled` to `true` to disable access. Set it to `false`
   to allow the user to sign in again.

```json
{
  "disabled": true
}
```

The extension waits for server confirmation before opening the signed-in UI.
Cached tenant data cannot grant access. A live listener signs out an open session
when `disabled` becomes `true` and shows an account-disabled message. A connection
is required to verify access. Reconnect or sign in again if verification fails.
The selected extension customer is cleared on sign-out.

The Firestore field controls extension access and access to its saved data.
Firebase Authentication still verifies the credentials before the extension can
read the access document. To disable the Firebase Authentication identity itself,
use Firebase Authentication's account controls or a trusted Admin SDK backend.

## Publish the rules

Publish [`firestore.rules`](../firestore.rules) before distributing the updated
extension. The rules let a user read their own access document and create it with
`disabled: false`. Updates and deletes require the Firebase Console or trusted
Admin SDK code. Disabled tenants are denied
access to customers, legacy profiles, LTM forms, and wallets.

```powershell
npx firebase-tools deploy --only firestore:rules --project inply-21d06
```

The future admin dashboard should update `tenants/{uid}.disabled` through a trusted
backend that verifies the administrator's identity and permissions.
