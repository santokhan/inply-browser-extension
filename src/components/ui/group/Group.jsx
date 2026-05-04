import { useState, useEffect } from "react";
import { useGroups } from "../../../hooks/useGroups";

export default function RuleGroupForm({ onClose = () => { }}) {
    const [name, setName] = useState("");
    const { loadGroups } = useGroups();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        const result = await chrome.storage.local.get("groups");
        let updatedGroups = result.groups || [];

        updatedGroups.push({ id: Date.now(), name });

        await chrome.storage.local.set({ groups: updatedGroups });
        
        setName("");
        onClose();
        loadGroups();
    };

    return (
        <form
            onSubmit={handleSubmit}
            className="bg-white p-3 rounded-xl shadow-sm space-y-2 border border-gray-100 mx-3 my-2"
        >
            <input
                name="group"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="New Group Name (Ex: EGP Tenderer Info)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
                autoFocus
                required
            />

            <div className="flex items-center gap-2 mt-1">
                <button className="w-full default">
                    Add Group
                </button>
            </div>
        </form>
    );
}