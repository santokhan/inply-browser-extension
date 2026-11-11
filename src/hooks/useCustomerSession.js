import { createContext, useContext } from "react";

export const CustomerSessionContext = createContext(null);

export default function useCustomerSession() {
  const session = useContext(CustomerSessionContext);
  if (!session) throw new Error("useCustomerSession must be used within CustomerSessionProvider");
  return session;
}
