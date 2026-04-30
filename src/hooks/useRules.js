import { useContext } from "react";
import { RulesContext } from "../contexts/RulesContext";

export function useRules() {
  const context = useContext(RulesContext);

  if (!context) throw new Error("useRules must be used within a RulesProvider");

  return context;
}
