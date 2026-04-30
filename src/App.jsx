import { Protected } from "./components/shared/Protected";
import Header from "./components/ui/header/Index";
import AutoFillRules from "./components/ui/rule";
import { AuthProvider } from "./contexts/AuthProvider";

export default function App() {
  return (
    <AuthProvider>
      <Header />
      <Protected>
        <AutoFillRules />
      </Protected>
    </AuthProvider>
  );
}
