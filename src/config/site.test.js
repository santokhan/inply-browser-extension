import assert from "node:assert/strict";
import test from "node:test";
import { SITE_MATCH, SITE_URL, isSiteUrl } from "./site.js";

test("root site configuration accepts only the configured HTTPS origin", () => {
  assert.equal(SITE_MATCH, "https://www.eprocure.gov.bd/*");
  assert.equal(isSiteUrl(SITE_URL), true);
  assert.equal(isSiteUrl(`${SITE_URL}tenderer/ViewCompanyDetail.jsp?id=1`), true);
  for (const url of [undefined, "invalid", "http://www.eprocure.gov.bd/", "https://www.eprocure.gov.bd.example.com/", "https://example.com/"]) {
    assert.equal(isSiteUrl(url), false);
  }
});
