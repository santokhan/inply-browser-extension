import React, { createContext, useContext, useState } from "react";
import { twMerge } from "tailwind-merge";

const TabsContext = createContext();

export function Tabs({ defaultValue, value, onValueChange, children }) {
  const [internalValue, setInternalValue] = useState(defaultValue);

  const isControlled = value !== undefined;
  const activeValue = isControlled ? value : internalValue;

  const setValue = (val) => {
    if (!isControlled) setInternalValue(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ activeValue, setValue }}>
      {children}
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }) {
  return (
    <div
      className={twMerge(
        "flex border-b border-gray-200",
        className
      )}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ value, children, className = "" }) {
  const { activeValue, setValue } = useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <button
      onClick={() => setValue(value)}
      className={twMerge(
        "w-full px-3 py-1.5 text-sm transition-colors border-b-2 border-transparent font-medium",
        "text-gray-600 rounded-t-xl",
        isActive ? "bg-indigo-600 text-white" : "hover:text-black hover:bg-gray-200",
        className
      )}
    >
      {children}
    </button>
  );
}

export function TabsContent({ value, children }) {
  const { activeValue } = useContext(TabsContext);

  if (activeValue !== value) return null;

  return (
    children
  );
}