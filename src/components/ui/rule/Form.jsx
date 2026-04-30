import { useEffect, useState } from "react";
import SavedRules from "./Saved";
import { useRules } from "../../../hooks/useRules";

export default function RuleForm() {
    const [type, setType] = useState("name");
    const [selector, setSelector] = useState("");
    const [value, setValue] = useState("");
    const { rules, loadRules } = useRules()

    const handleAddRule = async (e) => {
        e.preventDefault();

        if (!selector || !value) return;

        const newRule = { id: Date.now(), type, selector, value };

        const result = await chrome.storage.local.get("rules");
        const updated = [...(result.rules || []), newRule];

        await chrome.storage.local.set({ rules: updated });
        loadRules();

        setSelector("");
        setValue("");
        setType("name");
    };

    return (
        <div className="w-80 p-4 bg-gray-50 space-y-4">

            {/* Header */}
            <div className="text-center">
                <h1 className="text-lg font-semibold text-gray-800">
                    Auto Fill Rules
                </h1>
                <p className="text-xs text-gray-500">
                    Create rules to automate form inputs
                </p>
            </div>

            {/* Form Card */}
            <form onSubmit={handleAddRule} className="bg-white p-3 rounded-xl shadow-sm space-y-2 border border-gray-100">

                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-2 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none"
                >
                    <option value="name">Name</option>
                    <option value="id">ID</option>
                    <option value="class">Class</option>
                </select>

                <input
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder="Selector (id / class / name)"
                    className="w-full px-2 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none"
                />

                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Value to fill"
                    className="w-full px-2 py-2 text-sm rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-400 outline-none"
                />

                <button
                    className="w-full py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
                >+ Add Rule</button>
            </form>

            {/* Rules List */}
            <SavedRules />
        </div>
    );
}