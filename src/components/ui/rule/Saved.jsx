import { useState } from "react";
import { useRules } from "../../../hooks/useRules";
import SearchForm from "./Search";
import { getActiveTabSafe } from "../../../utils/chrome";

export function Rule({ rule, onApply = () => { }, onEdit = () => { }, onDelete = () => { }, index }) {
    async function onMouseEnter(e) {
        e.target.style.outline = "2px solid blue";
        const tab = await getActiveTabSafe();
        if (tab?.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: "startInspect", rule });
                return true;
            } catch (error) {
                console.warn(error);
                return false;
            }
        }
    }

    async function onMouseLeave(e) {
        e.target.style.outline = "none";
        const tab = await getActiveTabSafe();
        if (tab?.id) {
            try {
                await chrome.tabs.sendMessage(tab.id, { action: "stopInspect", rule });
                return true;
            } catch (error) {
                console.warn(error);
                return false;
            }
        }
    }

    if (!rule) return null

    const [applying, setApplying] = useState(false);

    return (
        <div
            className="relative p-px rounded-xl linear-to-r from-indigo-200 via-purple-200 to-indigo-100"
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
        >
            <div className="bg-white rounded-xl p-3 shadow-sm hover:shadow-md transition-all duration-200">

                {/* Line 1: Type + Selector */}
                <div className="flex items-center gap-2 text-sm mb-2">
                    <span className="text-sm tracking-wide text-gray-400">
                        <span className="uppercase">{rule?.tagName}</span> name="{rule?.name}"
                    </span>
                </div>

                {/* Line 2: Value + Actions */}
                <div className="flex items-center gap-2">
                    <span className="flex-1 text-sm text-indigo-600 font-medium truncate bg-indigo-50 px-2 py-1 rounded-md">
                        {rule?.value}
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
                        Apply{applying && "..."}
                    </button>

                    <button
                        onClick={() => onDelete(rule?.id)}
                        className="text-xs px-2 py-1 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                    >
                        Delete
                    </button>
                </div>
            </div>
        </div>
    );
}

function Accordion({ children, applyRules = (id) => { }, group }) {
    const [applying, setApplying] = useState(false);

    return (
        <details className="border-l border-gray-200 mx-3">
            <summary className="font-semibold text-gray-800 text-sm py-2 hover:bg-gray-100 px-3">
                <span className="truncate">{group?.name}</span>
                <button type="button" className="sm ml-1" onClick={async () => {
                    setApplying(true);
                    await applyRules();
                    setApplying(false);
                }}>Apply</button>
            </summary>
            <div className="space-y-2 ml-2">
                {children}
            </div>
        </details>
    );
}

export default function SavedRules({ groups = [] }) {
    const { rules, deleteRule, setEditingRule } = useRules();
    const [applyingAll, setApplyingAll] = useState(false);

    function applyRuleInPage(rule) {
        const element = Number(rule?.nth)
            ? document.querySelectorAll(rule?.selector)[rule?.nth]
            : document.querySelector(rule?.selector);

        if (!element) return;

        const setNativeValue = (el, value) => {
            const tag = el.tagName;

            if (tag === "input") {
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

            if (tag === "textarea") {
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

            if (tag === "select") {
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

        if (element) {
            setNativeValue(element, rule?.value);
            element.dispatchEvent(new Event("input", { bubbles: true }));
            element.dispatchEvent(new Event("change", { bubbles: true }));
        }
    }

    function sendRuleToTab(tabId, rule) {
        return new Promise((resolve) => {
            console.log("Applying rule in tab:", { tabId, rule });
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

    async function onApplyRules(rules) {
        await Promise.all(rules.map((rule) => applyRule(rule))).then((promises) => {
            console.log(promises);
        }).catch((error) => { console.error(error) }).finally(() => {
            setApplyingAll(false);
        })
    }

    let grouped = {}
    let common = []
    for (const rule of rules) {
        if (rule?.groupId) {
            if (!grouped[rule.groupId]) {
                grouped[rule.groupId] = []
            }
            grouped[rule.groupId].push(rule)
        } else {
            common.push(rule)
        }
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4 px-3 py-2">
                <SearchForm />
                <button
                    onClick={async () => {
                        setApplyingAll(true);
                        await onApplyRules(rules)
                        setApplyingAll(false);
                    }}
                    className="sm"
                >
                    Apply All {applyingAll && "..."}
                </button>
            </div>

            {rules.length === 0 && (
                <div className="text-xs text-gray-400 text-center py-4 mt-2">
                    No rules yet
                </div>
            )}

            {Object.entries(grouped)?.map(([groupId, rules], index) => {
                const group = groups?.find((g) => g?.id == groupId);
                return (
                    <Accordion key={index} applyRules={() => { onApplyRules(rules) }} group={group}>
                        {rules?.map((rule, index) => (
                            <Rule
                                key={rule.id + "_" + index}
                                rule={rule}
                                onDelete={deleteRule}
                                onEdit={function () {
                                    setEditingRule(rule);
                                    window.scrollTo({ top: 0, behavior: "smooth" });
                                }}
                                onApply={applyRule}
                                applying={applyingAll}
                                index={index}
                            />
                        ))}
                    </Accordion>
                )
            })}

            <div className="px-3">
                {common?.map((rule, index) => (
                    <Rule
                        key={rule.id + "_" + index}
                        rule={rule}
                        onDelete={deleteRule}
                        onEdit={function () {
                            setEditingRule(rule);
                            window.scrollTo({ top: 0, behavior: "smooth" });
                        }}
                        onApply={applyRule}
                        applying={applyingAll}
                        index={index}
                    />
                ))}
            </div>
        </>
    );
}
