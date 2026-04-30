import { createContext, useCallback, useEffect, useState } from "react";

export const RulesContext = createContext({
  rules: [],
  setRules: () => { },
  deleteRule: () => { },
  loadRules: () => { },
  editingRule: null,
  setEditingRule: () => { },
  query: "",
  setQuery: () => { }
})

export function RulesProvider({ children }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [query, setQuery] = useState("");

  const loadRules = async (query) => {
    try {
      const result = await chrome.storage.local.get("rules");
      if (!result?.rules) {
        console.log("No rules found");
        return
      }
      if (query) {
        function searchTerm(r) {
          // check for type, selector, value
          return (
            (r.type && r.type.toLowerCase().includes(query.toLowerCase())) ||
            (r.selector && r.selector.toLowerCase().includes(query.toLowerCase())) ||
            (r.value && r.value.toLowerCase().includes(query.toLowerCase()))
          );
        }
        setRules((result.rules || []).filter(searchTerm));
      } else {
        setRules(result.rules || []);
      }
    } catch (error) {
      console.error(error);
    }
  };

  // Load rules
  useEffect(() => { loadRules(query); }, [query]);

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
      query,
      setQuery
    }}>
      {children}
    </RulesContext.Provider>
  )
}
