import { useState, useEffect } from "react";
import { useRules } from "../../../hooks/useRules";

export default function RuleForm() {
    const { loadRules, editingRule, setEditingRule } = useRules();

    const [type, setType] = useState("name");
    const [selector, setSelector] = useState("");
    const [value, setValue] = useState("");

    // sync external editingRule → form state
    useEffect(() => {
        if (editingRule) {
            setType(editingRule.type || "name");
            setSelector(editingRule.selector || "");
            setValue(editingRule.value || "");
        }
    }, [editingRule]);

    const resetForm = () => {
        setType("name");
        setSelector("");
        setValue("");
        setEditingRule(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selector || !value) return;

        const result = await chrome.storage.local.get("rules");
        let updatedRules = result.rules || [];

        if (editingRule) {
            updatedRules = updatedRules.map((r) =>
                r.id === editingRule.id
                    ? { ...r, type, selector, value }
                    : r
            );
        } else {
            updatedRules.push({
                id: Date.now(),
                type,
                selector,
                value,
            });
        }

        await chrome.storage.local.set({ rules: updatedRules });
        loadRules();
        resetForm();
    };

    return (
        <div className="w-80 px-3 py-2 space-y-4">

            <div className="text-center">
                <h1 className="text-lg font-semibold text-gray-800">
                    Auto Fill Rules
                </h1>
                <p className="text-xs text-gray-500">
                    Create and manage automation rules
                </p>
            </div>

            <form
                onSubmit={handleSubmit}
                className="bg-white p-3 rounded-xl shadow-sm space-y-2 border border-gray-100"
            >
                <select
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
                >
                    <option value="name">Name</option>
                    <option value="id">ID</option>
                    <option value="class">Class</option>
                </select>

                <input
                    value={selector}
                    onChange={(e) => setSelector(e.target.value)}
                    placeholder="Selector"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
                />

                <input
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    placeholder="Value"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200"
                />

                <button className="w-full py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                    {editingRule ? "Save Changes" : "+ Add Rule"}
                </button>

                {editingRule && (
                    <button
                        type="button"
                        onClick={resetForm}
                        className="w-full py-2 text-sm text-gray-600 hover:text-gray-800"
                    >
                        Cancel Edit
                    </button>
                )}
            </form>
        </div>
    );
}