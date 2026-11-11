# LTM form Firestore access

LTM values are stored in the default Firestore database of Firebase project
`inply-21d06`, at `ltmTenderForms/{firebaseAuthUid}`. The extension must have a
Firebase Authentication session; an extension-only token does not authenticate
Firestore requests.

Use the up/down arrows beside each LTM form to reorder the list. Each move saves
the form keys in the `formOrder` array on the same user document, separately from
the form values. Documents without an order use the default sequence. Newly added
forms appear at the end of a saved sequence.

Expand a form and select **Fill Sign Encrypt Save** to fill the matching open
tender page using the values currently shown, then run Sign, Encrypt, and Save.
Save the encryption password in the Encrypt tab first. The action checks the
form title and expected editable table field count before filling; fields follow
the preset section order. BOQ fills each editable table select with its configured
option (Yes by default). The submission letter has no preset values, so it keeps
the existing contents and proceeds to signing. Save values separately to persist
edits to Firestore. Reload the extension and the tender page after updating the
extension so the new content-script handler is available.

In Firebase Console, open Firestore Database > Rules. Add this match block
**inside the existing `match /databases/{database}/documents` block**, alongside
the existing collection rules, then publish:

```text
match /ltmTenderForms/{uid} {
  allow get, create, update: if request.auth != null
                           && request.auth.uid == uid;
}
```

Keep the existing rules for customers and other collections. This block permits
each authenticated user to load and save only their own LTM document. It also
permits reading an absent document, so the extension can display the defaults
before the first save. Listing and deletion are not needed by the LTM interface.

After publishing, select Retry loading in LTM Form and save a value. Close and
reopen the tab to check that the saved value loads. In the Rules Playground,
check that get/create/update are allowed when the authenticated UID equals the
document ID, and denied for a different UID or unauthenticated request (unless
another existing rule grants broader access).

If access is still denied, check for App Check enforcement and verify the
Firebase project and authenticated UID in the Firebase Console.

Reference: https://firebase.google.com/docs/firestore/security/rules-conditions
