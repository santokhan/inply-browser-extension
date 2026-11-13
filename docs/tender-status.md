# Tender statuses

Each tender in a customer's basket has one status: `pending`, `encrypted`,
`mapped`, or `submitted`. The status appears as a read-only label beside the
tender ID and cannot be changed manually in the extension. New tenders start at
`pending`. Only pending tenders show the robot button for searching My Tenders.
Other statuses show their label without a robot button; their action buttons
will be added later. Workflow-driven status updates will also be implemented
later.

The existing customer document at
`customerOwners/{tenantUid}/customers/{customerId}` keeps its `tenderIds` array
and stores a `tenderStatuses` map keyed by those IDs. For example:

```json
{
  "tenderIds": ["1234", "5678"],
  "tenderStatuses": { "1234": "pending", "5678": "encrypted" }
}
```

Legacy IDs without a saved status resolve to `pending`. The next basket change
persists those defaults. Basket changes use a Firestore transaction to preserve
concurrent edits. Removing a tender removes its status; adding it again starts
at `pending`. Status is scoped to the customer, so the same tender ID can have
different statuses for different customers.

Future automation can use `getTenderStatus` and `TENDER_STATUSES` from
`src/utils/tenderBasket.js`; no transition restrictions are enforced yet.
