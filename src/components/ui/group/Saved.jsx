import { useState, useEffect } from "react";
import { useRules } from "../../../hooks/useRules";
import { useGroups } from "../../../hooks/useGroups";

function EditGroupForm({ initialValue, onCancel, onSave }) {
    const [value, setValue] = useState(initialValue);

    return (
        <form
            className="w-full flex items-center gap-2"
            onSubmit={(e) => {
                e.preventDefault();
                onSave(value);
            }}
        >
            <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                autoFocus
                required
                className="sm"
            />

            <button className="sm">Save</button>

            <button
                type="button"
                onClick={onCancel}
                className="text-xs px-2 py-1 bg-gray-100 rounded"
            >Cancel</button>
        </form>
    );
}

export default function SavedGroups() {
    const { groups, editGroup, deleteGroup } = useGroups();
    const { rules } = useRules();

    const [editingId, setEditingId] = useState(null);

    return (
        <div className="p-3 space-y-2">
            {groups.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">
                    No groups yet
                </div>
            )}

            {groups.map(group => (
                <div
                    key={group.id}
                    className="flex items-center gap-2 bg-white p-3 rounded-md shadow-sm"
                >
                    {editingId === group.id ? (
                        <EditGroupForm
                            initialValue={group.name}
                            onCancel={() => setEditingId(null)}
                            onSave={async (value) => {
                                await editGroup(group.id, value);
                                setEditingId(null);
                            }}
                        />
                    ) : (
                        <>
                            <span className="flex-1 text-sm font-medium px-1 truncate">
                                {group.name}
                            </span>

                            <button
                                onClick={() => setEditingId(group.id)}
                                className="text-xs px-2 py-1 bg-gray-100 rounded hover:bg-gray-200"
                            >Edit</button>
                        </>
                    )}

                    <button
                        onClick={() => {
                            if (rules?.some(r => r.groupId == group.id)) {
                                alert("Cannot delete group with rules");
                                return;
                            }
                            deleteGroup(group.id);
                        }}
                        className="text-xs px-2 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100"
                    >Delete</button>
                </div>
            ))}
        </div>
    );
}