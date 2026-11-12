# Account terminology

| Name | Meaning | Code |
| --- | --- | --- |
| Tenant | The person or organization signed in to the Tenddoo extension through Firebase. Owns saved customers and automation data. | `tenantAuth`, `TenantAuthProvider`, `useTenantAuth()`, `tenant`, `tenantUid` |
| Customer | A saved eProcure account that the tenant can select and log in to. | `CustomerAccounts`, `CustomerSessionProvider`, `useCustomerSession()`, `currentCustomer` |
| Active customer | A saved customer selected only by submitting a login through the extension's Login button. Selected independently of the browser's website session. The customer logout button clicks the website Logout control before clearing the selection. | `CustomerSessionProvider`, `currentCustomer` |

Tenant sign-in and sign-out control extension access. Every saved customer always has a Login button. Clicking Login checks for `/Logout.jsp`, clicks it if present, waits for logout, then opens a new eProcure tab to submit the selected customer's credentials. It does not infer the active customer from the website, track website login/logout, or save browser session metadata to Firestore.

## Existing data compatibility

Firestore customer records remain at `customerOwners/{tenantUid}/customers/{customerId}`. The legacy collection name is defined once in `src/data/tenantCustomerPaths.js`; application code calls `tenantCustomersPath()` and `tenantCustomerPath()`.

The existing `auth_user` and `auth_token` cache keys still contain tenant authentication data. These keys and the existing `encryptPassword` behavior are preserved. Submitting a customer login through the extension sets `encryptPassword` from the saved credentials. The active customer selection is restored from local extension storage for its tenant and cleared after customer logout succeeds. Older `eprocureSession` fields in saved records are ignored.
