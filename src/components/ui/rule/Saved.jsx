import { useState } from "react";
import { useRules } from "../../../hooks/useRules";
import SearchForm from "./Search";

export function getElementsForRule(rule) {
    if (!rule || !rule.selector) return [];

    if (rule.type === "name") {
        return document?.querySelectorAll(`[name="${CSS.escape(rule.selector)}"]`);
    }

    if (rule.type === "id") {
        return document?.querySelectorAll(`#${CSS.escape(rule.selector)}`);
    }

    if (rule.type === "class") {
        return document?.querySelectorAll(`.${CSS.escape(rule.selector)}`);
    }

    return document?.querySelectorAll(rule.selector);
}

export function Rule({ rule, onApply, onEdit, onDelete }) {
    const [applying, setApplying] = useState(false);

    return (
        <div className="relative p-px rounded-xl linear-to-r from-indigo-200 via-purple-200 to-indigo-100">
            <div className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200">

                {/* Line 1: Type + Selector */}
                <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-[10px] uppercase tracking-wide text-gray-400">
                        {rule.type}
                    </span>

                    <span className="text-gray-800 font-medium truncate">
                        {rule.selector}
                    </span>
                </div>

                {/* Line 2: Value + Actions */}
                <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-indigo-600 font-medium truncate bg-indigo-50 px-2 py-1 rounded-md">
                        {rule.value}
                    </span>
                </div>

                {/* Line 2: Value + Actions */}
                <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                        onClick={async () => {
                            setApplying(true);
                            await onApply(rule);
                            setApplying(false);
                        }}
                        className="text-xs px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
                    >
                        Apply
                    </button>

                    <button
                        onClick={() => onEdit(rule)}
                        className="text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200"
                    >
                        Edit
                    </button>

                    <button
                        onClick={() => onDelete(rule.id)}
                        className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

export default function SavedRules() {
    const { rules, deleteRule, setEditingRule } = useRules();
    const [applyingAll, setApplyingAll] = useState(false);

    function applyRuleInPage(rule) {
        const elements = getElementsForRule(rule);
        if (!elements || elements.length === 0) return;

        const setNativeValue = (el, value) => {
            const tag = el.tagName;

            if (tag === "INPUT") {
                const inputType = el.type?.toLowerCase();

                if (inputType === "checkbox" || inputType === "radio") {
                    const normalized = String(value ?? "").toLowerCase();
                    el.checked =
                        normalized === "true" ||
                        normalized === "1" ||
                        normalized === "checked" ||
                        normalized === "on";
                    return;
                }

                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLInputElement.prototype,
                    "value"
                )?.set;

                if (setter) {
                    setter.call(el, value);
                } else {
                    el.value = value;
                }
                return;
            }

            if (tag === "TEXTAREA") {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLTextAreaElement.prototype,
                    "value"
                )?.set;

                if (setter) {
                    setter.call(el, value);
                } else {
                    el.value = value;
                }
                return;
            }

            if (tag === "SELECT") {
                const setter = Object.getOwnPropertyDescriptor(
                    window.HTMLSelectElement.prototype,
                    "value"
                )?.set;

                if (setter) {
                    setter.call(el, value);
                } else {
                    el.value = value;
                }
            }
        };

        elements.forEach((el) => {
            setNativeValue(el, rule.value);
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
        });
    }

    function sendRuleToTab(tabId, rule) {
        return new Promise((resolve) => {
            chrome.tabs.sendMessage(tabId, { action: "applyRule", rule })
                .then(() => {
                    resolve(true);
                })
                .catch(async () => {
                    // fallback only when message fails

                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId },
                            func: applyRuleInPage,
                            args: [rule],
                        });

                        resolve(true);
                    } catch (err) {
                        console.warn("Failed to apply rule:", err?.message || err);
                        resolve(false);
                    }
                });
        });
    }

    async function applyRule(rule) {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        const tab = tabs?.[0];

        if (!tab?.id) {
            console.warn("No active tab available to apply rule:", rule);
            return false;
        }

        if (
            typeof tab.url === "string" &&
            /^(chrome|edge|brave|opera|moz)-extension:|^chrome:|^edge:|^about:|^view-source:/i.test(tab.url)
        ) {
            console.warn("Cannot apply rules on this page:", tab.url);
            return false;
        }

        return sendRuleToTab(tab.id, rule);
    }

    async function onApplyAll(rules) {
        setApplyingAll(true);
        await Promise.all(rules.map((rule) => applyRule(rule))).then((promises) => {
            console.log(promises);
        }).catch((error) => { console.error(error) }).finally(() => {
            setApplyingAll(false);
        })
    }

    return (
        <div className="space-y-2 px-3 py-2">
            <div className="flex items-center justify-between gap-4">
                <h2 className="text-sm font-semibold text-gray-700 shrink-0">
                    Saved Rules
                </h2>
                <div className="grow">
                    <SearchForm />
                </div>
                <button
                    onClick={() => onApplyAll(rules)}
                    className="text-xs px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 shrink-0"
                >
                    Apply All {applyingAll && "..."}
                </button>
            </div>

            {rules.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4">
                    No rules yet
                </div>
            )}

            {rules.map((rule) => (
                <Rule
                    key={rule.id}
                    rule={rule}
                    onDelete={deleteRule}
                    onEdit={function () {
                        setEditingRule(rule);
                        window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                    onApply={applyRule}
                    applying={applyingAll}
                />
            ))}
        </div>
    );
}
