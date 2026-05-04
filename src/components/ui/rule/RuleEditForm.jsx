import React, { useEffect, useState } from "react";

export default function RuleEditForm({ ruleValue, onSubmit = (value) => { } }) {
  const [value, setValue] = useState("");

  useEffect(() => { setValue(ruleValue || ""); }, [ruleValue]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (value) {
          onSubmit(value);
        } else {
          console.error("no value");
        }
      }}
      className="flex items-center gap-2"
    >
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="Enter value..."
        className="sm"
        required
      />

      <button className="sm">
        Save
      </button>
    </form>
  );
}