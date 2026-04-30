import { useState } from "react";
import Header from "./components/ui/header/Index";
import RuleForm from "./components/ui/rule/Form";
import { RulesProvider } from "./contexts/RulesContext";

export default function App() {
  const [value, setValue] = useState("");

  const handleSave = () => {
    chrome.storage.local.set({ autoFillValue: value });
  };

  const handleLoad = async () => {
    const data = await chrome.storage.local.get(["autoFillValue"]);
    setValue(data.autoFillValue || "");
  };

  return (
    <>
      <Header />
      <RulesProvider>
        <RuleForm />
      </RulesProvider>
    </>
  );
}