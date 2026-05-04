import { createContext, useCallback, useEffect, useState } from "react";

export const GroupContext = createContext({
  groups: [],
  setGroups: () => { },
  loadGroups: () => { },
  addGroup: () => { },
  editGroup: () => { },
  deleteGroup: () => { },
  loading: false,
});

export function GroupProvider({ children }) {
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);

  // Load groups
  const loadGroups = useCallback(async () => {
    const result = await chrome.storage.local.get("groups");
    setGroups(result.groups || []);
    setLoading(false);
  }, []);

  useEffect(() => { loadGroups(); }, [loadGroups]);

  // Add group (no duplicate check)
  const addGroup = useCallback(async (name) => {
    const newGroup = {
      id: crypto.randomUUID(),
      name,
    };

    const updated = [...groups, newGroup];

    await chrome.storage.local.set({ groups: updated });
    setGroups(updated);
  }, [groups]);

  // Edit group
  const editGroup = useCallback(async (id, name) => {
    const updated = groups.map((g) =>
      g.id === id ? { ...g, name } : g
    );

    await chrome.storage.local.set({ groups: updated });
    setGroups(updated);
  }, [groups]);

  // Delete group
  const deleteGroup = useCallback(async (id) => {
    const updated = groups.filter((g) => g.id !== id);

    const rules = await chrome.storage.local.get("rules");
    const hasRules = rules.rules?.some((r) => r.group?.id === id);
    if (hasRules) {
      alert("Cannot delete group with rules");
      return
    }
    await chrome.storage.local.set({ groups: updated });
    setGroups(updated);
  }, [groups]);

  return (
    <GroupContext.Provider
      value={{
        groups,
        setGroups,
        loadGroups,
        addGroup,
        editGroup,
        deleteGroup,
        loading,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}