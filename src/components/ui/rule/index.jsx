import { useState } from "react";
import { RulesProvider } from "../../../contexts/RulesContext";
import RuleForm from "./Form";
import SavedRules from "./Saved";

export default function AutoFillRules() {
  const [editingRule, setEditingRule] = useState(null);

  return (
    <RulesProvider>
      <RuleForm />
      <SavedRules />
    </RulesProvider>
  )
}