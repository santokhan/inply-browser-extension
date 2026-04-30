export default function RuleForm() {
    return (
        <div className="p-4 space-y-3">
            {/* Select */}
            <select
                id="type"
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            >
                <option value="name">Name</option>
                <option value="id">ID</option>
                <option value="class">Class</option>
            </select>

            {/* Inputs */}
            <input
                id="selector"
                placeholder="Field name / id / class"
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />

            <input
                id="value"
                placeholder="Value to set"
                className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400"
            />

            {/* Buttons */}
            <div className="flex gap-2">
                <button
                    id="add"
                    className="flex-1 bg-primary-600 hover:bg-primary-700 text-white text-xs py-1.5 rounded-md transition"
                >
                    Add Rule
                </button>

                <button
                    id="applyAll"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-xs py-1.5 rounded-md transition"
                >
                    Apply All
                </button>
            </div>

            {/* Rules */}
            <div>
                <h3 className="text-sm font-medium text-gray-700 mb-1">
                    Saved Rules
                </h3>

                <div className="space-y-1">
                    {/* rules will render here later */}
                </div>
            </div>
        </div>
    );
}