import { useEffect, useState } from "react";
import { useRules } from "../../../hooks/useRules";

export function Rule({ rule, onApply, onEdit, onDelete }) {
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
                        onClick={() => onApply(rule)}
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
    const { rules, deleteRule } = useRules();

    return (
        <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700">
                Saved Rules
            </h2>

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
                />
            ))}
        </div>
    );
}