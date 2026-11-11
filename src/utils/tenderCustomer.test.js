import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveTenderCustomer } from "./tenderCustomer.js";

const first = { id: "first", email: "first@example.com", businessName: "Saved business", registeredAddress: "Saved address" };
const second = { id: "second", email: "second@example.com", businessName: "Second business" };

test("a single saved customer supplies form defaults even without a restored login", () => {
  assert.equal(resolveTenderCustomer([first], null, ""), first);
});

test("active customer uses current saved details rather than a stale session copy", () => {
  assert.equal(resolveTenderCustomer([first, second], { id: first.id, email: first.email, businessName: "" }, ""), first);
  assert.equal(resolveTenderCustomer([first, second], { email: " FIRST@example.com " }, ""), first);
});

test("multiple customers require an active customer or an explicit form selection", () => {
  assert.equal(resolveTenderCustomer([first, second], null, ""), null);
  const active = { ...first };
  assert.equal(resolveTenderCustomer([first, second], active, second.id), second);
  assert.deepEqual(active, first);
  assert.equal(resolveTenderCustomer([], null, ""), null);
});
