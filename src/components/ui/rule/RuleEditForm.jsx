import React, { useState } from "react";

export default function RuleEditForm({ ruleValue, onSubmit }) {
  const [value, setValue] = useState(ruleValue);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(value);
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