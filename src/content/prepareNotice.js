// Use the site's own link behavior so its navigation/session handlers run.
export function openAllTenders(filters) {
  const { procurementType = "", procurementMethod = "", procurementNature = "", tenderId = "" } = filters || {};

  function setFieldsAndSearch() {
    const form = document.querySelector("#alltenderFrm");
    const fields = [
      [form?.querySelector("#cmbType"), procurementType],
      [form?.querySelector("#cmbProcMethod"), procurementMethod],
      [form?.querySelector("#procNature"), procurementNature],
    ];
    if (fields.some(([field]) => !field)) {
      return { ok: false, message: "The eGP search form is not ready." };
    }

    for (const [field, value] of fields) {
      if (value === "") continue;
      field.value = String(value);
      field.dispatchEvent(new Event("input", { bubbles: true }));
      field.dispatchEvent(new Event("change", { bubbles: true }));
    }

    if (tenderId) {
      const tenderField = form.querySelector('input[name="tenderId"][id="tenderId"]');
      if (!tenderField) return { ok: false, message: "The Tender ID search field is not available." };
      tenderField.value = String(tenderId);
      tenderField.dispatchEvent(new Event("input", { bubbles: true }));
      tenderField.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const searchButton = form.querySelector("#btnSearch")
      || [...form.querySelectorAll('button, input[type="button"], input[type="submit"]')]
        .find((button) => button.value?.trim().toLowerCase() === "search"
          || button.textContent?.trim().toLowerCase() === "search");
    if (!searchButton || searchButton.disabled) {
      return { ok: false, message: "The eGP Search button is not available." };
    }
    searchButton.click();
    return { ok: true };
  }

  if (window.location.pathname.endsWith("/AllTenders.jsp")) {
    sessionStorage.setItem("inply:notice:filters", JSON.stringify({ procurementType, procurementMethod, procurementNature, tenderId }));
    return setFieldsAndSearch();
  }

  const link = document.querySelector('a[href="/resources/common/AllTenders.jsp?h=f"]');
  if (!link) return { ok: false, message: "All Tenders link not found on this page." };

  sessionStorage.setItem("inply:notice:filters", JSON.stringify({ procurementType, procurementMethod, procurementNature, tenderId }));
  link.click();
  return { ok: true };
}
