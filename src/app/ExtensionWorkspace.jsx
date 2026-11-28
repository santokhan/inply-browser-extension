import { TenantProtected } from "../components/shared/TenantProtected";
import TenantAuthForm from "../components/form/TenantAuthForm";
import Header from "../components/ui/header/Index";
import AutoFillRules from "../components/ui/rule";
import CustomersSection from "../components/ui/profile/CustomersSection";
import { GroupProvider } from "../contexts/GroupContext";
import { RulesProvider } from "../contexts/RulesContext";

function AuthenticatedWorkspace() {
  return (
    <GroupProvider>
      <RulesProvider>
        <main>
          <AutoFillRules />
          <CustomersSection />
        </main>
      </RulesProvider>
    </GroupProvider>
  );
}

/** Top-level extension layout and authenticated workspace boundary. */
export default function ExtensionWorkspace() {
  return (
    <>
      <Header />
      <TenantProtected fallback={<TenantAuthForm />}>
        <AuthenticatedWorkspace />
      </TenantProtected>
    </>
  );
}
