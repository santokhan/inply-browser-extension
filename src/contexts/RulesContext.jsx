import { createContext, useCallback, useEffect, useState } from "react";

export const RulesContext = createContext(null)

export function RulesProvider({ children }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);

  const loadRules = async () => {
    try {
      const result = await chrome.storage.local.get("rules");
      setRules(result.rules || []);
    } catch (error) {
      console.error(error);
    }
  };

  // Load rules
  useEffect(() => { loadRules(); }, []);

  // Delete rule
  const deleteRule = useCallback(async (id) => {
    const result = await chrome.storage.local.get("rules");
    const updated = (result.rules || []).filter((r) => r.id !== id);

    await chrome.storage.local.set({ rules: updated });
    setRules(updated);
  }, []);

  return (
    <RulesContext.Provider value={{
      rules,
      setRules,
      deleteRule,
      loadRules,
      editingRule,
      setEditingRule,
    }}>
      {children}
    </RulesContext.Provider>
  )
}
