import AppProviders from "./app/AppProviders";
import ExtensionWorkspace from "./app/ExtensionWorkspace";

export default function App() {
  return (
    <AppProviders>
      <ExtensionWorkspace />
    </AppProviders>
  );
}
