import { useState, useEffect } from "react";

function useLocalStorage<T>(
  key: string,
  initialValue: T
): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(initialValue);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item !== null) {
        setStoredValue(JSON.parse(item));
      }
    } catch (error) {
      console.error("useLocalStorage initialization error:", error);
    } finally {
      setIsMounted(true);
    }
  }, [key]);

  useEffect(() => {
    if (!isMounted) return;

    try {
      const serialized = JSON.stringify(storedValue);
      window.localStorage.setItem(key, serialized);
    } catch (error: any) {
      if (
        error.name === "QuotaExceededError" ||
        error.name === "NS_ERROR_DOM_QUOTA_REACHED"
      ) {
        console.error(`Quota exceeded when setting ${key} in localStorage.`);
      } else {
        console.error("useLocalStorage update error:", error);
      }
    }
  }, [key, storedValue, isMounted]);

  return [storedValue, setStoredValue];
}

export default useLocalStorage;
