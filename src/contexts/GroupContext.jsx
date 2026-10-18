import { createContext, useCallback, useEffect, useState } from "react";

export const GroupContext = createContext({
  groups: [],
  setGroups: () => { },
  loadGroups: () => { },
  addGroup: () => { },
  editGroup: () => { },
  deleteGroup: () => { },
  moveGroup: () => { },
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

  const moveGroup = useCallback(async (id, direction) => {
    if (!id || !["up", "down"].includes(direction)) return false;
    const result = await chrome.storage.local.get("groups");
    const updated = [...(result.groups || [])];
    const currentIndex = updated.findIndex((group) => group.id === id);
    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (currentIndex < 0 || nextIndex < 0 || nextIndex >= updated.length) return false;
    [updated[currentIndex], updated[nextIndex]] = [updated[nextIndex], updated[currentIndex]];
    await chrome.storage.local.set({ groups: updated });
    setGroups(updated);
    return true;
  }, []);

  return (
    <GroupContext.Provider
      value={{
        groups,
        setGroups,
        loadGroups,
        addGroup,
        editGroup,
        deleteGroup,
        moveGroup,
        loading,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}
