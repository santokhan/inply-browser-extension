// Tenderer details always belong to the customer logged in through the extension.
export function resolveTenderCustomer(customers, activeCustomer) {
  if (!activeCustomer) return null;
  return customers.find((customer) => activeCustomer.id
    ? customer.id === activeCustomer.id
    : Boolean(activeCustomer.email?.trim())
      && customer.email?.trim().toLowerCase() === activeCustomer.email.trim().toLowerCase()) ?? activeCustomer;
}
