import { createContext, useCallback, useEffect, useState } from "react";

export const RulesContext = createContext({
  rules: [],
  setRules: () => { },
  deleteRule: () => { },
  loadRules: () => { },
  editingRule: null,
  setEditingRule: () => { },
  query: "",
  setQuery: () => { },
  editRule: (id, value) => { }
})

export function RulesProvider({ children }) {
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingRule, setEditingRule] = useState(null);
  const [query, setQuery] = useState("");

  const loadRules = async (query) => {
    try {
      const groupResults = await chrome.storage.local.get("groups");
      const result = await chrome.storage.local.get("rules");
      if (!result?.rules) {
        console.log("No rules found");
        return
      }

      // Create a map for quick lookup
      const groups = groupResults.groups || [];
      const groupMap = new Map(groups?.map(g => [g.id, g]));

      for (const rule of rules) {
        if (rule.group?.id && groupMap.has(rule.group.id)) {
          rule.group = groupMap.get(rule.group.id);
        }
      }

      if (query) {
        function searchTerm(r) {
          // check for type, selector, value
          return (
            (r.tagName && r.tagName.toLowerCase().includes(query.toLowerCase())) ||
            (r.group?.name && r.group?.name?.toLowerCase().includes(query.toLowerCase())) ||
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
    if (!id) {
      console.error("No id provided");
      return
    }
    const result = await chrome.storage.local.get("rules");
    const updated = (result.rules || []).filter((r) => r.id !== id);

    await chrome.storage.local.set({ rules: updated });
    setRules(updated);
  }, []);

  // Edit rule
  const editRule = useCallback(async (index, newValue) => {
    const updated = [...rules].map((rule, i) => {
      if (i === index) rule.value = newValue;
      return rule;
    });

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
      setQuery,
      editRule
    }}>
      {children}
    </RulesContext.Provider>
  )
}
