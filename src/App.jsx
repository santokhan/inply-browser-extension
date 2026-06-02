import { Protected } from "./components/shared/Protected";
import FormTokenLogin from "./components/form/TokenLogin";
import Header from "./components/ui/header/Index";
import AutoFillRules from "./components/ui/rule";
import { AuthProvider } from "./contexts/AuthProvider";
import { GroupProvider } from "./contexts/GroupContext";
import { RulesProvider } from "./contexts/RulesContext";
import FormAuth from "./components/form/auth";

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Protected
        fallback={
          <FormAuth />
        }
      >
        <GroupProvider>
          <RulesProvider>
            <AutoFillRules />
          </RulesProvider>
        </GroupProvider>
      </Protected>
    </AuthProvider>
  );
}
