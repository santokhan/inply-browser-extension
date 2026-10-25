import { useEffect, useState } from "react";

export default function ParsedFieldInput({ field, index, tabId, value, onValueChange }) {
    const [inputValue, setInputValue] = useState(value ?? "");

    useEffect(() => setInputValue(value ?? ""), [value]);

    const sendFieldFocus = async (focused) => {
        if (!tabId) return;
        try {
            await chrome.tabs.sendMessage(tabId, {
                action: "highlightParsedField",
                fieldKey: field.fieldKey,
                focused,
            });
        } catch (error) {
            console.warn("Could not highlight the parsed page field:", error);
        }
    };

    const handleChange = async (event) => {
        const nextValue = event.target.value;
        setInputValue(nextValue);
        onValueChange(index, nextValue);

        try {
            if (tabId) {
                const response = await chrome.tabs.sendMessage(tabId, {
                    action: "setParsedFieldValue",
                    fieldKey: field.fieldKey,
                    value: nextValue,
                });
                if (!response?.ok) {
                    console.warn("The parsed page field could not be found.", { index, field });
                }
            }
        } catch (error) {
            console.warn("Could not send the value to the parsed page tab:", error);
        }
    };

    return (
        <div className="text-xs">
            <label className="mb-1 block text-gray-600">
                {field.name || field.id || `${field.tagName} ${index + 1}`}
            </label>
            <input
                type="text"
                value={inputValue}
                onChange={handleChange}
                onFocus={() => sendFieldFocus(true)}
                onBlur={() => sendFieldFocus(false)}
                className="default"
            />
        </div>
    );
}
