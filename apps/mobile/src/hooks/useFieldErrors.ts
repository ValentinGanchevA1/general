import { useCallback, useState } from 'react';

/** Generic field-error bag, extracted from AuthScreen's inline pattern. */
export function useFieldErrors<K extends string>() {
  const [errors, setErrors] = useState<Partial<Record<K, string>>>({{}});

  const clear = useCallback((key: K) => {
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const clearAll = useCallback(() => setErrors({}), []);

  return { errors, setErrors, clear, clearAll } as const;
}
