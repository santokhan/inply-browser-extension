import { useState, useEffect } from "react";
import { useRules } from "../../../hooks/useRules";

export default function SavedGroups() {
    const [groups, setGroups] = useState([]);
    const [editingId, setEditingId] = useState(null);
    const [name, setName] = useState("");
    const { rules } = useRules();

    useEffect(() => {
        chrome.storage.local.get("groups").then(({ groups = [] }) => {
            setGroups(groups);
        });
    }, []);

    async function renameGroup(id) {
        const updated = groups.map(g =>
            g.id === id ? { ...g, name } : g
        );

        setGroups(updated);
        await chrome.storage.local.set({ groups: updated });

        setEditingId(null);
        setName("");
    }

    async function deleteGroup(groupId) {
        const updated = groups.filter(g => g.id !== groupId);

        if (rules?.find(r => r.groupId == groupId)) {
            alert("Cannot delete group with rules")
            return
        }

        setGroups(updated);
        await chrome.storage.local.set({ groups: updated });
    }

    return (
        <div className="p-3 space-y-2">
            {groups?.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">
                    No groups yet
                </div>
            )}

            {groups?.map(group => (
                <div
                    key={group.id}
                    className="flex items-center gap-1 bg-white p-3 rounded-md shadow-sm"
                >
                    {editingId === group.id ? (
                        <>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="flex-1 text-sm border px-2 py-1 rounded"
                                autoFocus
                            />

                            <button
                                onClick={() => renameGroup(group.id)}
                                className="text-xs px-2 py-1 bg-indigo-600 text-white rounded"
                            >
                                Save
                            </button>
                        </>
                    ) : (
                        <>
                            <span className="flex-1 text-sm font-medium px-1">
                                {group.name}
                            </span>

                            <button
                                onClick={() => {
                                    setEditingId(group.id);
                                    setName(group.name);
                                }}
                                className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                            >
                                Edit
                            </button>
                        </>
                    )}

                    <button
                        onClick={() => deleteGroup(group.id)}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >
                        Delete
                    </button>
                </div>
            ))}
        </div>
    );
}