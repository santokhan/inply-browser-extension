import { RulesProvider } from "../../../contexts/RulesContext";
import RuleForm from "./Form";
import SavedRules from "./Saved";

export default function AutoFillRules() {
  return (
    <RulesProvider>
      <RuleForm />
      <SavedRules />
    </RulesProvider>
  )
}
