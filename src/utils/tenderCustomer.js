// Choosing a form's defaults does not change the logged-in customer.
export function resolveTenderCustomer(customers, activeCustomer, selectedId) {
  const selected = customers.find((customer) => customer.id === selectedId);
  if (selected) return selected;
  if (activeCustomer) {
    return customers.find((customer) => customer.id === activeCustomer.id
      || customer.email?.trim().toLowerCase() === activeCustomer.email?.trim().toLowerCase()) ?? activeCustomer;
  }
  return customers.length === 1 ? customers[0] : null;
}
