import { useState, useCallback } from "react";

export function usePersistedState(key, defaultValue) {
  const [value, setValue] = useState(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored === null) return defaultValue;
      try {
        return JSON.parse(stored);
      } catch {
        return stored;
      }
    } catch {
      return defaultValue;
    }
  });

  const setPersistedValue = useCallback(
    (newValue) => {
      setValue(newValue);
      try {
        localStorage.setItem(key, JSON.stringify(newValue));
      } catch (e) {
        console.error("Failed to persist state:", e);
      }
    },
    [key]
  );

  const removePersistedValue = useCallback(() => {
    setValue(defaultValue);
    localStorage.removeItem(key);
  }, [key, defaultValue]);

  return [value, setPersistedValue, removePersistedValue];
}
