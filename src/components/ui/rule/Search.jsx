import { useId } from "react";
import { useRules } from "../../../hooks/useRules";

export default function SearchForm() {
  const id = useId();
  const { query, setQuery } = useRules();

  const hasValue = Boolean(query);

  const handleClear = () => {
    setQuery("");
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor={id} className="sr-only">
        Search rules
      </label>

      <div className="relative flex-1">
        <span className="pointer-events-none absolute inset-y-0 left-1 flex items-center text-gray-400">
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="none"
            className="h-4 w-4"
          >
            <path
              d="M8.5 14.5a6 6 0 1 1 0-12 6 6 0 0 1 0 12Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <path
              d="m13 13 4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </span>

        <input
          id={id}
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search rules"
          className="w-full border-b border-gray-200 py-1 pl-6 pr-2 text-sm text-gray-800 outline-none transition"
        />
      </div>
    </div>
  );
}
