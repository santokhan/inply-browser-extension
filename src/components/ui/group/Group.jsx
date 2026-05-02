import { useState, useEffect } from "react";

export default function RuleGroupForm({ onClose = () => { }, loadGroups = () => { } }) {
    const [name, setName] = useState("");

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
            <label htmlFor="group" className="inline-block mb-1 text-sm font-medium">
                Group Name <span className="text-gray-500">(Ex: EGP Tenderer Info)</span>
            </label>
            <input
                name="group"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter selector (name, id, or class)"
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
            />

            <div className="flex items-center gap-2 mt-1">
                <button type="button" className="w-full secondary" onClick={onClose}>
                    Cancel
                </button>
                <button className="w-full default">
                    Add Group
                </button>
            </div>
        </form>
    );
}