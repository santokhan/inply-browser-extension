import { useContext } from "react";
import { RulesContext } from "../contexts/RulesContext";
import { GroupContext } from "../contexts/GroupContext";

export function useGroups() {
  const context = useContext(GroupContext);

  if (!context) throw new Error("useRules must be used within a RulesProvider");

  return context;
}
