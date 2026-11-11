import { TenantProtected } from "./components/shared/TenantProtected";
import Header from "./components/ui/header/Index";
import AutoFillRules from "./components/ui/rule";
import CustomersSection from "./components/ui/profile/CustomersSection";
import { CustomerSessionProvider } from "./contexts/CustomerSessionProvider";
import { TenantAuthProvider } from "./contexts/TenantAuthProvider";
import { GroupProvider } from "./contexts/GroupContext";
import { RulesProvider } from "./contexts/RulesContext";
import TenantAuthForm from "./components/form/TenantAuthForm";

export default function App() {
  return (
    <TenantAuthProvider>
      <CustomerSessionProvider>
        <Header />
        <TenantProtected
          fallback={
            <TenantAuthForm />
          }
        >
          <GroupProvider>
            <RulesProvider>
              <AutoFillRules />
              <CustomersSection />
            </RulesProvider>
          </GroupProvider>
        </TenantProtected>
      </CustomerSessionProvider>
    </TenantAuthProvider>
  );
}
