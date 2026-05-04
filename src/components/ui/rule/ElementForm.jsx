import { useState, useEffect } from "react";
import { useRules } from "../../../hooks/useRules";
import { parseFormElement } from "../../../utils/parser";
import { buildQuerySelector } from "../../../utils/querySelector";

export default function RuleElementForm({ onOpen = () => { }, groups = [] }) {
    const { loadRules, editingRule, setEditingRule } = useRules();

    const [groupId, setGroupId] = useState("");
    const [element, setElement] = useState("");
    const [value, setValue] = useState("");
    const [parsed, setParsed] = useState(null);

    // sync editing rule
    useEffect(() => {
        if (editingRule) {
            setValue(editingRule.value || "");
            return;
        }
        setValue("");
    }, [editingRule]);

    const resetForm = () => {
        setElement("");
        setParsed(null);
        setValue("");
        setEditingRule(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!value || !parsed) return;

        const result = await chrome.storage.local.get("rules");
        let updatedRules = result.rules || [];

        // Find out existing item for duplicate selector
        const duplicates = updatedRules?.filter((r) =>
            r.selector === parsed.selector && r.groupId === groupId // Should be in the same group
        )

        if (editingRule) {
            updatedRules = updatedRules.map((r) =>
                r.id === editingRule.id ? {
                    ...r, tagName: parsed.tagName,
                    type: parsed.type,
                    id: parsed.id,
                    name: parsed.name,
                    className: parsed.className,
                    onblur: parsed.onblur,
                    selector: parsed.selector,
                    domain: location.hostName,
                    value,
                    groupId: groupId
                } : r
            );
        } else {
            updatedRules.push({
                id: Date.now(),
                tagName: parsed.tagName,
                type: parsed.type,
                id: parsed.id,
                name: parsed.name,
                className: parsed.className,
                onblur: parsed.onblur,
                selector: parsed.selector,
                nth: duplicates.length,
                domain: location.hostName,
                value,
                groupId: groupId
            });
        }

        await chrome.storage.local.set({ rules: updatedRules });

        loadRules();
        resetForm();
    };

    return (
        <div className="px-3 py-2 space-y-4">
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
                {/* Element Input */}
                <textarea
                    value={element}
                    onChange={(e) => {
                        const val = e.target.value;
                        setElement(val);

                        if (val.trim()) {
                            const node = parseFormElement(val);
                            if (node) {
                                node.selector = buildQuerySelector(node);
                                setParsed(node);
                            }
                        }
                    }}
                    placeholder="Paste input / textarea / select element HTML"
                    className="default"
                    rows={3}
                    required
                />

                <div className="flex gap-2 items-center">
                    <select
                        value={groupId}
                        onChange={(e) => setGroupId(e.target.value)}
                        className="default"
                    >
                        <option value="">Select Group</option>
                        {Array.isArray(groups) && groups?.map((g) => (
                            <option key={g.id} value={g.id}>
                                {g.name}
                            </option>
                        ))}
                    </select>
                    <button type="button" className="default size-9 flex justify-center items-center" onClick={onOpen}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" className="size-4" fill="currentColor">
                            <path d="M256 80c0-17.7-14.3-32-32-32s-32 14.3-32 32l0 144L48 224c-17.7 0-32 14.3-32 32s14.3 32 32 32l144 0 0 144c0 17.7 14.3 32 32 32s32-14.3 32-32l0-144 144 0c17.7 0 32-14.3 32-32s-14.3-32-32-32l-144 0 0-144z" />
                        </svg>
                    </button>
                </div>

                {parsed && (
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="Value to autofill"
                        className="default"
                        rows={2}
                        required
                    />
                )}

                {/* Submit */}
                {parsed && (
                    <button className="w-full py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg">
                        {editingRule ? "Save Changes" : "+ Add Rule"}
                    </button>
                )}

                {/* Cancel */}
                {editingRule && (
                    <button
                        type="button"
                        onClick={resetForm}
                        className="secondary w-full"
                    >
                        Cancel Edit
                    </button>
                )}
            </form>
        </div>
    );
}