import { useState, useEffect } from "react";
import { useRules } from "../../../hooks/useRules";
import { ScanSearch, CheckCircle2 } from "lucide-react";
import { getActiveTabSafe } from "../../../utils/chrome";
import { toast } from "react-toastify";
import ParsedFieldInput from "./ParsedFieldInput";
import { useGroups } from "../../../hooks/useGroups";

function Parse({ onParse = (inputFields) => { } }) {

    const handleParse = async () => {
        const tab = await getActiveTabSafe();
        if (!tab?.id) {
            toast.info("Open the tender preparation page before using Decrypt.");
            return;
        }

        // Call function from content.js or parser.js and get elements
        const elements = await chrome.tabs.sendMessage(tab.id, { action: "parse" });

        onParse(Array.isArray(elements) ? elements : [], tab.id);
    };

    return (
        <button
            type="button"
            onClick={handleParse}
            className="default w-full flex items-center justify-center gap-2"
        >
            <ScanSearch size={17} className="transition-transform group-hover:scale-110" />
            Parse element
        </button>
    )
}

export default function FormParser() {
    const { loadRules, editingRule } = useRules();
    const { groups } = useGroups();

    const [groupId, setGroupId] = useState("");
    const [fieldValues, setFieldValues] = useState([]);
    const [inputFields, setInputFields] = useState(null);
    const [parsedTabId, setParsedTabId] = useState(null);

    const handleParse = (fields, tabId) => {
        setInputFields(fields);
        setParsedTabId(tabId);
    };

    // sync editing rule
    useEffect(() => {
        if (editingRule) {
            setFieldValues([editingRule.value || ""]);
            return;
        }
        setFieldValues([]);
    }, [editingRule]);

    const resetForm = () => {
        setInputFields(null);
        setParsedTabId(null);
        setFieldValues([]);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!inputFields?.length) return;

        const result = await chrome.storage.local.get("rules");
        let updatedRules = result.rules || [];

        inputFields.forEach((field, index) => {
            const fieldValue = fieldValues[index] ?? "";
            if (!fieldValue) return;
            const duplicates = updatedRules.filter((rule) =>
                rule.selector === field.selector && rule.groupId === groupId
            );
            updatedRules.push({
                id: Date.now() + index,
                tagName: field.tagName,
                type: field.type,
                name: field.name,
                className: field.className,
                onblur: field.onblur,
                selector: field.selector,
                nth: field.nth ?? duplicates.length,
                domain: location.hostname,
                value: fieldValue,
                groupId,
            });
        });

        await chrome.storage.local.set({ rules: updatedRules });

        loadRules();
        resetForm();
    };

    return (
        <div className="px-3 py-4">
            {inputFields ? (
                <form onSubmit={handleSubmit} className="space-y-3 border-indigo-100 p-4 rounded-2xl border mt-4 bg-white">
                    <select
                        value={groupId}
                        onChange={(event) => setGroupId(event.target.value)}
                        className="default"
                    >
                        <option value="">Select Group</option>
                        {Array.isArray(groups) && groups.map((group) => (
                            <option key={group.id} value={group.id}>{group.name}</option>
                        ))}
                    </select>
                    {inputFields.map((field, index) => (
                        <ParsedFieldInput
                            key={`${field.id || field.name || field.tagName}-${index}`}
                            field={field}
                            index={index}
                            tabId={parsedTabId}
                            value={fieldValues[index] ?? ""}
                            onValueChange={(fieldIndex, nextValue) => {
                                setFieldValues((current) => {
                                    const next = [...current];
                                    next[fieldIndex] = nextValue;
                                    return next;
                                });
                            }}
                        />
                    ))}

                    <div className="flex gap-3 items-center">
                        {/* cancel and submit button */}
                        <button
                            type="button"
                            onClick={resetForm}
                            className="secondary w-full"
                        >
                            Cancel
                        </button>
                        <button type="submit" className="default w-full">Save</button>
                    </div>
                </form>
            ) : (
                <>
                    <div className="px-3 py-3 text-center">
                        <h2 className="text-lg font-semibold text-gray-800">Parse a form element</h2>
                    </div>
                    <Parse onParse={handleParse} />
                </>
            )}
        </div>
    );
}
