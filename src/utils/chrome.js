export async function getActiveTabSafe() {
  const tab = (await chrome.tabs.query({
    active: true,
    currentWindow: true,
  }))?.[0];

  if (!tab?.id) return null;

  if (
    typeof tab.url === "string" &&
    /^(chrome|edge|brave|opera|moz)-extension:|^chrome:|^edge:|^about:|^view-source:/i.test(tab.url)
  ) {
    return null;
  }

  return tab;
}