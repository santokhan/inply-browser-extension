import { Protected } from "./components/shared/Protected";
import Header from "./components/ui/header/Index";
import AutoFillRules from "./components/ui/rule";
import { AuthProvider } from "./contexts/AuthProvider";
import { GroupProvider } from "./contexts/GroupContext";
import { RulesProvider } from "./contexts/RulesContext";

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Protected>
        <GroupProvider>
          <RulesProvider>
            <AutoFillRules />
          </RulesProvider>
        </GroupProvider>
      </Protected>
    </AuthProvider>
  );
}
