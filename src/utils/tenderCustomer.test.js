import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTenderCustomer } from "./tenderCustomer.js";

const first = { id: "first", email: "first@example.com", businessName: "Saved business", registeredAddress: "Saved address" };
const second = { id: "second", email: "second@example.com", businessName: "Second business" };

test("saved customers never supply tenderer details without an active login", () => {
  assert.equal(resolveTenderCustomer([first], null), null);
  assert.equal(resolveTenderCustomer([first, second], null), null);
  assert.equal(resolveTenderCustomer([], null), null);
});

test("active customer uses current saved details rather than a stale session copy", () => {
  assert.equal(resolveTenderCustomer([first, second], { id: first.id, email: first.email, businessName: "" }, ""), first);
  assert.equal(resolveTenderCustomer([first, second], { email: " FIRST@example.com " }, ""), first);
});

test("a previous form selection cannot override the logged-in customer", () => {
  const active = { ...first };
  assert.equal(resolveTenderCustomer([first, second], active, second.id), first);
  assert.deepEqual(active, first);
});

test("customer changes and logout immediately change the resolved tenderer", () => {
  assert.equal(resolveTenderCustomer([first, second], first), first);
  assert.equal(resolveTenderCustomer([first, second], second), second);
  assert.equal(resolveTenderCustomer([first, second], null), null);
});

test("an identified active customer cannot match another account by email", () => {
  const active = { id: "active", email: first.email };
  assert.equal(resolveTenderCustomer([first, second], active), active);
  assert.equal(resolveTenderCustomer([first, second], {} ).id, undefined);
  assert.equal(resolveTenderCustomer([], active), active);
});
