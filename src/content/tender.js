/**
 * Opens the "My Tenders" page by clicking its link.
 * @returns {boolean} true if the link was clicked, false otherwise
 */
function openTenders() {
  const link =
    document.querySelector('a[href="/tenderer/MyTenders.jsp"]') ||
    [...document.querySelectorAll('a')].find(a => a.textContent.trim() === 'My Tenders');

  if (!link) {
    console.warn('My Tenders link not found on this page.');
    return false;
  }

  link.click();
  return true;
}

/**
 * Finds the Search submit button.
 * @returns {HTMLInputElement|null} the button element, or null if not found
 */
function findSearchButton() {
  const button = document.querySelector('table tbody tr td input[type="submit"]#btnSearch');

  if (!button) {
    console.warn('Search button not found on this page.');
    return null;
  }

  return button;
}

/**
 * Finds the Tender ID input field inside a table cell.
 * @returns {HTMLInputElement|null} the input element, or null if not found
 */
function findTenderIdField() {
  // Attribute selector instead of #tenderId, because duplicate ids
  // across rows make `#tenderId` only reliably match the first one.
  const field = document.querySelector('table tbody tr td input[id="tenderId"]');

  if (!field) {
    console.warn('Tender ID field not found on this page.');
    return null;
  }

  return field;
}

/**
 * Fills the Tender ID field for a given tender and clicks Search.
 * @param {number|string} tenderId - the tender ID to search for
 * @returns {boolean} true if the search was triggered, false otherwise
 */
function searchTender(tenderId) {
  const id = String(tenderId).trim();
  if (!/^\d+$/.test(id)) {
    throw new TypeError('tenderId must be numeric');
  }

  const field = findTenderIdField();
  const button = findSearchButton();
  if (!field || !button) return false;

  field.value = id;
  field.dispatchEvent(new Event('input', { bubbles: true }));
  field.dispatchEvent(new Event('change', { bubbles: true }));
  button.click();

  return {
    ok: true
  };
}