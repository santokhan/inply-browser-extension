import manifest from "../../manifest.json" with { type: "json" };

export const SITE_MATCH = manifest.host_permissions[0];
export const SITE_ORIGIN = new URL(SITE_MATCH.replace(/\*$/, "")).origin;
export const SITE_URL = `${SITE_ORIGIN}/`;

export function isSiteUrl(value) {
  try { return new URL(value).origin === SITE_ORIGIN; }
  catch { return false; }
}
