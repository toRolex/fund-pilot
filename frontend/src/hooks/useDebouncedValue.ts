import { useEffect, useState } from "react";

/**
 * Returns `value` after it has remained stable for `delayMs` milliseconds.
 * ponytail: shared debounce primitive, used by GlobalSearch and Watchlists add-search.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(t);
  }, [value, delayMs]);
  return debounced;
}
