import { CustomerSessionProvider } from "../contexts/CustomerSessionProvider";
import { TenantAuthProvider } from "../contexts/TenantAuthProvider";

/** Keep application-wide state providers and their dependency order in one place. */
export default function AppProviders({ children }) {
  return (
    <TenantAuthProvider>
      <CustomerSessionProvider>{children}</CustomerSessionProvider>
    </TenantAuthProvider>
  );
}
